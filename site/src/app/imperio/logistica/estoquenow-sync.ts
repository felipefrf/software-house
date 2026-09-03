import { createHash, timingSafeEqual } from "node:crypto";

import {
  isValidExternalId,
  canonicalItems,
  operationDestination,
  sourceFieldsDiverged,
  toScheduledAt,
  type EstoqueNowItem,
  type EstoqueNowOperation,
} from "./estoquenow.ts";

const SAO_PAULO_OFFSET = "-03:00";
const DEFAULT_LOOKBACK_DAYS = 1;
const DEFAULT_LOOKAHEAD_DAYS = 30;
const MAX_LOOKBACK_DAYS = 7;
const MAX_LOOKAHEAD_DAYS = 90;
const MAX_BATCH_SIZE = 5;
const MAX_DRAIN_RUNS = 6;
const DRAIN_START_DEADLINE_MS = 180_000;

export type EstoqueNowSourceContext = {
  order_id: string | null;
  protocol: string | null;
  source_version: string | null;
  return_at: string | null;
  venue: string | null;
  address_zipcode: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  delivery_status_id: string | null;
  delivery_status_type: string | null;
  delivery_concluded: boolean | null;
  return_status_id: string | null;
  return_status_type: string | null;
  return_concluded: boolean | null;
  item_count: string | null;
  order_type: string | null;
  logistic_type_id: string | null;
};

export type EstoqueNowImportRow = {
  source: "estoquenow";
  external_id: string;
  event_name: string;
  destination: string;
  scheduled_at: string;
  notes: string;
  imported_at: string;
  legacy_event_name: string;
  legacy_destination: string;
  legacy_notes: string;
  source_context: EstoqueNowSourceContext;
};

export type EstoqueNowExistingOperation = {
  external_id: string;
  event_name: string;
  destination: string;
  scheduled_at: string;
  notes: string | null;
  imported_at: string | null;
  status: "active" | "completed" | "cancelled";
  has_history: boolean;
  source_context: EstoqueNowSourceContext | null;
};

export type EstoqueNowSkipReason =
  | "missing_external_id"
  | "invalid_external_id"
  | "missing_event_name"
  | "invalid_event_name"
  | "missing_destination"
  | "invalid_destination"
  | "invalid_scheduled_date_or_time";

export type EstoqueNowCandidate = {
  externalId: string;
  scheduledAt: string;
  databaseImportedAt: string | null;
  state: "new" | "update" | "unchanged" | "diverged" | "blocked";
  updateKind: "mutable" | "legacy_backfill" | null;
  row: EstoqueNowImportRow;
};

export type EstoqueNowSyncPlan = {
  candidates: EstoqueNowCandidate[];
  counts: Record<EstoqueNowCandidate["state"] | "skipped", number>;
  skippedReasons: Record<EstoqueNowSkipReason, number>;
};

export type EstoqueNowPullConfig = {
  enabled: boolean;
  applyEnabled: boolean;
  managerId: string | null;
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  batchSize: number;
};

export type EstoqueNowConfirmationResult = "new" | "updated" | "unchanged" | "backfilled";

export type EstoqueNowPullDependencies = {
  inspectOperations: (
    start: Date,
    end: Date,
  ) => Promise<{ operations: EstoqueNowOperation[]; contract?: unknown }>;
  loadExisting: (externalIds: string[]) => Promise<EstoqueNowExistingOperation[]>;
  readItems: (externalId: string) => Promise<EstoqueNowItem[]>;
  confirm: (input: {
    candidate: EstoqueNowCandidate;
    items: EstoqueNowItem[];
    managerId: string;
  }) => Promise<EstoqueNowConfirmationResult>;
};

type DatabaseError = { code?: string; message: string };
type DatabaseResult<T> = PromiseLike<{ data: T; error: DatabaseError | null }>;

type DatabaseSelect = {
  eq: (column: string, value: unknown) => DatabaseSelect;
  in: (column: string, values: string[]) => DatabaseResult<unknown[]>;
};

export type EstoqueNowSyncDatabase = {
  from: (table: string) => {
    select: (columns: string) => DatabaseSelect;
  };
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => DatabaseResult<unknown>;
};

export type EstoqueNowSyncRunClaim = {
  started: boolean;
  runId: string | null;
  status: string;
  batchLimit: number;
  errorCode: string | null;
};

