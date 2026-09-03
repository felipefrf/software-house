"use client";

import { LogOut, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { prioritizeOperations } from "./action";
import { FieldApp } from "./field-app";
import type { LogisticsSnapshot } from "./types";
import { Button, inputClass } from "./ui";
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

function Brand({ surface, inverted = false }: { surface?: "web" | "field"; inverted?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl ${inverted ? "bg-white/12 text-white" : "bg-imp-green-deep text-white shadow-imp-soft"}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 14h14M5 14V8l5-3 5 3v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 14v-3h4v3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block font-imp-display text-[22px] font-semibold tracking-tight ${inverted ? "text-white" : "text-imp-ink"}`}>Império Logística</span>
        {surface && (
          <span className={`block text-[13px] ${inverted ? "text-white/70" : "text-imp-muted"}`}>
            {surface === "field" ? "App de campo" : "Torre de controle"}
          </span>
        )}
      </span>
    </div>
  );
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
    <div className="imperio-shell grid min-h-dvh place-items-center p-6">
      <form
        className="imp-rise w-full max-w-sm rounded-2xl border border-imp-line/70 bg-imp-surface p-7 shadow-imp-card"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
      >
        <Brand />
        <h1 className="mt-7 font-imp-display text-[32px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] leading-6 text-imp-muted">{description}</p>
        {!changePassword && (
          <label className="mt-6 block text-sm font-medium">
            E-mail
            <input className={inputClass} name="email" type="email" autoComplete="email" required autoFocus />
          </label>
        )}
        <label className="mt-4 block text-sm font-medium">
          {changePassword ? "Nova senha" : "Senha"}
          <input
            className={inputClass}
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
            <input className={inputClass} name="confirmation" type="password" autoComplete="new-password" minLength={10} required />
          </label>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="mt-6 w-full">
          {changePassword ? "Salvar nova senha" : "Entrar"}
        </Button>
        {message && (
          <p className="mt-4 text-[15px] text-imp-red" aria-live="polite">
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

  // Sucesso some sozinho; erros e avisos longos ficam até fechar.
  useEffect(() => {
    if (!message || message.length > 90) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);
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
        title="Entrar na operação"
        description="Use o e-mail e a senha criados pela coordenação."
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
        description="A senha temporária precisa ser trocada antes de operar."
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

  const isManager = snapshot.user?.role === "manager";
  const fieldChrome = surface === "field" || !isManager;
  const environment = snapshot.configured
    ? snapshot.estoquenow.source === "estoquenow"
      ? "Produção · EstoqueNOW conectado"
      : snapshot.estoquenow.configured
        ? "Produção · EstoqueNOW configurado"
        : "Produção · EstoqueNOW não conectado"
    : "Demonstração";

  return (
    <div className="imperio-shell min-h-dvh">
      <header
        className={`imperio-app-header sticky top-0 z-30 border-b px-4 md:px-6 ${
          fieldChrome ? "border-imp-green-deep bg-imp-green-deep text-white" : "border-imp-line bg-imp-surface"
        }`}
      >
        <div className="mx-auto flex min-h-14 max-w-[1720px] items-center justify-between gap-3">
          <Brand surface={surface === "field" && isManager ? "field" : undefined} inverted={fieldChrome} />
          <div className="flex items-center gap-2 md:gap-3">
            <span className={`hidden items-center gap-2 text-[13px] md:flex ${fieldChrome ? "text-white/70" : "text-imp-muted"}`} title="Ambiente atual">
              <span aria-hidden="true" className={`size-2 rounded-full ${snapshot.configured ? (fieldChrome ? "bg-white/70" : "bg-imp-green") : "bg-imp-amber"}`} />
              {environment}
            </span>
            {isManager && (
              <div className={`flex rounded-xl p-0.5 ${fieldChrome ? "bg-white/12" : "border border-imp-line bg-imp-ground"}`} role="group" aria-label="Superfície">
                {(["web", "field"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectSurface(item)}
                    aria-pressed={surface === item}
                    className={`min-h-11 rounded-lg px-3 text-[14px] font-semibold transition-colors ${
                      surface === item
                        ? "bg-imp-surface text-imp-ink shadow-imp-soft"
                        : fieldChrome
                          ? "text-white/80 hover:text-white"
                          : "text-imp-muted hover:text-imp-ink"
                    }`}
                  >
                    {item === "web" ? "Torre" : "Campo"}
                  </button>
                ))}
              </div>
            )}
            {snapshot.configured && (
              <button
                type="button"
                aria-label={`Sair${snapshot.user ? ` (${snapshot.user.full_name})` : ""}`}
                title="Sair"
                className={`grid min-h-11 min-w-11 place-items-center rounded-xl ${fieldChrome ? "text-white/80 hover:bg-white/12 hover:text-white" : "text-imp-muted hover:bg-imp-ground hover:text-imp-ink"}`}
                onClick={() =>
                  void run(async () => {
                    await postJson("logout", {});
                    window.location.reload();
                  }, "Sessão encerrada.")
                }
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!snapshot.configured && (
        <p className="border-b border-imp-amber/30 bg-imp-amber-tint px-4 py-1.5 text-center text-[13px] font-medium text-imp-amber">
          <span className="md:hidden">Demonstração: nada é salvo.</span>
          <span className="hidden md:inline">Ambiente de demonstração: nada é salvo e o EstoqueNOW não está conectado.</span>
        </p>
      )}

      {message && (
        <div
          className="imp-rise fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-start gap-3 rounded-2xl border border-imp-line/70 bg-imp-surface p-3 pl-4 shadow-imp-lift md:inset-x-auto md:bottom-6 md:right-6"
          role="status"
          aria-live="polite"
        >
          <p className="min-w-0 flex-1 py-2 text-[15px] leading-5">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="grid min-h-10 min-w-10 place-items-center rounded-lg text-imp-muted hover:bg-imp-ground"
            aria-label="Fechar mensagem"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {surface === "web" && isManager ? (
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
