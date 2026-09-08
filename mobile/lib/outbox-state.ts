import { operationStages, type Operation, type OperationEvent, type OutboxAction, type OutboxState } from "./types";

export function sameActionEvidence(left: OutboxAction, right: OutboxAction) {
  const evidence = (action: OutboxAction) => [
    action.deviceActionId, action.operationId, action.operationName, action.stage,
    Object.entries(action.checklist).sort(([a], [b]) => a.localeCompare(b)),
    action.location.latitude, action.location.longitude, action.location.accuracy,
    action.deviceCapturedAt, action.responsibleId, action.note, action.photoUri,
    action.photoPath, action.arrivalAccess, action.arrivalReason, action.acceptanceName,
    action.trackingTermsAccepted === true,
  ];
  return JSON.stringify(evidence(left)) === JSON.stringify(evidence(right));
}

export function projectOperationProgress(operation: Operation, actions: OutboxAction[], events: OperationEvent[]): Operation {
  if (operation.status !== "active") return operation;
  const recorded = new Set(events.filter(event => event.operation_id === operation.id).map(event => event.device_action_id));
  const queue = actions.filter(action => action.operationId === operation.id && !recorded.has(action.deviceActionId))
    .sort((a, b) => operationStages.indexOf(a.stage) - operationStages.indexOf(b.stage)
      || a.deviceCapturedAt.localeCompare(b.deviceCapturedAt) || a.deviceActionId.localeCompare(b.deviceActionId));
  if (!queue.length) return operation;
  let stage = operation.stage;
  let blocked = false;
  let awaitingCompletion = false;
  for (const action of queue) {
    if (action.state === "confirmed" && operationStages.indexOf(action.stage) < operationStages.indexOf(operation.stage)) continue;
    if (action.stage !== stage || ["conflict", "discarding"].includes(action.state)) { blocked = true; break; }
    if (action.stage === "arrival" && action.arrivalAccess === "blocked") { blocked = true; break; }
    const next = operationStages[operationStages.indexOf(stage) + 1];
    if (!next) { awaitingCompletion = true; break; }
    stage = next;
  }
  const pending = queue.filter(action => action.state !== "confirmed").length;
  if (stage === operation.stage && !pending && !blocked && !awaitingCompletion) return operation;
  // Projeção de tela somente: nunca altera cache, eventos, status ou relógio do servidor.
  return { ...operation, stage, local_progress: {
    serverStage: operation.stage,
    pending,
    blocked, awaitingCompletion,
  } };
}

// A etapa é a ordem operacional; o relógio do aparelho pode ser ajustado offline.
export const orderedUnconfirmedActions = (actions: OutboxAction[]) =>
  actions.filter((action) => action.state !== "confirmed").sort((left, right) =>
    operationStages.indexOf(left.stage) - operationStages.indexOf(right.stage) ||
    left.deviceCapturedAt.localeCompare(right.deviceCapturedAt) ||
    left.deviceActionId.localeCompare(right.deviceActionId),
  );

export async function drainOutbox(
  actions: OutboxAction[],
  send: (action: OutboxAction) => Promise<OutboxState | "skipped">,
  manual = false,
) {
  const blocked = new Set<string>();
  for (const action of orderedUnconfirmedActions(actions)) {
    if (blocked.has(action.operationId)) continue;
    const retryable = manual
      ? isRetryable(action.state)
      : isAutoRetryable(action.state, action.attempts);
    if (!retryable || await send(action) !== "confirmed")
      blocked.add(action.operationId);
  }
}

export const AUTO_RETRY_LIMIT = 3;

const conflictMessages = [
  "stage conflict",
  "device action unavailable",
  "operation not active",
  "operation assignment incomplete",
  "invalid responsible",
  "invalid device capture time",
  "invalid checklist",
  "incomplete checklist",
  "invalid location",
  "invalid photo path",
  "foto local não está mais disponível",
  "forbidden",
  "row-level security",
  "permission denied",
  "etapa diferente",
];

export const classifySyncFailure = (message: string): OutboxState => {
  const normalized = message.toLowerCase();
  return conflictMessages.some((item) => normalized.includes(item))
    ? "conflict"
    : "failed";
};

export const isRetryable = (state: OutboxState) =>
  state === "pending" || state === "failed";

export const isAutoRetryable = (state: OutboxState, attempts: number) =>
  isRetryable(state) && attempts < AUTO_RETRY_LIMIT;

export const isDiscardable = (state: OutboxState) =>
  state === "failed" || state === "conflict";

export const outboxStateLabel: Record<OutboxState, string> = {
  pending: "Pendente no aparelho",
  sending: "Enviando",
  confirmed: "Confirmado pelo servidor",
  conflict: "Conflito: revisão necessária",
  failed: "Falhou: pode tentar novamente",
  discarding: "Descartando após revisão",
};
