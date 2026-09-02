import type { Session } from "@supabase/supabase-js";
import * as Network from "expo-network";
import { useRouter } from "expo-router";
import {
  AppState,
  Platform,
  type AppStateStatus,
} from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  claimDiscardAction,
  completeDiscardAction,
  deleteCachedWorkVersion,
  enqueueAction as persistAction,
  listActions,
  prepareUserSignOut,
  readCachedWork,
  restoreDiscardAction,
  saveCachedWork,
} from "@/lib/database";
import { loadRemoteWork } from "@/lib/repository";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  cleanupDiscardedLocalEvidence,
  createIncident as insertIncident,
  removeDiscardedRemoteEvidence,
  syncOne,
  syncPending,
} from "@/lib/sync";
import type { EstoqueNowOperationContext, IncidentDraft, OutboxAction, WorkData } from "@/lib/types";

type AppContextValue = {
  configured: boolean;
  ready: boolean;
  busy: boolean;
  online: boolean;
  session: Session | null;
  work: WorkData | null;
  outbox: OutboxAction[];
  message: string;
  workResolved: boolean;
  workError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  enqueue: (action: OutboxAction) => Promise<void>;
  retry: (deviceActionId?: string) => Promise<void>;
  discard: (deviceActionId: string) => Promise<void>;
  createIncident: (draft: IncidentDraft) => Promise<void>;
  setItemChecked: (
    operationId: string,
    item: EstoqueNowOperationContext["items"][number],
    checked: boolean,
  ) => Promise<void>;
  setMessage: (message: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const connected = (state: Network.NetworkState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

export function AppProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [work, setWork] = useState<WorkData | null>(null);
  const [outbox, setOutbox] = useState<OutboxAction[]>([]);
  const [message, setMessage] = useState("");
  const [workResolved, setWorkResolved] = useState(false);
  const [workError, setWorkError] = useState("");
  const identity = useRef({ userId: null as string | null, generation: 0 });
  const onlineRef = useRef(true);
  const syncInFlight = useRef<{
    userId: string;
    promise: Promise<void>;
  } | null>(null);

  const adoptSession = useCallback((next: Session | null) => {
    const nextUserId = next?.user.id ?? null;
    if (identity.current.userId !== nextUserId)
      identity.current = {
        userId: nextUserId,
        generation: identity.current.generation + 1,
      };
    setSession(next);
  }, []);

  const isCurrent = useCallback(
    (snapshot: { userId: string | null; generation: number }) =>
      identity.current.userId === snapshot.userId &&
      identity.current.generation === snapshot.generation,
    [],
  );

  const reloadOutbox = useCallback(async (userId: string) => {
    const queued = await listActions(userId);
    if (identity.current.userId === userId) setOutbox(queued);
  }, []);

  const commitRemoteWork = useCallback(
    async (
      snapshot: { userId: string; generation: number },
      remote: WorkData,
    ) => {
      if (!isCurrent(snapshot)) return false;
      await saveCachedWork(snapshot.userId, remote);
      if (!isCurrent(snapshot)) {
        await deleteCachedWorkVersion(snapshot.userId, remote.fetchedAt);
        return false;
      }
      setWork(remote);
      setWorkResolved(true);
      setWorkError("");
      return true;
    },
    [isCurrent],
  );

  const refreshRemote = useCallback(async () => {
    const snapshot = { ...identity.current };
    const userId = snapshot.userId;
    if (!userId) return;
    const remote = await loadRemoteWork(userId);
    if (await commitRemoteWork({ userId, generation: snapshot.generation }, remote)) {
      await reloadOutbox(userId);
      setMessage("");
    }
  }, [commitRemoteWork, reloadOutbox]);

  const syncNow = useCallback(
    (userId: string, manual = false): Promise<void> => {
      const current = syncInFlight.current;
      if (current?.userId === userId) {
        if (!manual) return current.promise;
        return current.promise
          .catch(() => undefined)
          .then(() => syncNow(userId, true));
      }
      const snapshot = { ...identity.current };
      const request = (async () => {
        try {
          await syncPending(userId, manual);
          await reloadOutbox(userId);
          if (onlineRef.current && isCurrent(snapshot)) {
            const remote = await loadRemoteWork(userId);
            await commitRemoteWork(
              { userId, generation: snapshot.generation },
              remote,
            );
          }
        } finally {
          if (syncInFlight.current?.userId === userId)
            syncInFlight.current = null;
        }
      })();
      syncInFlight.current = { userId, promise: request };
      return request;
    },
    [commitRemoteWork, isCurrent, reloadOutbox],
  );

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    void Promise.all([supabase.auth.getSession(), Network.getNetworkStateAsync()])
      .then(([auth, network]) => {
        adoptSession(auth.data.session);
        const nextOnline = connected(network);
        onlineRef.current = nextOnline;
        setOnline(nextOnline);
      })
      .finally(() => setReady(true));
    const auth = supabase.auth.onAuthStateChange((_event, next) => adoptSession(next));
    return () => auth.data.subscription.unsubscribe();
  }, [adoptSession]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setWork(null);
      setOutbox([]);
      setWorkResolved(true);
      setWorkError("");
      return;
    }
    const snapshot = { userId, generation: identity.current.generation };
    let active = true;
    setWork(null);
    setWorkResolved(false);
    setWorkError("");
    void (async () => {
      const [cached, queued] = await Promise.all([
        readCachedWork(userId),
        listActions(userId),
      ]);
      if (!active || !isCurrent(snapshot)) return;
      if (cached) {
        setWork(cached);
        setWorkResolved(true);
      }
      setOutbox(queued);
      if (!onlineRef.current) {
        setWorkResolved(true);
        if (!cached) setWorkError("Sem conexão e sem escala salva neste aparelho.");
        return;
      }
      try {
        const remote = await loadRemoteWork(userId);
        if (active)
          await commitRemoteWork(snapshot, remote);
      } catch {
        if (!active || !isCurrent(snapshot)) return;
        setWorkResolved(true);
        setWorkError("Não foi possível carregar a escala do servidor.");
        if (cached)
          setMessage("Sem atualização do servidor. Exibindo a cópia salva.");
      }
    })().catch(() => {
      if (!active || !isCurrent(snapshot)) return;
      setWorkResolved(true);
      setWorkError("Não foi possível abrir os dados salvos neste aparelho.");
    });
    return () => {
      active = false;
    };
  }, [commitRemoteWork, isCurrent, session?.user.id]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      const next = connected(state);
      onlineRef.current = next;
      setOnline(next);
      const userId = session?.user.id;
      if (next && userId) void syncNow(userId).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [session?.user.id, syncNow]);

  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === "web") return;
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        client.auth.startAutoRefresh();
        const userId = session?.user.id;
        if (userId && online) void syncNow(userId).catch(() => undefined);
      } else {
        client.auth.stopAutoRefresh();
      }
    };
    handleAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [online, session?.user.id, syncNow]);

  const withBusy = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const value: AppContextValue = {
    configured: isSupabaseConfigured,
    ready,
    busy,
    online,
    session,
    work,
    outbox,
    message,
    workResolved,
    workError,
    setMessage,
    signIn: async (email, password) => {
      const client = supabase;
      if (!client) throw new Error("Supabase não configurado.");
      await withBusy(async () => {
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw new Error("E-mail ou senha inválidos.");
        adoptSession(result.data.session);
      });
    },
    signOut: async () => {
      const client = supabase;
      if (!client || !session) return;
      await withBusy(async () => {
        const currentSession = session;
        const activeSync =
          syncInFlight.current?.userId === currentSession.user.id
            ? syncInFlight.current.promise
            : null;
        await activeSync?.catch(() => undefined);
        const result = await client.auth.signOut({ scope: "local" });
        const reconciled = await client.auth.getSession();
        adoptSession(reconciled.data.session);
        if (reconciled.error || reconciled.data.session)
          throw new Error(
            reconciled.error?.message ??
              result.error?.message ??
              "A sessão local ainda está ativa. Tente sair novamente.",
          );
        await prepareUserSignOut(currentSession.user.id).catch(() => undefined);
        router.replace("/");
      });
    },
    refresh: async () =>
      withBusy(async () => {
        if (!online) throw new Error("Sem conexão. O dado salvo continua disponível.");
        setWorkError("");
        await refreshRemote();
      }),
    enqueue: async (action) => {
      if (!session) throw new Error("Sessão encerrada.");
      const userId = session.user.id;
      await persistAction(userId, action);
      await reloadOutbox(userId);
      if (onlineRef.current) {
        await syncNow(userId).catch(() =>
          setMessage("A ação está na fila, mas a escala não pôde ser atualizada agora."),
        );
      }
    },
    retry: async (deviceActionId) => {
      if (!session || !online) throw new Error("Conecte o aparelho antes de reenviar.");
      await withBusy(async () => {
        if (deviceActionId) {
          const action = outbox.find((item) => item.deviceActionId === deviceActionId);
          if (action) await syncOne(session.user.id, action, true);
          await reloadOutbox(session.user.id);
          await refreshRemote();
        } else {
          await syncNow(session.user.id, true);
        }
      });
    },
    discard: async (deviceActionId) => {
      if (!session) return;
      if (!onlineRef.current)
        throw new Error("Conecte o aparelho antes de descartar uma evidência.");
      const userId = session.user.id;
      await withBusy(async () => {
        const claimed = await claimDiscardAction(userId, deviceActionId);
        await reloadOutbox(userId);
        try {
          await removeDiscardedRemoteEvidence(claimed.action);
          const completed = await completeDiscardAction(userId, deviceActionId);
          if (!completed)
            throw new Error("O estado mudou durante o descarte. Atualize a fila.");
          cleanupDiscardedLocalEvidence(claimed.action);
        } catch (failure) {
          await restoreDiscardAction(
            userId,
            deviceActionId,
            claimed.previousState,
          );
          throw failure;
        } finally {
          await reloadOutbox(userId);
        }
      });
    },
    createIncident: async (draft) => {
      if (!session || !online)
        throw new Error("Ocorrências exigem conexão neste corte do app.");
      await withBusy(async () => {
        await insertIncident(session.user.id, draft);
        setMessage("Ocorrência registrada e enviada à torre.");
      });
    },
    setItemChecked: async (operationId, item, checked) => {
      const client = supabase;
      if (!client || !session || !online)
        throw new Error("Conecte o aparelho para atualizar a conferência.");
      await withBusy(async () => {
        const result = await client.rpc("set_operation_item_checked", {
          p_operation_id: operationId,
          p_item_snapshot: item,
          p_checked: checked,
        });
        if (result.error) throw new Error("Não foi possível atualizar este item.");
        await refreshRemote();
        setMessage(checked ? "Item conferido." : "Conferência removida.");
      });
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider ausente.");
  return value;
}
