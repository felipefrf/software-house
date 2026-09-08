import assert from "node:assert/strict";
import test from "node:test";

import {
  endsRouteTracking,
  operationEndedForTracking,
  routeTrackingAcknowledgement,
  ROUTE_TRACKING_TERMS_TEXT,
  ROUTE_TRACKING_TERMS_VERSION,
  startsRouteTracking,
  validRouteTrackingPoint,
} from "../lib/route-tracking-policy";

test("confirma só IDs do lote enviado e respeita parada mesmo sem pontos aceitos", () => {
  assert.deepEqual(routeTrackingAcknowledgement({ accepted_ids: ["a", "a"], should_stop: false }, ["a"]), {
    accepted: ["a"], stoppedAt: null, stopReason: null,
  });
  assert.equal(routeTrackingAcknowledgement({ accepted_ids: ["another-session"], should_stop: false }, ["a"]), null);
  assert.equal(routeTrackingAcknowledgement({ accepted_ids: ["a"] }, ["a"]), null);
  assert.equal(routeTrackingAcknowledgement({ accepted_ids: [], should_stop: true, stopped_at: "invalid", stop_reason: "completed" }, []), null);
  assert.deepEqual(routeTrackingAcknowledgement({ accepted_ids: [], should_stop: true, stopped_at: "2026-09-08T12:00:00Z", stop_reason: "completed" }, ["a"]), {
    accepted: [], stoppedAt: "2026-09-08T12:00:00Z", stopReason: "completed",
  });
});

test("rota exige termos versionados e cobre somente saída até retorno", () => {
  assert.equal(ROUTE_TRACKING_TERMS_VERSION, "imperio-route-tracking-v1");
  assert.match(ROUTE_TRACKING_TERMS_TEXT, /segundo plano/);
  assert.equal(startsRouteTracking("preparation"), false);
  assert.equal(startsRouteTracking("departure"), true);
  assert.equal(endsRouteTracking("return"), true);
  assert.equal(endsRouteTracking("inspection"), true);
  assert.equal(endsRouteTracking("delivery"), false);
  assert.equal(operationEndedForTracking({ stage: "travel", status: "cancelled" }), true);
});

test("ponto de rota descarta coordenada ou precisão não operacional", () => {
  assert.equal(
    validRouteTrackingPoint({ latitude: -12.97, longitude: -38.5, accuracy: 120 }),
    true,
  );
  assert.equal(
    validRouteTrackingPoint({ latitude: -12.97, longitude: -38.5, accuracy: 1_001 }),
    false,
  );
  assert.equal(
    validRouteTrackingPoint({ latitude: Number.NaN, longitude: -38.5, accuracy: 10 }),
    false,
  );
});
