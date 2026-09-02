import type { Operation } from "./types";

export function splitActiveOperations(
  operations: Operation[],
  now = new Date(),
) {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const active = operations.filter((operation) => operation.status === "active");
  return {
    current: active.filter(
      (operation) => new Date(operation.scheduled_at).getTime() < tomorrow.getTime(),
    ),
    upcoming: active.filter(
      (operation) => new Date(operation.scheduled_at).getTime() >= tomorrow.getTime(),
    ),
  };
}