const objectFrom = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

export async function beginEstoqueNowSyncRun(
  database: EstoqueNowSyncDatabase,
  config: EstoqueNowPullConfig,
): Promise<EstoqueNowSyncRunClaim> {
  const result = await database.rpc("begin_estoquenow_sync", {
    p_trigger: "scheduled",
    p_mode: config.applyEnabled ? "apply" : "observe",
    p_window_start: config.startDate,
    p_window_end: config.endDate,
    p_batch_limit: config.batchSize,
  });
  if (result.error) throw new Error("ESTOQUENOW_SYNC_BEGIN_FAILED");
  const value = objectFrom(result.data);
  if (!value || typeof value.started !== "boolean")
    throw new Error("ESTOQUENOW_SYNC_BEGIN_CONTRACT_INVALID");
  return {
    started: value.started,
    runId: typeof value.runId === "string" ? value.runId : null,
    status: typeof value.status === "string" ? value.status : "unknown",
    batchLimit: typeof value.batchLimit === "number" ? value.batchLimit : config.batchSize,
    errorCode: typeof value.errorCode === "string" ? value.errorCode : null,
  };
}

export async function finishEstoqueNowSyncRun(
  database: EstoqueNowSyncDatabase,
  runId: string,
  result: EstoqueNowPullResult,
  errorCode: string | null = null,
) {
  const validCount =
    result.counts.new +
    result.counts.update +
    result.counts.unchanged +
    result.counts.diverged +
    result.counts.blocked;
  const finished = await database.rpc("finish_estoquenow_sync", {
    p_run_id: runId,
    p_fetched_count: validCount + result.counts.skipped,
    p_valid_count: validCount,
    p_eligible_count: result.counts.eligible,
    p_blocked_count: result.counts.manualReview,
    p_deferred_count: result.counts.eligible - result.counts.attempted,
    p_contract_hash: result.contractHash,
    p_error_code:
      errorCode ?? (result.counts.detailFailed > 0 ? "invalid_source" : null),
  });
  if (finished.error) throw new Error("ESTOQUENOW_SYNC_FINISH_FAILED");
  return finished.data;
}

export async function failEstoqueNowSyncRun(
  database: EstoqueNowSyncDatabase,
  runId: string,
  errorCode: "internal",
) {
  const finished = await database.rpc("finish_estoquenow_sync", {
    p_run_id: runId,
    p_fetched_count: 0,
    p_valid_count: 0,
    p_eligible_count: 0,
    p_blocked_count: 0,
    p_deferred_count: 0,
    p_contract_hash: null,
    p_error_code: errorCode,
  });
  if (finished.error) throw new Error("ESTOQUENOW_SYNC_FINISH_FAILED");
  return finished.data;
}

export type EstoqueNowPullResult = {
  status: "disabled" | "observed" | "succeeded" | "partial" | "failed";
  mode: "disabled" | "observe" | "apply";
  startDate: string;
  endDate: string;
  batchSize: number;
  contractHash: string | null;
  counts: EstoqueNowSyncPlan["counts"] & {
    eligible: number;
    manualReview: number;
    selected: number;
    attempted: number;
    detailFailed: number;
    imported: number;
    updated: number;
    reconciled: number;
    failed: number;
  };
  outcomes: Array<{
    externalId: string;
    result: EstoqueNowConfirmationResult | "failed";
    errorCode: "source_item_changed" | "stale_source" | "historic_divergence" | "confirmation_failed" | null;
  }>;
};

export const shouldContinueEstoqueNowDrain = (
  result: EstoqueNowPullResult,
  completedRuns: number,
  elapsedMs: number,
) =>
  result.mode === "apply" &&
  (result.status === "succeeded" ||
    (result.status === "partial" &&
      result.counts.imported + result.counts.updated + result.counts.reconciled > 0)) &&
  result.counts.eligible > result.counts.attempted &&
  completedRuns < MAX_DRAIN_RUNS &&
  elapsedMs < DRAIN_START_DEADLINE_MS;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const isAuthorizedEstoqueNowPull = (
  authorization: string | null,
  secret: string | undefined,
) => {
  if (!secret || secret.length < 16) return false;
  const provided = Buffer.from(authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

const integerFrom = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) => {
  const raw = value?.trim() || String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name}_INVALID`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${name}_INVALID`);
  return parsed;
};

const saoPauloDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const shiftIsoDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
};

export function readEstoqueNowPullConfig(
  env: Readonly<Record<string, string | undefined>>,
  now = new Date(),
): EstoqueNowPullConfig {
  if (env.ESTOQUENOW_WRITE_ENABLED === "true")
    throw new Error("ESTOQUENOW_EXTERNAL_WRITE_MUST_REMAIN_DISABLED");

  const today = saoPauloDate(now);
  const lookback = integerFrom(
    env.ESTOQUENOW_PULL_LOOKBACK_DAYS,
    DEFAULT_LOOKBACK_DAYS,
    0,
    MAX_LOOKBACK_DAYS,
    "ESTOQUENOW_PULL_LOOKBACK_DAYS",
  );
  const lookahead = integerFrom(
    env.ESTOQUENOW_PULL_LOOKAHEAD_DAYS,
    DEFAULT_LOOKAHEAD_DAYS,
    0,
    MAX_LOOKAHEAD_DAYS,
    "ESTOQUENOW_PULL_LOOKAHEAD_DAYS",
  );
  const batchSize = integerFrom(
    env.ESTOQUENOW_PULL_BATCH_SIZE,
    1,
    1,
    MAX_BATCH_SIZE,
    "ESTOQUENOW_PULL_BATCH_SIZE",
  );
  const startDate = shiftIsoDate(today, -lookback);
  const endDate = shiftIsoDate(today, lookahead);
  const applyEnabled = env.ESTOQUENOW_PULL_APPLY_ENABLED === "true";
  const managerId = env.ESTOQUENOW_PULL_MANAGER_ID?.trim() || null;
  if (applyEnabled && (!managerId || !isUuid(managerId)))
    throw new Error("ESTOQUENOW_PULL_MANAGER_ID_INVALID");

  return {
    enabled: env.ESTOQUENOW_INCREMENTAL_PULL_ENABLED === "true",
    applyEnabled,
    managerId,
    start: new Date(`${startDate}T00:00:00${SAO_PAULO_OFFSET}`),
    end: new Date(`${endDate}T23:59:59.999${SAO_PAULO_OFFSET}`),
    startDate,
    endDate,
    batchSize,
  };
}

const sourceContextDiverged = (
  current: EstoqueNowSourceContext | null,
  incoming: EstoqueNowSourceContext,
) =>
  !current ||
  Object.entries(incoming).some(([key, value]) => {
    if (
      [
        "source_version",
        "delivery_status_id",
        "delivery_status_type",
        "delivery_concluded",
        "return_status_id",
        "return_status_type",
        "return_concluded",
        "item_count",
      ].includes(key)
    )
      return false;
    if (key === "return_at" && value && current.return_at)
      return Date.parse(current.return_at) !== Date.parse(value as string);
    return current[key as keyof EstoqueNowSourceContext] !== value;
  });

const mutableSourceContextDiverged = (
  current: EstoqueNowSourceContext | null,
  incoming: EstoqueNowSourceContext,
) =>
  !current ||
  [
    "source_version",
    "delivery_status_id",
    "delivery_status_type",
    "delivery_concluded",
    "return_status_id",
    "return_status_type",
    "return_concluded",
    "item_count",
  ].some(
    (key) =>
      current[key as keyof EstoqueNowSourceContext] !==
      incoming[key as keyof EstoqueNowSourceContext],
  );

