import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_RETRY_LIMIT,
  classifySyncFailure,
  isAutoRetryable,
  isDiscardable,
  isRetryable,
} from "../lib/outbox-state";

test("conflitos de estágio ficam parados para decisão humana", () => {
  assert.equal(classifySyncFailure("stage conflict"), "conflict");
  assert.equal(classifySyncFailure("Operation not active"), "conflict");
  assert.equal(classifySyncFailure("permission denied for table operations"), "conflict");
  assert.equal(classifySyncFailure("invalid device capture time"), "conflict");
  assert.equal(
    classifySyncFailure("A foto local não está mais disponível."),
    "conflict",
  );
  assert.equal(isRetryable("conflict"), false);
});

test("falhas de rede permanecem reenviáveis", () => {
  assert.equal(classifySyncFailure("Network request failed"), "failed");
  assert.equal(isRetryable("pending"), true);
  assert.equal(isRetryable("failed"), true);
  assert.equal(isRetryable("sending"), false);
  assert.equal(isRetryable("confirmed"), false);
});

test("retry automático para em três tentativas e o manual permanece disponível", () => {
  assert.equal(AUTO_RETRY_LIMIT, 3);
  assert.equal(isAutoRetryable("failed", 2), true);
  assert.equal(isAutoRetryable("failed", 3), false);
  assert.equal(isRetryable("failed"), true);
});

test("somente falhas e conflitos podem ser descartados", () => {
  assert.equal(isDiscardable("failed"), true);
  assert.equal(isDiscardable("conflict"), true);
  assert.equal(isDiscardable("pending"), false);
  assert.equal(isDiscardable("sending"), false);
  assert.equal(isDiscardable("discarding"), false);
  assert.equal(isDiscardable("confirmed"), false);
  assert.equal(isRetryable("discarding"), false);
});
