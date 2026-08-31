"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  Clock3,
  ExternalLink,
  FileClock,
  LocateFixed,
  RefreshCw,
  Signal,
  SignalZero,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  checklistForStage,
  isChecklistComplete,
  localOutboxKey,
  operationStages,
  stageLabels,
  stageState,
} from "./action";
import type { LogisticsSnapshot, Operation, PendingAction } from "./types";
import {
  formatDate,
  formatDuration,
  mapsUrl,
  type Run,
} from "./workspace";

type Props = {
  snapshot: LogisticsSnapshot;
  selectedId: string;
  setSelectedId: (id: string) => void;
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  setMessage: (message: string) => void;
};

async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function dataUrlFile(dataUrl: string) {
  const [header, content] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(content), (character) =>
    character.charCodeAt(0),
  );
  return new File([bytes], "evidencia.jpg", { type: mime });
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function useElapsed(startedAt?: string) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () =>
      setSeconds(
        startedAt
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
            )
          : 0,
      );
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [startedAt]);
  return seconds;
}

function StageRail({ operation }: { operation: Operation }) {
  const current = operationStages.indexOf(operation.stage);
  return (
    <div className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#708078]">
            Etapa {current + 1} de {operationStages.length}
          </p>
          <strong className="text-sm">{stageLabels[operation.stage]}</strong>
        </div>
        <span className="text-[10px] text-[#708078]">Deslize para ver todas</span>
      </div>
      <div
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${operationStages.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {operationStages.map((stage, index) => {
          const state = stageState(
            index,
            current,
            operation.status,
            operation.events.some(
              (event) =>
                event.stage === stage && event.event_type === "stage_completed",
            ),
          );
          return (
            <span
              key={stage}
              className={`h-1.5 rounded-full ${state === "done" ? "bg-[#2d7461]" : state === "active" ? "bg-[#5f52bd]" : "bg-[#d5dcd8]"}`}
            />
          );
        })}
      </div>
      <div className="sr-only mt-3 overflow-x-auto pb-2 sm:not-sr-only sm:block">
        <ol className="flex min-w-max gap-2" aria-label="Etapas da operação">
        {operationStages.map((stage, index) => {
          const state = stageState(
            index,
            current,
            operation.status,
            operation.events.some(
              (event) =>
                event.stage === stage && event.event_type === "stage_completed",
            ),
          );
          const done = state === "done";
          const active = state === "active";
          return (
            <li className="w-20 text-center" key={stage}>
              <span
                aria-current={active ? "step" : undefined}
                aria-label={`${stageLabels[stage]}: ${done ? "concluída" : active ? "etapa atual" : "pendente"}`}
                className={`mx-auto grid size-10 place-items-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? "border-[#287258] bg-[#e8f3ef] text-[#287258]"
                    : active
                      ? "border-[#5f52bd] bg-[#5f52bd] text-white ring-4 ring-[#ebe8fb]"
                      : "border-[#d5dcd8] bg-white text-[#819087]"
                }`}
              >
                {done ? <Check size={16} /> : index + 1}
              </span>
              <span className="mt-2 block text-[10px] font-medium">
                {stageLabels[stage]}
              </span>
            </li>
          );
        })}
        </ol>
      </div>
    </div>
  );
}

function CapturePhoto({
  value,
  onChange,
  run,
  label = "Tirar foto agora",
}: {
  value: string;
  onChange: (value: string) => void;
  run: Run;
  label?: string;
}) {
  return (
    <>
      <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#95b2a7] bg-[#f1f7f4] text-center">
        <Camera size={24} />
        <strong className="mt-2">{value ? "Substituir foto" : label}</strong>
        <small className="px-3 text-[#66776f]">
          A câmera traseira é solicitada; a imagem é comprimida no aparelho.
        </small>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file)
              void run(
                async () => onChange(await compressPhoto(file)),
                "Foto preparada no aparelho.",
              );
          }}
        />
      </label>
      {value && (
        <Image
          unoptimized
          src={value}
          alt="Prévia da evidência"
          width={640}
          height={320}
          className="mt-3 h-32 w-full rounded-lg object-cover"
        />
      )}
    </>
  );
}

