import * as SQLite from "expo-sqlite";

import type { OutboxAction, OutboxState, WorkData } from "./types";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const database = async () => {
  databasePromise ??= SQLite.openDatabaseAsync("imperio-logistica.db").then(
    async (db) => {
      await db.execAsync(`
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
