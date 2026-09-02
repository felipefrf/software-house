import type { OutboxState } from "./types";

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