export const estoqueNowImportRow = (
  operation: EstoqueNowOperation,
  importedAt: string,
): { row: EstoqueNowImportRow | null; reason: EstoqueNowSkipReason | null } => {
  const externalId = operation.id.trim();
  if (!externalId) return { row: null, reason: "missing_external_id" };
  if (!isValidExternalId(externalId)) return { row: null, reason: "invalid_external_id" };
  const eventName = operation.eventName.trim();
  if (!eventName) return { row: null, reason: "missing_event_name" };
  if (eventName.length < 2) return { row: null, reason: "invalid_event_name" };
  const destinationParts = [operation.venue.trim(), operation.city.trim()].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
  const legacyDestination = destinationParts.join(" · ");
  const destination = operationDestination(operation) || legacyDestination;
  if (!destination) return { row: null, reason: "missing_destination" };
  if (destination.length < 5) return { row: null, reason: "invalid_destination" };
  const scheduledAt = toScheduledAt(operation.scheduledDate, operation.scheduledTime);
  if (!scheduledAt) return { row: null, reason: "invalid_scheduled_date_or_time" };
  const returnAt = operation.returnDate.trim()
    ? toScheduledAt(operation.returnDate, operation.returnTime)
    : null;
  if ((operation.returnDate.trim() || operation.returnTime.trim()) && !returnAt)
    return { row: null, reason: "invalid_scheduled_date_or_time" };
  if (returnAt && Date.parse(returnAt) <= Date.parse(scheduledAt))
    return { row: null, reason: "invalid_scheduled_date_or_time" };

  const legacyNotes = [
    "Importado por leitura do EstoqueNOW.",
    operation.orderId.trim() ? `Pedido ${operation.orderId.trim()}.` : "",
    operation.returnDate.trim() ? `Retorno previsto: ${operation.returnDate.trim()}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    row: {
      source: "estoquenow",
      external_id: externalId,
      event_name: eventName,
      destination,
      scheduled_at: scheduledAt,
      notes: "",
      imported_at: importedAt,
      legacy_event_name: operation.legacyEventName.trim(),
      legacy_destination: legacyDestination,
      legacy_notes: legacyNotes,
      source_context: {
        order_id: operation.orderId.trim() || null,
        protocol: operation.protocol.trim() || null,
        source_version: operation.sourceVersion.trim() || null,
        return_at: returnAt,
        venue: operation.venue.trim() || null,
        address_zipcode: operation.address.zipcode.trim() || null,
        address_street: operation.address.street.trim() || null,
        address_number: operation.address.number.trim() || null,
        address_complement: operation.address.complement.trim() || null,
        address_neighborhood: operation.address.neighborhood.trim() || null,
        address_city: operation.address.city.trim() || null,
        address_state: operation.address.state.trim() || null,
        delivery_status_id: operation.deliveryStatus.id.trim() || null,
        delivery_status_type: operation.deliveryStatus.type.trim() || null,
        delivery_concluded: operation.deliveryStatus.concluded,
        return_status_id: operation.returnStatus.id.trim() || null,
        return_status_type: operation.returnStatus.type.trim() || null,
        return_concluded: operation.returnStatus.concluded,
        item_count: operation.itemCount.trim() || null,
        order_type: operation.orderType.trim() || null,
        logistic_type_id: operation.logisticTypeId.trim() || null,
      },
    },
    reason: null,
  };
};

export function buildEstoqueNowSyncPlan(
  operations: EstoqueNowOperation[],
  existingOperations: EstoqueNowExistingOperation[],
  importedAt: string,
): EstoqueNowSyncPlan {
  const skippedReasons: Record<EstoqueNowSkipReason, number> = {
    missing_external_id: 0,
    invalid_external_id: 0,
    missing_event_name: 0,
    invalid_event_name: 0,
    missing_destination: 0,
    invalid_destination: 0,
    invalid_scheduled_date_or_time: 0,
  };
  const rows: EstoqueNowImportRow[] = [];
  for (const operation of operations) {
    const candidate = estoqueNowImportRow(operation, importedAt);
    if (candidate.row) rows.push(candidate.row);
    else if (candidate.reason) skippedReasons[candidate.reason] += 1;
  }
  const existingById = new Map(
    existingOperations.map((operation) => [operation.external_id, operation]),
  );
  const candidates = rows.map((row): EstoqueNowCandidate => {
    const existing = existingById.get(row.external_id);
    const legacyBackfill = Boolean(
      existing &&
        existing.source_context === null &&
        existing.event_name === row.legacy_event_name &&
        existing.destination === row.legacy_destination &&
        Date.parse(existing.scheduled_at) === Date.parse(row.scheduled_at) &&
        existing.notes === row.legacy_notes,
    );
    const stableChanged = existing
      ? sourceFieldsDiverged(existing, row) ||
        sourceContextDiverged(existing.source_context, row.source_context)
      : false;
    const state: EstoqueNowCandidate["state"] = !existing
      ? "new"
      : legacyBackfill
        ? existing.has_history
          ? "blocked"
          : "update"
        : stableChanged
          ? existing.has_history
            ? "blocked"
            : "diverged"
          : mutableSourceContextDiverged(existing.source_context, row.source_context)
            ? "update"
            : "unchanged";
    return {
      externalId: row.external_id,
      scheduledAt: row.scheduled_at,
      databaseImportedAt: existing?.imported_at ?? null,
      state,
      updateKind: state === "update" ? (legacyBackfill ? "legacy_backfill" : "mutable") : null,
      row,
    };
  });
  return {
    candidates,
    counts: {
      new: candidates.filter(({ state }) => state === "new").length,
      update: candidates.filter(({ state }) => state === "update").length,
      unchanged: candidates.filter(({ state }) => state === "unchanged").length,
      diverged: candidates.filter(({ state }) => state === "diverged").length,
      blocked: candidates.filter(({ state }) => state === "blocked").length,
      skipped: operations.length - rows.length,
    },
    skippedReasons,
  };
}

const sourceContextFrom = (value: unknown): EstoqueNowSourceContext | null => {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object"
    ? (relation as EstoqueNowSourceContext)
    : null;
};

export async function loadExistingEstoqueNowOperations(
  database: EstoqueNowSyncDatabase,
  externalIds: string[],
): Promise<EstoqueNowExistingOperation[]> {
  const loaded: EstoqueNowExistingOperation[] = [];
  for (let index = 0; index < externalIds.length; index += 100) {
    const batch = externalIds.slice(index, index + 100);
    const operations = await database
      .from("operations")
      .select(
        "id,external_id,event_name,destination,scheduled_at,notes,imported_at,status,source_context:estoquenow_operation_contexts(order_id,protocol,source_version,return_at,venue,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,delivery_status_id,delivery_status_type,delivery_concluded,return_status_id,return_status_type,return_concluded,item_count,order_type,logistic_type_id)",
      )
      .eq("source", "estoquenow")
      .in("external_id", batch);
    if (operations.error) throw new Error("ESTOQUENOW_DATABASE_READ_FAILED");
    const rows = operations.data.filter(
      (value): value is Record<string, unknown> => Boolean(value && typeof value === "object"),
    );
    const operationIds = rows
      .map((row) => row.id)
      .filter((value): value is string => typeof value === "string");
    const events = operationIds.length
      ? await database
          .from("operation_events")
          .select("operation_id")
          .in("operation_id", operationIds)
      : { data: [], error: null };
    if (events.error) throw new Error("ESTOQUENOW_DATABASE_READ_FAILED");
    const withHistory = new Set(
      events.data
        .filter(
          (value): value is Record<string, unknown> => Boolean(value && typeof value === "object"),
        )
        .map((event) => event.operation_id)
        .filter((value): value is string => typeof value === "string"),
    );
    for (const row of rows) {
      if (
        typeof row.id !== "string" ||
        typeof row.external_id !== "string" ||
        typeof row.event_name !== "string" ||
        typeof row.destination !== "string" ||
        typeof row.scheduled_at !== "string" ||
        !["active", "completed", "cancelled"].includes(String(row.status))
      )
        throw new Error("ESTOQUENOW_DATABASE_CONTRACT_INVALID");
      loaded.push({
        external_id: row.external_id,
        event_name: row.event_name,
        destination: row.destination,
        scheduled_at: row.scheduled_at,
        notes: typeof row.notes === "string" ? row.notes : null,
        imported_at: typeof row.imported_at === "string" ? row.imported_at : null,
        status: row.status as EstoqueNowExistingOperation["status"],
        has_history: row.status !== "active" || withHistory.has(row.id),
        source_context: sourceContextFrom(row.source_context),
      });
    }
  }
  return loaded;
}

export async function loadExistingEstoqueNowOperationsForPull(
  database: EstoqueNowSyncDatabase,
  externalIds: string[],
): Promise<EstoqueNowExistingOperation[]> {
  const loaded: EstoqueNowExistingOperation[] = [];
  for (let index = 0; index < externalIds.length; index += 100) {
    const batch = externalIds.slice(index, index + 100);
    const result = await database.rpc("get_estoquenow_sync_existing", {
      p_external_ids: batch,
    });
    if (result.error) throw new Error("ESTOQUENOW_DATABASE_READ_FAILED");
    if (!Array.isArray(result.data))
      throw new Error("ESTOQUENOW_DATABASE_CONTRACT_INVALID");
    for (const value of result.data) {
      const row = objectFrom(value);
      if (
        !row ||
        typeof row.external_id !== "string" ||
        typeof row.event_name !== "string" ||
        typeof row.destination !== "string" ||
        typeof row.scheduled_at !== "string" ||
        typeof row.has_events !== "boolean" ||
        !["active", "completed", "cancelled"].includes(String(row.status))
      )
        throw new Error("ESTOQUENOW_DATABASE_CONTRACT_INVALID");
      loaded.push({
        external_id: row.external_id,
        event_name: row.event_name,
        destination: row.destination,
        scheduled_at: row.scheduled_at,
        notes: typeof row.notes === "string" ? row.notes : null,
        imported_at: typeof row.imported_at === "string" ? row.imported_at : null,
        status: row.status as EstoqueNowExistingOperation["status"],
        has_history: row.status !== "active" || row.has_events,
        source_context: sourceContextFrom(row.source_context),
      });
    }
  }
  return loaded;
}

export async function confirmEstoqueNowCandidate(
  database: EstoqueNowSyncDatabase,
  input: {
    candidate: EstoqueNowCandidate;
    items: EstoqueNowItem[];
    managerId: string;
    runId: string;
  },
): Promise<EstoqueNowConfirmationResult> {
  const { candidate, items, managerId } = input;
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({
      external_id: candidate.row.external_id,
      event_name: candidate.row.event_name,
      destination: candidate.row.destination,
      scheduled_at: candidate.row.scheduled_at,
      source_context: candidate.row.source_context,
    }))
    .digest("hex");
  const itemsHash = createHash("sha256")
    .update(JSON.stringify(canonicalItems(items)))
    .digest("hex");
  const confirmed = await database.rpc("record_estoquenow_sync_item", {
    p_run_id: input.runId,
    p_external_id: candidate.row.external_id,
    p_source_version: candidate.row.source_context.source_version,
    p_source_hash: sourceHash,
    p_items_hash: itemsHash,
    p_decision: candidate.state,
    p_event_name: candidate.row.event_name,
    p_destination: candidate.row.destination,
    p_scheduled_at: candidate.row.scheduled_at,
    p_notes: candidate.row.notes,
    p_imported_at: candidate.row.imported_at,
    p_manager_id: managerId,
    p_context: candidate.row.source_context,
    p_legacy_event_name: candidate.row.legacy_event_name,
    p_legacy_destination: candidate.row.legacy_destination,
    p_legacy_notes: candidate.row.legacy_notes,
    p_expected_imported_at: candidate.databaseImportedAt,
    p_items: items,
  });
  if (confirmed.error) {
    const error = new Error(confirmed.error.message);
    error.name = confirmed.error.code ?? "ESTOQUENOW_DATABASE_WRITE_FAILED";
    throw error;
  }
  if (!confirmed.data || typeof confirmed.data !== "object")
    throw new Error("ESTOQUENOW_DATABASE_CONTRACT_INVALID");
  const response = confirmed.data as Record<string, unknown>;
  if (response.outcome === "blocked" || response.outcome === "failed")
    throw new Error(typeof response.errorCode === "string" ? response.errorCode : "confirmation failed");
  if (response.result === "applied")
    return candidate.state === "new" ? "new" : "updated";
  if (!["new", "updated", "unchanged", "backfilled"].includes(String(response.result)))
    throw new Error("ESTOQUENOW_DATABASE_CONTRACT_INVALID");
  return response.result as EstoqueNowConfirmationResult;
}

export const selectAutomaticCandidates = (
  candidates: EstoqueNowCandidate[],
  batchSize: number,
) =>
  candidates
    .filter(
      (candidate) =>
        candidate.state === "new" ||
        (candidate.state === "update" && candidate.updateKind === "mutable"),
    )
    .sort((left, right) =>
      left.scheduledAt === right.scheduledAt
        ? left.externalId < right.externalId
          ? -1
          : left.externalId > right.externalId
            ? 1
            : 0
        : left.scheduledAt < right.scheduledAt
          ? -1
          : 1,
    )
    .slice(0, Math.min(MAX_BATCH_SIZE, Math.max(0, batchSize)));

const safeConfirmationError = (
  error: unknown,
): Exclude<EstoqueNowPullResult["outcomes"][number]["errorCode"], null> => {
  const message = error instanceof Error ? error.message : "";
  if (/SOURCE_ITEM_CHANGED|ORDER_ITEM|order id/i.test(message)) return "source_item_changed";
  if (/stale source divergence|23505/i.test(message)) return "stale_source";
  if (/historic .*divergence/i.test(message)) return "historic_divergence";
  return "confirmation_failed";
};

export async function runEstoqueNowPull(
  config: EstoqueNowPullConfig,
  dependencies: EstoqueNowPullDependencies,
  now = new Date(),
): Promise<EstoqueNowPullResult> {
  const emptyCounts = {
    new: 0,
    update: 0,
    unchanged: 0,
    diverged: 0,
    blocked: 0,
    skipped: 0,
    eligible: 0,
    manualReview: 0,
    selected: 0,
    attempted: 0,
    detailFailed: 0,
    imported: 0,
    updated: 0,
    reconciled: 0,
    failed: 0,
  };
  if (!config.enabled)
    return {
      status: "disabled",
      mode: "disabled",
      startDate: config.startDate,
      endDate: config.endDate,
      batchSize: config.batchSize,
      contractHash: null,
      counts: emptyCounts,
      outcomes: [],
    };

  const inspected = await dependencies.inspectOperations(config.start, config.end);
  const contractHash = inspected.contract === undefined
    ? null
    : createHash("sha256").update(JSON.stringify(inspected.contract)).digest("hex");
  const validExternalIds = inspected.operations
    .map(({ id }) => id.trim())
    .filter(isValidExternalId);
  const existing = await dependencies.loadExisting([...new Set(validExternalIds)]);
  const plan = buildEstoqueNowSyncPlan(inspected.operations, existing, now.toISOString());
  const eligible = plan.candidates.filter(
    ({ state, updateKind }) => state === "new" || (state === "update" && updateKind === "mutable"),
  ).length;
  const manualReview = plan.candidates.filter(
    ({ state, updateKind }) =>
      state === "blocked" ||
      state === "diverged" ||
      (state === "update" && updateKind === "legacy_backfill"),
  ).length;
  const selected = selectAutomaticCandidates(plan.candidates, config.batchSize);
  const counts = {
    ...plan.counts,
    eligible,
    manualReview,
    selected: selected.length,
    attempted: 0,
    detailFailed: 0,
    imported: 0,
    updated: 0,
    reconciled: 0,
    failed: 0,
  };
  if (!config.applyEnabled)
    return {
      status: "observed",
      mode: "observe",
      startDate: config.startDate,
      endDate: config.endDate,
      batchSize: config.batchSize,
      contractHash,
      counts,
      outcomes: [],
    };

  if (!config.managerId) throw new Error("ESTOQUENOW_PULL_MANAGER_ID_INVALID");
  const outcomes: EstoqueNowPullResult["outcomes"] = [];
  const prepared: Array<{ candidate: EstoqueNowCandidate; items: EstoqueNowItem[] }> = [];
  for (const candidate of selected) {
    try {
      const items = await dependencies.readItems(candidate.externalId);
      const orderId = candidate.row.source_context.order_id;
      if (!orderId || items.some((item) => item.orderId !== orderId))
        throw new Error("ESTOQUENOW_SOURCE_ITEM_CHANGED");
      prepared.push({ candidate, items });
    } catch (error) {
      counts.detailFailed += 1;
      counts.failed += 1;
      outcomes.push({
        externalId: candidate.externalId,
        result: "failed",
        errorCode: safeConfirmationError(error),
      });
    }
  }

  for (const { candidate, items } of prepared) {
    counts.attempted += 1;
    try {
      const result = await dependencies.confirm({ candidate, items, managerId: config.managerId });
      if (result === "new") counts.imported += 1;
      else if (result === "updated") counts.updated += 1;
      else counts.reconciled += 1;
      outcomes.push({ externalId: candidate.externalId, result, errorCode: null });
    } catch (error) {
      counts.failed += 1;
      outcomes.push({ externalId: candidate.externalId, result: "failed", errorCode: safeConfirmationError(error) });
    }
  }
  const succeeded = counts.imported + counts.updated + counts.reconciled;
  const status = counts.failed === 0 ? "succeeded" : succeeded === 0 ? "failed" : "partial";
  return {
    status,
    mode: "apply",
    startDate: config.startDate,
    endDate: config.endDate,
    batchSize: config.batchSize,
    contractHash,
    counts,
    outcomes,
  };
}
