"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ExternalLink, LocateFixed, RefreshCw, Truck, Users } from "lucide-react";
import Image from "next/image";

import { checklistForStage, isChecklistComplete } from "./action";
import type { LogisticsSnapshot, PendingAction } from "./types";

const OUTBOX_KEY = "imperio-logistics-outbox-v1";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const mapsUrl = (destination: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

const formValue = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function postJson(action: string, body: object) {
  const response = await fetch(`/api/imperio?action=${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a ação.");
}

async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

function dataUrlFile(dataUrl: string) {
  const [header, content] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
  return new File([bytes], "evidencia.jpg", { type: mime });
}

export function LogisticsWorkspace({ initialSnapshot }: { initialSnapshot: LogisticsSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<"tower" | "field" | "registry">("tower");
  const [selectedId, setSelectedId] = useState(initialSnapshot.operations[0]?.id ?? "");
  const [outbox, setOutbox] = useState<PendingAction[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [location, setLocation] = useState<PendingAction["location"] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = snapshot.operations.find((operation) => operation.id === selectedId) ?? snapshot.operations[0];
  const pendingForSelected = outbox.filter((action) => action.operationId === selected?.id);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setOutbox(JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as PendingAction[]);
      } catch {
        localStorage.removeItem(OUTBOX_KEY);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const saveOutbox = (actions: PendingAction[]) => {
    setOutbox(actions);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(actions));
  };

  const refresh = async () => {
    const response = await fetch("/api/imperio", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível atualizar a torre.");
    const fresh = (await response.json()) as LogisticsSnapshot;
    setSnapshot(fresh);
    if (!fresh.operations.some((operation) => operation.id === selectedId))
      setSelectedId(fresh.operations[0]?.id ?? "");
  };

  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ação não concluída.");
    } finally {
      setBusy(false);
    }
  };

  const syncAction = async (pending: PendingAction) => {
    const form = new FormData();
    form.set("operationId", pending.operationId);
    form.set("deviceActionId", pending.deviceActionId);
    form.set("stage", pending.stage);
    form.set("responsibleId", pending.responsibleId);
    form.set("deviceCapturedAt", pending.deviceCapturedAt);
    form.set("checklist", JSON.stringify(pending.checklist));
    form.set("latitude", String(pending.location.latitude));
    form.set("longitude", String(pending.location.longitude));
    form.set("accuracy", String(pending.location.accuracy));
    form.set("note", pending.note);
    form.set("photo", dataUrlFile(pending.photoDataUrl));
    const response = await fetch("/api/imperio?action=confirm-action", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; state?: string };
    if (!response.ok || payload.state !== "confirmed") throw new Error(payload.error ?? "Ação ainda pendente.");
    saveOutbox(outbox.filter((item) => item.deviceActionId !== pending.deviceActionId));
    await refresh();
  };

  const currentItems = useMemo(() => selected ? checklistForStage(selected.stage) : [], [selected]);
  const stageAlreadyConfirmed = selected?.events.some((event) => event.stage === selected.stage) ?? false;

  if (snapshot.configured && !snapshot.user)
    return (
      <main className="imperio-shell grid min-h-screen place-items-center bg-[#f4f6f4] p-6 text-[#17231f]">
        <form className="w-full max-w-sm rounded-2xl border border-[#d8dfda] bg-white p-7 shadow-sm" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run(async () => {
            await postJson("login", { email: formValue(form, "email"), password: formValue(form, "password") });
            window.location.reload();
          }, "Acesso confirmado.");
        }}>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#3d7567]">Império logística</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Acesse a operação</h1>
          <label className="mt-7 block text-sm font-medium">E-mail<input className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" name="email" type="email" required /></label>
          <label className="mt-4 block text-sm font-medium">Senha<input className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" name="password" type="password" required /></label>
          <button disabled={busy} className="mt-6 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:opacity-50">Entrar</button>
          {message && <p className="mt-4 text-sm" aria-live="polite">{message}</p>}
        </form>
      </main>
    );

  return (
    <main className="imperio-shell min-h-screen bg-[#f4f6f4] text-[#17231f]">
      <header className="border-b border-[#d7dfd9] bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#3d7567]">Império Eventos</p><h1 className="text-xl font-semibold tracking-tight">Núcleo de logística</h1></div>
          <nav className="flex rounded-xl bg-[#edf1ee] p-1" aria-label="Área do sistema">
            {([['tower', 'Torre'], ['field', 'Celular'], ['registry', 'Cadastros']] as const).map(([id, label]) =>
              <button key={id} onClick={() => setView(id)} className={`rounded-lg px-4 py-2 text-sm font-medium ${view === id ? "bg-white shadow-sm" : "text-[#587067]"}`}>{label}</button>)}
          </nav>
        </div>
      </header>

      <div className={`border-b px-4 py-2 text-center text-xs font-semibold ${snapshot.configured ? "border-[#c9ded6] bg-[#eaf4f0] text-[#275f50]" : "border-[#ead9aa] bg-[#fff6d9] text-[#765c16]"}`}>
        {snapshot.configured ? "Persistência Supabase ativa" : "AMBIENTE DEMONSTRATIVO — cadastros e ações não são persistidos no servidor"} · {snapshot.estoquenow.notice}
      </div>

      {message && <div className="mx-auto mt-4 max-w-7xl px-4"><p className="rounded-lg border border-[#d4ddd7] bg-white px-4 py-3 text-sm" aria-live="polite">{message}</p></div>}

      {view === "tower" && (
        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[1fr_380px] md:px-8">
          <div>
            <div className="mb-5 flex items-end justify-between"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Operação de hoje</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Próxima ação, sem ruído.</h2></div><button onClick={() => void run(refresh, "Torre atualizada.")} className="rounded-lg border border-[#cad4cd] bg-white p-2" aria-label="Atualizar"><RefreshCw size={17} /></button></div>
            <div className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white">
              {snapshot.operations.length === 0 && <p className="p-6 text-sm text-[#617068]">Nenhuma operação acessível. O gestor pode criar a primeira em Cadastros.</p>}
              {snapshot.operations.map((operation) => (
                <button key={operation.id} onClick={() => setSelectedId(operation.id)} className={`grid w-full gap-2 border-b border-[#e4e9e6] p-4 text-left last:border-0 md:grid-cols-[110px_1fr_150px] ${selected?.id === operation.id ? "bg-[#eef5f1]" : "hover:bg-[#f8faf8]"}`}>
                  <span className="font-mono text-sm font-semibold">{formatDate(operation.scheduled_at)}</span>
                  <span><strong className="block">{operation.event_name}</strong><small className="text-[#68776f]">{operation.destination}</small></span>
                  <span className="text-sm"><span className="block font-medium">{operation.stage === "preparation" ? "Preparação" : "Saída"}</span><small className="text-[#a05c2f]">Origem: {operation.source === "manual" ? "manual interna" : "EstoqueNOW"}</small></span>
                </button>
              ))}
            </div>
          </div>

          {selected && <aside className="rounded-xl border border-[#d7dfd9] bg-white p-5 lg:sticky lg:top-5 lg:self-start">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Operação selecionada</p>
            <h3 className="mt-2 text-2xl font-semibold">{selected.event_name}</h3>
            <p className="mt-1 text-sm text-[#617068]">{selected.destination}</p>
            <a href={mapsUrl(selected.destination)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#bfcfc6] px-3 py-2 text-sm font-semibold">Abrir rota no Google Maps <ExternalLink size={15} /></a>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-[#e2e8e4] py-4 text-sm">
              <div><dt className="text-[#708078]">Equipe</dt><dd className="font-medium">{snapshot.teams.find((team) => team.id === selected.team_id)?.name ?? "Não escalada"}</dd></div>
              <div><dt className="text-[#708078]">Veículo</dt><dd className="font-medium">{snapshot.vehicles.find((vehicle) => vehicle.id === selected.vehicle_id)?.name ?? "Não escalado"}</dd></div>
              <div><dt className="text-[#708078]">Motorista</dt><dd className="font-medium">{snapshot.people.find((person) => person.id === selected.driver_id)?.full_name ?? "Não escalado"}</dd></div>
              <div><dt className="text-[#708078]">Próxima etapa</dt><dd className="font-medium">{selected.stage === "preparation" ? "Concluir preparação" : "Confirmar saída"}</dd></div>
            </dl>
            <h4 className="mt-5 font-semibold">Eventos e evidências</h4>
            <div className="mt-3 space-y-3">
              {selected.events.length === 0 && <p className="text-sm text-[#708078]">Nenhuma ação confirmada no servidor.</p>}
              {selected.events.map((event) => <article key={event.id} className="rounded-lg bg-[#f3f6f4] p-3 text-sm"><div className="flex justify-between gap-3"><strong>{event.stage === "preparation" ? "Preparação" : "Saída"} confirmada</strong><span className="text-[#38705f]">Servidor</span></div><p className="mt-1 text-[#617068]">{event.actor_name} · {formatDate(event.server_received_at)}</p><p className="text-[#617068]">GPS {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)} · precisão {Math.round(event.accuracy)} m</p>{event.photo_url && <a className="mt-2 inline-block font-semibold underline" href={event.photo_url} target="_blank" rel="noreferrer">Abrir foto</a>}</article>)}
            </div>
          </aside>}
        </section>
      )}

      {view === "field" && (
        <section className="mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[#d7dfd9] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Operação móvel</p><span className="text-xs text-[#3d7567]">{pendingForSelected.length ? `${pendingForSelected.length} pendente` : "Servidor confirmado"}</span></div>
            <select value={selected?.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); setChecks({}); setPhotoDataUrl(""); setLocation(null); }} className="mt-4 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3 font-semibold">
              {snapshot.operations.map((operation) => <option value={operation.id} key={operation.id}>{operation.event_name}</option>)}
            </select>
            {selected && <>
              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[#9b653e]">{selected.source === "manual" ? "Operação manual · não originada do EstoqueNOW" : "Origem EstoqueNOW"}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{selected.stage === "preparation" ? "Concluir preparação" : "Confirmar saída"}</h2>
              <p className="mt-2 text-sm text-[#65746c]">Uma ação será registrada com horário do aparelho e do servidor.</p>
              <a href={mapsUrl(selected.destination)} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#bfd0c7] px-3 py-3 font-semibold">Abrir rota no Google Maps <ExternalLink size={16} /></a>

              {stageAlreadyConfirmed ? <div className="mt-6 rounded-xl bg-[#eaf4f0] p-4 text-sm font-semibold text-[#275f50]"><Check className="mr-2 inline" size={18} />Etapa confirmada no servidor.</div> : <>
                <div className="mt-6 space-y-2">{currentItems.map((item) => <label key={item} className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d7dfd9] px-4"><input type="checkbox" checked={Boolean(checks[item])} onChange={(event) => setChecks({ ...checks, [item]: event.target.checked })} className="size-5 accent-[#2d7461]" /><span className="font-medium">{item}</span></label>)}</div>
                <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#95b2a7] bg-[#f1f7f4] text-center"><Camera size={24} /><strong className="mt-2">Tirar foto agora</strong><small className="text-[#66776f]">Câmera solicitada; imagem comprimida no aparelho.</small><input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(async () => setPhotoDataUrl(await compressPhoto(file)), "Foto preparada."); }} /></label>
                {photoDataUrl && <Image unoptimized src={photoDataUrl} alt="Prévia da evidência" width={640} height={320} className="mt-3 h-32 w-full rounded-lg object-cover" />}
                <button onClick={() => navigator.geolocation.getCurrentPosition((position) => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }); setMessage("GPS capturado neste momento."); }, () => setMessage("Não foi possível capturar o GPS. Verifique a permissão."), { enableHighAccuracy: true, timeout: 12000 })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#bfd0c7] px-3 py-3 font-semibold"><LocateFixed size={18} />{location ? `GPS capturado · ${Math.round(location.accuracy)} m` : "Capturar GPS"}</button>
                <label className="mt-4 block text-sm font-medium">Responsável<select id="responsible" className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3" defaultValue={selected.driver_id ?? snapshot.user?.id}>{snapshot.people.map((person) => <option value={person.id} key={person.id}>{person.full_name}</option>)}</select></label>
                <label className="mt-4 block text-sm font-medium">Observação opcional<textarea id="action-note" className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" rows={2} /></label>
                <button disabled={busy || !isChecklistComplete(checks) || !photoDataUrl || !location} onClick={() => {
                  if (!selected || !location) return;
                  const pending: PendingAction = {
                    deviceActionId: crypto.randomUUID(), operationId: selected.id, stage: selected.stage, state: "pending",
                    checklist: checks, location, deviceCapturedAt: new Date().toISOString(),
                    note: (document.querySelector<HTMLTextAreaElement>("#action-note")?.value ?? "").trim(),
                    responsibleId: document.querySelector<HTMLSelectElement>("#responsible")?.value ?? snapshot.user?.id ?? "",
                    photoDataUrl,
                  };
                  saveOutbox([...outbox, pending]);
                  void run(async () => syncAction(pending), "Ação confirmada pelo servidor e exibida na torre.");
                }} className="mt-5 w-full rounded-lg bg-[#173d34] px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{selected.stage === "preparation" ? "Confirmar preparação" : "Confirmar saída"}</button>
              </>}
            </>}
          </div>
          {pendingForSelected.map((pending) => <div key={pending.deviceActionId} className="mt-3 rounded-xl border border-[#ead9aa] bg-[#fff9e8] p-4 text-sm"><strong>Pendente neste aparelho</strong><p className="mt-1 text-[#75622f]">Não é sync offline completo. O servidor ainda não confirmou e conflitos exigem revisão.</p><button className="mt-3 font-semibold underline" onClick={() => void run(async () => syncAction(pending), "Ação confirmada pelo servidor.")}>Tentar enviar novamente</button></div>)}
        </section>
      )}

      {view === "registry" && (
        <Registry snapshot={snapshot} busy={busy} run={run} refresh={refresh} />
      )}
    </main>
  );
}

