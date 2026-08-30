"use client";

import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  operationDateInput,
  operationDateTimeInput,
  operationStages,
  operationTimestamp,
  stageLabels,
} from "./action";
import type {
  Incident,
  LogisticsSnapshot,
  Operation,
  OperationEvent,
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
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[tone]}`}
    >
      {children}
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
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
}) {
  return (
    <label className="mt-3 block text-sm font-medium">
      {label}
      <input
        className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        minLength={minLength}
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
        className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2.5"
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
      className="mt-5 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
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
  selectedId,
  setSelectedId,
}: {
  operations: Operation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
}) {
  if (!operations.length)
    return <Empty>Nenhuma operação corresponde a esta visão.</Empty>;
  return (
    <div className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white">
      {operations.map((operation) => (
        <button
          key={operation.id}
          onClick={() => setSelectedId(operation.id)}
          className={`grid w-full gap-2 border-b border-[#e4e9e6] p-4 text-left last:border-0 md:grid-cols-[120px_1fr_170px_20px] ${
            selectedId === operation.id ? "bg-[#eef5f1]" : "hover:bg-[#f8faf8]"
          }`}
        >
          <span className="font-mono text-xs font-semibold">
            {formatDate(operation.scheduled_at)}
          </span>
          <span>
            <strong className="block">{operation.event_name}</strong>
            <small className="line-clamp-1 text-[#68776f]">
              {operation.destination}
            </small>
          </span>
          <span className="text-sm">
            <span className="block font-medium">{stageLabels[operation.stage]}</span>
            <small
              className={
                operation.source === "manual" ? "text-[#9b653e]" : "text-[#35705f]"
              }
            >
              {operation.source === "manual" ? "Origem manual" : "Origem EstoqueNOW"}
            </small>
          </span>
          <ChevronRight size={18} className="self-center text-[#87948e]" />
        </button>
      ))}
    </div>
  );
}

function StageRail({ operation }: { operation: Operation }) {
  const current = operationStages.indexOf(operation.stage);
  return (
    <ol className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Etapas da operação">
      {operationStages.map((stage, index) => {
        const done = operation.events.some(
          (event) => event.stage === stage && event.event_type === "stage_completed",
        );
        const active = operation.status === "active" && index === current;
        return (
          <li className="min-w-24 text-center" key={stage}>
            <span
              className={`mx-auto grid size-9 place-items-center rounded-full border-2 text-xs font-bold ${
                done
                  ? "border-[#2d7461] bg-[#e8f3ef] text-[#2d7461]"
                  : active
                    ? "border-[#5f52bd] bg-[#5f52bd] text-white ring-4 ring-[#ebe8fb]"
                    : "border-[#d5dcd8] bg-white text-[#819087]"
              }`}
            >
              {done ? "OK" : index + 1}
            </span>
            <span className="mt-2 block text-[11px] font-medium">{stageLabels[stage]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OperationDetail({ snapshot, operation }: { snapshot: LogisticsSnapshot; operation?: Operation }) {
  if (!operation) return <Empty>Selecione uma operação para ver o detalhe.</Empty>;
  const operationIncidents = snapshot.incidents.filter(
    (incident) => incident.operation_id === operation.id && incident.status !== "resolved",
  );
  return (
    <article className="rounded-xl border border-[#d7dfd9] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#708078]">
            {sourceLabel(operation)}
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{operation.event_name}</h3>
          <p className="mt-1 text-sm text-[#617068]">{operation.destination}</p>
        </div>
        <Pill
          tone={
            operation.status === "completed"
              ? "green"
              : operation.status === "cancelled"
                ? "red"
                : "amber"
          }
        >
          {statusLabel[operation.status]}
        </Pill>
      </div>
      <a
        href={mapsUrl(operation.destination)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#bfcfc6] px-3 py-2 text-sm font-semibold"
      >
        Abrir rota no Google Maps <ExternalLink size={15} />
      </a>
      <StageRail operation={operation} />
      <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-[#e2e8e4] py-4 text-sm">
        <div>
          <dt className="text-[#708078]">Equipe</dt>
          <dd className="font-medium">
            {snapshot.teams.find((team) => team.id === operation.team_id)?.name ??
              "Não escalada"}
          </dd>
        </div>
        <div>
          <dt className="text-[#708078]">Veículo</dt>
          <dd className="font-medium">
            {snapshot.vehicles.find((vehicle) => vehicle.id === operation.vehicle_id)
              ?.name ?? "Não escalado"}
          </dd>
        </div>
        <div>
          <dt className="text-[#708078]">Motorista</dt>
          <dd className="font-medium">
            {snapshot.people.find((person) => person.id === operation.driver_id)
              ?.full_name ?? "Não escalado"}
          </dd>
        </div>
        <div>
          <dt className="text-[#708078]">Próxima ação</dt>
          <dd className="font-medium">
            {operation.status === "active"
              ? `Concluir ${stageLabels[operation.stage].toLowerCase()}`
              : statusLabel[operation.status]}
          </dd>
        </div>
      </dl>
      {operationIncidents.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#ead5a4] bg-[#fff7e3] p-3 text-sm text-[#755615]">
          <strong>{operationIncidents.length} ocorrência(s) exige(m) decisão.</strong>
        </div>
      )}
      <h4 className="mt-5 font-semibold">Linha do tempo e evidências</h4>
      <div className="mt-3 space-y-3">
        {!operation.events.length && (
          <p className="text-sm text-[#708078]">Nenhuma ação confirmada no servidor.</p>
        )}
        {operation.events.map((event) => (
          <TimelineEvent key={event.id} event={event} />
        ))}
      </div>
    </article>
  );
}

function TimelineEvent({ event }: { event: OperationEvent }) {
  return (
    <div className="rounded-lg bg-[#f3f6f4] p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <strong>
          {event.event_type === "arrival_blocked"
            ? "Acesso bloqueado na chegada"
            : `${stageLabels[event.stage]} confirmada`}
        </strong>
        <span className="text-[#38705f]">Confirmado pelo servidor</span>
      </div>
      <p className="mt-1 text-[#617068]">
        {event.actor_name} · {formatDate(event.server_received_at)} · {formatDuration(event.duration_seconds)}
      </p>
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

function TodayView(props: Props) {
  const { snapshot, selectedId, setSelectedId } = props;
  const active = snapshot.operations.filter((operation) => operation.status === "active");
  const selected =
    active.find((operation) => operation.id === selectedId) ?? active[0];
  const openIncidents = snapshot.incidents.filter((incident) => incident.status !== "resolved");
  const unassigned = active.filter(
    (operation) => !operation.team_id || !operation.vehicle_id || !operation.driver_id,
  );
  const metrics: [string, number, LucideIcon][] = [
    ["Operações ativas", active.length, CircleGauge],
    ["Ocorrências abertas", openIncidents.length, AlertTriangle],
    ["Escalas incompletas", unassigned.length, Users],
    [
      "Concluídas",
      snapshot.operations.filter((item) => item.status === "completed").length,
      CheckCircle2,
    ],
  ];
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <article key={String(label)} className="rounded-xl border border-[#d7dfd9] bg-white p-4">
            <Icon size={19} className="text-[#3d7567]" />
            <strong className="mt-3 block text-3xl">{String(value)}</strong>
            <span className="text-sm text-[#65746c]">{String(label)}</span>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_440px]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">
                Torre de hoje
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Próxima ação, sem ruído.
              </h2>
            </div>
            <button
              onClick={() => void props.run(props.refresh, "Torre atualizada.")}
              className="rounded-lg border border-[#cad4cd] bg-white p-2"
              aria-label="Atualizar"
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <OperationList
            operations={active}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        </div>
        <OperationDetail snapshot={snapshot} operation={selected} />
      </div>
    </div>
  );
}

function OperationsView(props: Props) {
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const filtered = props.snapshot.operations.filter(
    (operation) =>
      (stageFilter === "all" || operation.stage === stageFilter) &&
      (sourceFilter === "all" || operation.source === sourceFilter),
  );
  const selected =
    props.snapshot.operations.find((operation) => operation.id === props.selectedId) ??
    filtered[0];

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
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Operações</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Planejamento e escala</h2>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Filtrar por etapa"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todas as etapas</option>
            {operationStages.map((stage) => (
              <option value={stage} key={stage}>{stageLabels[stage]}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar por origem"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"
          >
            <option value="all">Todas as origens</option>
            <option value="manual">Manual interna</option>
            <option value="estoquenow">EstoqueNOW</option>
          </select>
        </div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_430px]">
        <div className="space-y-5">
          <OperationList
            operations={filtered}
            selectedId={props.selectedId}
            setSelectedId={props.setSelectedId}
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
              <div className="md:col-span-2"><Submit busy={props.busy} configured={props.snapshot.configured} label="Criar e escalar operação" /></div>
            </form>
          </details>
        </div>
        <div className="space-y-5">
          <OperationDetail snapshot={props.snapshot} operation={selected} />
          {selected && selected.status === "active" && (
            <form key={selected.id} onSubmit={update} className="rounded-xl border border-[#d7dfd9] bg-white p-5">
              <h3 className="text-lg font-semibold">Editar escala</h3>
              <Input name="destination" label="Destino" defaultValue={selected.destination} />
              <Input name="scheduledAt" label="Data e horário" type="datetime-local" defaultValue={operationDateTimeInput(selected.scheduled_at)} />
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
      </div>
    </div>
  );
}

function CalendarView({ snapshot, setSelectedId }: Props) {
  const [reference, setReference] = useState(operationDateInput(new Date()));
  const selectedDate = new Date(`${reference}T12:00:00`);
  const monday = new Date(selectedDate);
  monday.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Agenda</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Semana operacional</h2>
        </div>
        <label className="text-sm font-medium">Semana de referência<input type="date" value={reference} onChange={(event) => setReference(event.target.value)} className="ml-2 rounded-lg border border-[#cbd4ce] bg-white px-3 py-2" /></label>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const key = operationDateInput(day);
          const operations = snapshot.operations.filter(
            (operation) => operationDateInput(new Date(operation.scheduled_at)) === key,
          );
          return (
            <section key={key} className="min-h-40 rounded-xl border border-[#d7dfd9] bg-white p-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#65746c]">
                {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day)}
              </h3>
              <div className="mt-3 space-y-2">
                {operations.map((operation) => (
                  <button key={operation.id} onClick={() => setSelectedId(operation.id)} className="w-full rounded-lg bg-[#eef4f0] p-2 text-left text-xs">
                    <strong className="block">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(operation.scheduled_at))}</strong>
                    <span className="mt-1 block">{operation.event_name}</span>
                    <small className="text-[#617068]">{stageLabels[operation.stage]}</small>
                  </button>
                ))}
                {!operations.length && <span className="text-xs text-[#9aa49f]">Sem operação</span>}
              </div>
            </section>
          );
        })}
      </div>
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
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Pessoas e equipes</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Quem pode ir para a escala</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.snapshot.people.map((person) => (
          <article key={person.id} className="rounded-xl border border-[#d7dfd9] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div><strong>{person.full_name}</strong><p className="text-sm text-[#65746c]">{person.job_title}</p></div>
              <Pill tone={person.availability === "available" ? "green" : "amber"}>{person.availability === "available" ? "Disponível" : "Indisponível"}</Pill>
            </div>
            <p className="mt-3 text-sm text-[#65746c]">{person.phone ?? "Telefone não informado"}</p>
            <small className="mt-2 block text-[#819087]">Acesso: {person.role === "manager" ? "Gestor" : "Funcionário"}</small>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-person", "Funcionário e acesso criados.", (form) => ({ fullName: formValue(form, "fullName"), email: formValue(form, "email"), phone: formValue(form, "phone"), jobTitle: formValue(form, "jobTitle"), temporaryPassword: formValue(form, "temporaryPassword") }))}>
          <Users size={21} /><h3 className="mt-3 text-xl font-semibold">Cadastrar funcionário</h3><p className="mt-1 text-sm text-[#68776f]">Cria perfil no Auth. A senha temporária deve ser trocada no primeiro acesso.</p>
          <Input name="fullName" label="Nome completo" /><Input name="email" label="E-mail" type="email" /><Input name="jobTitle" label="Função operacional" /><Input name="phone" label="Telefone" required={false} /><Input name="temporaryPassword" label="Senha temporária" type="password" minLength={10} />
          <Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar funcionário" />
        </form>
        <form className="rounded-xl border border-[#d7dfd9] bg-white p-5" onSubmit={submit("create-team", "Equipe criada.", (form) => ({ name: formValue(form, "name"), leaderId: formValue(form, "leaderId"), memberIds: form.getAll("memberIds").map(String) }))}>
          <Users size={21} /><h3 className="mt-3 text-xl font-semibold">Criar equipe-base</h3>
          <Input name="name" label="Nome da equipe" /><Select name="leaderId" label="Líder" options={props.snapshot.people.map((person) => [person.id, person.full_name])} />
          <label className="mt-3 block text-sm font-medium">Integrantes<select name="memberIds" multiple className="mt-2 h-32 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2">{props.snapshot.people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
          <Submit busy={props.busy} configured={props.snapshot.configured} label="Criar equipe" />
        </form>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.snapshot.teams.map((team) => (
          <article key={team.id} className="rounded-xl border border-[#d7dfd9] bg-white p-4"><strong>{team.name}</strong><p className="mt-2 text-sm text-[#65746c]">Líder: {props.snapshot.people.find((person) => person.id === team.leader_id)?.full_name ?? "Não informado"}</p><p className="text-sm text-[#65746c]">{team.member_ids.length} integrante(s)</p></article>
        ))}
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
  return (
    <div>
      <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Frota</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Veículos e disponibilidade</h2></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {props.snapshot.vehicles.map((vehicle) => (
          <article key={vehicle.id} className="rounded-xl border border-[#d7dfd9] bg-white p-4">
            <Truck size={21} className="text-[#3d7567]" /><strong className="mt-3 block text-lg">{vehicle.name}</strong><p className="text-sm text-[#65746c]">{vehicle.plate} · {vehicle.vehicle_type}</p><p className="mt-1 text-sm text-[#65746c]">{vehicle.capacity_label ?? "Capacidade não informada"}</p>
            <label className="mt-4 block text-xs font-semibold">Status<select value={vehicle.status} disabled={!props.snapshot.configured || props.busy} onChange={(event) => void props.run(async () => { await postJson("set-vehicle-status", { id: vehicle.id, status: event.target.value }); await props.refresh(); }, "Status do veículo atualizado.")} className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"><option value="available">Disponível</option><option value="in_use">Em uso</option><option value="maintenance">Manutenção</option></select></label>
          </article>
        ))}
      </div>
      <form onSubmit={create} className="mt-5 max-w-2xl rounded-xl border border-[#d7dfd9] bg-white p-5"><h3 className="text-xl font-semibold">Cadastrar veículo</h3><div className="grid gap-x-4 md:grid-cols-2"><Input name="name" label="Nome" /><Input name="plate" label="Placa" /><Input name="vehicleType" label="Tipo" /><Input name="capacityLabel" label="Capacidade" required={false} /></div><Submit busy={props.busy} configured={props.snapshot.configured} label="Cadastrar veículo" /></form>
    </div>
  );
}

function EvidenceView({ snapshot }: Props) {
  const evidence = snapshot.operations.flatMap((operation) =>
    operation.events.map((event) => ({ operation, event })),
  );
  return (
    <div>
      <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Evidências</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Registro confirmado por etapa</h2></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {evidence.map(({ operation, event }) => (
          <article key={event.id} className="overflow-hidden rounded-xl border border-[#d7dfd9] bg-white">
            {event.photo_url ? <a href={event.photo_url} target="_blank" rel="noreferrer" className="grid h-40 place-items-center bg-[#eaf0ec] text-sm font-semibold"><Camera size={24} /><span>Abrir foto protegida</span></a> : <div className="grid h-28 place-items-center bg-[#edf1ee] text-xs text-[#7a8780]">Foto demonstrativa indisponível</div>}
            <div className="p-4"><Pill tone="green">Servidor confirmado</Pill><h3 className="mt-3 font-semibold">{operation.event_name}</h3><p className="text-sm text-[#65746c]">{stageLabels[event.stage]} · {event.actor_name}</p><p className="mt-2 text-xs text-[#7a8780]">{formatDate(event.server_received_at)} · GPS {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}</p></div>
          </article>
        ))}
      </div>
      {!evidence.length && <div className="mt-5"><Empty>Nenhuma evidência confirmada no servidor.</Empty></div>}
    </div>
  );
}

function IncidentsView(props: Props) {
  return (
    <div>
      <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Ocorrências</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Exceções que exigem decisão</h2></div>
      <div className="mt-5 space-y-3">
        {props.snapshot.incidents.map((incident) => {
          const operation = props.snapshot.operations.find((item) => item.id === incident.operation_id);
          return (
            <article key={incident.id} className="grid gap-4 rounded-xl border border-[#d7dfd9] bg-white p-4 lg:grid-cols-[1fr_180px]">
              <div><div className="flex flex-wrap gap-2"><Pill tone={incident.severity === "high" ? "red" : incident.severity === "medium" ? "amber" : "neutral"}>{incident.severity === "high" ? "Alta" : incident.severity === "medium" ? "Média" : "Baixa"}</Pill><Pill>{incidentTypeLabel[incident.type]}</Pill></div><h3 className="mt-3 font-semibold">{operation?.event_name ?? "Operação"} · {stageLabels[incident.stage]}</h3><p className="mt-1 text-sm text-[#56675e]">{incident.description}</p>{incident.impact && <p className="mt-1 text-sm text-[#7a5911]">Impacto: {incident.impact}</p>}<p className="mt-2 text-xs text-[#7a8780]">{incident.actor_name} · {formatDate(incident.created_at)}</p>{incident.photo_url && <a href={incident.photo_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold underline">Abrir foto</a>}</div>
              <label className="text-xs font-semibold">Tratamento<select value={incident.status} disabled={!props.snapshot.configured || props.busy} onChange={(event) => void props.run(async () => { await postJson("update-incident-status", { id: incident.id, status: event.target.value }); await props.refresh(); }, "Ocorrência atualizada.")} className="mt-2 w-full rounded-lg border border-[#cbd4ce] bg-white px-3 py-2 text-sm"><option value="open">{incidentStatusLabel.open}</option><option value="handling">{incidentStatusLabel.handling}</option><option value="resolved">{incidentStatusLabel.resolved}</option></select></label>
            </article>
          );
        })}
        {!props.snapshot.incidents.length && <Empty>Nenhuma ocorrência registrada.</Empty>}
      </div>
    </div>
  );
}

function IntegrationsView(props: Props) {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 90);
  const sync = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void props.run(async () => {
      await postJson<{ imported: number; skipped: number }>("sync-estoquenow", { startDate: formValue(form, "startDate"), endDate: formValue(form, "endDate") });
      await props.refresh();
    }, "Importação somente leitura concluída.");
  };
  return (
    <div>
      <div><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#708078]">Integrações</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Conexões e fontes de verdade</h2></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><Link2 size={21} className="text-[#3d7567]" /><h3 className="mt-3 text-xl font-semibold">EstoqueNOW</h3></div><Pill tone={props.snapshot.estoquenow.source === "estoquenow" ? "green" : "amber"}>{props.snapshot.estoquenow.source === "estoquenow" ? "Leitura confirmada" : props.snapshot.estoquenow.configured ? "Aguardando teste" : "Sem credenciais"}</Pill></div><p className="mt-3 text-sm text-[#65746c]">{props.snapshot.estoquenow.notice}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[#7a8780]">Operações importadas</dt><dd className="font-semibold">{props.snapshot.estoquenow.imported_count}</dd></div><div><dt className="text-[#7a8780]">Última leitura</dt><dd className="font-semibold">{props.snapshot.estoquenow.last_sync_at ? formatDate(props.snapshot.estoquenow.last_sync_at) : "Nunca"}</dd></div></dl><div className="mt-4 rounded-lg bg-[#fff6dd] p-3 text-xs text-[#705817]">Integração estritamente server-side e somente leitura. Entrega, devolução, locação e inventário nunca são alterados por este módulo.</div></article>
        <form onSubmit={sync} className="rounded-xl border border-[#d7dfd9] bg-white p-5"><h3 className="text-xl font-semibold">Importar período</h3><p className="mt-2 text-sm text-[#65746c]">A lista de logísticas é conciliada por ID externo. Etapa, equipe, veículo e evidências internas são preservados.</p><div className="grid gap-x-4 sm:grid-cols-2"><Input name="startDate" label="Início" type="date" defaultValue={operationDateInput(today)} /><Input name="endDate" label="Fim" type="date" defaultValue={operationDateInput(future)} /></div><button disabled={props.busy || !props.snapshot.configured || !props.snapshot.estoquenow.configured} className="mt-5 w-full rounded-lg bg-[#173d34] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Executar importação somente leitura</button></form>
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5"><Settings2 size={21} /><h3 className="mt-3 text-xl font-semibold">Supabase</h3><Pill tone={props.snapshot.configured ? "green" : "amber"}>{props.snapshot.configured ? "Persistência ativa" : "Modo demonstrativo"}</Pill><p className="mt-3 text-sm text-[#65746c]">Postgres, Auth e Storage são configurados exclusivamente por ambiente. Nenhum segredo é enviado ao navegador.</p></article>
        <article className="rounded-xl border border-[#d7dfd9] bg-white p-5"><MapPin size={21} /><h3 className="mt-3 text-xl font-semibold">Google Maps</h3><Pill tone="green">URL universal ativa</Pill><p className="mt-3 text-sm text-[#65746c]">Abre a rota no app ou navegador. Sem chave paga, mapa embutido ou cálculo próprio de ETA.</p></article>
      </div>
    </div>
  );
}

export function WebDashboard(props: Props) {
  const [view, setView] = useState<View>("today");
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
    today: <TodayView {...props} />,
    operations: <OperationsView {...props} />,
    calendar: <CalendarView {...props} />,
    people: <PeopleView {...props} />,
    fleet: <FleetView {...props} />,
    evidence: <EvidenceView {...props} />,
    incidents: <IncidentsView {...props} />,
    integrations: <IntegrationsView {...props} />,
  };
  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 lg:grid-cols-[220px_1fr] md:px-8">
      <aside className="self-start overflow-x-auto rounded-xl border border-[#d7dfd9] bg-white p-2 lg:sticky lg:top-5">
        <nav className="flex gap-1 lg:flex-col" aria-label="Torre web">
          {navigation.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)} aria-pressed={view === id} className={`flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${view === id ? "bg-[#eaf2ed] text-[#1e5948]" : "text-[#5f7067] hover:bg-[#f5f7f5]"}`}><Icon size={17} />{label}</button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0">{content[view]}</section>
    </div>
  );
}
