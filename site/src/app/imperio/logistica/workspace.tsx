"use client";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

import { FieldApp } from "./field-app";
import type { LogisticsSnapshot } from "./types";
import { WebDashboard } from "./web-dashboard";

export type Run = (
  task: () => Promise<void>,
  success: string,
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
    <main className="imperio-shell grid min-h-screen place-items-center bg-[#f4f6f4] p-6 text-[#17231f]">
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
    </main>
  );
}

export function LogisticsWorkspace({
  initialSnapshot,
}: {
  initialSnapshot: LogisticsSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [surface, setSurface] = useState<"web" | "field">(
    initialSnapshot.user?.role === "worker" ? "field" : "web",
  );
  const [selectedId, setSelectedId] = useState(
    initialSnapshot.operations[0]?.id ?? "",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await fetch("/api/imperio", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível atualizar o sistema.");
    const fresh = (await response.json()) as LogisticsSnapshot;
    setSnapshot(fresh);
    if (!fresh.operations.some((operation) => operation.id === selectedId))
      setSelectedId(fresh.operations[0]?.id ?? "");
  };

  const run: Run = async (task, success) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ação não concluída.",
      );
    } finally {
      setBusy(false);
    }
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
    <main className="imperio-shell min-h-screen bg-[#f4f6f4] text-[#17231f]">
      <header className="border-b border-[#d7dfd9] bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#3d7567]">
              Império Eventos
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Núcleo de logística
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {snapshot.user?.role === "manager" && (
              <nav
                className="flex rounded-xl bg-[#edf1ee] p-1"
                aria-label="Superfície do sistema"
              >
                <button
                  onClick={() => setSurface("web")}
                  aria-pressed={surface === "web"}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${surface === "web" ? "bg-white shadow-sm" : "text-[#587067]"}`}
                >
                  <Monitor size={16} /> Torre web
                </button>
                <button
                  onClick={() => setSurface("field")}
                  aria-pressed={surface === "field"}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${surface === "field" ? "bg-white shadow-sm" : "text-[#587067]"}`}
                >
                  <Smartphone size={16} /> App de campo
                </button>
              </nav>
            )}
            {snapshot.configured && (
              <button
                title="Sair"
                aria-label="Sair"
                className="rounded-lg border border-[#cad4cd] p-2.5"
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
        {snapshot.configured
          ? "Persistência Supabase ativa"
          : "AMBIENTE DEMONSTRATIVO — nenhum cadastro ou ação é persistido"}
        {" · "}
        {snapshot.estoquenow.notice}
      </div>

      {message && (
        <div className="mx-auto mt-4 max-w-[1500px] px-4">
          <p
            className="rounded-lg border border-[#d4ddd7] bg-white px-4 py-3 text-sm"
            aria-live="polite"
          >
            {message}
          </p>
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
    </main>
  );
}