function Registry({ snapshot, busy, run, refresh }: { snapshot: LogisticsSnapshot; busy: boolean; run: (task: () => Promise<void>, success: string) => Promise<void>; refresh: () => Promise<void> }) {
  if (snapshot.user?.role !== "manager") return <p className="mx-auto max-w-3xl p-8">Seu perfil pode executar operações escaladas, mas não alterar cadastros.</p>;
  const submit = (action: string, success: string, body: (form: FormData) => object) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void run(async () => { await postJson(action, body(form)); element.reset(); await refresh(); }, success);
  };
  return <section className="mx-auto max-w-7xl px-4 py-7 md:px-8"><div className="mb-6"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Configuração operacional</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Cadastre somente o que vai para a escala.</h2></div><div className="grid gap-5 md:grid-cols-2">
    <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-person", "Funcionário e acesso criados.", (form) => ({ fullName: formValue(form, "fullName"), email: formValue(form, "email"), phone: formValue(form, "phone"), temporaryPassword: formValue(form, "temporaryPassword") }))}><Users size={21} /><h3 className="mt-3 text-xl font-semibold">1. Funcionário</h3><p className="mt-1 text-sm text-[#68776f]">Cria perfil e acesso real no Supabase Auth.</p><Input name="fullName" label="Nome completo" /><Input name="email" label="E-mail" type="email" /><Input name="phone" label="Telefone" required={false} /><Input name="temporaryPassword" label="Senha temporária" type="password" minLength={8} /><Submit busy={busy} label="Cadastrar funcionário" /></form>
    <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-team", "Equipe criada.", (form) => ({ name: formValue(form, "name"), leaderId: formValue(form, "leaderId"), memberIds: form.getAll("memberIds").map(String) }))}><Users size={21} /><h3 className="mt-3 text-xl font-semibold">2. Equipe</h3><Input name="name" label="Nome da equipe" /><Select name="leaderId" label="Líder" options={snapshot.people.map((person) => [person.id, person.full_name])} /><label className="mt-3 block text-sm font-medium">Integrantes<select name="memberIds" multiple className="mt-2 h-28 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2">{snapshot.people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label><Submit busy={busy} label="Criar equipe" /></form>
    <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-vehicle", "Veículo criado.", (form) => ({ name: formValue(form, "name"), plate: formValue(form, "plate"), capacityLabel: formValue(form, "capacityLabel") }))}><Truck size={21} /><h3 className="mt-3 text-xl font-semibold">3. Veículo</h3><Input name="name" label="Nome" /><Input name="plate" label="Placa" /><Input name="capacityLabel" label="Capacidade" required={false} /><Submit busy={busy} label="Cadastrar veículo" /></form>
    <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-operation", "Operação manual criada e escalada.", (form) => ({ eventName: formValue(form, "eventName"), destination: formValue(form, "destination"), scheduledAt: formValue(form, "scheduledAt"), teamId: formValue(form, "teamId"), vehicleId: formValue(form, "vehicleId"), driverId: formValue(form, "driverId"), notes: formValue(form, "notes") }))}><Check size={21} /><h3 className="mt-3 text-xl font-semibold">4. Operação manual</h3><p className="mt-1 text-sm font-semibold text-[#9b653e]">Não originada do EstoqueNOW.</p><Input name="eventName" label="Evento" /><Input name="destination" label="Destino completo" /><Input name="scheduledAt" label="Data e horário" type="datetime-local" /><Select name="teamId" label="Equipe" options={snapshot.teams.map((team) => [team.id, team.name])} /><Select name="vehicleId" label="Veículo" options={snapshot.vehicles.map((vehicle) => [vehicle.id, `${vehicle.name} · ${vehicle.plate}`])} /><Select name="driverId" label="Motorista" options={snapshot.people.map((person) => [person.id, person.full_name])} /><Input name="notes" label="Observações" required={false} /><Submit busy={busy} label="Criar e escalar operação" /></form>
  </div></section>;
}

function Input({ name, label, type = "text", required = true, minLength }: { name: string; label: string; type?: string; required?: boolean; minLength?: number }) {
  return <label className="mt-3 block text-sm font-medium">{label}<input className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-2.5" name={name} type={type} required={required} minLength={minLength} /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return <label className="mt-3 block text-sm font-medium">{label}<select className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5" name={name} required><option value="">Selecione</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return <button disabled={busy} className="mt-5 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:opacity-50">{label}</button>;
}
