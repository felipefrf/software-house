"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ClipboardList,
  ExternalLink,
  Images,
  LocateFixed,
  RefreshCw,
  UploadCloud,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  checklistForStage,
  isChecklistComplete,
  isOperationalToday,
  localOutboxKey,
  operationStages,
  prioritizeOperations,
  stageLabels,
} from "./action";
import { ItemManifest, manifestSummary } from "./item-manifest";
import { StageRail } from "./stage-rail";
import type { LogisticsSnapshot, Operation, PendingAction } from "./types";
import {
  Button,
  capitalize,
  Card,
  CheckMark,
  dateFormatter,
  Disclosure,
  Empty,
  Field,
  formatTime,
  formatWhen,
  inputClass,
  linkClass,
  mapsPointUrl,
  Notice,
  Pill,
  placeParts,
  plural,
  RouteDots,
  SectionTitle,
  sourceText,
} from "./ui";
import { formatDate, formatDuration, mapsUrl, type Run } from "./workspace";

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
  const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
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
      setSeconds(startedAt ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0);
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [startedAt]);
  return seconds;
}

/** Linha de requisito da ação: estado à esquerda, controle à direita. */
function Requirement({
  done,
  label,
  detail,
  children,
}: {
  done: boolean;
  label: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <CheckMark checked={done} />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-5">{label}</span>
        {detail && <span className="mt-0.5 block text-[14px] text-imp-muted">{detail}</span>}
      </span>
      {children}
    </div>
  );
}

function CapturePhoto({
  value,
  onChange,
  run,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  run: Run;
  label: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-imp-line bg-imp-surface px-3.5 text-[15px] font-semibold shadow-imp-soft has-focus-visible:outline-3 has-focus-visible:outline-imp-green">
        <Camera size={18} aria-hidden="true" />
        {value ? "Refazer" : label}
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void run(async () => onChange(await compressPhoto(file)), "Foto pronta.");
          }}
        />
      </label>
      {value && (
        <Image unoptimized src={value} alt="Prévia da foto" width={160} height={96} className="h-16 w-24 rounded-lg object-cover" />
      )}
    </div>
  );
}

