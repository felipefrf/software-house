import type { LocationEvidence, Operation, OperationStage, RouteTrackingPoint, RouteTrackingStopReason } from "./types";

export function currentLocationEvidence(position: {
  timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null };
}, now = Date.now()): LocationEvidence | null {
  if (!Number.isFinite(position.timestamp) || Math.abs(now - position.timestamp) > 120_000
    || position.coords.accuracy === null) return null;
  const evidence = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
  return validRouteTrackingPoint(evidence) ? evidence : null;
}

export function routeTrackingAcknowledgement(value: unknown, sentIds: string[]) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sent = new Set(sentIds);
  if (!Array.isArray(row.accepted_ids) || row.accepted_ids.some(id => typeof id !== "string" || !sent.has(id))
    || typeof row.should_stop !== "boolean") return null;
  const reasons: RouteTrackingStopReason[] = ["returned", "completed", "cancelled", "sign_out", "departure_failed", "operation_ended"];
  if (row.should_stop && (typeof row.stopped_at !== "string" || !Number.isFinite(Date.parse(row.stopped_at))
    || !reasons.includes(row.stop_reason as RouteTrackingStopReason))) return null;
  return {
    accepted: [...new Set(row.accepted_ids as string[])],
    stoppedAt: row.should_stop ? row.stopped_at as string : null,
    stopReason: row.should_stop ? row.stop_reason as RouteTrackingStopReason : null,
  };
}

export const ROUTE_TRACKING_TERMS_VERSION = "imperio-route-tracking-v1";

export const ROUTE_TRACKING_TERMS_TEXT =
  "A Império registrará localização, horário e precisão deste aparelho, inclusive em segundo plano, somente durante esta operação: da confirmação da saída até o retorno ou encerramento. Os dados serão usados para coordenação, segurança e evidência operacional e ficarão visíveis apenas a pessoas autorizadas.";

export const startsRouteTracking = (stage: OperationStage) => stage === "departure";

export const endsRouteTracking = (stage: OperationStage) =>
  stage === "return" || stage === "inspection";

export const operationEndedForTracking = (
  operation: Pick<Operation, "stage" | "status">,
) => operation.status !== "active" || operation.stage === "inspection";

export const validRouteTrackingPoint = (
  point: Pick<RouteTrackingPoint, "latitude" | "longitude" | "accuracy">,
) =>
  Number.isFinite(point.latitude) &&
  point.latitude >= -90 &&
  point.latitude <= 90 &&
  Number.isFinite(point.longitude) &&
  point.longitude >= -180 &&
  point.longitude <= 180 &&
  Number.isFinite(point.accuracy) &&
  point.accuracy >= 0 &&
  point.accuracy <= 1_000;
