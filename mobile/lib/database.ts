import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

import type {
  OutboxAction,
  OutboxState,
  RouteTrackingPoint,
  RouteTrackingSession,
  RouteTrackingStopReason,
  WorkData,
} from "./types";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DATABASE_KEY_NAME = "imperio-logistica-database-key-v1";

const databaseKey = async () => {
  const stored = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (stored) {
    if (!/^[0-9a-f]{64}$/.test(stored))
      throw new Error("A chave segura do banco local está inválida.");
    return stored;
  }
  const generated = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, generated, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return generated;
};

const database = async () => {
  databasePromise ??= Promise.all([
    SQLite.openDatabaseAsync("imperio-logistica.db"),
    databaseKey(),
  ]).then(
    async ([db, key]) => {
      await db.execAsync(`
        PRAGMA key = '${key}';
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cache (
          user_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outbox (
          device_action_id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          state TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS outbox_user_state_idx ON outbox(user_id, state);
        CREATE TABLE IF NOT EXISTS route_tracking_sessions (
          session_id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          operation_id TEXT NOT NULL,
          terms_version TEXT NOT NULL,
          consented_at TEXT NOT NULL,
          started_at TEXT NOT NULL,
          stopped_at TEXT,
          stop_reason TEXT,
          stop_synced INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS route_tracking_active_user_idx
          ON route_tracking_sessions(user_id) WHERE stopped_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS route_tracking_single_active_idx
          ON route_tracking_sessions((1)) WHERE stopped_at IS NULL;
        CREATE TABLE IF NOT EXISTS route_tracking_points (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL NOT NULL,
          speed REAL,
          heading REAL,
          mocked INTEGER NOT NULL DEFAULT 0,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          UNIQUE(session_id, captured_at, latitude, longitude)
        );
        CREATE INDEX IF NOT EXISTS route_tracking_points_session_idx
          ON route_tracking_points(session_id, captured_at);
      `);
      await db.runAsync(
        "UPDATE outbox SET state = 'pending' WHERE state = 'sending'",
      );
      await db.runAsync(
        `UPDATE outbox
         SET state = 'conflict', last_error = 'Descarte interrompido. Revise e tente novamente.'
         WHERE state = 'discarding'`,
      );
      return db;
    },
  );
  return databasePromise;
};

export async function readCachedWork(userId: string): Promise<WorkData | null> {
  const row = await (await database()).getFirstAsync<{ payload: string }>(
    "SELECT payload FROM cache WHERE user_id = ?",
    userId,
  );
  if (!row) return null;
  try {
    const cached = JSON.parse(row.payload) as WorkData;
    return { ...cached, events: cached.events ?? [] };
  } catch {
    await (await database()).runAsync("DELETE FROM cache WHERE user_id = ?", userId);
    return null;
  }
}

