import assert from "node:assert/strict";
import test from "node:test";

import {
  checklistForStage,
  isChecklistComplete,
  isOperationalToday,
  localOutboxKey,
  matchesOperationFilters,
  nextStage,
  operationDateTimeInput,
  operationSignals,
  operationStages,
  operationTimestamp,
  prioritizeOperations,
  stageState,
} from "./action.ts";
import type { Incident, Operation } from "./types.ts";

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

const operation = (overrides: Partial<Operation> = {}): Operation => ({
  id: "operation-1",
  source: "manual",
  external_id: null,
  event_name: "Formatura São José",
  destination: "Centro de Convenções",
  scheduled_at: "2026-08-31T12:00:00.000Z",
  stage: "preparation",
  status: "active",
  stage_started_at: "2026-08-31T11:00:00.000Z",
  completed_at: null,
  cancel_reason: null,
  manager_id: "manager-1",
  team_id: "team-1",
  vehicle_id: "vehicle-1",
  driver_id: "worker-1",
  notes: null,
  imported_at: null,
  waiting_since: null,
  events: [],
  ...overrides,
});

const incident = (overrides: Partial<Incident> = {}): Incident => ({
  id: "incident-1",
  operation_id: "operation-1",
  stage: "preparation",
  type: "other",
  severity: "low",
  impact: null,
  description: "Requer atenção",
  status: "open",
  latitude: null,
  longitude: null,
  accuracy: null,
  created_at: "2026-08-31T11:30:00.000Z",
  resolved_at: null,
  actor_name: "Funcionário",
  responsible_name: null,
  photo_url: null,
  ...overrides,
});

test("classifica e prioriza os bloqueios da torre", () => {
  const now = Date.parse("2026-08-31T13:00:00.000Z");
  const incomplete = operation({ id: "incomplete", team_id: null });
  const critical = operation({ id: "critical", stage: "travel" });
  const criticalIncident = incident({
    operation_id: "critical",
    severity: "high",
  });

  assert.equal(operationSignals(incomplete, [], now).risk, "attention");
  assert.equal(
    operationSignals(critical, [criticalIncident], now).risk,
    "critical",
  );
  assert.deepEqual(
    prioritizeOperations([incomplete, critical], [criticalIncident], now).map(
      (item) => item.id,
    ),
    ["critical", "incomplete"],
  );
});

test("filtra operações por busca, escala, risco e período", () => {
  const filters = {
    query: "sao jose",
    status: "active",
    stage: "all",
    source: "manual",
    teamId: "team-1",
    vehicleId: "vehicle-1",
    risk: "ready",
    startDate: "2026-08-31",
    endDate: "2026-08-31",
  };
  const now = Date.parse("2026-08-31T10:00:00.000Z");

  assert.equal(matchesOperationFilters(operation(), [], filters, now), true);
  assert.equal(
    matchesOperationFilters(operation({ driver_id: null }), [], filters, now),
    false,
  );
  assert.equal(
    matchesOperationFilters(operation(), [], { ...filters, query: "casamento" }, now),
    false,
  );
});

test("Hoje inclui o dia operacional e atrasos herdados, não eventos futuros", () => {
  const now = new Date("2026-08-31T15:00:00.000Z");
  assert.equal(isOperationalToday(operation(), now), true);
  assert.equal(
    isOperationalToday(
      operation({ scheduled_at: "2026-09-01T12:00:00.000Z" }),
      now,
    ),
    false,
  );
  assert.equal(
    isOperationalToday(operation({ status: "completed" }), now),
    false,
  );
});
