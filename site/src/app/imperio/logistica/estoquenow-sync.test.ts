import assert from "node:assert/strict";
import test from "node:test";

import type { EstoqueNowOperation } from "./estoquenow.ts";
import {
  beginEstoqueNowSyncRun,
  buildEstoqueNowSyncPlan,
  confirmEstoqueNowCandidate,
  finishEstoqueNowSyncRun,
  isAuthorizedEstoqueNowPull,
  loadExistingEstoqueNowOperationsForPull,
  readEstoqueNowPullConfig,
  runEstoqueNowPull,
  selectAutomaticCandidates,
  shouldContinueEstoqueNowDrain,
  type EstoqueNowExistingOperation,
  type EstoqueNowPullResult,
  type EstoqueNowSyncDatabase,
} from "./estoquenow-sync.ts";

const operation = (
  id: string,
  overrides: Partial<EstoqueNowOperation> = {},
): EstoqueNowOperation => ({
  id,
  orderId: `order-${id}`,
  protocol: `protocol-${id}`,
  sourceVersion: "2",
  eventName: `Pedido ${id}`,
  legacyEventName: `Cliente ${id}`,
  venue: "Pavilhão principal",
  address: {
    zipcode: "40000-000",
    street: "Rua Principal",
    number: "10",
    complement: "",
    neighborhood: "Centro",
    city: "Salvador",
    state: "BA",
  },
  city: "Salvador",
  scheduledDate: "2026-09-10",
  scheduledTime: "08:00:00",
  returnDate: "2026-09-11",
  returnTime: "18:00:00",
  deliveryStatus: { id: "1", type: "pending", concluded: false },
  returnStatus: { id: "1", type: "pending", concluded: false },
  itemCount: "1",
  orderType: "event",
  logisticTypeId: "1",
  status: "preparation",
  coordinator: "",
  crew: "",
  vehicle: "",
  ...overrides,
});

const existingFrom = (
  source: EstoqueNowOperation,
  overrides: Partial<EstoqueNowExistingOperation> = {},
) => {
  const planned = buildEstoqueNowSyncPlan([source], [], "2026-09-03T12:00:00.000Z");
  const row = planned.candidates[0]!.row;
  return {
    external_id: row.external_id,
    event_name: row.event_name,
    destination: row.destination,
    scheduled_at: row.scheduled_at,
    notes: row.notes || null,
    imported_at: "2026-09-02T12:00:00.000Z",
    status: "active" as const,
    has_history: false,
    source_context: row.source_context,
    ...overrides,
  };
};

test("autentica cron sem aceitar segredo ausente, curto ou diferente", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  assert.equal(isAuthorizedEstoqueNowPull(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedEstoqueNowPull("Bearer incorreto", secret), false);
  assert.equal(isAuthorizedEstoqueNowPull(null, secret), false);
  assert.equal(isAuthorizedEstoqueNowPull("Bearer curto", "curto"), false);
});

test("configuração usa janela de São Paulo, limita lote e bloqueia escrita externa", () => {
  const config = readEstoqueNowPullConfig(
    {
      ESTOQUENOW_INCREMENTAL_PULL_ENABLED: "true",
      ESTOQUENOW_PULL_APPLY_ENABLED: "false",
      ESTOQUENOW_PULL_LOOKBACK_DAYS: "2",
      ESTOQUENOW_PULL_LOOKAHEAD_DAYS: "7",
      ESTOQUENOW_PULL_BATCH_SIZE: "5",
    },
    new Date("2026-09-03T02:00:00.000Z"),
  );
  assert.equal(config.startDate, "2026-08-31");
  assert.equal(config.endDate, "2026-09-09");
  assert.equal(config.batchSize, 5);
  assert.throws(
    () => readEstoqueNowPullConfig({ ESTOQUENOW_PULL_BATCH_SIZE: "6" }),
    /ESTOQUENOW_PULL_BATCH_SIZE_INVALID/,
  );
  assert.throws(
    () => readEstoqueNowPullConfig({ ESTOQUENOW_WRITE_ENABLED: "true" }),
    /ESTOQUENOW_EXTERNAL_WRITE_MUST_REMAIN_DISABLED/,
  );
});

