import assert from "node:assert/strict";
import test from "node:test";

import {
  checklistForStage,
  isChecklistComplete,
  localOutboxKey,
  nextStage,
  operationDateTimeInput,
  operationStages,
  operationTimestamp,
  stageState,
} from "./action.ts";

test("exige todos os itens da etapa", () => {
  const checks = Object.fromEntries(checklistForStage("preparation").map((item) => [item, true]));
  assert.equal(isChecklistComplete(checks), true);
  checks[checklistForStage("preparation")[0]!] = false;
  assert.equal(isChecklistComplete(checks, "preparation"), false);
  assert.equal(isChecklistComplete({}), false);
});

test("isola a fila local por usuário", () => {
  assert.notEqual(localOutboxKey("worker-a"), localOutboxKey("worker-b"));
  assert.equal(
    localOutboxKey("worker-a"),
    "imperio-logistics-outbox-v2:worker-a",
  );
});

test("percorre todas as etapas e encerra após inspeção", () => {
  for (const [index, stage] of operationStages.entries())
    assert.equal(nextStage(stage), operationStages[index + 1] ?? null);
});

test("preserva o horário operacional de São Paulo", () => {
  assert.equal(
    operationTimestamp("2026-08-31T09:00"),
    "2026-08-31T12:00:00.000Z",
  );
  assert.equal(
    operationDateTimeInput("2026-08-31T12:00:00.000Z"),
    "2026-08-31T09:00",
  );
});

test("apresenta progresso coerente mesmo sem todos os eventos históricos", () => {
  assert.equal(stageState(0, 3, "active", false), "done");
  assert.equal(stageState(3, 3, "active", false), "active");
  assert.equal(stageState(4, 3, "active", false), "pending");
  assert.equal(stageState(8, 8, "completed", false), "done");
});