export async function saveCachedWork(userId: string, work: WorkData) {
  await (await database()).runAsync(
    `INSERT INTO cache(user_id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    userId,
    JSON.stringify(work),
    work.fetchedAt,
  );
}

export async function deleteCachedWorkVersion(userId: string, updatedAt: string) {
  await (await database()).runAsync(
    "DELETE FROM cache WHERE user_id = ? AND updated_at = ?",
    userId,
    updatedAt,
  );
}

export async function enqueueAction(userId: string, action: OutboxAction) {
  const db = await database();
  const inserted = await db.runAsync(
    `INSERT INTO outbox(device_action_id, user_id, state, payload, attempts, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_action_id) DO NOTHING`,
    action.deviceActionId,
    userId,
    action.state,
    JSON.stringify(action),
    action.attempts,
    action.lastError,
    action.updatedAt,
  );
  if (inserted.changes === 1) return true;
  const existing = await db.getFirstAsync<{ user_id: string; payload: string }>(
    "SELECT user_id, payload FROM outbox WHERE device_action_id = ?",
    action.deviceActionId,
  );
  if (!existing || existing.user_id !== userId)
    throw new Error("Identificador local indisponível. Capture a ação novamente.");
  try {
    const payload = JSON.parse(existing.payload) as OutboxAction;
    if (
      payload.operationId !== action.operationId ||
      payload.stage !== action.stage ||
      payload.photoPath !== action.photoPath
    )
      throw new Error("mismatch");
  } catch {
    throw new Error("A ação local divergiu do registro existente.");
  }
  return false;
}

export async function listActions(userId: string): Promise<OutboxAction[]> {
  const rows = await (await database()).getAllAsync<{
    payload: string;
    state: OutboxState;
    attempts: number;
    last_error: string | null;
    updated_at: string;
  }>(
    "SELECT payload, state, attempts, last_error, updated_at FROM outbox WHERE user_id = ? ORDER BY updated_at DESC",
    userId,
  );
  return rows.flatMap((row) => {
    try {
      const payload = JSON.parse(row.payload) as OutboxAction;
      return [
        {
          ...payload,
          state: row.state,
          attempts: row.attempts,
          lastError: row.last_error,
          updatedAt: row.updated_at,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function claimAction(
  userId: string,
  deviceActionId: string,
  manual: boolean,
): Promise<OutboxAction | null> {
  const db = await database();
  const result = await db.runAsync(
    `UPDATE outbox
     SET state = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = ?
     WHERE user_id = ? AND device_action_id = ?
       AND state IN ('pending', 'failed')
       ${manual ? "" : "AND attempts < 3"}`,
    new Date().toISOString(),
    userId,
    deviceActionId,
  );
  if (result.changes !== 1) return null;
  const row = await db.getFirstAsync<{
    payload: string;
    attempts: number;
    updated_at: string;
  }>(
    `SELECT payload, attempts, updated_at FROM outbox
     WHERE user_id = ? AND device_action_id = ? AND state = 'sending'`,
    userId,
    deviceActionId,
  );
  if (!row) return null;
  try {
    return {
      ...(JSON.parse(row.payload) as OutboxAction),
      state: "sending",
      attempts: row.attempts,
      lastError: null,
      updatedAt: row.updated_at,
    };
  } catch {
    await db.runAsync(
      `UPDATE outbox SET state = 'conflict', last_error = ?, updated_at = ?
       WHERE user_id = ? AND device_action_id = ? AND state = 'sending'`,
      "Registro local inválido.",
      new Date().toISOString(),
      userId,
      deviceActionId,
    );
    return null;
  }
}

export async function transitionAction(
  userId: string,
  deviceActionId: string,
  expected: OutboxState,
  next: OutboxState,
  lastError: string | null,
) {
  const updatedAt = new Date().toISOString();
  const result = await (await database()).runAsync(
    `UPDATE outbox SET state = ?, last_error = ?, updated_at = ?
     WHERE user_id = ? AND device_action_id = ? AND state = ? AND state <> 'confirmed'`,
    next,
    lastError,
    updatedAt,
    userId,
    deviceActionId,
    expected,
  );
  return result.changes === 1;
}

export async function prepareUserSignOut(userId: string) {
  await (await database()).withTransactionAsync(async () => {
    const db = await database();
    await db.runAsync("DELETE FROM cache WHERE user_id = ?", userId);
    await db.runAsync(
      "DELETE FROM outbox WHERE user_id = ? AND state = 'confirmed'",
      userId,
    );
  });
}

export async function claimDiscardAction(userId: string, deviceActionId: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ payload: string; state: OutboxState }>(
    "SELECT payload, state FROM outbox WHERE user_id = ? AND device_action_id = ?",
    userId,
    deviceActionId,
  );
  if (!row || !["failed", "conflict"].includes(row.state))
    throw new Error("Somente falhas e conflitos revisados podem ser descartados.");
  const action = JSON.parse(row.payload) as OutboxAction;
  const claimed = await db.runAsync(
    `UPDATE outbox SET state = 'discarding', updated_at = ?
     WHERE user_id = ? AND device_action_id = ? AND state = ?`,
    new Date().toISOString(),
    userId,
    deviceActionId,
    row.state,
  );
  if (claimed.changes !== 1)
    throw new Error("O estado mudou. Atualize a fila antes de descartar.");
  return { action, previousState: row.state as "failed" | "conflict" };
}

export async function restoreDiscardAction(
  userId: string,
  deviceActionId: string,
  previousState: "failed" | "conflict",
) {
  await (await database()).runAsync(
    `UPDATE outbox SET state = ?, updated_at = ?
     WHERE user_id = ? AND device_action_id = ? AND state = 'discarding'`,
    previousState,
    new Date().toISOString(),
    userId,
    deviceActionId,
  );
}

export async function completeDiscardAction(
  userId: string,
  deviceActionId: string,
) {
  const result = await (await database()).runAsync(
    `DELETE FROM outbox
     WHERE user_id = ? AND device_action_id = ? AND state = 'discarding'`,
    userId,
    deviceActionId,
  );
  return result.changes === 1;
}

const trackingSessionFromRow = (row: {
  session_id: string;
  user_id: string;
  operation_id: string;
  terms_version: string;
  consented_at: string;
  started_at: string;
  stopped_at: string | null;
  stop_reason: RouteTrackingStopReason | null;
  stop_synced: number;
  last_error: string | null;
}): RouteTrackingSession => ({
  sessionId: row.session_id,
  userId: row.user_id,
  operationId: row.operation_id,
  termsVersion: row.terms_version,
  consentedAt: row.consented_at,
  startedAt: row.started_at,
  stoppedAt: row.stopped_at,
  stopReason: row.stop_reason,
  stopSynced: row.stop_synced === 1,
  lastError: row.last_error,
});

const trackingSessionColumns = `
  session_id, user_id, operation_id, terms_version, consented_at, started_at,
  stopped_at, stop_reason, stop_synced, last_error
`;

export async function readActiveRouteTrackingSession(userId?: string) {
  const query = userId
    ? `SELECT ${trackingSessionColumns} FROM route_tracking_sessions
       WHERE user_id = ? AND stopped_at IS NULL ORDER BY started_at DESC LIMIT 1`
    : `SELECT ${trackingSessionColumns} FROM route_tracking_sessions
       WHERE stopped_at IS NULL ORDER BY started_at DESC LIMIT 1`;
  const row = await (await database()).getFirstAsync<{
    session_id: string;
    user_id: string;
    operation_id: string;
    terms_version: string;
    consented_at: string;
    started_at: string;
    stopped_at: string | null;
    stop_reason: RouteTrackingStopReason | null;
    stop_synced: number;
    last_error: string | null;
  }>(query, ...(userId ? [userId] : []));
  return row ? trackingSessionFromRow(row) : null;
}

export async function saveRouteTrackingSession(session: RouteTrackingSession) {
  await (await database()).runAsync(
    `INSERT INTO route_tracking_sessions(
       session_id, user_id, operation_id, terms_version, consented_at, started_at,
       stopped_at, stop_reason, stop_synced, last_error, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       stopped_at = excluded.stopped_at,
       stop_reason = excluded.stop_reason,
       stop_synced = excluded.stop_synced,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`,
    session.sessionId,
    session.userId,
    session.operationId,
    session.termsVersion,
    session.consentedAt,
    session.startedAt,
    session.stoppedAt,
    session.stopReason,
    session.stopSynced ? 1 : 0,
    session.lastError,
    new Date().toISOString(),
  );
}

export async function appendRouteTrackingPoints(points: RouteTrackingPoint[]) {
  if (!points.length) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const point of points)
      await db.runAsync(
        `INSERT OR IGNORE INTO route_tracking_points(
           id, session_id, captured_at, latitude, longitude, accuracy,
           speed, heading, mocked, attempts, last_error
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        point.id,
        point.sessionId,
        point.capturedAt,
        point.latitude,
        point.longitude,
        point.accuracy,
        point.speed,
        point.heading,
        point.mocked ? 1 : 0,
      );
  });
}