test("apply exige gestor explícito; observe não exige", () => {
  assert.doesNotThrow(() =>
    readEstoqueNowPullConfig({ ESTOQUENOW_PULL_APPLY_ENABLED: "false" }),
  );
  assert.throws(
    () => readEstoqueNowPullConfig({ ESTOQUENOW_PULL_APPLY_ENABLED: "true" }),
    /ESTOQUENOW_PULL_MANAGER_ID_INVALID/,
  );
});

test("drena lotes adiados somente em apply bem-sucedido e dentro do limite", () => {
  const result = {
    status: "succeeded",
    mode: "apply",
    counts: { eligible: 6, attempted: 5 },
  } as EstoqueNowPullResult;
  assert.equal(shouldContinueEstoqueNowDrain(result, 1, 1_000), true);
  assert.equal(shouldContinueEstoqueNowDrain(result, 6, 1_000), false);
  assert.equal(shouldContinueEstoqueNowDrain(result, 1, 180_000), false);
  assert.equal(
    shouldContinueEstoqueNowDrain({ ...result, mode: "observe" }, 1, 1_000),
    false,
  );
  assert.equal(
    shouldContinueEstoqueNowDrain({ ...result, status: "partial" }, 1, 1_000),
    false,
  );
  assert.equal(
    shouldContinueEstoqueNowDrain(
      { ...result, counts: { ...result.counts, eligible: 5 } },
      1,
      1_000,
    ),
    false,
  );
});

test("classifica update mutável separado de backfill, divergência e bloqueio", () => {
  const mutable = operation("mutable");
  const backfill = operation("backfill");
  const diverged = operation("diverged");
  const blocked = operation("blocked");
  const backfillRow = buildEstoqueNowSyncPlan(
    [backfill],
    [],
    "2026-09-03T12:00:00.000Z",
  ).candidates[0]!.row;
  const plan = buildEstoqueNowSyncPlan(
    [mutable, backfill, diverged, blocked],
    [
      existingFrom(mutable, {
        source_context: { ...existingFrom(mutable).source_context!, source_version: "1" },
      }),
      existingFrom(backfill, {
        event_name: backfillRow.legacy_event_name,
        destination: backfillRow.legacy_destination,
        notes: backfillRow.legacy_notes,
        source_context: null,
      }),
      existingFrom(diverged, { destination: "Destino interno diferente" }),
      existingFrom(blocked, {
        destination: "Destino histórico diferente",
        has_history: true,
      }),
    ],
    "2026-09-03T12:00:00.000Z",
  );
  assert.deepEqual(
    plan.candidates.map(({ state, updateKind }) => [state, updateKind]),
    [
      ["update", "mutable"],
      ["update", "legacy_backfill"],
      ["diverged", null],
      ["blocked", null],
    ],
  );
  assert.deepEqual(
    selectAutomaticCandidates(plan.candidates, 5).map(({ externalId }) => externalId),
    ["mutable"],
  );
});

test("observe contabiliza backfill legado como revisão manual, nunca como elegível", async () => {
  const source = operation("legacy-review");
  const row = buildEstoqueNowSyncPlan(
    [source],
    [],
    "2026-09-03T12:00:00.000Z",
  ).candidates[0]!.row;
  const result = await runEstoqueNowPull(
    {
      enabled: true,
      applyEnabled: false,
      managerId: null,
      start: new Date("2026-09-01T03:00:00.000Z"),
      end: new Date("2026-10-01T02:59:59.999Z"),
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      batchSize: 5,
    },
    {
      inspectOperations: async () => ({ operations: [source] }),
      loadExisting: async () => [
        existingFrom(source, {
          event_name: row.legacy_event_name,
          destination: row.legacy_destination,
          notes: row.legacy_notes,
          source_context: null,
        }),
      ],
      readItems: async () => {
        throw new Error("observe must not read detail");
      },
      confirm: async () => {
        throw new Error("observe must not confirm");
      },
    },
  );
  assert.equal(result.counts.update, 1);
  assert.equal(result.counts.manualReview, 1);
  assert.equal(result.counts.eligible, 0);
  assert.equal(result.counts.selected, 0);
});

