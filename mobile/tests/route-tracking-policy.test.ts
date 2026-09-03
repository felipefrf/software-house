import assert from "node:assert/strict";
import test from "node:test";

import {
  endsRouteTracking,
  operationEndedForTracking,
  ROUTE_TRACKING_TERMS_TEXT,
  ROUTE_TRACKING_TERMS_VERSION,
  startsRouteTracking,
  validRouteTrackingPoint,
} from "../lib/route-tracking-policy";

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
