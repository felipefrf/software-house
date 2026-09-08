import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_RETRY_LIMIT,
  classifySyncFailure,
  isAutoRetryable,
  isDiscardable,
  isRetryable,
  drainOutbox,
} from "../lib/outbox-state";
import type { OutboxAction } from "../lib/types";

const queued = (id: string, stage: OutboxAction["stage"], state: OutboxAction["state"] = "pending"): OutboxAction => ({
  deviceActionId: id, operationId: "operation-a", operationName: "Teste", stage, state,
  checklist: {}, location: { latitude: 0, longitude: 0, accuracy: 10 },
  deviceCapturedAt: "2026-09-08T12:00:00Z", responsibleId: "worker", note: "",
  photoUri: "file:///test.jpg", photoPath: "test.jpg", arrivalAccess: "",
  arrivalReason: "", acceptanceName: "", attempts: 0, lastError: null,
  updatedAt: "2026-09-08T12:00:00Z",
});

test("envia etapas em ordem mesmo com fila invertida e relógio ajustado", async () => {
  const sent: string[] = [];
  await drainOutbox([
    queued("arrival", "arrival"), queued("travel", "travel"),
    { ...queued("departure", "departure"), deviceCapturedAt: "2026-09-08T13:00:00Z" },
  ], async (action) => { sent.push(action.deviceActionId); return "confirmed"; });
  assert.deepEqual(sent, ["departure", "travel", "arrival"]);
});

test("falha segura impede etapas dependentes sem bloquear outra operação", async () => {
  for (const result of ["failed", "conflict", "skipped"] as const) {
    const sent: string[] = [];
    await drainOutbox([
      queued("departure", "departure"), queued("arrival", "arrival"),
      { ...queued("other", "arrival"), operationId: "operation-b" },
    ], async (action) => {
      sent.push(action.deviceActionId);
      return action.deviceActionId === "departure" ? result : "confirmed";
    });
    assert.deepEqual(sent, ["departure", "other"]);
  }
});

test("conflito ou retry esgotado preserva a ordem inclusive no envio manual", async () => {
  let calls = 0;
  await drainOutbox([queued("departure", "departure", "conflict"), queued("arrival", "arrival")],
    async () => { calls++; return "confirmed"; }, true);
  assert.equal(calls, 0);
  await drainOutbox([{ ...queued("departure", "departure", "failed"), attempts: 3 }, queued("arrival", "arrival")],
    async () => { calls++; return "confirmed"; });
  assert.equal(calls, 0);
});

test("conflitos de estágio ficam parados para decisão humana", () => {
  assert.equal(classifySyncFailure("stage conflict"), "conflict");
  assert.equal(classifySyncFailure("Operation not active"), "conflict");
  assert.equal(classifySyncFailure("permission denied for table operations"), "conflict");
  assert.equal(classifySyncFailure("invalid device capture time"), "conflict");
  assert.equal(
    classifySyncFailure("A foto local não está mais disponível."),
    "conflict",
  );
  assert.equal(isRetryable("conflict"), false);
});

test("falhas de rede permanecem reenviáveis", () => {
  assert.equal(classifySyncFailure("Network request failed"), "failed");
  assert.equal(isRetryable("pending"), true);
  assert.equal(isRetryable("failed"), true);
  assert.equal(isRetryable("sending"), false);
  assert.equal(isRetryable("confirmed"), false);
});

test("retry automático para em três tentativas e o manual permanece disponível", () => {
  assert.equal(AUTO_RETRY_LIMIT, 3);
  assert.equal(isAutoRetryable("failed", 2), true);
  assert.equal(isAutoRetryable("failed", 3), false);
  assert.equal(isRetryable("failed"), true);
});

test("somente falhas e conflitos podem ser descartados", () => {
  assert.equal(isDiscardable("failed"), true);
  assert.equal(isDiscardable("conflict"), true);
  assert.equal(isDiscardable("pending"), false);
  assert.equal(isDiscardable("sending"), false);
  assert.equal(isDiscardable("discarding"), false);
  assert.equal(isDiscardable("confirmed"), false);
  assert.equal(isRetryable("discarding"), false);
});
