"use client";

import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ExternalLink,
  Link2,
  ListChecks,
  MapPin,
  RefreshCw,
  Settings2,
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
import { StageRail } from "./stage-rail";
import type {
  Incident,
  LogisticsSnapshot,
  Operation,
  OperationEvent,
  OperationStage,
} from "./types";
import {
  formatDate,
  formatDuration,
  mapsUrl,
  postJson,
  type Run,
} from "./workspace";

type Props = {
  snapshot: LogisticsSnapshot;
  selectedId: string;
  setSelectedId: (id: string) => void;
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  refreshState: { lastUpdatedAt: string | null; failed: boolean };
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
  items: Array<{ id: string; itemId: string; orderId: string; name: string }>;
  contract: {
    fields: Array<{ path: string; signatures: string[]; occurrences: number }>;
  };
};

const formValue = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

const statusLabel = {
  active: "Em operação",
  completed: "Concluída",
  cancelled: "Cancelada",
};

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

const riskLabel = {
  critical: "Crítica",
  attention: "Atenção",
  ready: "Sem alerta detectado",
};

const sourceLabel = (operation: Operation) =>
  operation.source === "manual"
    ? "Manual interna · não originada do EstoqueNOW"
    : `EstoqueNOW · ID ${operation.external_id ?? "não informado"}`;

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const colors = {
    neutral: "bg-[#edf1ee] text-[#52655d]",
    green: "bg-[#e3f2ec] text-[#28624f]",
    amber: "bg-[#fff3d1] text-[#7a5911]",
    red: "bg-[#fae5e2] text-[#923d34]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}
    >
      {children}
    </span>
  );
}

function OperationIndicators({
  operation,
  incidents,
  showReady = false,
}: {
  operation: Operation;
  incidents: Incident[];
  showReady?: boolean;
}) {
  const signals = operationSignals(operation, incidents);
  if (signals.risk === "ready")
    return showReady ? <Pill tone="green">Sem alerta detectado</Pill> : null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {signals.criticalIncident && <Pill tone="red">Ocorrência crítica</Pill>}
      {signals.delayed && <Pill tone="amber">Atraso</Pill>}
      {signals.incompleteScale && <Pill tone="amber">Escala incompleta</Pill>}
      {!signals.criticalIncident &&
        !signals.delayed &&
        !signals.incompleteScale &&
        signals.unresolved.length > 0 && <Pill tone="amber">Ocorrência aberta</Pill>}
    </span>
  );
}

