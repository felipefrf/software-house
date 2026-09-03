"use client";

import {
  AlertTriangle,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sun,
  Truck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  checklistForStage,
  isOperationalToday,
  matchesOperationFilters,
  operationDateInput,
  operationDateTimeInput,
  operationSignals,
  operationStages,
  operationTimestamp,
  prioritizeOperations,
  stageLabels,
  stageState,
} from "./action";
import { ItemManifest, manifestSummary } from "./item-manifest";
import { StageRail } from "./stage-rail";
import type {
  Incident,
  LogisticsSnapshot,
  Operation,
  OperationEvent,
  OperationStage,
  EstoqueNowSyncRun,
} from "./types";
import {
  Button,
  capitalize,
  Card,
  CheckMark,
  dateFormatter,
  Disclosure,
  Empty,
  Field,
  formatShortDate,
  formatTime,
  formatWhen,
  inputClass,
  linkClass,
  mapsPointUrl,
  Notice,
  PageTitle,
  plural,
  Pill,
  placeParts,
  RouteDots,
  SectionTitle,
  sourceText,
  type Tone,
} from "./ui";
import { formatDate, formatDuration, mapsUrl, postJson, type Run } from "./workspace";

type Props = {
  snapshot: LogisticsSnapshot;
  selectedId: string;
  setSelectedId: (id: string) => void;
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  refreshState: { lastUpdatedAt: string | null; failed: boolean };
  navigationCollapsed: boolean;
  onNavigationCollapsedChange: (collapsed: boolean) => void;
};

type View =
  | "today"
  | "operations"
  | "calendar"
  | "people"
  | "fleet"
  | "evidence"
  | "incidents"
  | "integrations";

type EstoqueNowPreview = {
  mode: "preview";
  startDate: string;
  endDate: string;
  importEnabled: boolean;
  total: number;
  movementsTotal: number;
  candidates: Array<{
    externalId: string;
    eventName: string;
    destination: string;
    scheduledAt: string;
    reviewToken: string;
    databaseImportedAt: string | null;
    orderId: string | null;
    returnAt: string | null;
    externalStatus: string | null;
    externalConcluded: boolean | null;
    itemCount: string | null;
    sourceVersion: string | null;
    returnExternalStatus: string | null;
    returnExternalConcluded: boolean | null;
    changedFields: string[];
    state: "new" | "unchanged" | "update" | "diverged" | "blocked";
  }>;
  counts: {
    new: number;
    unchanged: number;
    update: number;
    blocked: number;
    diverged: number;
    skipped: number;
  };
  skippedReasons: {
    missing_external_id: number;
    invalid_external_id: number;
    missing_event_name: number;
    invalid_event_name: number;
    missing_destination: number;
    invalid_destination: number;
    invalid_scheduled_date_or_time: number;
  };
  contract: {
    pages: Array<{
      page: number | null;
      perPage: number | null;
      recordsTotal: number | null;
      recordsFiltered: number | null;
      records: number;
    }>;
    fields: Array<{ path: string; signatures: string[]; occurrences: number }>;
    facets: Array<{ field: string; values: Array<{ value: string; occurrences: number }> }>;
  };
};

type EstoqueNowDetailPreview = {
  externalId: string;
  itemsToken: string;
  itemsChanged: boolean;
  itemsBlocked: boolean;
  checksReset: number;
  items: Array<{ id: string; itemId: string; orderId: string; name: string }>;
  mediaProbe: {
    available: boolean;
    sourceHost: string | null;
    contentType: string | null;
    reason: string | null;
  } | null;
  contract: {
    fields: Array<{ path: string; signatures: string[]; occurrences: number }>;
    mediaFields: Array<{ path: string; signatures: string[]; occurrences: number }>;
  };
};

type PreviewRequestState = "idle" | "loading" | "succeeded" | "failed";

const automaticRunStatus = (
  run: EstoqueNowSyncRun | null,
  stale: boolean,
): { label: string; tone: Tone } => {
  if (!run) return { label: "Ainda não executado", tone: "neutral" };
  if (run.status === "running") return { label: "Em andamento", tone: "amber" };
  if (run.status === "failed" || run.status === "abandoned") return { label: "Falha", tone: "red" };
  if (run.status === "partial") return { label: "Parcial", tone: "amber" };
  if (run.status === "skipped") return { label: "Ignorado", tone: "amber" };
  if (stale) return { label: "Desatualizado", tone: "amber" };
  return { label: "Saudável", tone: "green" };
};

const isAutomaticRunStale = (run: EstoqueNowSyncRun | null) => {
  const finishedAt = run?.finishedAt;
  return Boolean(finishedAt && Date.now() - Date.parse(finishedAt) > 45 * 60 * 1000);
};

const formatSyncWindowDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : formatDate(value);

const formValue = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const statusLabel = { active: "Em operação", completed: "Concluída", cancelled: "Cancelada" };

const incidentTypeLabel: Record<Incident["type"], string> = {
  delay: "Atraso",
  damage: "Avaria",
  missing_item: "Item ausente",
  access: "Acesso",
  other: "Outro",
};

const incidentStatusLabel: Record<Incident["status"], string> = {
  open: "Aberta",
  handling: "Em tratamento",
  resolved: "Resolvida",
};

const riskLabel = { critical: "Crítica", attention: "Atenção", ready: "Sem alerta" };

/** Frase única que diz o que a torre precisa fazer com a operação agora. */
const nextActionText = (operation: Operation, incidents: Incident[]) => {
  if (operation.status !== "active") return statusLabel[operation.status];
  const signals = operationSignals(operation, incidents);
  if (signals.criticalIncident) return "Ver ocorrência crítica";
  if (signals.incompleteScale) return "Completar a escala";
  if (signals.delayed) return operation.waiting_since ? "Ver espera na chegada" : "Ver atraso";
  if (signals.unresolved.length) return `Ver ${plural(signals.unresolved.length, "ocorrência", "ocorrências")}`;
  return `Aguardando ${stageLabels[operation.stage].toLowerCase()} pelo campo`;
};

