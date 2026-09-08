import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../lib/route-tracking-policy";

const source = ts.transpileModule(readFileSync(new URL("../lib/route-tracking.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function runtime(database: Record<string, unknown>) {
  let nativeStops = 0;
  const compiled = { exports: {} as {
    stopRouteTrackingForSignOut: (user: string) => Promise<void>;
    syncRouteTracking: (user: string) => Promise<boolean>;
  } };
  vm.runInNewContext(source, {
    exports: compiled.exports,
    require: (name: string) => {
      switch (name) {
        case "expo-location": return { Accuracy: { Balanced: 3 }, ActivityType: { AutomotiveNavigation: 1 },
          hasStartedLocationUpdatesAsync: async () => true,
          stopLocationUpdatesAsync: async () => { nativeStops++; },
        };
        case "expo-task-manager": return { isTaskDefined: () => true };
        case "react-native": return { Platform: { OS: "ios" } };
        case "./database": return database;
        case "./supabase": return { supabase: {} };
        case "./route-tracking-policy": return policy;
        case "expo-crypto": return {};
        default: throw new Error(`Unexpected import: ${name}`);
      }
    },
  });
  return { api: compiled.exports, stops: () => nativeStops };
}

test("logout interrompe GPS mesmo se SQLite falhar e não oculta o erro", async () => {
  const app = runtime({ readActiveRouteTrackingSession: async () => { throw new Error("storage failed"); } });
  await assert.rejects(app.api.stopRouteTrackingForSignOut("user"), /storage failed/);
  assert.equal(app.stops(), 1);
});

test("sincronizações simultâneas compartilham o lote e liberam a trava após falha", async () => {
  let reads = 0;
  const app = runtime({ listRouteTrackingSessions: async () => { reads++; throw new Error("offline"); } });
  const first = app.api.syncRouteTracking("user");
  assert.equal(app.api.syncRouteTracking("user"), first);
  await assert.rejects(first, /offline/);
  assert.equal(reads, 1);
  await assert.rejects(app.api.syncRouteTracking("user"), /offline/);
  assert.equal(reads, 2);
});
