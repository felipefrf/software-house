"use client";

import { LogOut, Monitor, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { prioritizeOperations } from "./action";
import { FieldApp } from "./field-app";
import type { LogisticsSnapshot } from "./types";
import { WebDashboard } from "./web-dashboard";

export type Run = (
  task: () => Promise<void>,
  success: string | (() => string),
) => Promise<void>;

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "Sem duração";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
};

export const mapsUrl = (destination: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

const formValue = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export async function postJson<T = { ok: boolean }>(action: string, body: object) {
  const response = await fetch(`/api/imperio?action=${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(payload.error ?? "Não foi possível concluir a ação.");
  return payload;
}

function AccessCard({
  title,
  description,
  onSubmit,
  busy,
  message,
  changePassword = false,
}: {
  title: string;
  description: string;
  onSubmit: (form: FormData) => Promise<void>;
  busy: boolean;
  message: string;
  changePassword?: boolean;
}) {
  return (
    <div className="imperio-shell grid min-h-screen place-items-center bg-[#f4f6f4] p-6 text-[#17231f]">
      <form
        className="w-full max-w-sm rounded-2xl border border-[#d8dfda] bg-white p-7 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#3d7567]">
          Império logística
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#63716a]">{description}</p>
        {!changePassword && (
          <label className="mt-7 block text-sm font-medium">
            E-mail
            <input
              className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
        )}
        <label className="mt-4 block text-sm font-medium">
          {changePassword ? "Nova senha" : "Senha"}
          <input
            className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3"
            name="password"
            type="password"
            autoComplete={changePassword ? "new-password" : "current-password"}
            minLength={changePassword ? 10 : undefined}
            required
          />
        </label>
        {changePassword && (
          <label className="mt-4 block text-sm font-medium">
            Confirme a nova senha
            <input
              className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
        )}
        <button
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {changePassword ? "Salvar nova senha" : "Entrar"}
        </button>
        {message && (
          <p className="mt-4 text-sm" aria-live="polite">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

export function LogisticsWorkspace({
  initialSnapshot,
  initialSurface,
}: {
  initialSnapshot: LogisticsSnapshot;
  initialSurface: "web" | "field";
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [surface, setSurface] = useState<"web" | "field">(
    initialSnapshot.user?.role === "worker" ? "field" : initialSurface,
  );
  const [selectedId, setSelectedId] = useState(() =>
    prioritizeOperations(
      initialSnapshot.operations.filter((operation) => operation.status === "active"),
      initialSnapshot.incidents,
    )[0]?.id ?? initialSnapshot.operations[0]?.id ?? "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshRequestedRef = useRef(false);

  const refresh = useCallback(() => {
    refreshRequestedRef.current = true;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const request = (async () => {
      try {
        while (refreshRequestedRef.current) {
          refreshRequestedRef.current = false;
          const response = await fetch("/api/imperio", { cache: "no-store" });
          if (!response.ok)
            throw new Error("Não foi possível atualizar o sistema.");
          const fresh = (await response.json()) as LogisticsSnapshot;
          setSnapshot(fresh);
          setLastUpdatedAt(new Date().toISOString());
          setRefreshFailed(false);
          setSelectedId((current) =>
            fresh.operations.some((operation) => operation.id === current)
              ? current
              : (prioritizeOperations(
                  fresh.operations.filter((operation) => operation.status === "active"),
                  fresh.incidents,
                )[0]?.id ?? fresh.operations[0]?.id ?? ""),
          );
        }
      } catch (error) {
        setRefreshFailed(true);
        throw error;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  }, []);

  const pollingUserId = snapshot.configured ? snapshot.user?.id : undefined;

  useEffect(() => {
    if (!pollingUserId) return;

    let timer: number | null = null;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refresh().catch(() => undefined);
    };
    const schedulePolling = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (document.visibilityState !== "visible") return;
      timer = window.setInterval(refreshWhenVisible, 30_000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWhenVisible();
      schedulePolling();
    };

    schedulePolling();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollingUserId, refresh]);

  const run: Run = async (task, success) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(typeof success === "function" ? success() : success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ação não concluída.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectSurface = (next: "web" | "field") => {
    setSurface(next);
    const url = new URL(window.location.href);
    if (next === "field") url.searchParams.set("surface", "field");
    else url.searchParams.delete("surface");
    window.history.replaceState(null, "", url);
  };

  if (snapshot.configured && !snapshot.user)
    return (
      <AccessCard
        title="Acesse a operação"
        description="Entre com o acesso criado pelo gestor."
        busy={busy}
        message={message}
        onSubmit={async (form) => {
          await run(async () => {
            await postJson("login", {
              email: formValue(form, "email"),
              password: formValue(form, "password"),
            });
            window.location.reload();
          }, "Acesso confirmado.");
        }}
      />
    );

  if (snapshot.user?.must_change_password)
    return (
      <AccessCard
        title="Defina sua senha"
        description="A senha temporária precisa ser substituída antes da operação."
        busy={busy}
        message={message}
        changePassword
        onSubmit={async (form) => {
          const password = formValue(form, "password");
          if (password !== formValue(form, "confirmation")) {
            setMessage("As senhas não coincidem.");
            return;
          }
          await run(async () => {
            await postJson("change-password", { password });
            await refresh();
          }, "Senha atualizada.");
        }}
      />
    );

  return (
    <div className="imperio-shell min-h-dvh bg-[#f4f6f4] text-[#17231f]">
      <header className="imperio-app-header border-b border-[#d7dfd9] bg-white px-4 pb-2.5 pt-2.5 md:px-8 md:pb-3 md:pt-3">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#3d7567]">
              Império Eventos
            </p>
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">
              {surface === "field" ? "App de campo" : "Núcleo de logística"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {snapshot.user?.role === "manager" && (
              <nav
                className="flex rounded-xl bg-[#edf1ee] p-1"
                aria-label="Superfície do sistema"
              >
                <button
                  onClick={() => selectSurface("web")}
                  aria-label="Torre web"
                  aria-pressed={surface === "web"}
                  className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${surface === "web" ? "border border-[#d7dfd9] bg-white text-[#234e42]" : "text-[#587067]"}`}
                >
                  <Monitor size={16} /> <span className="hidden sm:inline">Torre web</span>
                </button>
                <button
                  onClick={() => selectSurface("field")}
                  aria-label="App de campo"
                  aria-pressed={surface === "field"}
                  className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${surface === "field" ? "border border-[#d7dfd9] bg-white text-[#234e42]" : "text-[#587067]"}`}
                >
                  <Smartphone size={16} /> <span className="hidden sm:inline">App de campo</span>
                </button>
              </nav>
            )}
            {snapshot.configured && (
              <button
                title="Sair"
                aria-label="Sair"
                className="min-h-11 min-w-11 rounded-lg border border-[#cad4cd] p-2.5"
                onClick={() =>
                  void run(async () => {
                    await postJson("logout", {});
                    window.location.reload();
                  }, "Sessão encerrada.")
                }
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className={`border-b px-4 py-2 text-center text-xs font-semibold ${
          snapshot.configured
            ? "border-[#c9ded6] bg-[#eaf4f0] text-[#275f50]"
            : "border-[#ead9aa] bg-[#fff6d9] text-[#765c16]"
        }`}
      >
        {snapshot.configured ? (
          <>
            AMBIENTE OPERACIONAL · Supabase ativo · {snapshot.estoquenow.source === "estoquenow" ? "EstoqueNOW lido" : "EstoqueNOW aguardando leitura"}
          </>
        ) : (
          <>DADOS DE DEMONSTRAÇÃO · Nada é persistido · EstoqueNOW não conectado</>
        )}
      </div>

      {message && (
        <div className="fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border border-[#cbd7d0] bg-white p-4 shadow-[0_12px_36px_rgba(23,35,31,0.14)]" role="status" aria-live="polite">
          <p className="min-w-0 flex-1 text-sm">{message}</p>
          <button onClick={() => setMessage("")} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[#5f7067] hover:bg-[#edf1ee]" aria-label="Fechar mensagem">
            <X size={17} />
          </button>
        </div>
      )}

      {surface === "web" && snapshot.user?.role === "manager" ? (
        <WebDashboard
          snapshot={snapshot}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          busy={busy}
          run={run}
          refresh={refresh}
          refreshState={{ lastUpdatedAt, failed: refreshFailed }}
        />
      ) : (
        <FieldApp
          snapshot={snapshot}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          busy={busy}
          run={run}
          refresh={refresh}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}