test("usa o wrapper atômico de ledger e confirmação, nunca o RPC canário direto", async () => {
  const candidate = buildEstoqueNowSyncPlan(
    [operation("wrapped")],
    [],
    "2026-09-03T12:00:00.000Z",
  ).candidates[0]!;
  let rpcName = "";
  let parameters: Record<string, unknown> = {};
  const database = {
    from: () => {
      throw new Error("not used");
    },
    rpc: async (name: string, input: Record<string, unknown>) => {
      rpcName = name;
      parameters = input;
      return { data: { outcome: "applied", result: "new" }, error: null };
    },
  } as unknown as EstoqueNowSyncDatabase;
  const result = await confirmEstoqueNowCandidate(database, {
    candidate,
    items: [{ id: "row", itemId: "item", orderId: "order-wrapped", name: "Mesa" }],
    managerId: "00000000-0000-4000-8000-000000000001",
    runId: "00000000-0000-4000-8000-000000000002",
  });
  assert.equal(result, "new");
  assert.equal(rpcName, "record_estoquenow_sync_item");
  assert.equal(parameters.p_decision, "new");
  assert.equal(String(parameters.p_source_hash).length, 64);
  assert.equal(String(parameters.p_items_hash).length, 64);
});

test("scheduler lê estado existente somente pelo RPC service-role em lotes de cem", async () => {
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  const database = {
    from: () => {
      throw new Error("scheduler must not read tables directly");
    },
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      calls.push({ name, parameters });
      const ids = parameters.p_external_ids as string[];
      return {
        data: ids.map((externalId) => ({
          external_id: externalId,
          event_name: "Operação",
          destination: "Destino",
          scheduled_at: "2026-09-10T11:00:00.000Z",
          notes: null,
          imported_at: null,
          status: "active",
          has_events: false,
          source_context: null,
        })),
        error: null,
      };
    },
  } as unknown as EstoqueNowSyncDatabase;
  const externalIds = Array.from({ length: 101 }, (_, index) => `external-${index}`);
  const result = await loadExistingEstoqueNowOperationsForPull(database, externalIds);
  assert.equal(result.length, 101);
  assert.deepEqual(calls.map(({ name }) => name), [
    "get_estoquenow_sync_existing",
    "get_estoquenow_sync_existing",
  ]);
  assert.equal((calls[0]?.parameters.p_external_ids as string[]).length, 100);
  assert.equal((calls[1]?.parameters.p_external_ids as string[]).length, 1);
});

test("abre e finaliza run com reconciliação agregada", async () => {
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  const database = {
    from: () => {
      throw new Error("not used");
    },
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      calls.push({ name, parameters });
      return name === "begin_estoquenow_sync"
        ? {
            data: {
              started: true,
              runId: "00000000-0000-4000-8000-000000000002",
              status: "running",
              batchLimit: 5,
              errorCode: null,
            },
            error: null,
          }
        : { data: { status: "succeeded" }, error: null };
    },
  } as unknown as EstoqueNowSyncDatabase;
  const config = readEstoqueNowPullConfig({
    ESTOQUENOW_INCREMENTAL_PULL_ENABLED: "true",
    ESTOQUENOW_PULL_BATCH_SIZE: "5",
  });
  const claim = await beginEstoqueNowSyncRun(database, config);
  assert.equal(claim.started, true);
  await finishEstoqueNowSyncRun(database, claim.runId!, {
    status: "observed",
    mode: "observe",
    startDate: config.startDate,
    endDate: config.endDate,
    batchSize: 5,
    contractHash: null,
    counts: {
      new: 2,
      update: 1,
      unchanged: 3,
      diverged: 1,
      blocked: 1,
      skipped: 2,
      eligible: 2,
      manualReview: 3,
      selected: 2,
      attempted: 0,
      detailFailed: 0,
      imported: 0,
      updated: 0,
      reconciled: 0,
      failed: 0,
    },
    outcomes: [],
  });
  assert.deepEqual(calls.map(({ name }) => name), [
    "begin_estoquenow_sync",
    "finish_estoquenow_sync",
  ]);
  assert.equal(calls[1]?.parameters.p_fetched_count, 10);
  assert.equal(calls[1]?.parameters.p_valid_count, 8);
  assert.equal(calls[1]?.parameters.p_blocked_count, 3);
  assert.equal(calls[1]?.parameters.p_deferred_count, 2);
});

