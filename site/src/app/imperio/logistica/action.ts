import type {
  Incident,
  Operation,
  OperationStage,
  OperationStatus,
} from "./types";

export const operationStages: OperationStage[] = [
  "preparation",
  "departure",
  "travel",
  "arrival",
  "assembly",
  "delivery",
  "disassembly",
  "return",
  "inspection",
];

export const stageLabels: Record<OperationStage, string> = {
  preparation: "Preparação",
  departure: "Saída",
  travel: "Deslocamento",
  arrival: "Chegada",
  assembly: "Montagem",
  delivery: "Entrega",
  disassembly: "Desmontagem",
  return: "Retorno",
  inspection: "Conclusão",
};

const stageChecklists: Record<OperationStage, string[]> = {
  preparation: [
    "Pedido e separação conferidos",
    "Equipe escalada confirmada",
    "Veículo e motorista vinculados",
  ],
  departure: [
    "Motorista e veículo confirmados",
    "Toda a equipe presente",
    "Carga fotografada e conferida",
  ],
  travel: [
    "Rota aberta no Google Maps",
    "Contato do local disponível",
    "Nenhuma ocorrência pendente sem registro",
  ],
  arrival: [
    "Chegada registrada no local",
    "Condição de acesso verificada",
    "Equipe orientada para a próxima etapa",
  ],
  assembly: [
    "Itens e quantidades conferidos",
    "Montagem final fotografada",
    "Divergências registradas como ocorrência",
  ],
  delivery: [
    "Entrega conferida com o responsável local",
    "Aceite interno identificado",
    "Pendências registradas",
  ],
  disassembly: [
    "Volumes retirados conferidos",
    "Condição do local fotografada",
    "Faltas ou avarias registradas",
  ],
  return: [
    "Saída do evento confirmada",
    "Chegada à base registrada",
    "Itens avariados separados para revisão",
  ],
  inspection: [
    "Devolução conferida",
    "Avarias separadas e registradas",
    "Operação pronta para encerramento",
  ],
};

export const checklistForStage = (stage: OperationStage) => stageChecklists[stage];

export const isChecklistComplete = (
  checks: Record<string, boolean>,
  stage?: OperationStage,
) => {
  const required = stage ? checklistForStage(stage) : Object.keys(checks);
  return required.length > 0 && required.every((item) => checks[item] === true);
};

export const nextStage = (stage: OperationStage): OperationStage | null => {
  const next = operationStages[operationStages.indexOf(stage) + 1];
  return next ?? null;
};

export const stageState = (
  index: number,
  current: number,
  status: OperationStatus,
  confirmed: boolean,
): "done" | "active" | "pending" => {
  if (status === "completed" || confirmed || index < current) return "done";
  return status === "active" && index === current ? "active" : "pending";
};

const saoPauloParts = (date: Date, withTime = false) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  }).formatToParts(date);

export const operationDateInput = (date: Date) => {
  const parts = saoPauloParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export const operationDateTimeInput = (value: string) => {
  const parts = saoPauloParts(new Date(value), true);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

export const operationTimestamp = (value: string) =>
  new Date(`${value}:00-03:00`).toISOString();

export const isOperationalToday = (operation: Operation, now = new Date()) =>
  operation.status === "active" &&
  operationDateInput(new Date(operation.scheduled_at)) <= operationDateInput(now);

export type OperationRisk = "critical" | "attention" | "ready";

export const operationSignals = (
  operation: Operation,
  incidents: Incident[],
  now = Date.now(),
) => {
  const unresolved = incidents.filter(
    (incident) =>
      incident.operation_id === operation.id && incident.status !== "resolved",
  );
  const incompleteScale =
    operation.status === "active" &&
    (!operation.team_id || !operation.vehicle_id || !operation.driver_id);
  const delayed =
    operation.status === "active" &&
    (Boolean(operation.waiting_since) ||
      unresolved.some((incident) => incident.type === "delay") ||
      (operation.stage === "preparation" &&
        Date.parse(operation.scheduled_at) < now));
  const criticalIncident = unresolved.some(
    (incident) => incident.severity === "high",
  );
  const risk: OperationRisk = criticalIncident
    ? "critical"
    : delayed || incompleteScale || unresolved.length > 0
      ? "attention"
      : "ready";

  return { criticalIncident, delayed, incompleteScale, risk, unresolved };
};

export type OperationFilters = {
  query: string;
  status: string;
  stage: string;
  source: string;
  teamId: string;
  vehicleId: string;
  risk: string;
  startDate: string;
  endDate: string;
};

const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export const matchesOperationFilters = (
  operation: Operation,
  incidents: Incident[],
  filters: OperationFilters,
  now = Date.now(),
) => {
  const query = searchable(filters.query.trim());
  const scheduledDate = operationDateInput(new Date(operation.scheduled_at));
  return (
    (!query ||
      searchable(
        `${operation.event_name} ${operation.destination} ${operation.external_id ?? ""}`,
      ).includes(query)) &&
    (filters.status === "all" || operation.status === filters.status) &&
    (filters.stage === "all" || operation.stage === filters.stage) &&
    (filters.source === "all" || operation.source === filters.source) &&
    (filters.teamId === "all" || operation.team_id === filters.teamId) &&
    (filters.vehicleId === "all" || operation.vehicle_id === filters.vehicleId) &&
    (filters.risk === "all" ||
      operationSignals(operation, incidents, now).risk === filters.risk) &&
    (!filters.startDate || scheduledDate >= filters.startDate) &&
    (!filters.endDate || scheduledDate <= filters.endDate)
  );
};

export const prioritizeOperations = (
  operations: Operation[],
  incidents: Incident[],
  now = Date.now(),
) =>
  [...operations].sort((left, right) => {
    const priority = (operation: Operation) => {
      const signals = operationSignals(operation, incidents, now);
      return (
        Number(signals.criticalIncident) * 8 +
        Number(signals.delayed) * 4 +
        Number(signals.incompleteScale) * 2 +
        Number(signals.unresolved.length > 0)
      );
    };
    return (
      priority(right) - priority(left) ||
      Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at)
    );
  });

export const localOutboxKey = (userId: string) =>
  `imperio-logistics-outbox-v2:${userId}`;