export async function listRouteTrackingSessions(userId: string) {
  const rows = await (await database()).getAllAsync<{
    session_id: string;
    user_id: string;
    operation_id: string;
    terms_version: string;
    consented_at: string;
    started_at: string;
    stopped_at: string | null;
    stop_reason: RouteTrackingStopReason | null;
    stop_synced: number;
    last_error: string | null;
  }>(
    `SELECT ${trackingSessionColumns} FROM route_tracking_sessions
     WHERE user_id = ? ORDER BY started_at`,
    userId,
  );
  return rows.map(trackingSessionFromRow);
}

export async function listPendingRouteTrackingPoints(sessionId: string, limit = 100) {
  const rows = await (await database()).getAllAsync<{
    id: string;
    session_id: string;
    captured_at: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    mocked: number;
  }>(
    `SELECT id, session_id, captured_at, latitude, longitude, accuracy, speed, heading, mocked
     FROM route_tracking_points WHERE session_id = ? ORDER BY captured_at LIMIT ?`,
    sessionId,
    limit,
  );
  return rows.map<RouteTrackingPoint>((row) => ({
    id: row.id,
    sessionId: row.session_id,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    mocked: row.mocked === 1,
  }));
}

export async function confirmRouteTrackingPoints(sessionId: string, ids: string[]) {
  if (!ids.length) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const id of ids)
      await db.runAsync(
        "DELETE FROM route_tracking_points WHERE session_id = ? AND id = ?",
        sessionId,
        id,
      );
  });
}