test("observe lê e classifica, mas não busca detalhe nem confirma", async () => {
  let detailReads = 0;
  let confirmations = 0;
  const result = await runEstoqueNowPull(
    {
      enabled: true,
      applyEnabled: false,
      managerId: null,
      start: new Date("2026-09-01T03:00:00.000Z"),
      end: new Date("2026-10-01T02:59:59.999Z"),
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      batchSize: 5,
    },
    {
      inspectOperations: async () => ({ operations: [operation("new")], contract: { fields: [] } }),
      loadExisting: async () => [],
      readItems: async () => {
        detailReads += 1;
        return [];
      },
      confirm: async () => {
        confirmations += 1;
        return "new";
      },
    },
    new Date("2026-09-03T12:00:00.000Z"),
  );
  assert.equal(result.status, "observed");
  assert.equal(result.counts.eligible, 1);
  assert.equal(result.counts.manualReview, 0);
  assert.equal(result.counts.selected, 1);
  assert.equal(result.counts.attempted, 0);
  assert.equal(result.contractHash?.length, 64);
  assert.equal(detailReads, 0);
  assert.equal(confirmations, 0);
});

test("apply confirma no máximo cinco novos e updates mutáveis", async () => {
  const operations = Array.from({ length: 7 }, (_, index) => operation(`new-${index}`));
  let detailReads = 0;
  let confirmations = 0;
  const result = await runEstoqueNowPull(
    {
      enabled: true,
      applyEnabled: true,
      managerId: "00000000-0000-4000-8000-000000000001",
      start: new Date("2026-09-01T03:00:00.000Z"),
      end: new Date("2026-10-01T02:59:59.999Z"),
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      batchSize: 5,
    },
    {
      inspectOperations: async () => ({ operations }),
      loadExisting: async () => [],
      readItems: async (externalId) => {
        detailReads += 1;
        return [{ id: `row-${externalId}`, itemId: "item", orderId: `order-${externalId}`, name: "Mesa" }];
      },
      confirm: async () => {
        confirmations += 1;
        return "new";
      },
    },
    new Date("2026-09-03T12:00:00.000Z"),
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.counts.eligible, 7);
  assert.equal(result.counts.selected, 5);
  assert.equal(result.counts.attempted, 5);
  assert.equal(result.counts.imported, 5);
  assert.equal(detailReads, 5);
  assert.equal(confirmations, 5);
});

test("apply isola detalhe inválido sem confirmar o candidato", async () => {
  let confirmations = 0;
  const result = await runEstoqueNowPull(
    {
      enabled: true,
      applyEnabled: true,
      managerId: "00000000-0000-4000-8000-000000000001",
      start: new Date("2026-09-01T03:00:00.000Z"),
      end: new Date("2026-10-01T02:59:59.999Z"),
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      batchSize: 1,
    },
    {
      inspectOperations: async () => ({ operations: [operation("changed")] }),
      loadExisting: async () => [],
      readItems: async () => [
        { id: "row", itemId: "item", orderId: "outro-pedido", name: "Mesa" },
      ],
      confirm: async () => {
        confirmations += 1;
        return "new";
      },
    },
  );
  assert.equal(result.status, "failed");
  assert.equal(result.counts.detailFailed, 1);
  assert.equal(result.counts.attempted, 0);
  assert.equal(result.counts.failed, 1);
  assert.equal(confirmations, 0);
});

test("detalhe inválido não impede outro candidato válido do mesmo lote", async () => {
  const confirmed: string[] = [];
  const result = await runEstoqueNowPull(
    {
      enabled: true,
      applyEnabled: true,
      managerId: "00000000-0000-4000-8000-000000000001",
      start: new Date("2026-09-01T03:00:00.000Z"),
      end: new Date("2026-10-01T02:59:59.999Z"),
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      batchSize: 2,
    },
    {
      inspectOperations: async () => ({
        operations: [operation("invalid"), operation("valid")],
      }),
      loadExisting: async () => [],
      readItems: async (externalId) => [
        {
          id: `row-${externalId}`,
          itemId: "item",
          orderId: externalId === "invalid" ? "outro-pedido" : `order-${externalId}`,
          name: "Mesa",
        },
      ],
      confirm: async ({ candidate }) => {
        confirmed.push(candidate.externalId);
        return "new";
      },
    },
  );
  assert.equal(result.status, "partial");
  assert.equal(result.counts.selected, 2);
  assert.equal(result.counts.attempted, 1);
  assert.equal(result.counts.detailFailed, 1);
  assert.deepEqual(confirmed, ["valid"]);
});