function Input({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
  minLength,
  readOnly = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
  readOnly?: boolean;
}) {
  return (
    <label className="mt-3 block text-sm font-medium">
      {label}
      <input
        className="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5 read-only:bg-[#edf1ee] read-only:text-[#5f7067]"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
        readOnly={readOnly}
      />
    </label>
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
    <label className="mt-3 block text-sm font-medium">
      {label}
      <select
        className="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5"
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
      >
        <option value="">Selecione</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Submit({
  busy,
  configured,
  label,
}: {
  busy: boolean;
  configured: boolean;
  label: string;
}) {
  return (
    <button
      disabled={busy || !configured}
      className="mt-5 min-h-11 w-full rounded-lg bg-[#5b4bcc] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#4e3fb5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? "Salvando…" : label}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[#cbd5ce] bg-white p-7 text-center text-sm text-[#66756d]">
      {children}
    </p>
  );
}

function OperationList({
  operations,
  incidents,
  selectedId,
  setSelectedId,
  compact = false,
}: {
  operations: Operation[];
  incidents: Incident[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  compact?: boolean;
}) {
  if (!operations.length)
    return <Empty>Nenhuma operação corresponde a esta visão.</Empty>;
  return (
    <div className={`${compact ? "flex max-w-full overflow-x-auto lg:block lg:overflow-hidden" : "overflow-hidden"} rounded-xl border border-[#d7dfd9] bg-white`}>
      <div className={`${compact ? "hidden" : "hidden md:grid"} grid-cols-[120px_1fr_170px_20px] gap-2 border-b border-[#d7dfd9] bg-[#f7f9f7] px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[#5f7067]`}>
        <span>Horário</span>
        <span>Operação</span>
        <span>Etapa</span>
        <span aria-hidden="true" />
      </div>
      {operations.map((operation) => (
        <button
          key={operation.id}
          onClick={() => setSelectedId(operation.id)}
          className={`grid min-h-16 w-full gap-2 p-4 text-left ${compact ? "min-w-[300px] shrink-0 grid-cols-[82px_1fr_20px] border-r border-[#e4e9e6] last:border-r-0 lg:min-w-0 lg:border-b lg:border-r-0 lg:last:border-b-0" : "min-w-0 grid-cols-[minmax(0,1fr)_20px] border-b border-[#e4e9e6] last:border-0 md:grid-cols-[120px_1fr_170px_20px]"} ${
            selectedId === operation.id ? "bg-[#eef5f1]" : "hover:bg-[#f8faf8]"
          }`}
        >
          <span className={`${compact ? "" : "col-start-1 row-start-1 md:col-auto md:row-auto"} font-mono text-xs font-semibold`}>
            {formatDate(operation.scheduled_at)}
          </span>
          <span className={`${compact ? "" : "col-start-1 row-start-2 md:col-auto md:row-auto"} min-w-0`}>
            <strong className="block break-words">{operation.event_name}</strong>
            <small className="line-clamp-1 text-[#68776f]">
              {operation.destination}
            </small>
            <span className="mt-2 block">
              <OperationIndicators operation={operation} incidents={incidents} />
            </span>
          </span>
          <span className={`${compact ? "col-start-2" : "col-start-1 row-start-3 md:col-auto md:row-auto"} text-sm`}>
            <span className="block font-medium">{stageLabels[operation.stage]}</span>
            <small
              className={
                operation.source === "manual" ? "text-[#9b653e]" : "text-[#35705f]"
              }
            >
              {operation.source === "manual" ? "Origem manual" : "Origem EstoqueNOW"}
            </small>
          </span>
          <ChevronRight
            size={18}
            className={`${compact ? "col-start-3 row-span-2 row-start-1" : "col-start-2 row-span-3 row-start-1 md:col-auto md:row-auto"} self-center text-[#5f7067]`}
          />
        </button>
      ))}
    </div>
  );
}

function StageFocus({
  operation,
  stage,
}: {
  operation: Operation;
  stage: OperationStage;
}) {
  const index = operationStages.indexOf(stage);
  const current = operationStages.indexOf(operation.stage);
  const completedEvent = operation.events.find(
    (event) => event.stage === stage && event.event_type === "stage_completed",
  );
  const evidence = completedEvent ?? operation.events.find((event) => event.stage === stage);
  const state = stageState(index, current, operation.status, Boolean(completedEvent));
  const stateLabel = state === "done" ? "Concluída" : state === "active" ? "Etapa atual" : "Aguardando";

  return (
    <section className="mt-5 border-y border-[#e2e8e4] py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
            Foco da etapa {index + 1}
          </p>
          <h4 className="mt-1 text-lg font-semibold">{stageLabels[stage]}</h4>
        </div>
        <Pill tone={state === "done" ? "green" : "neutral"}>{stateLabel}</Pill>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h5 className="text-sm font-semibold">Checklist operacional</h5>
          <ul className="mt-3 space-y-2">
            {checklistForStage(stage).map((item) => {
              const checked = evidence?.checklist[item] === true;
              return (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-[#287258] bg-[#287258] text-white" : "border-[#d3a34a] bg-[#fff7e3] text-[#7a5911]"}`}>
                    {checked && <Check size={13} />}
                  </span>
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h5 className="text-sm font-semibold">Evidências da etapa</h5>
          {evidence ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-[#5f7067]">Confirmação</dt><dd className="font-medium">{formatDate(evidence.server_received_at)}</dd></div>
              <div><dt className="text-[#5f7067]">Executado por</dt><dd className="font-medium">{evidence.actor_name}</dd></div>
              <div><dt className="text-[#5f7067]">Responsável</dt><dd className="font-medium">{evidence.responsible_name}</dd></div>
              <div><dt className="text-[#5f7067]">GPS</dt><dd className="font-medium">{evidence.latitude.toFixed(5)}, {evidence.longitude.toFixed(5)} · precisão {Math.round(evidence.accuracy)} m</dd></div>
              {evidence.photo_url && <div><dt className="text-[#5f7067]">Foto</dt><dd><a href={evidence.photo_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">Abrir evidência</a></dd></div>}
            </dl>
          ) : (
            <p className="mt-3 rounded-lg bg-[#f3f6f4] p-3 text-sm text-[#5f7067]">
              {state === "done"
                ? "Etapa avançada sem evidência disponível neste recorte."
                : "Aguardando checklist, foto e GPS confirmados pelo app de campo."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function OperationDetail({
  snapshot,
  operation,
  timelineLimit,
  onOpenEvidence,
  onOpenIncidents,
}: {
  snapshot: LogisticsSnapshot;
  operation?: Operation;
  timelineLimit?: number;
  onOpenEvidence?: () => void;
  onOpenIncidents?: () => void;
}) {
  const [focusedStage, setFocusedStage] = useState<OperationStage>(
    operation?.stage ?? "preparation",
  );
  if (!operation) return <Empty>Selecione uma operação para ver o detalhe.</Empty>;
  const operationIncidents = snapshot.incidents.filter(
    (incident) => incident.operation_id === operation.id && incident.status !== "resolved",
  );
  const signals = operationSignals(operation, snapshot.incidents);
  const orderedEvents = [...operation.events].sort(
    (left, right) =>
      Date.parse(right.server_received_at) - Date.parse(left.server_received_at),
  );
  const visibleEvents =
    timelineLimit === undefined
      ? orderedEvents
      : orderedEvents.slice(0, timelineLimit);
  const hiddenEvents = orderedEvents.length - visibleEvents.length;
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[#d7dfd9] bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
            {sourceLabel(operation)}
          </p>
          <h3 className="mt-2 break-words text-2xl font-semibold md:text-3xl">
            {operation.event_name}
          </h3>
          <p className="mt-1 text-sm text-[#617068]">{operation.destination}</p>
        </div>
        <Pill
          tone={
            operation.status === "completed"
              ? "green"
              : operation.status === "cancelled"
                ? "red"
                : "neutral"
          }
        >
          {statusLabel[operation.status]}
        </Pill>
      </div>
      <div className="mt-3">
        <OperationIndicators
          operation={operation}
          incidents={snapshot.incidents}
          showReady
        />
      </div>
      {operation.estoquenow_context && (
        <div className="mt-4 overflow-hidden rounded-lg border border-[#dce3de]">
          <dl className="grid gap-px bg-[#dce3de] text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-[#f8faf8] p-3">
              <dt className="text-[#5f7067]">Pedido EstoqueNOW</dt>
              <dd className="font-medium">{operation.estoquenow_context.order_id ?? "Não informado"}</dd>
            </div>
            <div className="bg-[#f8faf8] p-3">
              <dt className="text-[#5f7067]">Devolução prevista</dt>
              <dd className="font-medium">
                {operation.estoquenow_context.return_at
                  ? formatDate(operation.estoquenow_context.return_at)
                  : "Não informada"}
              </dd>
            </div>
            <div className="bg-[#f8faf8] p-3">
              <dt className="text-[#5f7067]">Status externo</dt>
              <dd className="font-medium">
                {operation.estoquenow_context.delivery_status_type ?? "Não informado"}
              </dd>
            </div>
            <div className="bg-[#f8faf8] p-3">
              <dt className="text-[#5f7067]">Itens previstos</dt>
              <dd className="font-medium">
                {operation.estoquenow_context.item_count ?? "Não informado"}
              </dd>
            </div>
          </dl>
          {operation.estoquenow_context.items.length > 0 && (
            <details className="bg-[#f8faf8] p-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Equipamentos importados · {operation.estoquenow_context.items.length}</summary>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {operation.estoquenow_context.items.map((item) => <li key={item.id} className="rounded-md bg-white p-2">{item.name}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {operationIncidents.length > 0 && (
        <div className="mt-5 border-l-4 border-[#d69f38] bg-[#fff7e3] p-4 text-sm text-[#755615]">
          <p className="font-mono text-xs uppercase tracking-[0.14em]">
            Antes de avançar
          </p>
          <strong className="mt-1 block">
            {operationIncidents.length} ocorrência(s) exige(m) decisão.
          </strong>
          <span className="mt-1 block">Revise a exceção na torre antes da próxima etapa.</span>
          {onOpenIncidents && (
            <button
              type="button"
              onClick={onOpenIncidents}
              className="mt-3 min-h-11 rounded-lg border border-[#d3ad61] bg-white px-3 py-2 font-semibold"
            >
              Revisar ocorrências
            </button>
          )}
        </div>
      )}
      <a
        href={mapsUrl(operation.destination)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfcfc6] px-3 py-2 text-sm font-semibold hover:bg-[#f4f7f5]"
      >
        Abrir rota no Google Maps <ExternalLink size={15} />
      </a>
      <StageRail
        operation={operation}
        selectedStage={focusedStage}
        onStageSelect={setFocusedStage}
      />
      <StageFocus operation={operation} stage={focusedStage} />
      <dl className="mt-5 grid border-y border-[#e2e8e4] text-sm [&>div]:p-4 sm:grid-cols-2">
        <div>
          <dt className="text-[#5f7067]">Equipe</dt>
          <dd className="font-medium">
            {snapshot.teams.find((team) => team.id === operation.team_id)?.name ??
              "Não escalada"}
          </dd>
        </div>
        <div className="border-t border-[#e2e8e4] sm:border-l sm:border-t-0">
          <dt className="text-[#5f7067]">Veículo</dt>
          <dd className="font-medium">
            {snapshot.vehicles.find((vehicle) => vehicle.id === operation.vehicle_id)
              ?.name ?? "Não escalado"}
          </dd>
        </div>
        <div className="border-t border-[#e2e8e4]">
          <dt className="text-[#5f7067]">Motorista</dt>
          <dd className="font-medium">
            {snapshot.people.find((person) => person.id === operation.driver_id)
              ?.full_name ?? "Não escalado"}
          </dd>
        </div>
        <div className="border-t border-[#e2e8e4] sm:border-l">
          <dt className="text-[#5f7067]">Próxima ação</dt>
          <dd className="font-medium">
            {operation.status === "active"
              ? signals.unresolved.length > 0
                ? "Tratar ocorrência antes de avançar"
                : signals.incompleteScale
                  ? "Completar a escala operacional"
                  : signals.delayed
                    ? "Decidir o tratamento do atraso"
                    : `Concluir ${stageLabels[operation.stage].toLowerCase()}`
              : statusLabel[operation.status]}
          </dd>
        </div>
      </dl>
      <h4 className="mt-5 font-semibold">Linha do tempo e evidências</h4>
      <div className="mt-3 space-y-3">
        {!operation.events.length && (
          <p className="text-sm text-[#5f7067]">Nenhuma ação confirmada no servidor.</p>
        )}
        {visibleEvents.map((event) => (
          <TimelineEvent key={event.id} event={event} configured={snapshot.configured} />
        ))}
        {hiddenEvents > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8e4] pt-3 text-sm font-medium text-[#5f7067]">
            <p>+{hiddenEvents} registro(s) disponível(is) em Evidências.</p>
            {onOpenEvidence && (
              <button
                type="button"
                onClick={onOpenEvidence}
                className="min-h-11 rounded-lg border border-[#cad4cd] bg-white px-3 py-2 font-semibold text-[#294f43]"
              >
                Abrir evidências
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function TimelineEvent({
  event,
  configured,
}: {
  event: OperationEvent;
  configured: boolean;
}) {
  return (
    <div className="rounded-lg bg-[#f3f6f4] p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <strong>
          {event.event_type === "arrival_blocked"
            ? "Acesso bloqueado na chegada"
            : `${stageLabels[event.stage]} confirmada`}
        </strong>
        <span className="text-[#38705f]">
          {configured ? "Confirmado pelo servidor" : "Dado demonstrativo"}
        </span>
      </div>
      <p className="mt-1 text-[#617068]">
        Executado por {event.actor_name} · {formatDate(event.server_received_at)} · {formatDuration(event.duration_seconds)}
      </p>
      <p className="text-[#617068]">Responsável: {event.responsible_name}</p>
      <p className="text-[#617068]">
        GPS {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)} · precisão {Math.round(event.accuracy)} m
      </p>
      {event.arrival_reason && (
        <p className="mt-1 text-[#7a5911]">Motivo: {event.arrival_reason}</p>
      )}
      {event.acceptance_name && (
        <p className="mt-1 text-[#617068]">Aceite interno: {event.acceptance_name}</p>
      )}
      {event.note && <p className="mt-1 text-[#617068]">{event.note}</p>}
      {event.photo_url && (
        <a
          className="mt-2 inline-block font-semibold underline"
          href={event.photo_url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir foto
        </a>
      )}
    </div>
  );
}

function TodayView(
  props: Props & {
    onOpenEvidence: (id: string) => void;
    onOpenIncidents: (id: string) => void;
    onOpenOperations: () => void;
  },
) {
  const { snapshot, selectedId, setSelectedId } = props;
  const active = snapshot.operations.filter((operation) =>
    isOperationalToday(operation),
  );
  const prioritized = prioritizeOperations(active, snapshot.incidents);
  const selected =
    active.find((operation) => operation.id === selectedId) ?? prioritized[0];
  const unassigned = active.filter(
    (operation) => !operation.team_id || !operation.vehicle_id || !operation.driver_id,
  );
  const delayed = active.filter(
    (operation) => operationSignals(operation, snapshot.incidents).delayed,
  );
  const critical = active.filter(
    (operation) => operationSignals(operation, snapshot.incidents).criticalIncident,
  );
  const decisionQueue = prioritized.filter(
    (operation) => operationSignals(operation, snapshot.incidents).risk !== "ready",
  );
  const metrics: [string, number, LucideIcon][] = [
    ["Ativas hoje", active.length, CircleGauge],
    ["Críticas", critical.length, AlertTriangle],
    ["Atrasos", delayed.length, CalendarDays],
    ["Escalas incompletas", unassigned.length, Users],
  ];
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_44px] items-end gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">
            Torre de hoje
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Próxima ação, sem ruído.
          </h2>
          <p className="mt-2 text-sm text-[#5f7067]">
            {!snapshot.configured
              ? "Modo demonstrativo: os dados desta tela não são atualizados pelo servidor."
              : props.refreshState.failed
                ? "A atualização automática falhou. Use o botão para tentar novamente."
                : props.refreshState.lastUpdatedAt
                  ? `Atualizado em ${formatDate(props.refreshState.lastUpdatedAt)}. Nova leitura em até 30 segundos.`
                  : "Atualização automática ativa a cada 30 segundos enquanto esta aba estiver visível."}
          </p>
        </div>
        <button
          onClick={() => void props.run(props.refresh, "Torre atualizada.")}
          className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-[#cad4cd] bg-white hover:bg-[#f4f7f5]"
          aria-label="Atualizar torre"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-4 overflow-hidden border-y border-[#d7dfd9] bg-white">
        {metrics.map(([label, value, Icon], index) => (
          <article
            key={String(label)}
            className={`flex min-h-20 min-w-0 items-start gap-2 px-2 py-3 sm:gap-3 sm:px-4 ${index < metrics.length - 1 ? "border-r border-[#e1e7e3]" : ""}`}
          >
            <Icon size={18} className="hidden shrink-0 text-[#3d7567] sm:block" />
            <span className="min-w-0">
              <strong className="block text-2xl leading-none">{String(value)}</strong>
              <span className="mt-1 block text-xs leading-tight text-[#5f7067] sm:text-sm">{String(label)}</span>
            </span>
          </article>
        ))}
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <OperationDetail
          key={`${selected?.id}-${selected?.stage}`}
          snapshot={snapshot}
          operation={selected}
          timelineLimit={2}
          onOpenEvidence={selected ? () => props.onOpenEvidence(selected.id) : undefined}
          onOpenIncidents={selected ? () => props.onOpenIncidents(selected.id) : undefined}
        />
        <aside className="order-first min-w-0 space-y-4 lg:order-last">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
                  Fila de decisão
                </p>
                <h3 className="font-semibold">Bloqueios prioritários</h3>
              </div>
              <Pill tone={decisionQueue.length ? "amber" : "green"}>
                {decisionQueue.length}
              </Pill>
            </div>
            {decisionQueue.length ? (
              <div className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white">
                {decisionQueue.slice(0, 5).map((operation) => {
                  const signals = operationSignals(operation, snapshot.incidents);
                  return (
                    <button
                      type="button"
                      key={operation.id}
                      onClick={() => setSelectedId(operation.id)}
                      className={`block min-h-11 w-full border-b border-[#e1e7e3] p-4 text-left last:border-b-0 hover:bg-[#f8faf8] ${selected?.id === operation.id ? "bg-[#fff9e9]" : ""}`}
                    >
                      <span className="block font-semibold">{operation.event_name}</span>
                      <span className="mt-1 block text-sm text-[#5f7067]">
                        {signals.criticalIncident
                          ? "Ocorrência crítica exige tratamento"
                          : signals.delayed
                            ? "Atraso exige decisão operacional"
                            : signals.incompleteScale
                              ? "Equipe, veículo ou motorista pendente"
                              : `${signals.unresolved.length} ocorrência(s) aberta(s)`}
                      </span>
                      <span className="mt-2 block">
                        <OperationIndicators operation={operation} incidents={snapshot.incidents} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="border-l-4 border-[#2d7461] bg-[#edf6f2] p-4 text-sm text-[#285f50]">
                Nenhum bloqueio detectado nas operações de hoje.
              </p>
            )}
            {decisionQueue.length > 5 && (
              <button type="button" onClick={props.onOpenOperations} className="mt-2 min-h-11 w-full rounded-lg px-3 py-2 text-sm font-semibold text-[#3d675b] underline underline-offset-4">
                Ver todas as operações
              </button>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">
                  Agenda operacional
                </p>
                <h3 className="font-semibold">Hoje e atrasadas</h3>
              </div>
              <Pill tone="neutral">{active.length}</Pill>
            </div>
            <OperationList
              operations={prioritized.slice(0, 4)}
              incidents={snapshot.incidents}
              selectedId={selected?.id ?? ""}
              setSelectedId={setSelectedId}
              compact
            />
            {active.length > 4 && (
              <button type="button" onClick={props.onOpenOperations} className="mt-2 min-h-11 w-full rounded-lg px-3 py-2 text-sm font-semibold text-[#3d675b] underline underline-offset-4">
                Ver todas as operações
              </button>
            )}
          </section>
        </aside>
      </div>
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
  const filters = {
    query,
    status: statusFilter,
    stage: stageFilter,
    source: sourceFilter,
    teamId: teamFilter,
    vehicleId: vehicleFilter,
    risk: riskFilter,
    startDate,
    endDate,
  };
  const filtered = props.snapshot.operations.filter((operation) =>
    matchesOperationFilters(operation, props.snapshot.incidents, filters),
  );
  const hasFilters = Object.values(filters).some(
    (value) => value !== "" && value !== "all",
  );
  const advancedFilterCount = [
    teamFilter,
    vehicleFilter,
    stageFilter,
    sourceFilter,
    startDate,
    endDate,
  ].filter((value) => value !== "" && value !== "all").length;
  const selected =
    filtered.find((operation) => operation.id === props.selectedId) ??
    (detailOpen ? undefined : filtered[0]);

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
    if (!detailOpen || !detailRef.current || window.matchMedia("(min-width: 1280px)").matches)
      return;
    detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
    }, "Operação manual criada e escalada.");
  };

  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void props.run(async () => {
      await postJson("update-operation", {
        id: selected?.id,
        destination: formValue(form, "destination"),
        scheduledAt: operationTimestamp(formValue(form, "scheduledAt")),
        teamId: formValue(form, "teamId"),
        vehicleId: formValue(form, "vehicleId"),
        driverId: formValue(form, "driverId"),
        notes: formValue(form, "notes"),
      });
      await props.refresh();
    }, "Escala da operação atualizada.");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Operações</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Planejamento e escala</h2>
        </div>
        <p className="text-sm text-[#5f7067]">{filtered.length} de {props.snapshot.operations.length} operação(ões)</p>
      </div>
      <section aria-label="Filtros de operações" className="mt-5 rounded-xl border border-[#d7dfd9] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="sm:col-span-2 xl:col-span-4">
            <span className="text-xs font-semibold text-[#5f7067]">Buscar operação</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Evento, destino ou ID do EstoqueNOW"
              className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
            >
              <option value="all">Todos os status</option>
              <option value="active">Em operação</option>
              <option value="completed">Concluídas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Risco operacional</span>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
            >
              <option value="all">Todos os riscos</option>
              {Object.entries(riskLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <details className="group mt-3 rounded-lg border border-[#e1e7e3] bg-[#f8faf8] p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[#3d675b]">
            Filtros avançados{advancedFilterCount ? ` · ${advancedFilterCount} aplicado(s)` : ""}
          </summary>
          <div className="mt-3 hidden gap-3 border-t border-[#e1e7e3] pt-3 group-open:grid sm:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Equipe</span>
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm">
              <option value="all">Todas as equipes</option>
              {props.snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Veículo</span>
            <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm">
              <option value="all">Todos os veículos</option>
              {props.snapshot.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Etapa</span>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todas as etapas</option>
            {operationStages.map((stage) => (
              <option value={stage} key={stage}>{stageLabels[stage]}</option>
            ))}
          </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Origem</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todas as origens</option>
            <option value="manual">Manual interna</option>
            <option value="estoquenow">EstoqueNOW</option>
          </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">De</span>
            <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm" />
          </label>
          <label>
            <span className="text-xs font-semibold text-[#5f7067]">Até</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm" />
          </label>
        </div>
        </details>
        {hasFilters && (
          <button type="button" onClick={resetFilters} className="mt-3 min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-[#3d675b] underline underline-offset-4">
            Limpar filtros
          </button>
        )}
      </section>
      <div className={`mt-5 grid items-start gap-5 ${detailOpen ? "xl:grid-cols-[minmax(0,1fr)_430px]" : ""}`}>
        <div className="min-w-0 space-y-5">
          <OperationList
            operations={filtered}
            incidents={props.snapshot.incidents}
            selectedId={selected?.id ?? ""}
            setSelectedId={(id) => {
              props.setSelectedId(id);
              setDetailOpen(true);
            }}
          />
          <details className="rounded-xl border border-[#d7dfd9] bg-white p-5" open={!props.snapshot.operations.length}>
            <summary className="cursor-pointer font-semibold">Criar operação manual</summary>
            <p className="mt-2 text-sm font-semibold text-[#9b653e]">
              Não originada do EstoqueNOW.
            </p>
            <form onSubmit={create} className="mt-3 grid gap-x-4 md:grid-cols-2">
              <Input name="eventName" label="Evento" />
              <Input name="destination" label="Destino completo" />
              <Input name="scheduledAt" label="Data e horário" type="datetime-local" />
              <Select name="teamId" label="Equipe" required={false} options={props.snapshot.teams.map((team) => [team.id, team.name])} />
              <Select name="vehicleId" label="Veículo" required={false} options={props.snapshot.vehicles.map((vehicle) => [vehicle.id, `${vehicle.name} · ${vehicle.plate}`])} />
              <Select name="driverId" label="Motorista" required={false} options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
              <div className="md:col-span-2"><Input name="notes" label="Observações" required={false} /></div>
              <div className="md:col-span-2"><Submit busy={props.busy} configured={props.snapshot.configured} label="Criar operação manual" /></div>
            </form>
          </details>
        </div>
        {detailOpen && (
        <div ref={detailRef} className="min-w-0 scroll-mt-20 space-y-3 xl:sticky xl:top-4">
          <button onClick={() => setDetailOpen(false)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#cad4cd] bg-white px-3 text-sm font-semibold hover:bg-[#f4f7f5]"><X size={16} /> Fechar detalhe</button>
          {selected ? (
            <OperationDetail
              key={`${selected.id}-${selected.stage}`}
              snapshot={props.snapshot}
              operation={selected}
              onOpenEvidence={() => props.onOpenEvidence(selected.id)}
              onOpenIncidents={() => props.onOpenIncidents(selected.id)}
            />
          ) : (
            <Empty>
              A operação selecionada está fora dos filtros. Limpe os filtros ou
              escolha outra operação.
            </Empty>
          )}
          {selected && selected.status === "active" && (
            <form key={selected.id} onSubmit={update} className="rounded-xl border border-[#d7dfd9] bg-white p-5">
              <h3 className="text-lg font-semibold">Editar escala</h3>
              <Input name="destination" label="Destino" defaultValue={selected.destination} readOnly={selected.source === "estoquenow"} />
              <Input name="scheduledAt" label="Data e horário" type="datetime-local" defaultValue={operationDateTimeInput(selected.scheduled_at)} readOnly={selected.source === "estoquenow"} />
              {selected.source === "estoquenow" && <p className="mt-2 text-xs text-[#5f7067]">Destino e horário vêm do EstoqueNOW; aqui você altera apenas a escala interna.</p>}
              <Select name="teamId" label="Equipe" required={false} defaultValue={selected.team_id ?? ""} options={props.snapshot.teams.map((team) => [team.id, team.name])} />
              <Select name="vehicleId" label="Veículo" required={false} defaultValue={selected.vehicle_id ?? ""} options={props.snapshot.vehicles.map((vehicle) => [vehicle.id, `${vehicle.name} · ${vehicle.plate}`])} />
              <Select name="driverId" label="Motorista" required={false} defaultValue={selected.driver_id ?? ""} options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
              <Input name="notes" label="Observações" required={false} defaultValue={selected.notes ?? ""} />
              <Submit busy={props.busy} configured={props.snapshot.configured} label="Salvar escala" />
              <details className="mt-5 border-t border-[#e1e7e3] pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#8a4339]">Cancelar operação</summary>
                <label className="mt-3 block text-sm font-medium">Motivo<textarea name="cancelReason" className="mt-2 w-full rounded-lg border border-[#cbd4ce] px-3 py-2" rows={2} /></label>
                <button
                  type="button"
                  disabled={props.busy || !props.snapshot.configured}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    const reason = form ? formValue(new FormData(form), "cancelReason") : "";
                    void props.run(async () => {
                      await postJson("cancel-operation", { id: selected.id, reason });
                      await props.refresh();
                    }, "Operação cancelada com motivo registrado.");
                  }}
                  className="mt-3 rounded-lg border border-[#cf9d96] px-3 py-2 text-sm font-semibold text-[#8a4339] disabled:opacity-40"
                >
                  Confirmar cancelamento
                </button>
              </details>
            </form>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({
  snapshot,
  onOpenOperation,
}: Props & { onOpenOperation: (id: string) => void }) {
  const [reference, setReference] = useState(
    operationDateInput(
      new Date(
        snapshot.operations.find((operation) => operation.status === "active")
          ?.scheduled_at ?? new Date(),
      ),
    ),
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
  const visibleOperations = snapshot.operations.filter(
    (operation) =>
      dayKeys.has(operationDateInput(new Date(operation.scheduled_at))) &&
      (teamFilter === "all" || operation.team_id === teamFilter),
  );
  const shiftWeek = (daysToAdd: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + daysToAdd);
    setReference(operationDateInput(next));
  };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Agenda</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Semana operacional</h2>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[44px_1fr_44px]">
          <button type="button" onClick={() => shiftWeek(-7)} aria-label="Semana anterior" className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-[#cbd4ce] bg-white"><ChevronLeft size={17} /></button>
          <label className="sr-only" htmlFor="agenda-reference">Semana de referência</label>
          <input id="agenda-reference" type="date" value={reference} onChange={(event) => { if (event.target.value) setReference(event.target.value); }} className="min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={() => shiftWeek(7)} aria-label="Próxima semana" className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-[#cbd4ce] bg-white"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#5f7067]">Semana completa · sábado e domingo em destaque · horários de São Paulo</p>
        <select aria-label="Filtrar agenda por equipe" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm sm:w-auto">
          <option value="all">Todas as equipes</option>
          {snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#d7dfd9] bg-white">
        <div className="grid min-w-[1100px] grid-cols-[76px_repeat(7,minmax(140px,1fr))]">
          <div className="border-b border-r border-[#e1e7e3] bg-[#f7f9f7]" />
          {days.map((day) => {
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <h3 key={operationDateInput(day)} className={`border-b border-r border-[#e1e7e3] px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] last:border-r-0 ${weekend ? "bg-[#fff7e8] text-[#7a5911]" : "bg-[#f7f9f7] text-[#5f7067]"}`}>
                {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day)}
              </h3>
            );
          })}
          {slots.map((slot) => (
            <div className="contents" key={slot}>
              <time className="border-b border-r border-[#e1e7e3] px-3 py-3 font-mono text-xs tabular-nums text-[#5f7067]">{String(slot).padStart(2, "0")}:00</time>
              {days.map((day) => {
                const key = operationDateInput(day);
                const operations = visibleOperations.filter((operation) => {
                  if (operationDateInput(new Date(operation.scheduled_at)) !== key) return false;
                  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date(operation.scheduled_at)));
                  return hour >= slot && hour < slot + 6;
                });
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <section key={`${key}-${slot}`} aria-label={`${key}, ${slot}:00`} className={`min-h-28 border-b border-r border-[#e1e7e3] p-2 last:border-r-0 ${weekend ? "bg-[#fffdf8]" : ""}`}>
                    <div className="space-y-2">
                      {operations.map((operation) => (
                        <button key={operation.id} onClick={() => onOpenOperation(operation.id)} className="min-h-11 w-full rounded-lg bg-[#eef4f0] p-2 text-left text-xs hover:bg-[#e2eee7]">
                          <strong className="block font-mono tabular-nums">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(operation.scheduled_at))}</strong>
                          <span className="mt-1 block font-semibold">{operation.event_name}</span>
                          <span className="text-[#5f7067]">{stageLabels[operation.stage]}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!visibleOperations.length && <div className="mt-4"><Empty>Nenhuma operação corresponde à semana e à equipe selecionadas.</Empty></div>}
    </div>
  );
}

function PeopleView(props: Props) {
  const submit = (
    action: string,
    success: string,
    body: (form: FormData) => object,
  ) => (event: FormEvent<HTMLFormElement>) => {
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
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Pessoas e equipes</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Quem pode ir para a escala</h2>
      </div>

      <div className="mt-5 grid items-start gap-3 sm:grid-cols-2">
        <details className="rounded-xl border border-[#d7dfd9] bg-white p-4" open={!props.snapshot.people.length}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <Users size={19} className="text-[#3d7567]" /> Cadastrar funcionário
          </summary>
          <form className="mt-2 border-t border-[#e1e7e3] pt-2" onSubmit={submit("create-person", "Funcionário e acesso criados.", (form) => ({ fullName: formValue(form, "fullName"), email: formValue(form, "email"), phone: formValue(form, "phone"), jobTitle: formValue(form, "jobTitle"), temporaryPassword: formValue(form, "temporaryPassword") }))}>
            <p className="mt-2 text-sm text-[#5f7067]">Cria o perfil no Auth; a senha temporária muda no primeiro acesso.</p>
            <Input name="fullName" label="Nome completo" />
            <Input name="email" label="E-mail" type="email" />
            <Input name="jobTitle" label="Função operacional" />
            <Input name="phone" label="Telefone" required={false} />
            <Input name="temporaryPassword" label="Senha temporária" type="password" minLength={10} />
            <Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar funcionário" />
          </form>
        </details>

        <details className="rounded-xl border border-[#d7dfd9] bg-white p-4" open={!props.snapshot.teams.length}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
            <Users size={19} className="text-[#3d7567]" /> Criar equipe-base
          </summary>
          <form className="mt-2 border-t border-[#e1e7e3] pt-2" onSubmit={submit("create-team", "Equipe criada.", (form) => ({ name: formValue(form, "name"), leaderId: formValue(form, "leaderId"), memberIds: form.getAll("memberIds").map(String) }))}>
            <Input name="name" label="Nome da equipe" />
            <Select name="leaderId" label="Líder" options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Integrantes</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {props.snapshot.people.map((person) => (
                  <label key={person.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#d7dfd9] px-3 text-sm">
                    <input type="checkbox" name="memberIds" value={person.id} className="size-5 accent-[#5b4bcc]" />
                    <span className="min-w-0 break-words">{person.full_name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Submit busy={props.busy} configured={props.snapshot.configured} label="Criar equipe" />
          </form>
        </details>
      </div>

      <h3 className="mt-7 font-semibold">Pessoas</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.snapshot.people.map((person) => (
          <article key={person.id} className="rounded-xl border border-[#d7dfd9] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><strong className="break-words">{person.full_name}</strong><p className="text-sm text-[#65746c]">{person.job_title}</p></div>
              <Pill tone={person.availability === "available" ? "green" : "amber"}>{person.availability === "available" ? "Disponível" : "Indisponível"}</Pill>
            </div>
            <p className="mt-3 text-sm text-[#65746c]">{person.phone ?? "Telefone não informado"}</p>
            <small className="mt-2 block text-[#5f7067]">Acesso: {person.role === "manager" ? "Gestor" : "Funcionário"}</small>
          </article>
        ))}
      </div>
      {!props.snapshot.people.length && <div className="mt-3"><Empty>Cadastre a primeira pessoa para formar uma equipe.</Empty></div>}

      <h3 className="mt-7 font-semibold">Equipes-base</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.snapshot.teams.map((team) => (
          <article key={team.id} className="min-w-0 rounded-xl border border-[#d7dfd9] bg-white p-4"><strong className="break-words">{team.name}</strong><p className="mt-2 text-sm text-[#65746c]">Líder: {props.snapshot.people.find((person) => person.id === team.leader_id)?.full_name ?? "Não informado"}</p><p className="text-sm text-[#65746c]">{team.member_ids.length} integrante(s)</p></article>
        ))}
      </div>
      {!props.snapshot.teams.length && <div className="mt-3"><Empty>Crie uma equipe para escalar os recursos juntos.</Empty></div>}
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
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Frota</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Veículos e disponibilidade</h2></div>
        <details className="w-full rounded-xl border border-[#d7dfd9] bg-white p-4 sm:max-w-sm">
          <summary className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><Truck size={19} className="text-[#3d7567]" /> Cadastrar veículo</summary>
          <form onSubmit={create} className="mt-2 border-t border-[#e1e7e3] pt-2"><div className="grid gap-x-4 sm:grid-cols-2"><Input name="name" label="Nome" /><Input name="plate" label="Placa" /><Input name="vehicleType" label="Tipo" /><Input name="capacityLabel" label="Capacidade" required={false} /></div><Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar veículo" /></form>
        </details>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[#d7dfd9] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#f7f9f7] font-mono text-xs uppercase tracking-[0.12em] text-[#5f7067]">
            <tr><th className="px-4 py-3">Veículo</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Capacidade</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {props.snapshot.vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="border-t border-[#e4e9e6]">
                <td className="px-4 py-3 font-semibold">{vehicle.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{vehicle.plate}</td>
                <td className="px-4 py-3 text-[#5f7067]">{vehicle.vehicle_type}</td>
                <td className="px-4 py-3 text-[#5f7067]">{vehicle.capacity_label ?? "Não informada"}</td>
                <td className="px-4 py-3"><select aria-label={`Status de ${vehicle.name}`} value={vehicle.status} disabled={!props.snapshot.configured || props.busy} onChange={(event) => void props.run(async () => { await postJson("set-vehicle-status", { id: vehicle.id, status: event.target.value }); await props.refresh(); }, "Status do veículo atualizado.")} className="min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"><option value="available">Disponível</option><option value="in_use">Em uso</option><option value="maintenance">Manutenção</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!props.snapshot.vehicles.length && <div className="mt-3"><Empty>Cadastre o primeiro veículo para completar uma escala.</Empty></div>}
    </div>
  );
}

function EvidenceView({
  snapshot,
  onOpenOperation,
  focusedOperationId,
  onClearFocus,
}: Props & {
  onOpenOperation: (id: string) => void;
  focusedOperationId: string | null;
  onClearFocus: () => void;
}) {
  const allEvidence = snapshot.operations.flatMap((operation) =>
    operation.events.map((event) => ({ operation, event })),
  );
  const evidence = focusedOperationId
    ? allEvidence.filter(({ operation }) => operation.id === focusedOperationId)
    : allEvidence;
  const focusedOperation = snapshot.operations.find(
    (operation) => operation.id === focusedOperationId,
  );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Evidências</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Registro confirmado por etapa</h2>{focusedOperation && <p className="mt-2 text-sm text-[#5f7067]">Mostrando somente {focusedOperation.event_name}.</p>}</div>{focusedOperation && <button type="button" onClick={onClearFocus} className="min-h-11 rounded-lg border border-[#cad4cd] bg-white px-3 py-2 text-sm font-semibold">Ver todas as evidências</button>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {evidence.map(({ operation, event }) => (
          <article key={event.id} className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white">
            {event.photo_url ? <a href={event.photo_url} target="_blank" rel="noreferrer" className="grid h-40 place-items-end bg-cover bg-center p-4 text-sm font-semibold text-white" style={{ backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(17, 35, 29, .82)), url(${JSON.stringify(event.photo_url)})` }}><span className="flex items-center gap-2"><Camera size={18} />Abrir evidência</span></a> : <div className="grid h-28 place-items-center bg-[#edf1ee] text-xs text-[#5f7067]">Sem foto nesta etapa</div>}
            <div className="p-4"><Pill tone="green">{snapshot.configured ? "Servidor confirmado" : "Dado demonstrativo"}</Pill><h3 className="mt-3 font-semibold">{operation.event_name}</h3><p className="text-sm text-[#65746c]">{stageLabels[event.stage]} · executado por {event.actor_name}</p><p className="text-sm text-[#65746c]">Responsável: {event.responsible_name}</p><p className="mt-2 text-xs text-[#5f7067]">{formatDate(event.server_received_at)} · GPS {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</p><button type="button" onClick={() => onOpenOperation(operation.id)} className="mt-3 min-h-11 rounded-lg border border-[#cad4cd] px-3 py-2 text-sm font-semibold">Abrir operação</button></div>
          </article>
        ))}
      </div>
      {!evidence.length && <div className="mt-5"><Empty>{focusedOperation ? "Esta operação ainda não possui evidências." : "Conclua uma etapa no app de campo para gerar a primeira evidência."}</Empty></div>}
    </div>
  );
}

function IncidentsView(
  props: Props & {
    onOpenOperation: (id: string) => void;
    focusedOperationId: string | null;
    onClearFocus: () => void;
  },
) {
  const incidents = props.focusedOperationId
    ? props.snapshot.incidents.filter(
        (incident) => incident.operation_id === props.focusedOperationId,
      )
    : props.snapshot.incidents;
  const unresolved = incidents.filter((incident) => incident.status !== "resolved");
  const resolved = incidents.filter((incident) => incident.status === "resolved");
  const focusedOperation = props.snapshot.operations.find(
    (operation) => operation.id === props.focusedOperationId,
  );
  const renderIncident = (incident: Incident) => {
    const operation = props.snapshot.operations.find(
      (item) => item.id === incident.operation_id,
    );
    return (
      <article key={incident.id} className="grid gap-4 rounded-xl border border-[#d7dfd9] bg-white p-4 lg:grid-cols-[1fr_180px]">
        <div><div className="flex flex-wrap gap-2"><Pill tone={incident.severity === "high" ? "red" : incident.severity === "medium" ? "amber" : "neutral"}>{incident.severity === "high" ? "Alta" : incident.severity === "medium" ? "Média" : "Baixa"}</Pill><Pill>{incidentTypeLabel[incident.type]}</Pill></div><h3 className="mt-3 font-semibold">{operation?.event_name ?? "Operação"} · {stageLabels[incident.stage]}</h3><p className="mt-1 text-sm text-[#56675e]">{incident.description}</p>{incident.impact && <p className="mt-1 text-sm text-[#7a5911]">Impacto: {incident.impact}</p>}<p className="mt-2 text-xs text-[#5f7067]">{incident.actor_name} · {formatDate(incident.created_at)}</p>{incident.photo_url && <a href={incident.photo_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Abrir foto</a>}</div>
        <div><label className="text-xs font-semibold">Tratamento<select value={incident.status} disabled={!props.snapshot.configured || props.busy} onChange={(event) => void props.run(async () => { await postJson("update-incident-status", { id: incident.id, status: event.target.value }); await props.refresh(); }, "Ocorrência atualizada.")} className="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"><option value="open">{incidentStatusLabel.open}</option><option value="handling">{incidentStatusLabel.handling}</option><option value="resolved">{incidentStatusLabel.resolved}</option></select></label>{operation && <button type="button" onClick={() => props.onOpenOperation(operation.id)} className="mt-3 min-h-11 w-full rounded-lg border border-[#cad4cd] px-3 py-2 text-sm font-semibold">Abrir operação</button>}</div>
      </article>
    );
  };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Ocorrências</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Exceções que exigem decisão</h2>{focusedOperation && <p className="mt-2 text-sm text-[#5f7067]">Mostrando somente {focusedOperation.event_name}.</p>}</div>{focusedOperation && <button type="button" onClick={props.onClearFocus} className="min-h-11 rounded-lg border border-[#cad4cd] bg-white px-3 py-2 text-sm font-semibold">Ver todas as ocorrências</button>}</div>
      <div className="mt-5 space-y-3">
        {unresolved.map(renderIncident)}
        {!unresolved.length && <Empty>Nenhuma ocorrência aberta nesta visão.</Empty>}
      </div>
      {resolved.length > 0 && <details className="mt-5 rounded-xl border border-[#d7dfd9] bg-white p-4"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Histórico resolvido · {resolved.length}</summary><div className="mt-3 space-y-3 border-t border-[#e1e7e3] pt-3">{resolved.map(renderIncident)}</div></details>}
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
  const selectedCanary = preview?.candidates.find(
    (candidate) => candidate.externalId === canaryId,
  );
  const sync = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let result = "Prévia concluída sem gravar no banco da Império.";
    void props.run(async () => {
      const nextPreview = await postJson<EstoqueNowPreview>("sync-estoquenow", {
        mode: "preview",
        startDate: formValue(form, "startDate"),
        endDate: formValue(form, "endDate"),
      });
      setPreview(nextPreview);
      setDetailPreview(null);
      setCanaryId("");
      result = `${nextPreview.total} logística(s), ${nextPreview.movementsTotal} movimento(s) · ${nextPreview.counts.new} nova(s) · ${nextPreview.counts.update} atualização(ões) · ${nextPreview.counts.unchanged} conciliada(s) · ${nextPreview.counts.diverged} divergente(s) · ${nextPreview.counts.blocked} histórica(s) bloqueada(s) · ${nextPreview.counts.skipped} inválida(s). Nenhuma gravação realizada.`;
    }, () => result);
  };
  const inspectDetail = () => {
    if (!selectedCanary) return;
    void props.run(async () => {
      const detail = await postJson<EstoqueNowDetailPreview>("inspect-estoquenow-detail", {
        externalId: selectedCanary.externalId,
      });
      setDetailPreview(detail);
    }, "Detalhe lido sem gravar; equipamentos revisáveis e contrato sanitizado foram retornados.");
  };
  const confirmCanary = () => {
    if (!preview || !selectedCanary || detailPreview?.externalId !== selectedCanary.externalId)
      return;
    let result = "Importação individual confirmada.";
    void props.run(async () => {
      const confirmed = await postJson<{
        externalId: string;
        imported: number;
        preserved: number;
        backfilled: number;
        updated: number;
      }>("sync-estoquenow", {
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
        : `Operação ${confirmed.externalId} já estava conciliada; dados operacionais foram preservados.`;
      setPreview(null);
      setCanaryId("");
      await props.refresh();
    }, () => result);
  };
  const domains = [
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
  return (
    <div>
      <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5f7067]">Integrações</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Conexões e fontes de verdade</h2></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div><Link2 size={21} className="text-[#3d7567]" /><h3 className="mt-3 text-xl font-semibold">EstoqueNOW</h3></div>
            <Pill tone={props.snapshot.estoquenow.source === "estoquenow" ? "green" : "amber"}>{props.snapshot.estoquenow.source === "estoquenow" ? "Importação ativa" : props.snapshot.estoquenow.configured ? "Credenciais no servidor" : "Sem credenciais"}</Pill>
          </div>
          <p className="mt-3 text-sm text-[#65746c]">{props.snapshot.estoquenow.notice}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[#5f7067]">Operações importadas</dt><dd className="font-semibold">{props.snapshot.estoquenow.imported_count}</dd></div>
            <div><dt className="text-[#5f7067]">Última importação</dt><dd className="font-semibold">{props.snapshot.estoquenow.last_sync_at ? formatDate(props.snapshot.estoquenow.last_sync_at) : "Nunca"}</dd></div>
          </dl>
          <div className="mt-4 rounded-lg bg-[#eef5f1] p-3 text-xs leading-relaxed text-[#285f50]">A consulta à API é somente leitura e ocorre no servidor. Cada confirmação importa exatamente uma operação para o Postgres da Império.</div>
          <div className={`mt-3 rounded-lg p-3 text-xs ${props.snapshot.estoquenow.import_enabled ? "bg-[#e3f2ec] text-[#28624f]" : "bg-[#fff6dd] text-[#705817]"}`}>
            Importação individual {props.snapshot.estoquenow.import_enabled ? "habilitada" : "bloqueada"} por ambiente. Importação em lote indisponível.
          </div>
        </article>
        <form onSubmit={sync} className="rounded-xl border border-[#d7dfd9] bg-white p-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">Passo 1</p>
          <h3 className="mt-2 text-xl font-semibold">Pré-visualizar leitura</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#65746c]">Consulte um período e confira IDs, datas e divergências. Esta etapa nunca grava operações.</p>
          <div className="grid gap-x-4 sm:grid-cols-2"><Input name="startDate" label="Início" type="date" defaultValue={operationDateInput(today)} /><Input name="endDate" label="Fim" type="date" defaultValue={operationDateInput(future)} /></div>
          <button disabled={props.busy || !props.snapshot.configured || !props.snapshot.estoquenow.configured} className="mt-5 min-h-11 w-full rounded-lg bg-[#5b4bcc] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Gerar prévia sem gravar</button>
          {!props.snapshot.estoquenow.configured && <p className="mt-3 text-xs text-[#705817]">Adicione as credenciais apenas no servidor para liberar a prévia.</p>}
        </form>
        {preview && (
          <article className="rounded-xl border border-[#d7dfd9] bg-white p-5 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">Passo 2 · prévia sem escrita</p><h3 className="mt-2 text-xl font-semibold">Escolha exatamente uma operação</h3><p className="mt-1 text-sm text-[#65746c]">Período {preview.startDate.split("-").reverse().join("/")} a {preview.endDate.split("-").reverse().join("/")}</p></div>
              <Pill tone="green">Nenhuma gravação realizada</Pill>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Novas", preview.counts.new],
                ["Atualizações", preview.counts.update],
                ["Conciliadas", preview.counts.unchanged],
                ["Divergentes", preview.counts.diverged],
                ["Histórico bloqueado", preview.counts.blocked],
                ["Inválidas", preview.counts.skipped],
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-[#f2f5f3] p-3"><p className="text-xs text-[#5f7067]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
            </div>
            {preview.counts.diverged > 0 && <p className="mt-4 flex items-start gap-2 rounded-lg bg-[#fff3d1] p-3 text-sm text-[#705817]"><AlertTriangle className="mt-0.5 shrink-0" size={17} />{preview.counts.diverged} registro(s) mudaram no EstoqueNOW. Selecione um por vez e revise antes de atualizar.</p>}
            {preview.counts.blocked > 0 && <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#fbe9e7] p-3 text-sm text-[#8a3025]"><AlertTriangle className="mt-0.5 shrink-0" size={17} />{preview.counts.blocked} operação(ões) têm histórico e não podem reescrever rótulo, endereço ou agenda.</p>}
            {preview.counts.skipped > 0 && <div className="mt-3 rounded-lg border border-[#eadcae] bg-[#fffaf0] p-3 text-xs text-[#705817]"><strong>Registros inválidos, sem gravação:</strong><p className="mt-1">{[
              ["sem ID", preview.skippedReasons.missing_external_id],
              ["ID inválido", preview.skippedReasons.invalid_external_id],
              ["sem nome", preview.skippedReasons.missing_event_name],
              ["nome inválido", preview.skippedReasons.invalid_event_name],
              ["sem destino", preview.skippedReasons.missing_destination],
              ["destino inválido", preview.skippedReasons.invalid_destination],
              ["data ou hora inválida", preview.skippedReasons.invalid_scheduled_date_or_time],
            ].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${count} ${label}`).join(" · ")}</p></div>}
            {preview.candidates.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
                <label className="text-sm font-medium">ID externo da operação
                  <select value={canaryId} onChange={(event) => { setCanaryId(event.target.value); setDetailPreview(null); }} className="mt-2 min-h-11 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5">
                    <option value="">Selecione uma operação válida</option>
                    {preview.candidates.map((candidate) => <option key={candidate.externalId} value={candidate.externalId}>{candidate.externalId} · {candidate.eventName}{candidate.state === "blocked" ? " · histórico bloqueado" : candidate.state === "diverged" ? " · divergência canônica" : candidate.state === "update" ? " · atualização disponível" : candidate.state === "unchanged" ? " · já conciliada" : " · nova"}</option>)}
                  </select>
                </label>
                {selectedCanary ? <div className="rounded-lg border border-[#dce3de] bg-[#f8faf8] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{selectedCanary.eventName}</strong><Pill tone={selectedCanary.state === "new" ? "green" : selectedCanary.state === "diverged" || selectedCanary.state === "blocked" ? "red" : "neutral"}>{selectedCanary.state === "new" ? "Nova" : selectedCanary.state === "blocked" ? "Histórico bloqueado" : selectedCanary.state === "diverged" ? "Divergente" : selectedCanary.state === "update" ? "Atualização" : "Conciliada"}</Pill></div><p className="mt-2 text-xs text-[#5f7067]">{selectedCanary.destination}</p><p className="mt-1 text-xs text-[#5f7067]">Entrega {formatDate(selectedCanary.scheduledAt)}{selectedCanary.returnAt ? ` · devolução ${formatDate(selectedCanary.returnAt)}` : ""}</p><p className="mt-1 text-xs text-[#5f7067]">Pedido {selectedCanary.orderId ?? "não informado"} · entrega {selectedCanary.externalStatus ?? "não informada"}{selectedCanary.externalConcluded === true ? " concluída" : ""} · devolução {selectedCanary.returnExternalStatus ?? "não informada"}{selectedCanary.returnExternalConcluded === true ? " concluída" : ""}</p><p className="mt-1 text-xs text-[#5f7067]">Itens {selectedCanary.itemCount ?? "não informado"} · versão {selectedCanary.sourceVersion ?? "não informada"}</p>{selectedCanary.changedFields.length > 0 && <p className="mt-2 text-xs font-medium text-[#705817]">Mudou: {selectedCanary.changedFields.join(" · ")}</p>}</div> : <div className="rounded-lg bg-[#f2f5f3] p-4 text-sm text-[#5f7067]">Selecione um ID para revisar o registro exato.</div>}
              </div>
            ) : <div className="mt-5"><Empty>Nenhum candidato válido neste período.</Empty></div>}
            {selectedCanary && (
              <button type="button" onClick={inspectDetail} disabled={props.busy} className="mt-4 min-h-11 rounded-lg border border-[#bfcfc6] px-3 py-2 text-sm font-semibold disabled:opacity-40">
                Inspecionar itens e vínculos sem gravar
              </button>
            )}
            {detailPreview && (
              <details open className="mt-4 rounded-lg border border-[#dce3de] bg-[#f8faf8] p-4">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold">Contrato sanitizado do detalhe</summary>
                <p className="mt-2 text-xs text-[#5f7067]">O corpo completo não é retornado. Somente os campos operacionais dos itens abaixo são exibidos; demais chaves aparecem redigidas.</p>
                <div className="mt-2 max-h-64 divide-y divide-[#e1e7e3] overflow-auto text-xs">
                  {detailPreview.contract.fields.map((field) => <p key={field.path} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><code className="break-all">{field.path}</code><span className="text-[#5f7067]">{field.signatures.join(" | ")} · {field.occurrences}x</span></p>)}
                </div>
                <p className="mt-4 text-sm font-semibold">Linhas de item · {detailPreview.items.length}</p>
                <ul className="mt-2 max-h-64 divide-y divide-[#e1e7e3] overflow-auto text-sm">
                  {detailPreview.items.map((item) => <li key={item.id} className="py-2"><strong>{item.name}</strong><span className="ml-2 font-mono text-xs text-[#5f7067]">item {item.itemId}</span></li>)}
                </ul>
                {detailPreview.itemsBlocked && <p className="mt-3 rounded-lg bg-[#fff1ee] p-3 text-xs font-semibold text-[#8a3c2d]">A lista histórica difere e está protegida contra reescrita.</p>}
              </details>
            )}
            <details className="mt-5 rounded-lg border border-[#dce3de] bg-[#f8faf8] p-4">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Contrato sanitizado observado</summary>
              <p className="mt-2 text-xs leading-relaxed text-[#5f7067]">Somente nomes de campos, tipos, formatos e contagens. Valores, tokens e dados pessoais não são retornados.</p>
              <div className="mt-3 max-h-72 overflow-auto text-xs">
                <p className="font-semibold">Paginação</p>
                {preview.contract.pages.map((page, index) => <p key={`${page.page ?? index}-${index}`} className="mt-1 font-mono text-[#52655d]">página {page.page ?? index + 1} · {page.records} registro(s) · perPage {page.perPage ?? "não informado"} · filtrados {page.recordsFiltered ?? "não informado"} · total {page.recordsTotal ?? "não informado"}</p>)}
                {preview.contract.facets.length > 0 && <><p className="mt-4 font-semibold">Categorias operacionais</p>{preview.contract.facets.map((facet) => <p key={facet.field} className="mt-1 font-mono text-[#52655d]"><code>{facet.field}</code> · {facet.values.map((value) => `${value.value} (${value.occurrences}x)`).join(" · ")}</p>)}</>}
                <p className="mt-4 font-semibold">Campos observados</p>
                <div className="mt-2 divide-y divide-[#e1e7e3]">
                  {preview.contract.fields.map((field) => <p key={field.path} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"><code className="break-all">{field.path}</code><span className="text-[#5f7067]">{field.signatures.join(" | ")} · {field.occurrences}x</span></p>)}
                </div>
              </div>
            </details>
            <button type="button" onClick={confirmCanary} disabled={props.busy || !props.snapshot.estoquenow.import_enabled || !selectedCanary || selectedCanary.state === "blocked" || detailPreview?.itemsBlocked || detailPreview?.externalId !== selectedCanary.externalId || (selectedCanary.state === "unchanged" && !detailPreview?.itemsChanged)} className="mt-5 min-h-11 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{selectedCanary?.state === "blocked" || detailPreview?.itemsBlocked ? "Histórico protegido contra reescrita" : detailPreview?.externalId !== selectedCanary?.externalId ? "Inspecione os itens antes de confirmar" : selectedCanary?.state === "diverged" || selectedCanary?.state === "update" || detailPreview?.itemsChanged ? "Atualizar somente esta operação após revisão" : selectedCanary?.state === "unchanged" ? "Operação já conciliada" : "Importar somente esta operação para a Império"}</button>
            {!props.snapshot.estoquenow.import_enabled && <p className="mt-3 text-center text-xs text-[#705817]">Defina ESTOQUENOW_IMPORT_ENABLED=true no servidor somente após validar esta prévia e obter autorização operacional.</p>}
          </article>
        )}
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5"><Settings2 size={21} /><h3 className="mt-3 text-xl font-semibold">Supabase</h3><Pill tone={props.snapshot.configured ? "green" : "amber"}>{props.snapshot.configured ? "Persistência ativa" : "Modo demonstrativo"}</Pill><p className="mt-3 text-sm text-[#65746c]">Postgres, Auth e Storage são configurados exclusivamente por ambiente. Nenhum segredo é enviado ao navegador.</p></article>
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5"><MapPin size={21} /><h3 className="mt-3 text-xl font-semibold">Google Maps</h3><Pill tone="green">URL universal ativa</Pill><p className="mt-3 text-sm text-[#65746c]">Abre a rota no app ou navegador. Sem chave paga, mapa embutido ou cálculo próprio de ETA.</p></article>
        <article className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white xl:col-span-2">
          <div className="border-b border-[#e2e8e4] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5f7067]">Contrato de dados</p>
            <h3 className="mt-2 text-xl font-semibold">Uma fonte de verdade por domínio</h3>
          </div>
          <div className="divide-y divide-[#e5eae7]">
            {domains.map(([domain, owner, state]) => (
              <div key={domain} className="grid gap-1 px-5 py-4 text-sm sm:grid-cols-[1.2fr_.7fr_1.5fr]">
                <strong>{domain}</strong>
                <span className="text-[#44675c]">{owner}</span>
                <span className="text-[#65746c]">{state}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5 xl:col-span-2">
          <h3 className="text-xl font-semibold">Prontidão do conector</h3>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            {["OAuth real validado no servidor", "Prévia externa sem escrita", "Importação individual protegida por flag", "Divergências bloqueadas antes da gravação"].map((item) => <p key={item} className="flex items-center gap-2 rounded-lg bg-[#eef5f1] p-3 text-[#285f50]"><CheckCircle2 size={17} />{item}</p>)}
            <p className="flex items-start gap-2 rounded-lg bg-[#fff6dd] p-3 text-[#705817] md:col-span-2"><AlertTriangle className="mt-0.5 shrink-0" size={17} />Confirmação de entrega/devolução: conectado em código, não homologado no EstoqueNOW. Ações e escrita externa permanecem bloqueadas.</p>
          </div>
        </article>
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
  };
  const openContext = (next: "evidence" | "incidents", id: string) => {
    setContextOperationId(id);
    setView(next);
  };
  const navigation: [View, string, typeof CircleGauge][] = [
    ["today", "Hoje", CircleGauge],
    ["operations", "Operações", ListChecks],
    ["calendar", "Agenda", CalendarDays],
    ["people", "Pessoas e equipes", Users],
    ["fleet", "Frota", Truck],
    ["evidence", "Evidências", Camera],
    ["incidents", "Ocorrências", AlertTriangle],
    ["integrations", "Integrações", Link2],
  ];
  const content = {
    today: <TodayView {...props} onOpenEvidence={(id) => openContext("evidence", id)} onOpenIncidents={(id) => openContext("incidents", id)} onOpenOperations={() => { setOpenSelectedOperation(false); setView("operations"); }} />,
    operations: <OperationsView {...props} openSelected={openSelectedOperation} onOpenEvidence={(id) => openContext("evidence", id)} onOpenIncidents={(id) => openContext("incidents", id)} />,
    calendar: <CalendarView {...props} onOpenOperation={openOperation} />,
    people: <PeopleView {...props} />,
    fleet: <FleetView {...props} />,
    evidence: <EvidenceView {...props} onOpenOperation={openOperation} focusedOperationId={contextOperationId} onClearFocus={() => setContextOperationId(null)} />,
    incidents: <IncidentsView {...props} onOpenOperation={openOperation} focusedOperationId={contextOperationId} onClearFocus={() => setContextOperationId(null)} />,
    integrations: <IntegrationsView {...props} />,
  };
  return (
    <div className="mx-auto w-full max-w-[1720px] lg:grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 overflow-x-auto border-b border-[#d7dfd9] bg-white p-2 lg:min-h-[calc(100vh-96px)] lg:border-b-0 lg:border-r lg:p-4">
        <nav className="flex gap-1 lg:flex-col" aria-label="Torre web">
          {navigation.map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setContextOperationId(null); if (id === "operations") setOpenSelectedOperation(false); setView(id); }} aria-pressed={view === id} className={`flex min-h-11 min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${view === id ? "bg-[#eaf2ed] text-[#1e5948]" : "text-[#5f7067] hover:bg-[#f5f7f5]"}`}><Icon size={17} />{label}</button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 p-4 md:p-6 xl:p-8">{content[view]}</section>
    </div>
  );
}