export function FieldApp(props: Props) {
  const [tab, setTab] = useState<"today" | "evidence" | "queue">("today");
  const [outbox, setOutbox] = useState<PendingAction[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [location, setLocation] = useState<PendingAction["location"] | null>(null);
  const [arrivalAccess, setArrivalAccess] = useState<"released" | "blocked" | "">("");
  const [incidentPhoto, setIncidentPhoto] = useState("");
  const outboxKey = localOutboxKey(props.snapshot.user?.id ?? "anonymous");
  const online = useOnline();
  const selected =
    props.snapshot.operations.find((operation) => operation.id === props.selectedId) ??
    props.snapshot.operations[0];
  const elapsed = useElapsed(selected?.stage_started_at);
  const currentItems = useMemo(
    () => (selected ? checklistForStage(selected.stage) : []),
    [selected],
  );
  const pendingForSelected = outbox.filter(
    (action) => action.operationId === selected?.id,
  );
  const responsiblePeople = useMemo(() => {
    if (!selected) return [];
    const team = props.snapshot.teams.find((item) => item.id === selected.team_id);
    const allowed = new Set(
      [props.snapshot.user?.id, selected.driver_id, ...(team?.member_ids ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
    );
    return props.snapshot.people.filter((person) => allowed.has(person.id));
  }, [props.snapshot.people, props.snapshot.teams, props.snapshot.user?.id, selected]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem(outboxKey) ?? "[]",
        ) as PendingAction[];
        setOutbox(stored);
      } catch {
        localStorage.removeItem(outboxKey);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [outboxKey]);

  const saveOutbox = (actions: PendingAction[]) => {
    try {
      localStorage.setItem(outboxKey, JSON.stringify(actions));
      setOutbox(actions);
    } catch {
      throw new Error(
        "O aparelho não conseguiu salvar a ação localmente. Libere espaço antes de sair da tela.",
      );
    }
  };

  const removeFromOutbox = (deviceActionId: string) => {
    const next = outbox.filter((item) => item.deviceActionId !== deviceActionId);
    localStorage.setItem(outboxKey, JSON.stringify(next));
    setOutbox(next);
  };

  const resetCapture = () => {
    setChecks({});
    setPhotoDataUrl("");
    setLocation(null);
    setArrivalAccess("");
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
    form.set("arrivalAccess", pending.arrivalAccess);
    form.set("arrivalReason", pending.arrivalReason);
    form.set("acceptanceName", pending.acceptanceName);
    form.set("photo", dataUrlFile(pending.photoDataUrl));
    const response = await fetch("/api/imperio?action=confirm-action", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as { error?: string; state?: string };
    if (!response.ok || payload.state !== "confirmed")
      throw new Error(payload.error ?? "A ação ainda está pendente.");
    removeFromOutbox(pending.deviceActionId);
    await props.refresh();
    resetCapture();
  };

  const captureGps = () =>
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        props.setMessage("GPS capturado neste momento.");
      },
      () =>
        props.setMessage(
          "Não foi possível capturar o GPS. Verifique a permissão do navegador.",
        ),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );

  const submitAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !location || !photoDataUrl) return;
    const form = new FormData(event.currentTarget);
    const pending: PendingAction = {
      deviceActionId: crypto.randomUUID(),
      operationId: selected.id,
      stage: selected.stage,
      state: "pending",
      checklist: checks,
      location,
      deviceCapturedAt: new Date().toISOString(),
      note: String(form.get("note") ?? "").trim(),
      responsibleId:
        String(form.get("responsibleId") ?? "") || props.snapshot.user?.id || "",
      arrivalAccess,
      arrivalReason: String(form.get("arrivalReason") ?? "").trim(),
      acceptanceName: String(form.get("acceptanceName") ?? "").trim(),
      photoDataUrl,
    };
    void props.run(async () => {
      saveOutbox([...outbox, pending]);
      if (!online) return;
      await syncAction(pending);
    },
    online
      ? "Ação confirmada pelo servidor e exibida na torre."
      : "Ação salva como pendente neste aparelho. Envie quando houver conexão.");
  };

  const submitIncident = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const form = new FormData();
    form.set("incidentId", crypto.randomUUID());
    form.set("operationId", selected.id);
    form.set("stage", selected.stage);
    for (const name of ["type", "severity", "impact", "description", "responsibleId"])
      form.set(name, String(data.get(name) ?? ""));
    if (location) {
      form.set("latitude", String(location.latitude));
      form.set("longitude", String(location.longitude));
      form.set("accuracy", String(location.accuracy));
    }
    if (incidentPhoto) form.set("photo", dataUrlFile(incidentPhoto));
    void props.run(async () => {
      const response = await fetch("/api/imperio?action=create-incident", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Ocorrência não registrada.");
      element.reset();
      setIncidentPhoto("");
      await props.refresh();
    }, "Ocorrência registrada e exibida na torre.");
  };

  const actionDisabled =
    props.busy ||
    !props.snapshot.configured ||
    !selected ||
    selected.status !== "active" ||
    !isChecklistComplete(checks, selected.stage) ||
    !photoDataUrl ||
    !location ||
    pendingForSelected.some((item) => item.stage === selected.stage) ||
    (selected.stage === "arrival" && !arrivalAccess);

  if (!selected)
    return (
      <section className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-xl border border-[#d7dfd9] bg-white p-6 text-center">
          <h2 className="text-xl font-semibold">Nenhuma operação escalada</h2>
          <p className="mt-2 text-sm text-[#66756d]">
            O gestor precisa associar você ou sua equipe a uma operação.
          </p>
        </div>
      </section>
    );

  const evidence = props.snapshot.operations.flatMap((operation) =>
    operation.events.map((item) => ({ operation, item })),
  );

  return (
    <section className="mx-auto max-w-[460px] px-4 py-6 pb-28">
      <div className="mb-3 flex items-center justify-between rounded-xl border border-[#d7dfd9] bg-white px-4 py-3 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          {online ? <Signal size={16} /> : <SignalZero size={16} />}
          {online ? "Com conexão" : "Sem conexão"}
        </span>
        <span className={outbox.length ? "text-[#8a6318]" : "text-[#2d6e58]"}>
          {outbox.length ? `${outbox.length} pendente(s)` : "Fila local vazia"}
        </span>
      </div>

      {tab === "today" && (
        <>
          <div className="rounded-2xl border border-[#d7dfd9] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">
                Operação móvel
              </p>
              <button
                onClick={() =>
                  void props.run(async () => {
                    await props.refresh();
                    resetCapture();
                  }, "Operações atualizadas.")
                }
                className="rounded-lg border border-[#d3dbd6] p-2"
                aria-label="Atualizar"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <select
              value={selected.id}
              onChange={(event) => {
                props.setSelectedId(event.target.value);
                resetCapture();
              }}
              className="mt-4 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3 font-semibold"
            >
              {props.snapshot.operations.map((operation) => (
                <option value={operation.id} key={operation.id}>
                  {operation.event_name}
                </option>
              ))}
            </select>
            <p
              className={`mt-5 font-mono text-xs uppercase tracking-[0.14em] ${
                selected.source === "manual" ? "text-[#9b653e]" : "text-[#32705d]"
              }`}
            >
              {selected.source === "manual"
                ? "Operação manual · não originada do EstoqueNOW"
                : `Origem EstoqueNOW · ID ${selected.external_id}`}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {selected.event_name}
            </h1>
            <p className="mt-1 text-sm text-[#65746c]">{selected.destination}</p>
            <StageRail operation={selected} />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-[#f2f5f3] p-3">
                <span className="text-[#708078]">Equipe</span>
                <strong className="mt-1 block">
                  {props.snapshot.teams.find((team) => team.id === selected.team_id)
                    ?.name ?? "Não escalada"}
                </strong>
              </div>
              <div className="rounded-lg bg-[#f2f5f3] p-3">
                <span className="text-[#708078]">Veículo</span>
                <strong className="mt-1 block">
                  {props.snapshot.vehicles.find(
                    (vehicle) => vehicle.id === selected.vehicle_id,
                  )?.name ?? "Não escalado"}
                </strong>
              </div>
            </div>
            <a
              href={mapsUrl(selected.destination)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#bfd0c7] px-3 py-3 font-semibold"
            >
              Abrir rota no Google Maps <ExternalLink size={16} />
            </a>
          </div>

          {selected.status !== "active" ? (
            <div className="mt-4 rounded-xl border border-[#d7dfd9] bg-white p-5 text-center">
              <Check className="mx-auto text-[#2d7461]" />
              <strong className="mt-2 block">
                {selected.status === "completed" ? "Operação concluída" : "Operação cancelada"}
              </strong>
              {selected.cancel_reason && (
                <p className="mt-2 text-sm text-[#65746c]">{selected.cancel_reason}</p>
              )}
            </div>
          ) : (
            <form
              onSubmit={submitAction}
              className="mt-4 rounded-2xl border border-[#d7dfd9] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f52bd]">
                    Próxima ação
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Concluir {stageLabels[selected.stage].toLowerCase()}
                  </h2>
                </div>
                <span className="flex items-center gap-1 rounded-lg bg-[#f0edfb] px-2 py-1 text-xs text-[#5f52bd]">
                  <Clock3 size={14} /> {formatDuration(elapsed)}
                </span>
              </div>
              {selected.waiting_since && selected.stage === "arrival" && (
                <div className="mt-4 rounded-lg border border-[#ead5a4] bg-[#fff7e3] p-3 text-sm text-[#755615]">
                  Espera iniciada em {formatDate(selected.waiting_since)}. Registre a liberação para avançar.
                </div>
              )}
              <p className="mt-2 text-sm text-[#65746c]">
                Checklist, foto, GPS e horários do aparelho e servidor ficam vinculados a esta etapa.
              </p>
              <div className="mt-5 space-y-2">
                {currentItems.map((item) => (
                  <label
                    key={item}
                    className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d7dfd9] px-4"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checks[item])}
                      onChange={(event) =>
                        setChecks({ ...checks, [item]: event.target.checked })
                      }
                      className="size-5 accent-[#2d7461]"
                    />
                    <span className="font-medium">{item}</span>
                  </label>
                ))}
              </div>

              {selected.stage === "arrival" && (
                <fieldset className="mt-4 rounded-lg border border-[#d7dfd9] p-3">
                  <legend className="px-1 text-sm font-semibold">O acesso ao local foi liberado?</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-lg bg-[#eef5f1] p-3 text-sm font-medium"><input type="radio" name="arrivalAccess" value="released" checked={arrivalAccess === "released"} onChange={() => setArrivalAccess("released")} />Sim, liberado</label>
                    <label className="flex items-center gap-2 rounded-lg bg-[#fff6df] p-3 text-sm font-medium"><input type="radio" name="arrivalAccess" value="blocked" checked={arrivalAccess === "blocked"} onChange={() => setArrivalAccess("blocked")} />Não, bloqueado</label>
                  </div>
                  {arrivalAccess === "blocked" && (
                    <label className="mt-3 block text-sm font-medium">Motivo obrigatório<textarea name="arrivalReason" required minLength={3} rows={2} className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-2" /></label>
                  )}
                </fieldset>
              )}

              {selected.stage === "delivery" && (
                <label className="mt-4 block text-sm font-medium">Responsável pelo aceite interno<input name="acceptanceName" required minLength={2} className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" placeholder="Nome de quem conferiu no local" /></label>
              )}

              <CapturePhoto
                value={photoDataUrl}
                onChange={setPhotoDataUrl}
                run={props.run}
              />
              <button
                type="button"
                onClick={captureGps}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#bfd0c7] px-3 py-3 font-semibold"
              >
                <LocateFixed size={18} />
                {location
                  ? `GPS capturado · ${Math.round(location.accuracy)} m`
                  : "Capturar GPS agora"}
              </button>
              <label className="mt-4 block text-sm font-medium">
                Responsável
                <select
                  name="responsibleId"
                  className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3"
                  defaultValue={selected.driver_id ?? props.snapshot.user?.id}
                  required
                >
                  {responsiblePeople.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.full_name} · {person.job_title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Observação opcional
                <textarea
                  name="note"
                  className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3"
                  rows={2}
                />
              </label>
              <button
                disabled={actionDisabled}
                className="mt-5 w-full rounded-lg bg-[#173d34] px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selected.stage === "arrival" && arrivalAccess === "blocked"
                  ? "Registrar bloqueio e iniciar espera"
                  : `Confirmar ${stageLabels[selected.stage].toLowerCase()}`}
              </button>
              {!props.snapshot.configured && (
                <p className="mt-3 text-center text-xs text-[#80651c]">
                  Ação desativada no ambiente demonstrativo.
                </p>
              )}
            </form>
          )}

          <details className="mt-4 rounded-xl border border-[#d7dfd9] bg-white p-5">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <AlertTriangle size={18} /> Registrar ocorrência
            </summary>
            <p className="mt-2 text-sm text-[#65746c]">
              A ocorrência vai para a torre sem avançar a etapa.
            </p>
            <form onSubmit={submitIncident} className="mt-3">
              <label className="block text-sm font-medium">Tipo<select name="type" className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3" required><option value="delay">Atraso</option><option value="access">Acesso</option><option value="damage">Avaria</option><option value="missing_item">Item ausente</option><option value="other">Outro</option></select></label>
              <label className="mt-3 block text-sm font-medium">Severidade<select name="severity" className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3" required><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
              <label className="mt-3 block text-sm font-medium">Descrição<textarea name="description" required minLength={3} rows={3} className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" /></label>
              <label className="mt-3 block text-sm font-medium">Impacto opcional<input name="impact" className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-3" /></label>
              <label className="mt-3 block text-sm font-medium">Responsável pelo tratamento<select name="responsibleId" className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-3"><option value="">A definir na torre</option>{responsiblePeople.map((person) => <option value={person.id} key={person.id}>{person.full_name}</option>)}</select></label>
              <CapturePhoto value={incidentPhoto} onChange={setIncidentPhoto} run={props.run} label="Adicionar foto da ocorrência" />
              <button disabled={props.busy || !props.snapshot.configured || !online} className="mt-4 w-full rounded-lg border border-[#9f5d53] px-4 py-3 font-semibold text-[#8d443b] disabled:opacity-40">Registrar ocorrência</button>
              {!online && <p className="mt-2 text-xs text-[#80651c]">Ocorrências exigem conexão neste corte. A fila local cobre apenas ações de etapa.</p>}
            </form>
          </details>
        </>
      )}

      {tab === "evidence" && (
        <div>
          <div className="mb-4"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Servidor</p><h2 className="mt-1 text-3xl font-semibold">Evidências</h2><p className="mt-2 text-sm text-[#65746c]">Somente registros já confirmados.</p></div>
          <div className="space-y-3">
            {evidence.map(({ operation, item }) => (
              <article key={item.id} className="rounded-xl border border-[#d7dfd9] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><strong>{operation.event_name}</strong><p className="text-sm text-[#65746c]">{stageLabels[item.stage]} · {item.actor_name}</p></div><Check size={18} className="text-[#2d7461]" /></div><p className="mt-2 text-xs text-[#7a8780]">{formatDate(item.server_received_at)} · GPS {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</p>{item.photo_url && <a href={item.photo_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold underline">Abrir foto</a>}</article>
            ))}
            {!evidence.length && <p className="rounded-xl border border-dashed border-[#cbd5ce] bg-white p-6 text-center text-sm text-[#66756d]">Nenhuma evidência confirmada.</p>}
          </div>
        </div>
      )}

      {tab === "queue" && (
        <div>
          <div className="mb-4"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Este aparelho</p><h2 className="mt-1 text-3xl font-semibold">Fila local</h2><p className="mt-2 text-sm text-[#65746c]">Reenvio idempotente com identificador único se a conexão cair com o app aberto. Abrir ou recarregar exige internet; não há sync offline completo nem resolução automática de conflitos.</p></div>
          <div className="space-y-3">
            {outbox.map((pending) => (
              <article key={pending.deviceActionId} className="rounded-xl border border-[#ead9aa] bg-[#fff9e8] p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><strong>{props.snapshot.operations.find((operation) => operation.id === pending.operationId)?.event_name ?? "Operação"}</strong><p className="text-[#75622f]">{stageLabels[pending.stage]} · capturada em {formatDate(pending.deviceCapturedAt)}</p></div><FileClock size={18} /></div><div className="mt-3 flex flex-wrap gap-4"><button disabled={!online || props.busy} className="font-semibold underline disabled:opacity-40" onClick={() => void props.run(async () => syncAction(pending), "Ação confirmada pelo servidor.")}>Tentar enviar novamente</button><button className="font-semibold text-[#8a4339] underline" onClick={() => { removeFromOutbox(pending.deviceActionId); props.setMessage("Ação pendente descartada somente deste aparelho."); }}>Descartar deste aparelho</button></div></article>
            ))}
            {!outbox.length && <p className="rounded-xl border border-dashed border-[#cbd5ce] bg-white p-6 text-center text-sm text-[#66756d]">Nenhuma ação pendente neste aparelho.</p>}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[460px] grid-cols-3 border-t border-[#d7dfd9] bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(23,35,31,0.08)]" aria-label="App de campo">
        {([[
          "today",
          "Hoje",
        ], ["evidence", "Evidências"], ["queue", `Fila${outbox.length ? ` (${outbox.length})` : ""}`]] as const).map(([id, label]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={`px-2 py-4 text-xs font-semibold ${tab === id ? "text-[#5f52bd]" : "text-[#65746c]"}`}>{label}</button>
        ))}
      </nav>
    </section>
  );
}
