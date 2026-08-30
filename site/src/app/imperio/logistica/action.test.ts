import assert from "node:assert/strict";
import test from "node:test";

import { checklistForStage, isChecklistComplete } from "./action.ts";

test("exige todos os itens da etapa", () => {
  const checks = Object.fromEntries(checklistForStage("preparation").map((item) => [item, true]));
  assert.equal(isChecklistComplete(checks), true);
  checks["Carga conferida"] = false;
  assert.equal(isChecklistComplete(checks), false);
  assert.equal(isChecklistComplete({}), false);
});