function OperationRow({
  operation,
  onOpen,
  emphasis,
}: {
  operation: Operation;
  onOpen: () => void;
  emphasis: boolean;
}) {
  const place = placeParts(operation);
  const stageIndex = operationStages.indexOf(operation.stage) + 1;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full rounded-2xl border bg-imp-surface p-4 text-left shadow-imp-card transition-[box-shadow,border-color] hover:border-imp-line-strong hover:shadow-imp-lift ${
          emphasis ? "border-imp-line/70" : "border-imp-line/70"
        }`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className={`font-imp-display font-semibold tabular-nums ${emphasis ? "text-[26px] leading-7" : "text-[18px] leading-6"}`}>
            {formatWhen(operation.scheduled_at)}
          </span>
          {operation.status !== "active" && (
            <Pill tone={operation.status === "completed" ? "green" : "red"}>
              {operation.status === "completed" ? "Concluída" : "Cancelada"}
            </Pill>
          )}
        </span>
        <span className={`mt-1 block break-words font-semibold ${emphasis ? "text-[19px] leading-6" : "text-[16px] leading-5"}`}>
          {operation.event_name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[14px] leading-5 text-imp-muted">{place.address}</span>
        {operation.status === "active" && (
          <span className="mt-3 flex items-end justify-between gap-3 border-t border-imp-line pt-3">
            <span className="text-[14px]">
              <RouteDots operation={operation} className="mb-1.5" />
              <span className="block">
                <strong>{stageLabels[operation.stage]}</strong>
                <span className="text-imp-muted"> · etapa {stageIndex} de {operationStages.length}</span>
              </span>
            </span>
            <span className="text-[15px] font-semibold text-imp-green">{isOperationalToday(operation) ? "Continuar" : "Abrir"}</span>
          </span>
        )}
      </button>
    </li>
  );
}

export function FieldApp(props: Props) {
  const [tab, setTab] = useState<"today" | "evidence" | "queue">("today");
  const [stageOpen, setStageOpen] = useState(false);
  const [outbox, setOutbox] = useState<PendingAction[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [location, setLocation] = useState<PendingAction["location"] | null>(null);
  const [arrivalAccess, setArrivalAccess] = useState<"released" | "blocked" | "">("");
  const [incidentPhoto, setIncidentPhoto] = useState("");
  const outboxKey = localOutboxKey(props.snapshot.user?.id ?? "anonymous");
  const online = useOnline();
  const selected =
    props.snapshot.operations.find((operation) => operation.id === props.selectedId) ?? props.snapshot.operations[0];
  const elapsed = useElapsed(selected?.stage_started_at);
  const currentItems = useMemo(() => (selected ? checklistForStage(selected.stage) : []), [selected]);
  const pendingForSelected = outbox.filter((action) => action.operationId === selected?.id);
  const responsiblePeople = useMemo(() => {
    if (!selected) return [];
    const team = props.snapshot.teams.find((item) => item.id === selected.team_id);
    const allowed = new Set(
      [props.snapshot.user?.id, selected.driver_id, ...(team?.member_ids ?? [])].filter((id): id is string => Boolean(id)),
    );
    return props.snapshot.people.filter((person) => allowed.has(person.id));
  }, [props.snapshot.people, props.snapshot.teams, props.snapshot.user?.id, selected]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(outboxKey) ?? "[]") as PendingAction[];
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
      throw new Error("O aparelho não conseguiu salvar a ação localmente. Libere espaço antes de sair da tela.");
    }
  };

  const removeFromOutbox = (deviceActionId: string) => {
    const next = outbox.filter((item) => item.deviceActionId !== deviceActionId);
    try {
      localStorage.setItem(outboxKey, JSON.stringify(next));
    } catch {
      try {
        localStorage.removeItem(outboxKey);
      } catch {
        // A confirmação no servidor não deve falhar por indisponibilidade local.
      }
    }
    setOutbox(next);
  };

  const resetCapture = () => {
    setChecks({});
    setPhotoDataUrl("");
    setLocation(null);
    setArrivalAccess("");
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setChecks({});
      setPhotoDataUrl("");
      setLocation(null);
      setArrivalAccess("");
    });
    return () => cancelAnimationFrame(frame);
  }, [selected?.id, selected?.stage]);

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
    const response = await fetch("/api/imperio?action=confirm-action", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; state?: string };
    if (!response.ok || payload.state !== "confirmed") throw new Error(payload.error ?? "A ação ainda está pendente.");
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
        props.setMessage("Local marcado.");
      },
      () => props.setMessage("Não foi possível marcar o local. Permita o acesso à localização no navegador."),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );

  const submitAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actionDisabled || !selected || !location || !photoDataUrl) return;
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
      responsibleId: String(form.get("responsibleId") ?? "") || props.snapshot.user?.id || "",
      arrivalAccess,
      arrivalReason: String(form.get("arrivalReason") ?? "").trim(),
      acceptanceName: String(form.get("acceptanceName") ?? "").trim(),
      photoDataUrl,
    };
    void props.run(
      async () => {
        try {
          saveOutbox([...outbox, pending]);
        } catch (error) {
          if (!online) throw error;
        }
        if (!online) return;
        await syncAction(pending);
      },
      online
        ? arrivalAccess === "blocked"
          ? "Bloqueio registrado. A torre foi avisada e a espera começou."
          : `${stageLabels[selected.stage]} concluída. A torre já vê o registro.`
        : "Salvo neste aparelho. Envie quando houver conexão.",
    );
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
      const response = await fetch("/api/imperio?action=create-incident", { method: "POST", body: form });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Ocorrência não registrada.");
      element.reset();
      setIncidentPhoto("");
      await props.refresh();
    }, "Ocorrência registrada. A torre foi avisada.");
  };

  const defaultResponsibleId =
    [selected?.driver_id, props.snapshot.user?.id].find((id) => responsiblePeople.some((person) => person.id === id)) ??
    responsiblePeople[0]?.id ??
    "";
  const actionDisabled =
    props.busy ||
    !props.snapshot.configured ||
    !selected ||
    selected.status !== "active" ||
    !isChecklistComplete(checks, selected.stage) ||
    !photoDataUrl ||
    !location ||
    !defaultResponsibleId ||
    pendingForSelected.some((item) => item.stage === selected.stage) ||
    (selected.stage === "arrival" && !arrivalAccess);

  const navPadding = "pb-[calc(76px+env(safe-area-inset-bottom))]";
  const actionPadding = "pb-[calc(168px+env(safe-area-inset-bottom))]";

  const firstName = props.snapshot.user?.full_name.split(" ")[0];
  const today = props.snapshot.operations.filter((operation) => isOperationalToday(operation));
  const upcoming = props.snapshot.operations.filter(
    (operation) => operation.status === "active" && !isOperationalToday(operation),
  );
  const closed = props.snapshot.operations.filter((operation) => operation.status !== "active");

  const openOperation = (operation: Operation) => {
    props.setSelectedId(operation.id);
    resetCapture();
    setStageOpen(true);
    window.scrollTo({ top: 0 });
  };

  const evidenceByOperation = props.snapshot.operations
    .filter((operation) => operation.events.length > 0)
    .map((operation) => ({
      operation,
      items: [...operation.events].sort((a, b) => Date.parse(b.server_received_at) - Date.parse(a.server_received_at)),
    }))
    .sort((a, b) => Date.parse(b.items[0].server_received_at) - Date.parse(a.items[0].server_received_at));

  const connectionNotice =
    !online ? (
      <Notice tone="amber" title="Sem conexão">
        Você pode concluir etapas; elas ficam salvas neste aparelho até a conexão voltar.
        {outbox.length > 0 && ` ${plural(outbox.length, "registro aguarda", "registros aguardam")} envio.`}
      </Notice>
    ) : outbox.length > 0 ? (
      <Notice
        tone="amber"
        title={`${plural(outbox.length, "registro aguarda", "registros aguardam")} envio`}
        action={
          <Button variant="secondary" onClick={() => setTab("queue")}>
            Ver envios pendentes
          </Button>
        }
      >
        Foram salvos neste aparelho e ainda não chegaram à torre.
      </Notice>
    ) : null;

  const bottomNav = (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-imp-line/70 bg-imp-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(23,33,29,.12)]"
      aria-label="App de campo"
    >
      <div className="mx-auto grid max-w-[480px] grid-cols-3">
        {(
          [
            ["today", "Hoje", ClipboardList],
            ["evidence", "Evidências", Images],
            ["queue", outbox.length ? `Envios (${outbox.length})` : "Envios", UploadCloud],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              if (id === "today") setStageOpen(false);
            }}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-[13px] font-semibold ${
              tab === id ? "text-imp-green" : "text-imp-muted"
            }`}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );

  if (!selected)
    return (
      <>
        <section className={`mx-auto max-w-[480px] px-4 py-6 ${navPadding}`}>
          {connectionNotice}
          <h1 className="mt-4 font-imp-display text-[30px] font-semibold leading-tight">Hoje</h1>
          <p className="text-[15px] text-imp-muted">{dateFormatter.format(new Date())}</p>
          <div className="mt-5">
            <Empty>Nenhuma operação escalada para você. A coordenação precisa associar você ou sua equipe a uma operação.</Empty>
          </div>
        </section>
        {bottomNav}
      </>
    );

  const uncheckedCount = currentItems.filter((item) => !checks[item]).length;
  const hasPendingStage = pendingForSelected.some((item) => item.stage === selected.stage);
  const requirementsLeft = [
    uncheckedCount ? `${plural(uncheckedCount, "item", "itens")} do checklist` : "",
    photoDataUrl ? "" : "foto",
    location ? "" : "local",
    defaultResponsibleId ? "" : "responsável",
    selected.stage === "arrival" && !arrivalAccess ? "situação do acesso" : "",
  ].filter(Boolean);
  const actionHint = props.busy
    ? "Enviando…"
    : hasPendingStage
      ? "Esta etapa já tem um envio pendente neste aparelho. Veja em Envios."
      : requirementsLeft.length
        ? `Falta: ${requirementsLeft.join(", ")}.${props.snapshot.configured ? "" : " Demonstração: nada é enviado."}`
        : !props.snapshot.configured
          ? "Tudo pronto. Na demonstração, a conclusão não é enviada."
          : online
            ? "Tudo pronto. O registro vai direto para a torre."
            : "Tudo pronto. Sem conexão, o registro fica salvo neste aparelho.";

  const place = placeParts(selected);
  const manifest = manifestSummary(selected);
  // ponytail: conferir itens é a tarefa nas etapas de carga; nas demais fica recolhido.
  const manifestIsTask = selected.stage === "preparation" || selected.stage === "departure";
  const unresolvedIncidents = props.snapshot.incidents.filter(
    (incident) => incident.operation_id === selected.id && incident.status !== "resolved",
  );
  const team = props.snapshot.teams.find((item) => item.id === selected.team_id);
  const vehicle = props.snapshot.vehicles.find((item) => item.id === selected.vehicle_id);
  const driver = props.snapshot.people.find((item) => item.id === selected.driver_id);
  const stageIndex = operationStages.indexOf(selected.stage) + 1;

  const manifestBlock = manifest.total > 0 && (
    <Card className="mt-4 px-4">
      <Disclosure
        className="border-t-0"
        open={manifestIsTask && !manifest.complete}
        summary="Conferir itens da carga"
        meta={
          <span className={manifest.complete ? "text-imp-green" : ""}>
            {manifest.checked} de {manifest.total}
          </span>
        }
      >
        <ItemManifest
          operation={selected}
          configured={props.snapshot.configured}
          busy={props.busy}
          online={online}
          refresh={props.refresh}
          run={props.run}
          dense
        />
      </Disclosure>
    </Card>
  );

  return (
    <>
      <section
        className={`mx-auto max-w-[480px] px-4 pt-4 ${
          tab === "today" && stageOpen && selected.status === "active" ? actionPadding : navPadding
        }`}
      >
        {tab === "today" && !stageOpen && (
          <>
            {connectionNotice}
            <div className={`flex items-end justify-between gap-3 ${connectionNotice ? "mt-4" : ""}`}>
              <div>
                <p className="text-[15px] text-imp-muted">{firstName ? `Olá, ${firstName}. ` : ""}{capitalize(dateFormatter.format(new Date()))}</p>
                <h1 className="font-imp-display text-[32px] font-semibold leading-tight">
                  {today.length ? `${plural(today.length, "operação", "operações")} hoje` : "Nada escalado para hoje"}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => void props.run(props.refresh, "Operações atualizadas.")}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-imp-line bg-imp-surface shadow-imp-soft"
                aria-label="Atualizar operações"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {prioritizeOperations(today, props.snapshot.incidents).map((operation) => (
                <OperationRow key={operation.id} operation={operation} emphasis onOpen={() => openOperation(operation)} />
              ))}
            </ul>

            {upcoming.length > 0 && (
              <div className="mt-7">
                <SectionTitle count={upcoming.length}>Próximas</SectionTitle>
                <ul className="mt-3 space-y-2">
                  {[...upcoming]
                    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
                    .map((operation) => (
                      <OperationRow key={operation.id} operation={operation} emphasis={false} onOpen={() => openOperation(operation)} />
                    ))}
                </ul>
              </div>
            )}

            {closed.length > 0 && (
              <div className="mt-6">
                <Disclosure summary="Encerradas" meta={closed.length}>
                  <ul className="space-y-2">
                    {closed.map((operation) => (
                      <OperationRow key={operation.id} operation={operation} emphasis={false} onOpen={() => openOperation(operation)} />
                    ))}
                  </ul>
                </Disclosure>
              </div>
            )}

            <details className="pwa-install-hint mt-8 text-[14px] text-imp-muted">
              <summary className="min-h-11 cursor-pointer content-center font-semibold text-imp-green">Instalar como app neste celular</summary>
              <p className="mt-1 leading-6">
                iPhone: abra no Safari, toque em Compartilhar e em Adicionar à Tela de Início. Android: menu do Chrome e Instalar app.
              </p>
            </details>
          </>
        )}

        {tab === "today" && stageOpen && (
          <>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStageOpen(false)}
                className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-semibold text-imp-green"
              >
                <ArrowLeft size={18} aria-hidden="true" /> Hoje
              </button>
              <button
                type="button"
                onClick={() =>
                  void props.run(async () => {
                    await props.refresh();
                    resetCapture();
                  }, "Operação atualizada.")
                }
                className="grid min-h-11 min-w-11 place-items-center rounded-xl text-imp-muted"
                aria-label="Atualizar operação"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
            </div>

            {connectionNotice && <div className="mt-2">{connectionNotice}</div>}

            <div className="mt-2">
              <p className="text-[15px] font-medium tabular-nums text-imp-muted">{formatWhen(selected.scheduled_at)}</p>
              <h1 className="mt-0.5 break-words font-imp-display text-[28px] font-semibold leading-tight">
                {selected.event_name}
              </h1>
              <p className="mt-1 text-[15px] leading-5 text-imp-muted">{place.address}</p>
              <p className="mt-1 text-[13px] text-imp-muted">{sourceText(selected)}</p>
            </div>

            <Card className="mt-4 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px]">
                  <strong className="text-[17px]">{stageLabels[selected.stage]}</strong>
                  <span className="text-imp-muted"> · etapa {stageIndex} de {operationStages.length}</span>
                </p>
                {selected.status === "active" && (
                  <span className="text-[14px] tabular-nums text-imp-muted">há {formatDuration(elapsed)}</span>
                )}
              </div>
              <div className="mt-2">
                <StageRail operation={selected} compact />
              </div>
            </Card>

            {selected.waiting_since && selected.stage === "arrival" && (
              <div className="mt-4">
                <Notice tone="amber" title={`Em espera desde ${formatTime(selected.waiting_since)}`}>
                  O acesso estava bloqueado. Quando liberarem a entrada, marque “Sim, liberado” abaixo e conclua a chegada.
                </Notice>
              </div>
            )}
            {unresolvedIncidents.length > 0 && (
              <div className="mt-4">
                <Notice tone="amber" title={`${plural(unresolvedIncidents.length, "ocorrência", "ocorrências")} em aberto`}>
                  A torre foi avisada. Você pode seguir com a etapa.
                </Notice>
              </div>
            )}

            {manifestIsTask && manifestBlock}

            {selected.status !== "active" ? (
              <Card className="mt-4 p-5 text-center">
                <Check className="mx-auto text-imp-green" aria-hidden="true" />
                <strong className="mt-2 block text-[17px]">
                  {selected.status === "completed" ? "Operação concluída" : "Operação cancelada"}
                </strong>
                {selected.cancel_reason && <p className="mt-2 text-[15px] text-imp-muted">{selected.cancel_reason}</p>}
              </Card>
            ) : (
              <form id="stage-action" onSubmit={submitAction} className="mt-4 rounded-2xl border border-imp-line/70 bg-imp-surface shadow-imp-card p-4">
                <p className="text-[14px] font-semibold text-imp-green">Próxima ação</p>
                <h2 className="mt-0.5 font-imp-display text-[26px] font-semibold leading-tight">
                  {selected.stage === "arrival" && arrivalAccess === "blocked"
                    ? "Registrar bloqueio"
                    : `Concluir ${stageLabels[selected.stage].toLowerCase()}`}
                </h2>

                <fieldset className="mt-4">
                  <legend className="text-[14px] font-semibold text-imp-muted">Checklist</legend>
                  <div className="mt-1 divide-y divide-imp-line">
                    {currentItems.map((item) => (
                      <label
                        key={item}
                        className="flex min-h-14 cursor-pointer items-center gap-3 py-2 has-focus-visible:outline-3 has-focus-visible:outline-imp-green"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checks[item])}
                          onChange={(event) => setChecks({ ...checks, [item]: event.target.checked })}
                          className="sr-only"
                        />
                        <CheckMark checked={Boolean(checks[item])} />
                        <span className="text-[16px] font-medium leading-5">{item}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {selected.stage === "arrival" && (
                  <fieldset className="mt-4">
                    <legend className="text-[14px] font-semibold text-imp-muted">O acesso ao local foi liberado?</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["released", "Sim, liberado"],
                          ["blocked", "Não, bloqueado"],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold has-focus-visible:outline-3 has-focus-visible:outline-imp-green ${
                            arrivalAccess === value
                              ? value === "released"
                                ? "border-imp-green bg-imp-green-tint text-imp-green"
                                : "border-imp-amber bg-imp-amber-tint text-imp-amber"
                              : "border-imp-line-strong"
                          }`}
                        >
                          <input
                            type="radio"
                            name="arrivalAccess"
                            value={value}
                            className="sr-only"
                            checked={arrivalAccess === value}
                            onChange={() => setArrivalAccess(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {arrivalAccess === "blocked" && (
                      <Field label="Motivo do bloqueio" className="mt-3">
                        <textarea name="arrivalReason" required minLength={3} rows={2} className={inputClass} />
                      </Field>
                    )}
                  </fieldset>
                )}

                {selected.stage === "delivery" && (
                  <Field label="Quem recebeu no local" className="mt-4">
                    <input name="acceptanceName" required minLength={2} className={inputClass} placeholder="Nome de quem conferiu" />
                  </Field>
                )}

                <div className="mt-4 divide-y divide-imp-line border-t border-imp-line">
                  <Requirement
                    done={Boolean(photoDataUrl)}
                    label="Foto da etapa"
                    detail={photoDataUrl ? "Foto pronta" : "Tire uma foto do resultado da etapa"}
                  >
                    <CapturePhoto value={photoDataUrl} onChange={setPhotoDataUrl} run={props.run} label="Tirar foto" />
                  </Requirement>
                  <Requirement
                    done={Boolean(location)}
                    label="Onde você está"
                    detail={location ? `Local marcado (±${Math.round(location.accuracy)} m)` : "Marque o local para registrar onde a etapa terminou"}
                  >
                    <Button variant="secondary" onClick={captureGps}>
                      <LocateFixed size={18} aria-hidden="true" /> {location ? "Marcar de novo" : "Marcar local"}
                    </Button>
                  </Requirement>
                </div>

                <Field label="Responsável pela etapa" className="mt-4">
                  <select name="responsibleId" className={inputClass} defaultValue={defaultResponsibleId} required>
                    {responsiblePeople.map((person) => (
                      <option value={person.id} key={person.id}>
                        {person.full_name} · {person.job_title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Disclosure summary="Adicionar observação" className="mt-4">
                  <textarea name="note" className={inputClass} rows={2} aria-label="Observação" />
                </Disclosure>
              </form>
            )}

            {!manifestIsTask && manifestBlock}

            <Card className="mt-4 px-4">
              <Disclosure className="border-t-0" summary={<span className="flex items-center gap-2"><AlertTriangle size={18} aria-hidden="true" /> Registrar ocorrência</span>}>
                <p className="text-[15px] leading-6 text-imp-muted">Avisa a torre sem avançar a etapa.</p>
                <form onSubmit={submitIncident} className="mt-3 space-y-3">
                  <Field label="O que aconteceu">
                    <select name="type" className={inputClass} required>
                      <option value="delay">Atraso</option>
                      <option value="access">Acesso</option>
                      <option value="damage">Avaria</option>
                      <option value="missing_item">Item ausente</option>
                      <option value="other">Outro</option>
                    </select>
                  </Field>
                  <Field label="Gravidade">
                    <select name="severity" className={inputClass} required>
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </Field>
                  <Field label="Descrição">
                    <textarea name="description" required minLength={3} rows={3} className={inputClass} />
                  </Field>
                  <Field label="Impacto (opcional)">
                    <input name="impact" className={inputClass} />
                  </Field>
                  <Field label="Quem trata">
                    <select name="responsibleId" className={inputClass}>
                      <option value="">A definir na torre</option>
                      {responsiblePeople.map((person) => (
                        <option value={person.id} key={person.id}>
                          {person.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-medium">Foto (opcional)</span>
                    <CapturePhoto value={incidentPhoto} onChange={setIncidentPhoto} run={props.run} label="Tirar foto" />
                  </div>
                  <Button type="submit" variant="danger" disabled={props.busy || !props.snapshot.configured || !online} className="w-full">
                    Registrar ocorrência
                  </Button>
                  {!online ? (
                    <p className="text-[13px] text-imp-amber">Sem conexão. Ocorrências só podem ser registradas com internet; tente de novo quando o sinal voltar.</p>
                  ) : !props.snapshot.configured ? (
                    <p className="text-[13px] text-imp-muted">Registro desativado no ambiente de demonstração.</p>
                  ) : null}
                </form>
              </Disclosure>
            </Card>

            <Card className="mt-4 p-4">
              <dl className="grid grid-cols-3 gap-3 text-[14px]">
                <div>
                  <dt className="text-imp-muted">Equipe</dt>
                  <dd className="font-semibold">{team?.name ?? "Não escalada"}</dd>
                </div>
                <div>
                  <dt className="text-imp-muted">Veículo</dt>
                  <dd className="font-semibold">{vehicle?.name ?? "Não escalado"}</dd>
                </div>
                <div>
                  <dt className="text-imp-muted">Motorista</dt>
                  <dd className="font-semibold">{driver?.full_name.split(" ")[0] ?? "Não escalado"}</dd>
                </div>
              </dl>
              <a
                href={mapsUrl(selected.destination)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-imp-line bg-imp-surface px-3 text-[15px] font-semibold shadow-imp-soft"
              >
                Abrir rota no Google Maps <ExternalLink size={16} aria-hidden="true" />
              </a>
            </Card>

            {selected.status === "active" && (
              <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-20 border-t border-imp-line bg-imp-surface/95 backdrop-blur">
                <div className="mx-auto max-w-[480px] px-4 py-3">
                  <button
                    type="submit"
                    form="stage-action"
                    aria-disabled={actionDisabled}
                    aria-describedby="stage-action-hint"
                    onClick={(event) => {
                      if (actionDisabled) event.preventDefault();
                    }}
                    className={`min-h-13 w-full rounded-xl px-4 text-[17px] font-semibold transition-[background-color,box-shadow] ${
                      actionDisabled ? "cursor-not-allowed bg-imp-line text-imp-muted" : "bg-imp-green text-white shadow-imp-lift hover:bg-imp-green-deep"
                    }`}
                  >
                    {selected.stage === "arrival" && arrivalAccess === "blocked"
                      ? "Registrar bloqueio"
                      : `Concluir ${stageLabels[selected.stage].toLowerCase()}`}
                  </button>
                  <p id="stage-action-hint" aria-live="polite" className="mt-1.5 text-center text-[13px] leading-4 text-imp-muted">
                    {actionHint}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "evidence" && (
          <div>
            <h1 className="font-imp-display text-[30px] font-semibold leading-tight">Evidências</h1>
            <p className="text-[15px] text-imp-muted">Etapas já recebidas pela torre, por operação.</p>
            <div className="mt-4 space-y-3">
              {evidenceByOperation.map(({ operation, items }) => (
                <Card key={operation.id} className="px-4">
                  <Disclosure
                    className="border-t-0"
                    open={isOperationalToday(operation)}
                    summary={<span className="break-words">{operation.event_name}</span>}
                    meta={plural(items.length, "registro", "registros")}
                  >
                    <ul className="divide-y divide-imp-line">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 py-3">
                          <Check size={18} className="mt-0.5 shrink-0 text-imp-green" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[16px] font-semibold">
                              {stageLabels[item.stage]} <span className="font-normal text-imp-muted">· {formatWhen(item.server_received_at)}</span>
                            </p>
                            <p className="text-[14px] text-imp-muted">
                              {item.actor_name} ·{" "}
                              <a href={mapsPointUrl(item.latitude, item.longitude)} target="_blank" rel="noreferrer" className={linkClass}>
                                Ver no mapa
                              </a>
                              {item.photo_url && (
                                <>
                                  {" · "}
                                  <a href={item.photo_url} target="_blank" rel="noreferrer" className={linkClass}>
                                    Abrir foto
                                  </a>
                                </>
                              )}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </Card>
              ))}
            </div>
            {!evidenceByOperation.length && <div className="mt-4"><Empty>Conclua uma etapa para gerar a primeira evidência.</Empty></div>}
          </div>
        )}

        {tab === "queue" && (
          <div>
            <h1 className="font-imp-display text-[30px] font-semibold leading-tight">Envios pendentes</h1>
            <p className="text-[15px] leading-6 text-imp-muted">
              Etapas concluídas sem sinal ficam aqui até chegarem à torre. Abrir ou recarregar o app exige internet.
            </p>
            <ul className="mt-4 space-y-2">
              {outbox.map((pending) => (
                <li key={pending.deviceActionId} className="rounded-2xl border border-imp-amber/30 bg-imp-amber-tint p-4">
                  <strong className="block text-[16px]">
                    {props.snapshot.operations.find((operation) => operation.id === pending.operationId)?.event_name ?? "Operação"}
                  </strong>
                  <p className="text-[14px] text-imp-amber">
                    {stageLabels[pending.stage]} · concluída {formatDate(pending.deviceCapturedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      disabled={!online || props.busy}
                      onClick={() => void props.run(async () => syncAction(pending), "Registro recebido pela torre.")}
                    >
                      Enviar agora
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-imp-red hover:bg-imp-red-tint"
                      onClick={() => {
                        if (!window.confirm("Descartar esta ação somente deste aparelho?")) return;
                        removeFromOutbox(pending.deviceActionId);
                        props.setMessage("Registro descartado deste aparelho.");
                      }}
                    >
                      Descartar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {!outbox.length && (
              <div className="mt-4">
                <Empty>
                  {online ? "Nenhum registro aguardando envio." : (
                    <span className="inline-flex items-center gap-2"><WifiOff size={16} aria-hidden="true" /> Sem conexão e nada pendente.</span>
                  )}
                </Empty>
              </div>
            )}
          </div>
        )}
      </section>
      {bottomNav}
    </>
  );
}
