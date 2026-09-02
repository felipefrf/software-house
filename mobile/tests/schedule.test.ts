import assert from "node:assert/strict";
import test from "node:test";

import { splitActiveOperations } from "../lib/schedule";
import type { Operation } from "../lib/types";

const operation = (
  id: string,
  scheduledAt: string,
  status: Operation["status"] = "active",
): Operation => ({
  id,
  source: "manual",
  external_id: null,
  event_name: id,
  destination: "Salvador",
  scheduled_at: scheduledAt,
  stage: "preparation",
  status,
  stage_started_at: scheduledAt,
  completed_at: null,
  cancel_reason: null,
  manager_id: "manager",
  team_id: null,
  vehicle_id: null,
  driver_id: null,
  notes: null,
  imported_at: null,
  waiting_since: null,
});

test("home separa hoje e atrasadas das próximas operações", () => {
  const groups = splitActiveOperations(
    [
      operation("atrasada", "2026-08-31T12:00:00-03:00"),
      operation("hoje", "2026-09-02T20:00:00-03:00"),
      operation("proxima", "2026-09-03T09:00:00-03:00"),
      operation("concluida", "2026-09-02T10:00:00-03:00", "completed"),
    ],
    new Date("2026-09-02T11:00:00-03:00"),
  );
  assert.deepEqual(groups.current.map((item) => item.id), ["atrasada", "hoje"]);
  assert.deepEqual(groups.upcoming.map((item) => item.id), ["proxima"]);
});
