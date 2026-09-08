import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as state from "../lib/outbox-state";
import type { OutboxAction } from "../lib/types";

const source = ts.transpileModule(readFileSync(new URL("../lib/database.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
type API = typeof import("../lib/database");

test("SQLite preserva fila após reinício, isola usuários e recupera falha de abertura", async () => {
  const directory = mkdtempSync(join(tmpdir(), "imperio-sqlite-test-"));
  let db: DatabaseSync | undefined;
  let keyUnavailable = true;
  const load = () => {
    const compiled = { exports: {} as API };
    vm.runInNewContext(source, {
      exports: compiled.exports,
      require: (name: string) => {
        if (name === "./outbox-state") return state;
        if (name === "expo-crypto") return {};
        if (name === "expo-secure-store") return { getItemAsync: async () => {
          if (keyUnavailable) throw new Error("device locked");
          return "a".repeat(64);
        } };
        if (name !== "expo-sqlite") throw new Error(`Unexpected import: ${name}`);
        return { openDatabaseAsync: async () => {
          db = new DatabaseSync(join(directory, "test.db"));
          const current = db;
          return {
            // SQLite real para durabilidade/queries; isto não homologa SQLCipher.
            execAsync: async (sql: string) => current.exec(sql),
            runAsync: async (sql: string, ...params: SQLInputValue[]) => current.prepare(sql).run(...params),
            getFirstAsync: async (sql: string, ...params: SQLInputValue[]) => current.prepare(sql).get(...params) ?? null,
            getAllAsync: async (sql: string, ...params: SQLInputValue[]) => current.prepare(sql).all(...params),
            closeAsync: async () => current.close(),
          };
        } };
      },
    });
    return compiled.exports;
  };
  try {
    const action: OutboxAction = {
      deviceActionId: "action-1", operationId: "op", operationName: "Teste", stage: "travel", state: "pending",
      checklist: {}, location: { latitude: 0, longitude: 0, accuracy: 20 }, deviceCapturedAt: new Date().toISOString(),
      responsibleId: "worker", note: "", photoUri: "file:///synthetic.jpg", photoPath: "op/synthetic.jpg",
      arrivalAccess: "", arrivalReason: "", acceptanceName: "", attempts: 0, lastError: null, updatedAt: new Date().toISOString(),
    };
    let api = load();
    await assert.rejects(api.listActions("worker"), /device locked/);
    assert.equal(db, undefined, "não abre conexão antes de obter chave");
    keyUnavailable = false;
    assert.equal(await api.enqueueAction("worker", action), true);
    assert.equal(await api.enqueueAction("worker", action), false);
    await assert.rejects(api.enqueueAction("worker", { ...action, note: "altered" }), /divergiu/);
    await assert.rejects(api.enqueueAction("other", action), /indisponível/);
    assert.equal((await api.listActions("other")).length, 0);
    assert.equal((await api.claimAction("worker", action.deviceActionId, false))?.state, "sending");
    db!.close(); db = undefined;
    api = load();
    const restored = await api.listActions("worker");
    assert.equal(restored.length, 1);
    assert.equal(restored[0].state, "pending");
    assert.equal(restored[0].attempts, 1);
    assert.equal(state.sameActionEvidence(restored[0], action), true);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