export async function markRouteTrackingSyncAttempt(
  sessionId: string,
  pointIds: string[],
  error: string | null,
) {
  const db = await database();
  await db.runAsync(
    "UPDATE route_tracking_sessions SET last_error = ?, updated_at = ? WHERE session_id = ?",
    error,
    new Date().toISOString(),
    sessionId,
  );
  if (!pointIds.length) return;
  await db.withTransactionAsync(async () => {
    for (const id of pointIds)
      await db.runAsync(
        `UPDATE route_tracking_points SET attempts = attempts + 1, last_error = ?
         WHERE session_id = ? AND id = ?`,
        error,
        sessionId,
        id,
      );
  });
}

export async function markRouteTrackingStopped(
  sessionId: string,
  stoppedAt: string,
  reason: RouteTrackingStopReason,
  stopSynced = false,
) {
  await (await database()).runAsync(
    `UPDATE route_tracking_sessions
     SET stopped_at = coalesce(stopped_at, ?),
         stop_reason = coalesce(stop_reason, ?),
         stop_synced = CASE WHEN ? THEN 1 ELSE stop_synced END,
         updated_at = ?
     WHERE session_id = ?`,
    stoppedAt,
    reason,
    stopSynced ? 1 : 0,
    new Date().toISOString(),
    sessionId,
  );
}

export async function markRouteTrackingStopSynced(sessionId: string) {
  await (await database()).runAsync(
    `UPDATE route_tracking_sessions
     SET stop_synced = 1, last_error = NULL, updated_at = ? WHERE session_id = ?`,
    new Date().toISOString(),
    sessionId,
  );
}

export async function removeRouteTrackingSessionIfSettled(sessionId: string) {
  const result = await (await database()).runAsync(
    `DELETE FROM route_tracking_sessions
     WHERE session_id = ? AND stopped_at IS NOT NULL AND stop_synced = 1
       AND NOT EXISTS (
         SELECT 1 FROM route_tracking_points WHERE route_tracking_points.session_id = route_tracking_sessions.session_id
       )`,
    sessionId,
  );
  return result.changes === 1;
}