function Input({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
  minLength,
  readOnly = false,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input className={inputClass} name={name} type={type} required={required} defaultValue={defaultValue} minLength={minLength} readOnly={readOnly} />
    </Field>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
  required = true,
}: {
  name: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <select className={inputClass} name={name} defaultValue={defaultValue ?? ""} required={required}>
        <option value="">Selecione</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Submit({ busy, configured, label }: { busy: boolean; configured: boolean; label: string }) {
  return (
    <>
      <Button type="submit" variant="primary" disabled={busy || !configured} className="w-full">
        {busy ? "Salvando…" : label}
      </Button>
      {!configured && <p className="mt-2 text-center text-[13px] text-imp-muted">Demonstração: nada é salvo.</p>}
    </>
  );
}

const scaleText = (snapshot: LogisticsSnapshot, operation: Operation) => {
  const team = snapshot.teams.find((item) => item.id === operation.team_id)?.name;
  const vehicle = snapshot.vehicles.find((item) => item.id === operation.vehicle_id)?.name;
  const driver = snapshot.people.find((item) => item.id === operation.driver_id)?.full_name.split(" ")[0];
  return { team, vehicle, driver, complete: Boolean(team && vehicle && driver) };
};

/** Linha do quadro de operações: hora, evento, rota, escala, próxima ação. */
function OperationRow({
  operation,
  snapshot,
  selected,
  onOpen,
  showDate,
  compact = false,
}: {
  operation: Operation;
  snapshot: LogisticsSnapshot;
  selected: boolean;
  onOpen: () => void;
  showDate: boolean;
  compact?: boolean;
}) {
  const place = placeParts(operation);
  const scale = scaleText(snapshot, operation);
  const risk = operationSignals(operation, snapshot.incidents).risk;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={`grid w-full gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-imp-ground/70 ${
          compact ? "grid-cols-[minmax(0,1fr)_auto]" : "@3xl:grid-cols-[88px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_20px] @3xl:items-center"
        } ${
          selected ? "bg-imp-green-tint/50" : ""
        }`}
      >
        <span className={`${compact ? "col-span-2 text-[13px] font-semibold text-imp-green" : "text-[14px] font-semibold leading-5 text-imp-green"} tabular-nums`}>
          {showDate ? formatWhen(operation.scheduled_at) : formatTime(operation.scheduled_at)}
        </span>
        <span className={`min-w-0 ${compact ? "col-span-2" : ""}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="break-words font-imp-display text-[18px] leading-5">{operation.event_name}</strong>
            {risk === "critical" && <Pill tone="red">Crítica</Pill>}
            {risk === "attention" && <Pill tone="amber">Atenção</Pill>}
            {operation.status !== "active" && <Pill tone={operation.status === "completed" ? "green" : "red"}>{statusLabel[operation.status]}</Pill>}
          </span>
          <span className="mt-0.5 line-clamp-1 block text-[14px] text-imp-muted">{place.address}</span>
        </span>
        <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] ${compact ? "min-w-0" : ""}`}>
          <RouteDots operation={operation} />
          <span className="font-medium">{stageLabels[operation.stage]}</span>
        </span>
        <span className={`text-[14px] ${compact ? "hidden" : ""}`}>
          {scale.complete ? (
            <span className="text-imp-muted">
              {scale.team} · {scale.vehicle} · {scale.driver}
            </span>
          ) : operation.status === "active" ? (
            <span className="font-semibold text-imp-amber">Escala incompleta</span>
          ) : (
            <span className="text-imp-muted">{[scale.team, scale.vehicle, scale.driver].filter(Boolean).join(" · ") || "Sem escala"}</span>
          )}
        </span>
        <ChevronRight size={18} className={`${compact ? "self-center justify-self-end" : "hidden justify-self-end @3xl:block"} text-imp-muted`} aria-hidden="true" />
      </button>
    </li>
  );
}

function OperationList({
  operations,
  snapshot,
  selectedId,
  onOpen,
  showDate = true,
  emptyText = "Nenhuma operação nesta visão.",
  compact = false,
}: {
  operations: Operation[];
  snapshot: LogisticsSnapshot;
  selectedId: string;
  onOpen: (id: string) => void;
  showDate?: boolean;
  emptyText?: string;
  compact?: boolean;
}) {
  if (!operations.length) return <Empty>{emptyText}</Empty>;
  return (
    <Card className="@container overflow-hidden">
      <div className={`${compact ? "hidden" : "hidden @3xl:grid"} grid-cols-[88px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_20px] gap-x-4 border-b border-imp-line px-4 py-2 text-[13px] font-semibold text-imp-muted`}>
        <span>{showDate ? "Quando" : "Hora"}</span>
        <span>Operação</span>
        <span>Etapa</span>
        <span>Escala</span>
        <span aria-hidden="true" />
      </div>
      <ul className="divide-y divide-imp-line">
        {operations.map((operation) => (
          <OperationRow
            key={operation.id}
            operation={operation}
            snapshot={snapshot}
            selected={selectedId === operation.id}
            onOpen={() => onOpen(operation.id)}
            showDate={showDate}
            compact={compact}
          />
        ))}
      </ul>
    </Card>
  );
}

function StageFocus({ operation, stage }: { operation: Operation; stage: OperationStage }) {
  const index = operationStages.indexOf(stage);
  const current = operationStages.indexOf(operation.stage);
  const completedEvent = operation.events.find((event) => event.stage === stage && event.event_type === "stage_completed");
  const evidence = completedEvent ?? operation.events.find((event) => event.stage === stage);
  const state = stageState(index, current, operation.status, Boolean(completedEvent));
  const stateLabel = state === "done" ? "Concluída" : state === "active" ? "Etapa atual" : "Aguardando";

  return (
    <div className="mt-4 grid gap-5 rounded-xl bg-imp-ground p-4 lg:grid-cols-2">
      <div>
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {stageLabels[stage]}
          {state === "done" ? <Pill tone="green">{stateLabel}</Pill> : <span className="text-[14px] font-medium text-imp-muted">{stateLabel}</span>}
        </p>
        <ul className="mt-3 space-y-2">
          {checklistForStage(stage).map((item) => {
            const checked = evidence?.checklist[item] === true;
            return (
              <li key={item} className="flex items-center gap-2 text-[15px]">
                <CheckMark checked={checked} size="sm" tone="neutral" />
                <span className={checked ? "" : "text-imp-muted"}>{item}</span>
                <span className="sr-only">{checked ? "confirmado" : "pendente"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="text-[15px]">
        {evidence ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-imp-muted">Confirmada</dt>
            <dd className="tabular-nums">{formatDate(evidence.server_received_at)}</dd>
            <dt className="text-imp-muted">Por</dt>
            <dd>{evidence.actor_name}</dd>
            <dt className="text-imp-muted">Responsável</dt>
            <dd>{evidence.responsible_name}</dd>
            <dt className="text-imp-muted">Local</dt>
            <dd>
              <a href={mapsPointUrl(evidence.latitude, evidence.longitude)} target="_blank" rel="noreferrer" className={linkClass}>
                Ver no mapa
              </a>{" "}
              <span className="text-imp-muted">(±{Math.round(evidence.accuracy)} m)</span>
            </dd>
            {evidence.photo_url && (
              <>
                <dt className="text-imp-muted">Foto</dt>
                <dd>
                  <a href={evidence.photo_url} target="_blank" rel="noreferrer" className={linkClass}>
                    Abrir evidência
                  </a>
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-imp-muted">
            {state === "done" ? "Etapa avançada sem evidência registrada." : "Sem registro ainda. O app de campo envia checklist, foto e GPS ao confirmar."}
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ event, configured }: { event: OperationEvent; configured: boolean }) {
  return (
    <li className="grid gap-x-4 py-3 text-[15px] sm:grid-cols-[64px_1fr]">
      <time className="font-semibold tabular-nums" dateTime={event.server_received_at}>
        {formatTime(event.server_received_at)}
      </time>
      <div>
        <p className="font-semibold">
          {event.event_type === "arrival_blocked" ? "Acesso bloqueado na chegada" : `${stageLabels[event.stage]} concluída`}
          {!configured && <span className="ml-2 text-[13px] font-medium text-imp-muted">demonstração</span>}
        </p>
        <p className="text-imp-muted">
          {event.actor_name}{event.responsible_name !== event.actor_name ? ` · responsável ${event.responsible_name}` : ""} · {formatShortDate(event.server_received_at)} · {formatDuration(event.duration_seconds)} ·{" "}
          <a href={mapsPointUrl(event.latitude, event.longitude)} target="_blank" rel="noreferrer" className={linkClass}>
            Ver no mapa
          </a>
        </p>
        {event.arrival_reason && <p className="text-imp-amber">Motivo: {event.arrival_reason}</p>}
        {event.acceptance_name && <p className="text-imp-muted">Recebido por {event.acceptance_name}</p>}
        {event.note && <p className="text-imp-muted">{event.note}</p>}
        {event.photo_url && (
          <a className={linkClass} href={event.photo_url} target="_blank" rel="noreferrer">
            Abrir foto
          </a>
        )}
      </div>
    </li>
  );
}

/** Detalhe da operação: "Agora" no topo, resto por seções recolhíveis. Existe em um lugar só. */
function OperationDetail({
  snapshot,
  operation,
  busy,
  run,
  refresh,
  onOpenEvidence,
  onOpenIncidents,
}: {
  snapshot: LogisticsSnapshot;
  operation?: Operation;
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  onOpenEvidence?: () => void;
  onOpenIncidents?: () => void;
}) {
  const [focusedStage, setFocusedStage] = useState<OperationStage>(operation?.stage ?? "preparation");
  if (!operation) return <Empty>Selecione uma operação para ver o detalhe.</Empty>;
  const openIncidents = snapshot.incidents.filter((incident) => incident.operation_id === operation.id && incident.status !== "resolved");
  const signals = operationSignals(operation, snapshot.incidents);
  const orderedEvents = [...operation.events].sort((a, b) => Date.parse(b.server_received_at) - Date.parse(a.server_received_at));
  const place = placeParts(operation);
  const scale = scaleText(snapshot, operation);
  const manifest = manifestSummary(operation);
  const ctx = operation.estoquenow_context;
  const stageIndex = operationStages.indexOf(operation.stage) + 1;

  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(async () => {
      await postJson("update-operation", {
        id: operation.id,
        destination: formValue(form, "destination"),
        scheduledAt: operationTimestamp(formValue(form, "scheduledAt")),
        teamId: formValue(form, "teamId"),
        vehicleId: formValue(form, "vehicleId"),
        driverId: formValue(form, "driverId"),
        notes: formValue(form, "notes"),
      });
      await refresh();
    }, "Escala salva.");
  };

  return (
    <article className="min-w-0 rounded-2xl border border-imp-line/70 bg-imp-surface shadow-imp-card">
      <header className="px-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-medium tabular-nums text-imp-muted">{formatWhen(operation.scheduled_at)}</p>
          <Pill tone={operation.status === "completed" ? "green" : operation.status === "cancelled" ? "red" : "neutral"}>{statusLabel[operation.status]}</Pill>
        </div>
        <h2 className="mt-1 break-words font-imp-display text-[26px] font-semibold leading-tight md:text-[30px]">
          {operation.event_name}
        </h2>
        <p className="mt-1 text-[15px] leading-5 text-imp-muted">{place.address}</p>
        <p className="mt-1 text-[13px] text-imp-muted">{sourceText(operation)}</p>
      </header>

      <div className="mt-5 grid gap-4 border-y border-imp-line bg-imp-ground/60 px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="text-[14px] font-semibold text-imp-muted">Agora</p>
          <p className="mt-0.5 text-[20px] font-semibold leading-6">{nextActionText(operation, snapshot.incidents)}</p>
          <p className="mt-1 text-[15px] text-imp-muted">
            {stageLabels[operation.stage]}, etapa {stageIndex} de {operationStages.length}
            {operation.status === "active" && ` · desde ${formatTime(operation.stage_started_at)}`}
            {operation.waiting_since && ` · em espera desde ${formatTime(operation.waiting_since)}`}
          </p>
        </div>
        <a
          href={mapsUrl(operation.destination)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-imp-line bg-imp-surface px-4 text-[15px] font-semibold shadow-imp-soft hover:border-imp-line-strong"
        >
          Rota no Google Maps <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>

      {(openIncidents.length > 0 || signals.incompleteScale) && (
        <div className="space-y-3 px-5 pt-4">
          {openIncidents.length > 0 && (
            <Notice
              tone={signals.criticalIncident ? "red" : "amber"}
              title={`${plural(openIncidents.length, "ocorrência", "ocorrências")} em aberto`}
              action={onOpenIncidents && <Button variant="secondary" onClick={onOpenIncidents}>Revisar ocorrências</Button>}
            >
              {openIncidents.slice(0, 2).map((incident) => (
                <span key={incident.id} className="block">
                  {incidentTypeLabel[incident.type]}: {incident.description}
                </span>
              ))}
            </Notice>
          )}
          {signals.incompleteScale && (
            <Notice tone="amber" title="Escala incompleta">
              Falta {[!scale.team && "equipe", !scale.vehicle && "veículo", !scale.driver && "motorista"].filter(Boolean).join(", ")}. Defina abaixo em Escala.
            </Notice>
          )}
        </div>
      )}

      <div className="px-5 pt-5">
        <StageRail operation={operation} selectedStage={focusedStage} onStageSelect={setFocusedStage} />
        <StageFocus operation={operation} stage={focusedStage} />
      </div>

      <div className="mt-4 px-5 pb-2">
        <Disclosure
          summary="Escala"
          open={signals.incompleteScale && operation.status === "active"}
          meta={
            scale.complete ? (
              <span>{scale.team} · {scale.vehicle} · {scale.driver}</span>
            ) : (
              <span className="text-imp-amber">Incompleta</span>
            )
          }
        >
          {operation.status === "active" ? (
            <form key={operation.id} onSubmit={update} className="grid gap-3 sm:grid-cols-2">
              <Select name="teamId" label="Equipe" required={false} defaultValue={operation.team_id ?? ""} options={snapshot.teams.map((team) => [team.id, team.name])} />
              <Select name="vehicleId" label="Veículo" required={false} defaultValue={operation.vehicle_id ?? ""} options={snapshot.vehicles.map((vehicle) => [vehicle.id, `${vehicle.name} · ${vehicle.plate}`])} />
              <Select name="driverId" label="Motorista" required={false} defaultValue={operation.driver_id ?? ""} options={snapshot.people.map((person) => [person.id, person.full_name])} />
              <Input name="notes" label="Observações" required={false} defaultValue={operation.notes ?? ""} />
              <Input
                name="destination"
                label="Destino"
                defaultValue={operation.destination}
                readOnly={operation.source === "estoquenow"}
                hint={operation.source === "estoquenow" ? "Vem do EstoqueNOW; só a escala interna é editável." : undefined}
              />
              <Input name="scheduledAt" label="Data e horário" type="datetime-local" defaultValue={operationDateTimeInput(operation.scheduled_at)} readOnly={operation.source === "estoquenow"} />
              <div className="sm:col-span-2">
                <Submit busy={busy} configured={snapshot.configured} label="Salvar escala" />
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-3 gap-3 text-[15px]">
              <div><dt className="text-imp-muted">Equipe</dt><dd className="font-medium">{scale.team ?? "Não escalada"}</dd></div>
              <div><dt className="text-imp-muted">Veículo</dt><dd className="font-medium">{scale.vehicle ?? "Não escalado"}</dd></div>
              <div><dt className="text-imp-muted">Motorista</dt><dd className="font-medium">{scale.driver ?? "Não escalado"}</dd></div>
            </dl>
          )}
        </Disclosure>

        {manifest.total > 0 && (
          <Disclosure
            summary="Itens da carga"
            meta={<span className={manifest.complete ? "text-imp-green" : ""}>{manifest.checked} de {manifest.total} conferidos</span>}
          >
            <ItemManifest operation={operation} configured={snapshot.configured} busy={busy} run={run} refresh={refresh} />
          </Disclosure>
        )}

        {ctx && (
          <Disclosure summary="Dados do pedido no EstoqueNOW" meta={ctx.order_id ? `Pedido ${ctx.order_id}` : undefined}>
            <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
              <div><dt className="text-imp-muted">Pedido</dt><dd className="font-medium">{ctx.order_id ?? "Não informado"}</dd></div>
              <div><dt className="text-imp-muted">Devolução prevista</dt><dd className="font-medium">{ctx.return_at ? formatDate(ctx.return_at) : "Não informada"}</dd></div>
              <div><dt className="text-imp-muted">Situação da entrega na origem</dt><dd className="font-medium">{ctx.delivery_status_type ?? "Não informada"}{ctx.delivery_concluded ? " · concluída" : ""}</dd></div>
              <div><dt className="text-imp-muted">Situação da devolução na origem</dt><dd className="font-medium">{ctx.return_status_type ?? "Não informada"}{ctx.return_concluded ? " · concluída" : ""}</dd></div>
              <div><dt className="text-imp-muted">Itens previstos</dt><dd className="font-medium">{ctx.item_count ?? "Não informado"}</dd></div>
              <div><dt className="text-imp-muted">Importado em</dt><dd className="font-medium">{operation.imported_at ? formatDate(operation.imported_at) : "—"}</dd></div>
            </dl>
            <p className="mt-3 text-[13px] text-imp-muted">Leitura da origem. Nada é escrito de volta no EstoqueNOW.</p>
          </Disclosure>
        )}

        <Disclosure summary="Linha do tempo" meta={plural(orderedEvents.length, "registro", "registros")} open={orderedEvents.length > 0 && orderedEvents.length <= 3}>
          {orderedEvents.length ? (
            <ul className="divide-y divide-imp-line">
              {orderedEvents.map((event) => (
                <TimelineEvent key={event.id} event={event} configured={snapshot.configured} />
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-imp-muted">Nenhuma etapa confirmada pelo campo ainda.</p>
          )}
          {onOpenEvidence && orderedEvents.length > 0 && (
            <Button variant="ghost" className="mt-2" onClick={onOpenEvidence}>
              Ver fotos em Evidências
            </Button>
          )}
        </Disclosure>

        {operation.status === "active" && (
          <Disclosure summary={<span className="text-imp-red">Cancelar operação</span>}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const reason = formValue(new FormData(event.currentTarget), "cancelReason");
                void run(async () => {
                  await postJson("cancel-operation", { id: operation.id, reason });
                  await refresh();
                }, "Operação cancelada.");
              }}
            >
              <Field label="Motivo">
                <textarea name="cancelReason" className={inputClass} rows={2} />
              </Field>
              <Button type="submit" variant="danger" disabled={busy || !snapshot.configured} className="mt-3">
                Confirmar cancelamento
              </Button>
            </form>
          </Disclosure>
        )}
        {operation.cancel_reason && <p className="py-3 text-[15px] text-imp-muted">Cancelada: {operation.cancel_reason}</p>}
      </div>
    </article>
  );
}

function TodayView(props: Props & { onOpenOperation: (id: string) => void; onOpenIncidents: (id: string) => void; onOpenOperations: () => void }) {
  const { snapshot } = props;
  const active = snapshot.operations.filter((operation) => isOperationalToday(operation));
  const prioritized = prioritizeOperations(active, snapshot.incidents);
  const decisions = prioritized.filter((operation) => operationSignals(operation, snapshot.incidents).risk !== "ready");
  const flowing = prioritized.filter((operation) => operationSignals(operation, snapshot.incidents).risk === "ready");
  const now = new Date();
  const todayKey = operationDateInput(now);
  const weekAhead = operationDateInput(new Date(now.getTime() + 7 * 86_400_000));
  const upcoming = snapshot.operations
    .filter((operation) => {
      const key = operationDateInput(new Date(operation.scheduled_at));
      return operation.status === "active" && key > todayKey && key <= weekAhead;
    })
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));

  const status = !snapshot.configured
    ? ""
    : props.refreshState.failed
      ? "A atualização automática falhou. Tente atualizar."
      : props.refreshState.lastUpdatedAt
        ? `Atualizado às ${formatTime(props.refreshState.lastUpdatedAt)}. Nova leitura a cada 30 segundos.`
        : "Atualiza a cada 30 segundos com a aba aberta.";
  const severityLabel = { high: "alta", medium: "média", low: "baixa" } as const;

  return (
    <div>
      <PageTitle
        title={capitalize(dateFormatter.format(now))}
        lead={
          <>
            {active.length ? `${plural(active.length, "operação", "operações")} em andamento` : "Nenhuma operação em andamento"}
            {decisions.length ? `, ${decisions.length === 1 ? "1 exige decisão." : `${decisions.length} exigem decisão.`}` : "."} {status}
          </>
        }
        aside={
          <Button variant="secondary" onClick={() => void props.run(props.refresh, "Torre atualizada.")} aria-label="Atualizar torre">
            <RefreshCw size={16} aria-hidden="true" /> Atualizar
          </Button>
        }
      />

      <section className="mt-6" aria-labelledby="decisions-title">
        <SectionTitle count={decisions.length}>
          <span id="decisions-title">Exige decisão agora</span>
        </SectionTitle>
        <div className="mt-3">
          {decisions.length ? (
            <ul className="space-y-2">
              {decisions.map((operation) => {
                const signals = operationSignals(operation, snapshot.incidents);
                const topIncident = [...signals.unresolved].sort(
                  (a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity),
                )[0];
                const leader = snapshot.people.find((person) => person.id === operation.driver_id);
                const goesToIncidents = signals.unresolved.length > 0;
                return (
                  <li key={operation.id}>
                    <Notice
                      tone={signals.criticalIncident ? "red" : "amber"}
                      title={`${formatTime(operation.scheduled_at)}, ${operation.event_name}`}
                      action={
                        <span className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            onClick={() => (goesToIncidents ? props.onOpenIncidents(operation.id) : props.onOpenOperation(operation.id))}
                          >
                            {nextActionText(operation, snapshot.incidents)}
                          </Button>
                          {goesToIncidents && (
                            <Button variant="secondary" onClick={() => props.onOpenOperation(operation.id)}>
                              Abrir operação
                            </Button>
                          )}
                        </span>
                      }
                    >
                      {topIncident && (
                        <span className="block">
                          {incidentTypeLabel[topIncident.type]}, gravidade {severityLabel[topIncident.severity]}: {topIncident.description}
                        </span>
                      )}
                      {signals.delayed && (
                        <span className="block">
                          {operation.waiting_since
                            ? `Equipe em espera desde ${formatTime(operation.waiting_since)}. Só o campo libera a espera.`
                            : "O horário previsto passou e a etapa não avançou."}
                          {leader?.phone && (
                            <>
                              {" "}Fale com {leader.full_name.split(" ")[0]}:{" "}
                              <a href={`tel:${leader.phone.replace(/\D/g, "")}`} className="font-semibold text-imp-ink underline">{leader.phone}</a>.
                            </>
                          )}
                        </span>
                      )}
                      {signals.incompleteScale && <span className="block">Sem equipe, veículo ou motorista definidos.</span>}
                      <span className="text-imp-muted">{stageLabels[operation.stage]}, etapa {operationStages.indexOf(operation.stage) + 1} de 9.</span>
                    </Notice>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-imp-green/20 bg-imp-green-tint px-4 py-3 text-[15px] text-imp-green">
              Nenhum bloqueio. {active.length ? "As operações do dia seguem no fluxo." : "Nada em andamento hoje."}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="board-title">
        <SectionTitle
          count={active.length}
          action={
            <Button variant="ghost" onClick={props.onOpenOperations}>
              Todas as operações
            </Button>
          }
        >
          <span id="board-title">Em andamento hoje</span>
        </SectionTitle>
        <div className="mt-3">
          <OperationList
            operations={[...decisions, ...flowing]}
            snapshot={snapshot}
            selectedId=""
            onOpen={props.onOpenOperation}
            showDate={false}
            emptyText="Nenhuma operação ativa com data até hoje."
          />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="upcoming-title">
        <SectionTitle count={upcoming.length}>
          <span id="upcoming-title">Próximos 7 dias</span>
        </SectionTitle>
        <div className="mt-3">
          <OperationList
            operations={upcoming}
            snapshot={snapshot}
            selectedId=""
            onOpen={props.onOpenOperation}
            emptyText="Nada agendado para os próximos sete dias."
          />
        </div>
      </section>
    </div>
  );
}

function OperationsView(
  props: Props & {
    openSelected?: boolean;
    onOpenEvidence: (id: string) => void;
    onOpenIncidents: (id: string) => void;
  },
) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailOpen, setDetailOpen] = useState(Boolean(props.openSelected));
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeDetail = () => {
    setDetailOpen(false);
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>('[aria-current="true"], button');
      row?.focus();
    });
  };
  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);
  const filters = { query, status: statusFilter, stage: stageFilter, source: sourceFilter, teamId: teamFilter, vehicleId: vehicleFilter, risk: riskFilter, startDate, endDate };
  // Ativas primeiro em ordem cronológica; encerradas depois, das mais recentes.
  const filtered = props.snapshot.operations
    .filter((operation) => matchesOperationFilters(operation, props.snapshot.incidents, filters))
    .sort((a, b) => {
      const aActive = a.status === "active" ? 0 : 1;
      const bActive = b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const diff = Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at);
      return aActive === 0 ? diff : -diff;
    });
  const hasFilters = Object.values(filters).some((value) => value !== "" && value !== "all");
  const advancedFilterCount = [teamFilter, vehicleFilter, stageFilter, sourceFilter, startDate, endDate].filter((value) => value !== "" && value !== "all").length;
  const selected = filtered.find((operation) => operation.id === props.selectedId) ?? (detailOpen ? undefined : filtered[0]);

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setStageFilter("all");
    setSourceFilter("all");
    setTeamFilter("all");
    setVehicleFilter("all");
    setRiskFilter("all");
    setStartDate("");
    setEndDate("");
  };

  useEffect(() => {
    if (!detailOpen || !detailRef.current || window.matchMedia("(min-width: 1280px)").matches) return;
    detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    detailRef.current.focus({ preventScroll: true });
  }, [detailOpen, selected?.id]);

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void props.run(async () => {
      await postJson("create-operation", {
        eventName: formValue(form, "eventName"),
        destination: formValue(form, "destination"),
        scheduledAt: operationTimestamp(formValue(form, "scheduledAt")),
        teamId: formValue(form, "teamId"),
        vehicleId: formValue(form, "vehicleId"),
        driverId: formValue(form, "driverId"),
        notes: formValue(form, "notes"),
      });
      element.reset();
      await props.refresh();
    }, "Operação interna criada.");
  };

  const selectClass = "mt-1 min-h-11 w-full rounded-xl border border-imp-line bg-imp-surface px-3.5 py-2 text-[15px] shadow-imp-soft disabled:bg-imp-ground disabled:text-imp-muted disabled:shadow-none";

  return (
    <div>
      <PageTitle title="Operações" lead={`${filtered.length} de ${plural(props.snapshot.operations.length, "operação", "operações")}.`} />
      <Card className={`mt-5 p-4 ${detailOpen ? "hidden xl:block" : ""}`} aria-label="Filtros">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="text-[13px] font-semibold text-imp-muted">
            Buscar operação
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Evento, destino ou ID do EstoqueNOW" className={selectClass} />
          </label>
          <label className="text-[13px] font-semibold text-imp-muted">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}>
              <option value="all">Todos</option>
              <option value="active">Em operação</option>
              <option value="completed">Concluídas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>
          <label className="text-[13px] font-semibold text-imp-muted">
            Risco operacional
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className={selectClass}>
              <option value="all">Todos</option>
              {Object.entries(riskLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <Disclosure className="mt-3" summary="Mais filtros" meta={advancedFilterCount ? `${advancedFilterCount} aplicado(s)` : undefined}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-[13px] font-semibold text-imp-muted">Equipe
              <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className={selectClass}>
                <option value="all">Todas</option>
                {props.snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-imp-muted">Veículo
              <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} className={selectClass}>
                <option value="all">Todos</option>
                {props.snapshot.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-imp-muted">Etapa
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className={selectClass}>
                <option value="all">Todas</option>
                {operationStages.map((stage) => <option value={stage} key={stage}>{stageLabels[stage]}</option>)}
              </select>
            </label>
            <label className="text-[13px] font-semibold text-imp-muted">Origem
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className={selectClass}>
                <option value="all">Todas</option>
                <option value="manual">Cadastro interno</option>
                <option value="estoquenow">EstoqueNOW</option>
              </select>
            </label>
            <label className="text-[13px] font-semibold text-imp-muted">De
              <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className={selectClass} />
            </label>
            <label className="text-[13px] font-semibold text-imp-muted">Até
              <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className={selectClass} />
            </label>
          </div>
        </Disclosure>
        {hasFilters && (
          <Button variant="ghost" onClick={resetFilters} className="mt-2">Limpar filtros</Button>
        )}
      </Card>

      <div className={`mt-5 grid items-start gap-5 ${detailOpen ? "xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]" : ""}`}>
        <div ref={listRef} className={`min-w-0 space-y-5 ${detailOpen ? "hidden xl:block" : ""}`}>
          <OperationList
            operations={filtered}
            snapshot={props.snapshot}
            selectedId={detailOpen ? selected?.id ?? "" : ""}
            onOpen={(id) => {
              props.setSelectedId(id);
              setDetailOpen(true);
            }}
            emptyText={hasFilters ? "Nenhuma operação corresponde aos filtros." : "Nenhuma operação cadastrada ou importada."}
            compact={detailOpen}
          />
          <Card className="px-5">
            <Disclosure className="border-t-0" summary="Criar operação interna" open={!props.snapshot.operations.length}>
              <p className="text-[15px] text-imp-muted">Para eventos que não existem no EstoqueNOW. Fica marcada como cadastro interno.</p>
              <form onSubmit={create} className="mt-3 grid gap-3 md:grid-cols-2">
                <Input name="eventName" label="Evento" />
                <Input name="destination" label="Destino completo" />
                <Input name="scheduledAt" label="Data e horário" type="datetime-local" />
                <Select name="teamId" label="Equipe" required={false} options={props.snapshot.teams.map((team) => [team.id, team.name])} />
                <Select name="vehicleId" label="Veículo" required={false} options={props.snapshot.vehicles.map((vehicle) => [vehicle.id, `${vehicle.name} · ${vehicle.plate}`])} />
                <Select name="driverId" label="Motorista" required={false} options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
                <div className="md:col-span-2"><Input name="notes" label="Observações" required={false} /></div>
                <div className="md:col-span-2"><Submit busy={props.busy} configured={props.snapshot.configured} label="Criar operação interna" /></div>
              </form>
            </Disclosure>
          </Card>
        </div>
        {detailOpen && (
          <div ref={detailRef} tabIndex={-1} className="min-w-0 scroll-mt-20 space-y-3 outline-none xl:sticky xl:top-20">
            <div className="flex justify-between xl:justify-end">
              <span className="xl:hidden">
                <Button variant="ghost" className="-ml-3" onClick={closeDetail}>
                  <ChevronLeft size={16} aria-hidden="true" /> Voltar à lista
                </Button>
              </span>
              <span className="hidden xl:block">
                <Button variant="ghost" onClick={closeDetail}>
                  <X size={16} aria-hidden="true" /> Fechar detalhe
                </Button>
              </span>
            </div>
            {selected ? (
              <OperationDetail
                key={`${selected.id}-${selected.stage}`}
                snapshot={props.snapshot}
                operation={selected}
                busy={props.busy}
                run={props.run}
                refresh={props.refresh}
                onOpenEvidence={() => props.onOpenEvidence(selected.id)}
                onOpenIncidents={() => props.onOpenIncidents(selected.id)}
              />
            ) : (
              <Empty action={<Button variant="secondary" onClick={resetFilters}>Limpar filtros</Button>}>
                A operação selecionada está fora dos filtros.
              </Empty>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({ snapshot, onOpenOperation }: Props & { onOpenOperation: (id: string) => void }) {
  const [reference, setReference] = useState(
    operationDateInput(new Date(snapshot.operations.find((operation) => operation.status === "active")?.scheduled_at ?? new Date())),
  );
  const [teamFilter, setTeamFilter] = useState("all");
  const selectedDate = new Date(`${reference}T12:00:00`);
  const monday = new Date(selectedDate);
  monday.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  const slots = [0, 6, 12, 18];
  const dayKeys = new Set(days.map(operationDateInput));
  const todayKey = operationDateInput(new Date());
  const visibleOperations = snapshot.operations.filter(
    (operation) => dayKeys.has(operationDateInput(new Date(operation.scheduled_at))) && (teamFilter === "all" || operation.team_id === teamFilter),
  );
  const shiftWeek = (daysToAdd: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + daysToAdd);
    setReference(operationDateInput(next));
  };
  const hourOf = (value: string) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
  return (
    <div>
      <PageTitle
        title="Agenda da semana"
        lead="Horários de São Paulo. Toque em uma operação para abrir o detalhe."
        aside={
          <>
            <Button variant="secondary" onClick={() => shiftWeek(-7)} aria-label="Semana anterior" className="min-w-11 px-0"><ChevronLeft size={17} aria-hidden="true" /></Button>
            <label className="sr-only" htmlFor="agenda-reference">Semana de referência</label>
            <input id="agenda-reference" type="date" value={reference} onChange={(event) => { if (event.target.value) setReference(event.target.value); }} className="min-h-11 rounded-xl border border-imp-line bg-imp-surface px-3.5 text-[15px] shadow-imp-soft" />
            <Button variant="secondary" onClick={() => shiftWeek(7)} aria-label="Próxima semana" className="min-w-11 px-0"><ChevronRight size={17} aria-hidden="true" /></Button>
            <select aria-label="Filtrar por equipe" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="min-h-11 rounded-xl border border-imp-line bg-imp-surface px-3.5 text-[15px] shadow-imp-soft">
              <option value="all">Todas as equipes</option>
              {snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </>
        }
      />
      <Card className="imp-scroll-x mt-5 overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-[64px_repeat(7,minmax(128px,1fr))]">
          <div className="border-b border-r border-imp-line" />
          {days.map((day) => {
            const key = operationDateInput(day);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <h3
                key={key}
                className={`border-b border-r border-imp-line px-3 py-2.5 text-[14px] font-semibold last:border-r-0 ${
                  key === todayKey ? "bg-imp-green-tint text-imp-green" : weekend ? "bg-imp-ground text-imp-muted" : "text-imp-muted"
                }`}
              >
                {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day).replace(".", "")}
              </h3>
            );
          })}
          {slots.map((slot) => (
            <div className="contents" key={slot}>
              <time className="border-b border-r border-imp-line px-3 py-3 text-[13px] tabular-nums text-imp-muted">{String(slot).padStart(2, "0")}h</time>
              {days.map((day) => {
                const key = operationDateInput(day);
                const operations = visibleOperations
                  .filter((operation) => {
                    if (operationDateInput(new Date(operation.scheduled_at)) !== key) return false;
                    const hour = hourOf(operation.scheduled_at);
                    return hour >= slot && hour < slot + 6;
                  })
                  .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <section key={`${key}-${slot}`} aria-label={`${key}, ${slot}h`} className={`min-h-24 border-b border-r border-imp-line p-1.5 last:border-r-0 ${weekend ? "bg-imp-ground/60" : ""}`}>
                    <div className="space-y-1.5">
                      {operations.map((operation) => {
                        const risk = operationSignals(operation, snapshot.incidents).risk;
                        return (
                          <button
                            key={operation.id}
                            type="button"
                            onClick={() => onOpenOperation(operation.id)}
                            className={`min-h-11 w-full rounded border-l-4 bg-imp-surface p-2 text-left text-[13px] leading-4 shadow-[0_1px_2px_rgba(22,33,28,.08)] hover:bg-imp-ground ${
                              risk === "critical" ? "border-imp-red" : risk === "attention" ? "border-imp-amber" : operation.status === "active" ? "border-imp-green" : "border-imp-line-strong"
                            }`}
                          >
                            <strong className="tabular-nums">{formatTime(operation.scheduled_at)}</strong>
                            <span className="mt-0.5 block font-semibold">{operation.event_name}</span>
                            <span className="text-imp-muted">{stageLabels[operation.stage]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      {!visibleOperations.length && (
        <div className="mt-4">
          <Empty
            action={
              <>
                <Button variant="secondary" onClick={() => setReference(operationDateInput(new Date()))}>Voltar para esta semana</Button>
                {teamFilter !== "all" && <Button variant="ghost" onClick={() => setTeamFilter("all")}>Todas as equipes</Button>}
              </>
            }
          >
            Nenhuma operação nesta semana{teamFilter !== "all" ? " para a equipe escolhida" : ""}. Use as setas para mudar a semana.
          </Empty>
        </div>
      )}
    </div>
  );
}

function PeopleView(props: Props) {
  const submit = (action: string, success: string, body: (form: FormData) => object) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void props.run(async () => {
      await postJson(action, body(form));
      element.reset();
      await props.refresh();
    }, success);
  };
  return (
    <div>
      <PageTitle title="Pessoas e equipes" lead="Quem pode entrar na escala. Cadastro interno da Império, sem relação com o EstoqueNOW." />

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section>
            <SectionTitle count={props.snapshot.people.length}>Pessoas</SectionTitle>
            {props.snapshot.people.length ? (
              <Card className="mt-3 overflow-hidden">
                <ul className="divide-y divide-imp-line">
                  {props.snapshot.people.map((person) => (
                    <li key={person.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
                      <span className="min-w-0">
                        <strong className="block break-words text-[16px]">{person.full_name}</strong>
                        <span className="text-[14px] text-imp-muted">{person.job_title} · {person.role === "manager" ? "coordenação" : "campo"}</span>
                      </span>
                      <span className="text-[14px] tabular-nums text-imp-muted">{person.phone ?? "Sem telefone"}</span>
                      <Pill tone={person.availability === "available" ? "green" : "amber"}>{person.availability === "available" ? "Disponível" : "Indisponível"}</Pill>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <div className="mt-3"><Empty>Cadastre a primeira pessoa para formar uma equipe.</Empty></div>
            )}
          </section>
          <section>
            <SectionTitle count={props.snapshot.teams.length}>Equipes</SectionTitle>
            {props.snapshot.teams.length ? (
              <Card className="mt-3 overflow-hidden">
                <ul className="divide-y divide-imp-line">
                  {props.snapshot.teams.map((team) => (
                    <li key={team.id} className="px-4 py-3">
                      <strong className="text-[16px]">{team.name}</strong>
                      <p className="text-[14px] text-imp-muted">
                        Líder {props.snapshot.people.find((person) => person.id === team.leader_id)?.full_name ?? "não informado"} · {team.member_ids.length} integrante(s)
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <div className="mt-3"><Empty>Crie uma equipe para escalar as pessoas juntas.</Empty></div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <Card className="px-5">
            <Disclosure className="border-t-0" summary="Cadastrar pessoa" open={!props.snapshot.people.length}>
              <form className="space-y-3" onSubmit={submit("create-person", "Pessoa e acesso criados.", (form) => ({ fullName: formValue(form, "fullName"), email: formValue(form, "email"), phone: formValue(form, "phone"), jobTitle: formValue(form, "jobTitle"), temporaryPassword: formValue(form, "temporaryPassword") }))}>
                <p className="text-[15px] text-imp-muted">Cria o acesso. A senha temporária é trocada no primeiro login.</p>
                <Input name="fullName" label="Nome completo" />
                <Input name="email" label="E-mail" type="email" />
                <Input name="jobTitle" label="Função" />
                <Input name="phone" label="Telefone" required={false} />
                <Input name="temporaryPassword" label="Senha temporária" type="password" minLength={10} />
                <Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar pessoa" />
              </form>
            </Disclosure>
          </Card>
          <Card className="px-5">
            <Disclosure className="border-t-0" summary="Criar equipe" open={!props.snapshot.teams.length && props.snapshot.people.length > 0}>
              <form className="space-y-3" onSubmit={submit("create-team", "Equipe criada.", (form) => ({ name: formValue(form, "name"), leaderId: formValue(form, "leaderId"), memberIds: form.getAll("memberIds").map(String) }))}>
                <Input name="name" label="Nome da equipe" />
                <Select name="leaderId" label="Líder" options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
                <fieldset>
                  <legend className="text-sm font-medium">Integrantes</legend>
                  <div className="mt-1.5 grid gap-1.5">
                    {props.snapshot.people.map((person) => (
                      <label key={person.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-imp-line px-3 text-[15px]">
                        <input type="checkbox" name="memberIds" value={person.id} className="size-5" />
                        <span className="min-w-0 break-words">{person.full_name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Submit busy={props.busy} configured={props.snapshot.configured} label="Criar equipe" />
              </form>
            </Disclosure>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FleetView(props: Props) {
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void props.run(async () => {
      await postJson("create-vehicle", { name: formValue(form, "name"), plate: formValue(form, "plate"), vehicleType: formValue(form, "vehicleType"), capacityLabel: formValue(form, "capacityLabel") });
      element.reset();
      await props.refresh();
    }, "Veículo cadastrado.");
  };
  const statusTone: Record<string, Tone> = { available: "green", in_use: "neutral", maintenance: "amber" };
  return (
    <div>
      <PageTitle title="Frota" lead="Veículos disponíveis para a escala. Cadastro interno." />
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          {props.snapshot.vehicles.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-imp-line">
                {props.snapshot.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px] sm:items-center">
                    <span>
                      <strong className="block text-[16px]">{vehicle.name}</strong>
                      <span className="text-[14px] text-imp-muted">{vehicle.plate} · {vehicle.vehicle_type}</span>
                    </span>
                    <span className="text-[14px] text-imp-muted">{vehicle.capacity_label ?? "Capacidade não informada"}</span>
                    <label className="text-[13px] font-semibold text-imp-muted">
                      <span className="sr-only">Status de {vehicle.name}</span>
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${statusTone[vehicle.status] === "green" ? "bg-imp-green" : statusTone[vehicle.status] === "amber" ? "bg-imp-amber" : "bg-imp-line-strong"}`} />
                        <select
                          value={vehicle.status}
                          disabled={!props.snapshot.configured || props.busy}
                          onChange={(event) => void props.run(async () => { await postJson("set-vehicle-status", { id: vehicle.id, status: event.target.value }); await props.refresh(); }, "Status do veículo atualizado.")}
                          className="min-h-11 w-full rounded-xl border border-imp-line bg-imp-surface px-3.5 text-[15px] shadow-imp-soft font-medium text-imp-ink"
                        >
                          <option value="available">Disponível</option>
                          <option value="in_use">Em uso</option>
                          <option value="maintenance">Manutenção</option>
                        </select>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Empty>Cadastre o primeiro veículo para completar uma escala.</Empty>
          )}
        </div>
        <Card className="px-5">
          <Disclosure className="border-t-0" summary="Cadastrar veículo" open={!props.snapshot.vehicles.length}>
            <form onSubmit={create} className="space-y-3">
              <Input name="name" label="Nome" />
              <Input name="plate" label="Placa" />
              <Input name="vehicleType" label="Tipo" />
              <Input name="capacityLabel" label="Capacidade" required={false} />
              <Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar veículo" />
            </form>
          </Disclosure>
        </Card>
      </div>
    </div>
  );
}

function EvidenceView({
  snapshot,
  onOpenOperation,
  focusedOperationId,
  onClearFocus,
}: Props & { onOpenOperation: (id: string) => void; focusedOperationId: string | null; onClearFocus: () => void }) {
  const allEvidence = snapshot.operations.flatMap((operation) => operation.events.map((event) => ({ operation, event })));
  const evidence = (focusedOperationId ? allEvidence.filter(({ operation }) => operation.id === focusedOperationId) : allEvidence).sort(
    (a, b) => Date.parse(b.event.server_received_at) - Date.parse(a.event.server_received_at),
  );
  const focusedOperation = snapshot.operations.find((operation) => operation.id === focusedOperationId);
  return (
    <div>
      <PageTitle
        title="Evidências"
        lead={focusedOperation ? `Somente ${focusedOperation.event_name}.` : "Fotos, GPS e horários confirmados pelo campo, por etapa."}
        aside={focusedOperation && <Button variant="secondary" onClick={onClearFocus}>Ver todas</Button>}
      />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {evidence.map(({ operation, event }) => (
          <li key={event.id} className="overflow-hidden rounded-2xl border border-imp-line/70 bg-imp-surface shadow-imp-card">
            {event.photo_url ? (
              <a
                href={event.photo_url}
                target="_blank"
                rel="noreferrer"
                className="grid h-44 place-items-end bg-imp-ground bg-cover bg-center p-3 text-[14px] font-semibold text-white"
                style={{ backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(22,33,28,.85)), url(${JSON.stringify(event.photo_url)})` }}
              >
                <span className="flex items-center gap-2"><Camera size={16} aria-hidden="true" />Abrir foto</span>
              </a>
            ) : (
              <div className="grid h-44 place-items-center bg-imp-ground text-[13px] text-imp-muted">Sem foto nesta etapa</div>
            )}
            <div className="p-4">
              <p className="text-[14px] font-semibold text-imp-green">
                {stageLabels[event.stage]} · {formatWhen(event.server_received_at)}
              </p>
              <h3 className="mt-1 text-[16px] font-semibold leading-5">{operation.event_name}</h3>
              <p className="mt-1 text-[14px] text-imp-muted">
                {event.actor_name} ·{" "}
                <a href={mapsPointUrl(event.latitude, event.longitude)} target="_blank" rel="noreferrer" className={linkClass}>
                  Ver no mapa
                </a>
              </p>
              <Button variant="ghost" className="mt-2 -ml-3" onClick={() => onOpenOperation(operation.id)}>Abrir operação</Button>
            </div>
          </li>
        ))}
      </ul>
      {!evidence.length && (
        <div className="mt-6">
          <Empty>{focusedOperation ? "Esta operação ainda não tem evidências." : "Nenhuma etapa confirmada pelo campo ainda."}</Empty>
        </div>
      )}
    </div>
  );
}

function IncidentsView(props: Props & { onOpenOperation: (id: string) => void; focusedOperationId: string | null; onClearFocus: () => void }) {
  const incidents = props.focusedOperationId
    ? props.snapshot.incidents.filter((incident) => incident.operation_id === props.focusedOperationId)
    : props.snapshot.incidents;
  const unresolved = incidents.filter((incident) => incident.status !== "resolved");
  const resolved = incidents.filter((incident) => incident.status === "resolved");
  const focusedOperation = props.snapshot.operations.find((operation) => operation.id === props.focusedOperationId);
  const renderIncident = (incident: Incident) => {
    const operation = props.snapshot.operations.find((item) => item.id === incident.operation_id);
    const tone: Tone = incident.severity === "high" ? "red" : incident.severity === "medium" ? "amber" : "neutral";
    return (
      <li key={incident.id} className={`grid gap-4 rounded-2xl border-l-4 bg-imp-surface p-4 shadow-imp-card lg:grid-cols-[1fr_220px] ${tone === "red" ? "border-imp-red" : tone === "amber" ? "border-imp-amber" : "border-imp-line-strong"}`}>
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[14px] text-imp-muted">
            <Pill tone={tone}>{incident.severity === "high" ? "Alta" : incident.severity === "medium" ? "Média" : "Baixa"}</Pill>
            <span>{incidentTypeLabel[incident.type]}</span>
            <span>· {stageLabels[incident.stage]}</span>
            <span>· {formatWhen(incident.created_at)}</span>
          </p>
          <h3 className="mt-2 text-[17px] font-semibold leading-6">{operation ? (operation.event_name) : "Operação"}</h3>
          <p className="mt-1 text-[15px] leading-6">{incident.description}</p>
          {incident.impact && <p className="mt-1 text-[15px] text-imp-amber">Impacto: {incident.impact}</p>}
          <p className="mt-2 text-[13px] text-imp-muted">Registrada por {incident.actor_name}{incident.responsible_name ? ` · trata ${incident.responsible_name}` : ""}</p>
          {incident.photo_url && <a href={incident.photo_url} target="_blank" rel="noreferrer" className={`${linkClass} text-[15px]`}>Abrir foto</a>}
        </div>
        <div className="space-y-2">
          <label className="block text-[13px] font-semibold text-imp-muted">
            Tratamento
            <select
              value={incident.status}
              disabled={!props.snapshot.configured || props.busy}
              onChange={(event) => void props.run(async () => { await postJson("update-incident-status", { id: incident.id, status: event.target.value }); await props.refresh(); }, "Ocorrência atualizada.")}
              className="mt-1 min-h-11 w-full rounded-xl border border-imp-line bg-imp-surface px-3.5 text-[15px] shadow-imp-soft font-medium text-imp-ink"
            >
              <option value="open">{incidentStatusLabel.open}</option>
              <option value="handling">{incidentStatusLabel.handling}</option>
              <option value="resolved">{incidentStatusLabel.resolved}</option>
            </select>
          </label>
          {operation && <Button variant="secondary" className="w-full" onClick={() => props.onOpenOperation(operation.id)}>Abrir operação</Button>}
        </div>
      </li>
    );
  };
  return (
    <div>
      <PageTitle
        title="Ocorrências"
        lead={focusedOperation ? `Somente ${focusedOperation.event_name}.` : "Atrasos, avarias, faltas e bloqueios registrados pelo campo. Mude o tratamento aqui."}
        aside={focusedOperation && <Button variant="secondary" onClick={props.onClearFocus}>Ver todas</Button>}
      />
      <section className="mt-6">
        <SectionTitle count={unresolved.length}>Em aberto</SectionTitle>
        <ul className="mt-3 space-y-3">{unresolved.map(renderIncident)}</ul>
        {!unresolved.length && <div className="mt-3"><Empty>Nenhuma ocorrência em aberto.</Empty></div>}
      </section>
      {resolved.length > 0 && (
        <div className="mt-6">
          <Disclosure summary="Resolvidas" meta={resolved.length}>
            <ul className="space-y-3">{resolved.map(renderIncident)}</ul>
          </Disclosure>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-imp-ground p-3">
      <p className="text-[13px] text-imp-muted">{label}</p>
      <p className="mt-0.5 break-words font-imp-display text-[22px] font-semibold leading-7">{value}</p>
    </div>
  );
}

function IntegrationsView(props: Props) {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 90);
  const [preview, setPreview] = useState<EstoqueNowPreview | null>(null);
  const [detailPreview, setDetailPreview] = useState<EstoqueNowDetailPreview | null>(null);
  const [canaryId, setCanaryId] = useState("");
  const [previewRequestState, setPreviewRequestState] = useState<PreviewRequestState>("idle");
  const selectedCanary = preview?.candidates.find((candidate) => candidate.externalId === canaryId);
  const syncHealth = props.snapshot.estoquenow.sync_health;
  const automaticRuns = syncHealth
    ? [syncHealth.lastRun, ...syncHealth.recentRuns].filter((run): run is EstoqueNowSyncRun => run?.trigger === "scheduled")
    : [];
  const latestAutomaticRun = automaticRuns[0] ?? null;
  const latestAutomaticSuccess = syncHealth?.lastSuccessfulScheduledRun ?? null;
  const automaticStatus = syncHealth
    ? automaticRunStatus(latestAutomaticRun, isAutomaticRunStale(latestAutomaticRun))
    : { label: "Indisponível", tone: "neutral" as const };
  const automaticReviewCount = latestAutomaticRun ? latestAutomaticRun.blocked + latestAutomaticRun.deferred + latestAutomaticRun.failed : 0;
  const previewReviewCount = preview ? preview.counts.new + preview.counts.update + preview.counts.diverged + preview.counts.blocked + preview.counts.skipped : 0;
  const sync = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let result = "Prévia concluída sem gravar no banco da Império.";
    setPreviewRequestState("loading");
    void props.run(async () => {
      try {
        const nextPreview = await postJson<EstoqueNowPreview>("sync-estoquenow", { mode: "preview", startDate: formValue(form, "startDate"), endDate: formValue(form, "endDate") });
        setPreview(nextPreview);
        setDetailPreview(null);
        setCanaryId("");
        setPreviewRequestState("succeeded");
        result = `${nextPreview.total} logística(s), ${nextPreview.movementsTotal} movimento(s) · ${nextPreview.counts.new} nova(s) · ${nextPreview.counts.update} atualização(ões) · ${nextPreview.counts.unchanged} conciliada(s) · ${nextPreview.counts.diverged} divergente(s) · ${nextPreview.counts.blocked} histórica(s) bloqueada(s) · ${nextPreview.counts.skipped} inválida(s). Nenhuma gravação realizada.`;
      } catch (error) {
        setPreviewRequestState("failed");
        throw error;
      }
    }, () => result);
  };
  const inspectDetail = () => {
    if (!selectedCanary) return;
    void props.run(async () => {
      const detail = await postJson<EstoqueNowDetailPreview>("inspect-estoquenow-detail", { externalId: selectedCanary.externalId });
      setDetailPreview(detail);
    }, "Detalhe lido sem gravar; itens e contrato sanitizado retornados.");
  };
  const confirmCanary = () => {
    if (!preview || !selectedCanary || detailPreview?.externalId !== selectedCanary.externalId) return;
    let result = "Importação individual confirmada.";
    void props.run(async () => {
      const confirmed = await postJson<{ externalId: string; imported: number; preserved: number; backfilled: number; updated: number }>("sync-estoquenow", {
        mode: "canary",
        startDate: preview.startDate,
        endDate: preview.endDate,
        externalId: selectedCanary.externalId,
        reviewedEventName: selectedCanary.eventName,
        reviewedDestination: selectedCanary.destination,
        reviewedScheduledAt: selectedCanary.scheduledAt,
        reviewedToken: selectedCanary.reviewToken,
        reviewedDatabaseImportedAt: selectedCanary.databaseImportedAt,
        reviewedItemsToken: detailPreview.itemsToken,
      });
      result = confirmed.imported
        ? `Operação ${confirmed.externalId} importada para o banco da Império.`
        : confirmed.backfilled
          ? `Operação ${confirmed.externalId} enriquecida com o contexto do EstoqueNOW.`
          : confirmed.updated
            ? `Operação ${confirmed.externalId} atualizada após revisão da divergência.`
            : `Operação ${confirmed.externalId} já estava conciliada; dados operacionais preservados.`;
      setPreview(null);
      setCanaryId("");
      await props.refresh();
    }, () => result);
  };
  const domains: [string, string, string][] = [
    [
      "Agenda e pedidos",
      "EstoqueNOW",
      props.snapshot.estoquenow.source === "estoquenow"
        ? "Leitura externa · última importação confirmada"
        : props.snapshot.estoquenow.configured
          ? "Leitura externa sob demanda · prévias não persistidas"
          : "Somente leitura · aguardando credenciais",
    ],
    ["Pessoas, equipes e frota", "Império", props.snapshot.configured ? "Cadastro persistente ativo" : "Dado demonstrativo"],
    ["Etapas, GPS, fotos e ocorrências", "Império", props.snapshot.configured ? "Registro persistente ativo" : "Dado demonstrativo"],
    ["Entrega, devolução e inventário", "EstoqueNOW", "Escrita desabilitada"],
  ];
  const candidateState = (state: EstoqueNowPreview["candidates"][number]["state"]) =>
    state === "blocked" ? "histórico bloqueado" : state === "diverged" ? "divergência" : state === "update" ? "atualização disponível" : state === "unchanged" ? "já conciliada" : "nova";
  const contractField = (field: { path: string; signatures: string[]; occurrences: number }) => (
    <p key={field.path} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <code className="break-all">{field.path}</code>
      <span className="text-imp-muted">{field.signatures.join(" | ")} · {field.occurrences}x</span>
    </p>
  );
  const est = props.snapshot.estoquenow;

  return (
    <div>
      <PageTitle title="Integrações" lead="De onde cada dado vem e o que a Império pode gravar. Nenhum segredo chega ao navegador." />
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="flex items-center gap-2 text-[20px] font-semibold"><Link2 size={20} className="text-imp-green" aria-hidden="true" /> EstoqueNOW</h3>
            <Pill tone={est.source === "estoquenow" ? "green" : "amber"}>{est.source === "estoquenow" ? "Leitura conectada" : est.configured ? "Credenciais no servidor" : "Sem credenciais"}</Pill>
          </div>
          <p className="mt-3 text-[15px] leading-6 text-imp-muted">{est.notice}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Operações importadas" value={est.imported_count} />
            <Stat label="Última importação" value={est.last_sync_at ? formatDate(est.last_sync_at) : "Nunca"} />
          </div>
          <ul className="mt-4 space-y-1.5 text-[14px] leading-5 text-imp-muted">
            <li>Consulta somente leitura, executada no servidor. Cada confirmação importa uma operação por vez.</li>
            <li>
              Importação individual {est.import_enabled ? "habilitada" : "bloqueada"} por ambiente. Pull automático {est.pull_apply_enabled ? "com aplicação interna habilitada" : "em observação; aplicação interna desabilitada"}; cada lote processa até cinco e cada chamada pode drenar até seis lotes.
            </li>
            <li>Escrita de entrega e devolução no EstoqueNOW: desligada.</li>
          </ul>
        </Card>

        <Card className="p-5" aria-labelledby="automatic-read-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="automatic-read-title" className="text-[20px] font-semibold">Último lote automático</h3>
              <p className="mt-1 text-[15px] text-imp-muted">O pull roda a cada 15 minutos e pode encadear até seis lotes. Aqui aparece o lote mais recente, sem payload externo.</p>
            </div>
            <Pill tone={automaticStatus.tone}>{automaticStatus.label}</Pill>
          </div>
          {syncHealth ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Último sucesso" value={latestAutomaticSuccess?.finishedAt ? formatDate(latestAutomaticSuccess.finishedAt) : "Nunca"} />
                <Stat label="Janela consultada" value={latestAutomaticRun ? `${formatSyncWindowDate(latestAutomaticRun.windowStart)} a ${formatSyncWindowDate(latestAutomaticRun.windowEnd)}` : "Ainda não"} />
                <Stat label="Logísticas lidas" value={latestAutomaticRun?.fetched ?? 0} />
                <Stat label="A revisar" value={automaticReviewCount} />
              </div>
              {latestAutomaticRun && (
                <p className="mt-3 text-[13px] text-imp-muted">
                  Válidas {latestAutomaticRun.valid} · elegíveis {latestAutomaticRun.eligible} · aplicadas {latestAutomaticRun.applied} · sem mudança {latestAutomaticRun.unchanged}
                </p>
              )}
              {latestAutomaticRun && ["failed", "partial", "abandoned"].includes(latestAutomaticRun.status) && (
                <div className="mt-3">
                  <Notice tone="red" title="A última leitura automática não terminou com sucesso">
                    {latestAutomaticRun.errorCode ? `Código ${latestAutomaticRun.errorCode}.` : null}
                  </Notice>
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 rounded-xl bg-imp-ground p-3 text-[15px] text-imp-muted">Saúde da leitura automática indisponível. A consulta manual continua ao lado.</p>
          )}
        </Card>

        <form onSubmit={sync} aria-busy={previewRequestState === "loading"} className="rounded-2xl border border-imp-line/70 bg-imp-surface shadow-imp-card p-5 xl:col-span-2">
          <h3 className="text-[20px] font-semibold">Buscar alterações sem importar</h3>
          <p className="mt-1 text-[15px] leading-6 text-imp-muted">Escolha um período e confira IDs, datas e divergências. Esta etapa não cria nem altera operações.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input name="startDate" label="Início" type="date" defaultValue={operationDateInput(today)} />
            <Input name="endDate" label="Fim" type="date" defaultValue={operationDateInput(future)} />
            <Button type="submit" variant="primary" disabled={props.busy || previewRequestState === "loading" || !props.snapshot.configured || !est.configured}>
              {previewRequestState === "loading" ? "Consultando EstoqueNOW…" : "Buscar alterações sem importar"}
            </Button>
          </div>
          <div aria-live="polite">
            {previewRequestState === "loading" && (
              <p className="mt-3 flex items-center gap-2 text-[14px] font-medium text-imp-green"><RefreshCw className="animate-spin" size={14} aria-hidden="true" />A leitura pode levar alguns segundos.</p>
            )}
            {previewRequestState === "failed" && (
              <p className="mt-3 rounded-xl border-l-4 border-imp-red bg-imp-red-tint px-4 py-3 text-[15px] text-imp-ink" role="alert">
                <strong>A consulta não foi concluída.</strong> Confirme a disponibilidade do conector e tente novamente.
              </p>
            )}
          </div>
          {!est.configured && <p className="mt-3 text-[14px] text-imp-amber">Adicione as credenciais apenas no servidor para liberar a prévia.</p>}
        </form>

        {preview && (
          <Card className="p-5 xl:col-span-2" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-semibold">Fila de revisão <span className="text-imp-muted">{previewReviewCount}</span></h3>
                <p className="mt-1 text-[15px] text-imp-muted">
                  {formatSyncWindowDate(preview.startDate)} a {formatSyncWindowDate(preview.endDate)} · {preview.total} logística(s) · {preview.movementsTotal} movimento(s)
                </p>
              </div>
              <Pill tone="green">Nada foi alterado</Pill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {(
                [
                  ["Novas", preview.counts.new],
                  ["Atualizações", preview.counts.update],
                  ["Conciliadas", preview.counts.unchanged],
                  ["Divergentes", preview.counts.diverged],
                  ["Histórico bloqueado", preview.counts.blocked],
                  ["Inválidas", preview.counts.skipped],
                ] as const
              ).map(([label, value]) => <Stat key={label} label={label} value={value} />)}
            </div>
            <div className="mt-4 space-y-3">
              {previewReviewCount === 0 && <p className="rounded-xl bg-imp-green-tint p-3 text-[15px] text-imp-green">Nenhuma operação exige revisão neste período.</p>}
              {preview.counts.diverged > 0 && <Notice tone="amber" title={`${preview.counts.diverged} registro(s) mudaram no EstoqueNOW`}>Selecione um por vez e revise antes de atualizar.</Notice>}
              {preview.counts.blocked > 0 && <Notice tone="red" title={`${preview.counts.blocked} operação(ões) com histórico protegido`}>Não podem reescrever rótulo, endereço ou agenda.</Notice>}
              {preview.counts.skipped > 0 && (
                <Notice tone="amber" title="Registros inválidos, sem gravação">
                  {(
                    [
                      ["sem ID", preview.skippedReasons.missing_external_id],
                      ["ID inválido", preview.skippedReasons.invalid_external_id],
                      ["sem nome", preview.skippedReasons.missing_event_name],
                      ["nome inválido", preview.skippedReasons.invalid_event_name],
                      ["sem destino", preview.skippedReasons.missing_destination],
                      ["destino inválido", preview.skippedReasons.invalid_destination],
                      ["data ou hora inválida", preview.skippedReasons.invalid_scheduled_date_or_time],
                    ] as const
                  )
                    .filter(([, count]) => count > 0)
                    .map(([label, count]) => `${count} ${label}`)
                    .join(" · ")}
                </Notice>
              )}
            </div>
            {preview.candidates.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
                <Field label="Operação da consulta">
                  <select value={canaryId} onChange={(event) => { setCanaryId(event.target.value); setDetailPreview(null); }} className={inputClass}>
                    <option value="">Selecione uma operação válida</option>
                    {preview.candidates.map((candidate) => (
                      <option key={candidate.externalId} value={candidate.externalId}>
                        {candidate.externalId} · {candidate.eventName} · {candidateState(candidate.state)}
                      </option>
                    ))}
                  </select>
                </Field>
                {selectedCanary ? (
                  <div className="rounded-xl bg-imp-ground p-4 text-[14px]">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-[15px]">{selectedCanary.eventName}</strong>
                      <Pill tone={selectedCanary.state === "new" ? "green" : selectedCanary.state === "diverged" || selectedCanary.state === "blocked" ? "red" : "neutral"}>{candidateState(selectedCanary.state)}</Pill>
                    </div>
                    <p className="mt-2 text-imp-muted">{selectedCanary.destination}</p>
                    <p className="mt-1 text-imp-muted">Entrega {formatDate(selectedCanary.scheduledAt)}{selectedCanary.returnAt ? ` · devolução ${formatDate(selectedCanary.returnAt)}` : ""}</p>
                    <p className="mt-1 text-imp-muted">
                      Pedido {selectedCanary.orderId ?? "não informado"} · entrega {selectedCanary.externalStatus ?? "não informada"}{selectedCanary.externalConcluded === true ? " concluída" : ""} · devolução {selectedCanary.returnExternalStatus ?? "não informada"}{selectedCanary.returnExternalConcluded === true ? " concluída" : ""}
                    </p>
                    <p className="mt-1 text-imp-muted">Itens {selectedCanary.itemCount ?? "não informado"} · versão {selectedCanary.sourceVersion ?? "não informada"}</p>
                    {selectedCanary.changedFields.length > 0 && <p className="mt-2 font-medium text-imp-amber">Mudou: {selectedCanary.changedFields.join(" · ")}</p>}
                  </div>
                ) : (
                  <div className="rounded-xl bg-imp-ground p-4 text-[15px] text-imp-muted">Selecione um ID para revisar o registro exato.</div>
                )}
              </div>
            ) : (
              <div className="mt-5"><Empty>{preview.counts.skipped > 0 ? "Nenhuma operação válida; revise os registros inválidos acima." : "Nenhuma logística retornada para este período."}</Empty></div>
            )}
            {selectedCanary && (
              <Button variant="secondary" onClick={inspectDetail} disabled={props.busy} className="mt-4">Inspecionar itens e vínculos sem gravar</Button>
            )}
            {detailPreview && (
              <Disclosure className="mt-4" summary="Contrato sanitizado do detalhe" open>
                <p className="text-[13px] text-imp-muted">O corpo completo não é retornado. Somente campos operacionais dos itens; demais chaves aparecem redigidas.</p>
                <div className="mt-2 max-h-64 divide-y divide-imp-line overflow-auto text-[13px]">{detailPreview.contract.fields.map(contractField)}</div>
                <p className="mt-4 text-[15px] font-semibold">Campos de mídia candidatos · {detailPreview.contract.mediaFields.length}</p>
                {detailPreview.contract.mediaFields.length > 0 ? (
                  <div className="mt-2 divide-y divide-imp-line text-[13px]">{detailPreview.contract.mediaFields.map(contractField)}</div>
                ) : (
                  <p className="mt-2 text-[13px] text-imp-muted">Nenhum campo estável de foto foi confirmado neste detalhe.</p>
                )}
                {detailPreview.mediaProbe && (
                  <p className="mt-2 text-[13px] text-imp-muted">
                    Teste da mídia · {detailPreview.mediaProbe.available ? `${detailPreview.mediaProbe.contentType} disponível` : detailPreview.mediaProbe.reason} · {detailPreview.mediaProbe.sourceHost ?? "origem indisponível"}
                  </p>
                )}
                <p className="mt-4 text-[15px] font-semibold">Linhas de item · {detailPreview.items.length}</p>
                <ul className="mt-2 max-h-64 divide-y divide-imp-line overflow-auto text-[15px]">
                  {detailPreview.items.map((item) => (
                    <li key={item.id} className="py-2"><strong>{item.name}</strong><span className="ml-2 text-[13px] text-imp-muted">item {item.itemId}</span></li>
                  ))}
                </ul>
                {detailPreview.itemsBlocked && <div className="mt-3"><Notice tone="red" title="Lista histórica protegida">A lista difere e está protegida contra reescrita.</Notice></div>}
                {detailPreview.checksReset > 0 && <div className="mt-3"><Notice tone="amber" title={`${detailPreview.checksReset} conferência(s) será(ão) redefinida(s)`}>O equipamento mudou na origem.</Notice></div>}
              </Disclosure>
            )}
            <Disclosure className="mt-4" summary="Contrato sanitizado observado">
              <p className="text-[13px] leading-5 text-imp-muted">Somente nomes de campos, tipos, formatos e contagens. Valores, tokens e dados pessoais não são retornados.</p>
              <div className="mt-3 max-h-72 overflow-auto text-[13px]">
                <p className="font-semibold">Paginação</p>
                {preview.contract.pages.map((page, index) => (
                  <p key={`${page.page ?? index}-${index}`} className="mt-1 text-imp-muted">
                    página {page.page ?? index + 1} · {page.records} registro(s) · perPage {page.perPage ?? "não informado"} · filtrados {page.recordsFiltered ?? "não informado"} · total {page.recordsTotal ?? "não informado"}
                  </p>
                ))}
                {preview.contract.facets.length > 0 && (
                  <>
                    <p className="mt-4 font-semibold">Categorias operacionais</p>
                    {preview.contract.facets.map((facet) => (
                      <p key={facet.field} className="mt-1 text-imp-muted"><code>{facet.field}</code> · {facet.values.map((value) => `${value.value} (${value.occurrences}x)`).join(" · ")}</p>
                    ))}
                  </>
                )}
                <p className="mt-4 font-semibold">Campos observados</p>
                <div className="mt-2 divide-y divide-imp-line">{preview.contract.fields.map(contractField)}</div>
              </div>
            </Disclosure>
            <Button
              variant="primary"
              onClick={confirmCanary}
              disabled={
                props.busy ||
                !est.import_enabled ||
                !selectedCanary ||
                selectedCanary.state === "blocked" ||
                detailPreview?.itemsBlocked ||
                detailPreview?.externalId !== selectedCanary.externalId ||
                (selectedCanary.state === "unchanged" && !detailPreview?.itemsChanged)
              }
              className="mt-5 w-full"
            >
              {selectedCanary?.state === "blocked" || detailPreview?.itemsBlocked
                ? "Histórico protegido contra reescrita"
                : detailPreview?.externalId !== selectedCanary?.externalId
                  ? "Inspecione os itens antes de confirmar"
                  : selectedCanary?.state === "diverged" || selectedCanary?.state === "update" || detailPreview?.itemsChanged
                    ? "Atualizar somente esta operação após revisão"
                    : selectedCanary?.state === "unchanged"
                      ? "Operação já conciliada"
                      : "Importar somente esta operação para a Império"}
            </Button>
            {!est.import_enabled && <p className="mt-3 text-center text-[13px] text-imp-amber">Defina ESTOQUENOW_IMPORT_ENABLED=true no servidor somente após validar esta prévia e obter autorização operacional.</p>}
          </Card>
        )}

        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-imp-line px-5 py-4">
            <h3 className="text-[20px] font-semibold">Uma fonte de verdade por domínio</h3>
          </div>
          <ul className="divide-y divide-imp-line">
            {domains.map(([domain, owner, state]) => (
              <li key={domain} className="grid gap-1 px-5 py-3 text-[15px] sm:grid-cols-[1.2fr_.6fr_1.5fr]">
                <strong>{domain}</strong>
                <span className={owner === "Império" ? "text-imp-green" : "text-imp-ink"}>{owner}</span>
                <span className="text-imp-muted">{state}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="text-[20px] font-semibold">Banco de dados da Império</h3>
          <p className="mt-1 text-[15px] text-imp-muted">Supabase: banco, acessos e fotos configurados por ambiente. Nenhum segredo vai ao navegador.</p>
          <div className="mt-3"><Pill tone={props.snapshot.configured ? "green" : "amber"}>{props.snapshot.configured ? "Persistência ativa" : "Modo demonstrativo"}</Pill></div>
        </Card>
        <Card className="p-5">
          <h3 className="text-[20px] font-semibold">Google Maps</h3>
          <p className="mt-1 text-[15px] text-imp-muted">Abre a rota no app ou navegador. Sem chave paga, mapa embutido ou cálculo próprio de chegada.</p>
          <div className="mt-3"><Pill tone="green">Link universal ativo</Pill></div>
        </Card>

        <Card className="p-5 xl:col-span-2">
          <h3 className="text-[20px] font-semibold">Prontidão do conector</h3>
          <ul className="mt-3 grid gap-2 text-[15px] md:grid-cols-2">
            {["OAuth real validado no servidor", "Prévia externa sem escrita", "Importação individual protegida por flag", "Divergências bloqueadas antes da gravação"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-imp-green"><CheckMark checked size="sm" />{item}</li>
            ))}
          </ul>
          <div className="mt-3">
            <Notice tone="amber" title="Confirmação de entrega e devolução no EstoqueNOW">Conectada em código, não homologada. Escrita externa permanece bloqueada.</Notice>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function WebDashboard(props: Props) {
  const [view, setView] = useState<View>("today");
  const [openSelectedOperation, setOpenSelectedOperation] = useState(false);
  const [contextOperationId, setContextOperationId] = useState<string | null>(null);
  const openOperation = (id: string) => {
    props.setSelectedId(id);
    setContextOperationId(null);
    setOpenSelectedOperation(true);
    setView("operations");
    window.scrollTo({ top: 0 });
  };
  const openContext = (next: "evidence" | "incidents", id: string) => {
    setContextOperationId(id);
    setView(next);
  };
  const openIncidents = props.snapshot.incidents.filter((incident) => incident.status !== "resolved").length;
  const groups: [string, [View, string, LucideIcon, string, number?][]][] = [
    [
      "Operação",
      [
        ["today", "Hoje", Sun, "Hoje"],
        ["operations", "Operações", ListChecks, "Operações"],
        ["calendar", "Agenda", CalendarDays, "Agenda"],
        ["incidents", "Ocorrências", AlertTriangle, "Ocorrências", openIncidents],
        ["evidence", "Evidências", Camera, "Evidências"],
      ],
    ],
    [
      "Cadastros",
      [
        ["people", "Pessoas e equipes", Users, "Pessoas"],
        ["fleet", "Frota", Truck, "Frota"],
        ["integrations", "Integrações", Link2, "Integrações"],
      ],
    ],
  ];
  const content = {
    today: <TodayView {...props} onOpenOperation={openOperation} onOpenIncidents={(id) => openContext("incidents", id)} onOpenOperations={() => { setOpenSelectedOperation(false); setView("operations"); }} />,
    operations: <OperationsView {...props} openSelected={openSelectedOperation} onOpenEvidence={(id) => openContext("evidence", id)} onOpenIncidents={(id) => openContext("incidents", id)} />,
    calendar: <CalendarView {...props} onOpenOperation={openOperation} />,
    people: <PeopleView {...props} />,
    fleet: <FleetView {...props} />,
    evidence: <EvidenceView {...props} onOpenOperation={openOperation} focusedOperationId={contextOperationId} onClearFocus={() => setContextOperationId(null)} />,
    incidents: <IncidentsView {...props} onOpenOperation={openOperation} focusedOperationId={contextOperationId} onClearFocus={() => setContextOperationId(null)} />,
    integrations: <IntegrationsView {...props} />,
  };
  const select = (id: View) => {
    setContextOperationId(null);
    if (id === "operations") setOpenSelectedOperation(false);
    setView(id);
  };
  return (
    <div className={`mx-auto w-full max-w-[1720px] lg:grid ${props.navigationCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
      <aside className="border-b border-imp-line bg-imp-surface lg:sticky lg:top-[calc(3.5rem+1px+env(safe-area-inset-top))] lg:h-[calc(100dvh-3.5rem-1px-env(safe-area-inset-top))] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <button
          type="button"
          className="mx-auto mt-3 hidden min-h-11 min-w-11 place-items-center rounded-xl text-imp-muted hover:bg-imp-ground hover:text-imp-ink lg:grid"
          aria-controls="tower-navigation"
          aria-expanded={!props.navigationCollapsed}
          aria-label={props.navigationCollapsed ? "Expandir navegação" : "Recolher navegação"}
          title={props.navigationCollapsed ? "Expandir navegação" : "Recolher navegação"}
          onClick={() => props.onNavigationCollapsedChange(!props.navigationCollapsed)}
        >
          {props.navigationCollapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
        </button>
        <nav id="tower-navigation" className={`grid grid-cols-4 gap-1 px-2 py-2 lg:block lg:py-4 ${props.navigationCollapsed ? "lg:px-2" : "lg:px-3"}`} aria-label="Torre de controle">
          {groups.map(([group, items], groupIndex) => (
            <div key={group} className={`contents lg:block ${groupIndex > 0 ? "lg:mt-5" : ""}`}>
              <p className={`hidden px-3 pb-1 text-[13px] font-semibold text-imp-muted ${props.navigationCollapsed ? "" : "lg:block"}`}>{group}</p>
              {items.map(([id, label, Icon, shortLabel, badge]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(id)}
                  aria-current={view === id ? "page" : undefined}
                  title={props.navigationCollapsed ? label : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[13px] font-medium lg:min-h-11 lg:w-full lg:text-[15px] ${props.navigationCollapsed ? "lg:px-0" : "lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:text-left"} ${
                    view === id ? "bg-imp-green-tint text-imp-green shadow-imp-soft" : "text-imp-ink/80 hover:bg-imp-ground"
                  }`}
                >
                  <Icon size={18} aria-hidden="true" className={view === id ? "text-imp-green" : "text-imp-muted"} />
                  <span className="lg:hidden">{shortLabel}</span>
                  <span className={props.navigationCollapsed ? "sr-only" : "hidden flex-1 lg:inline"}>{label}</span>
                  {badge ? <span className="absolute right-1 top-1 rounded-sm bg-imp-amber-tint px-1.5 text-[13px] font-semibold text-imp-amber lg:static">{badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 p-4 md:p-6 xl:px-8 xl:py-7">
        {props.snapshot.configured && props.refreshState.failed && (
          <div className="mb-5">
            <Notice
              tone="amber"
              title={props.refreshState.lastUpdatedAt ? `Sem atualização desde ${formatTime(props.refreshState.lastUpdatedAt)}` : "A atualização automática falhou"}
              action={
                <Button variant="secondary" onClick={() => void props.run(props.refresh, "Torre atualizada.")}>
                  <RefreshCw size={16} aria-hidden="true" /> Atualizar agora
                </Button>
              }
            >
              Os dados desta tela podem estar desatualizados.
            </Notice>
          </div>
        )}
        <div key={view} className="imp-rise">{content[view]}</div>
      </section>
    </div>
  );
}
