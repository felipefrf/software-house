import type { Operation, OperationStage, RouteTrackingPoint } from "./types";

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
