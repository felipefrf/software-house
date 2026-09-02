import assert from "node:assert/strict";
import test from "node:test";

import {
  missingRequiredAssignments,
  stageRequirementProgress,
} from "../lib/checklist";

test("preparação bloqueia exatamente os vínculos ausentes", () => {
  assert.deepEqual(
    missingRequiredAssignments({
      stage: "preparation",
      team_id: null,
      vehicle_id: "vehicle-id",
      driver_id: null,
    }),
    ["equipe", "motorista"],
  );
});

test("etapas posteriores não exigem os três vínculos", () => {
  assert.deepEqual(
    missingRequiredAssignments({
      stage: "travel",
      team_id: null,
      vehicle_id: null,
      driver_id: null,
    }),
    [],
  );
});

test("progresso conta cada checklist e apresenta todos os faltantes", () => {
  const progress = stageRequirementProgress({
    stage: "preparation",
    checklist: {
      "Pedido e separação conferidos": true,
      "Equipe escalada confirmada": false,
      "Veículo e motorista vinculados": true,
    },
    hasPhoto: false,
    hasLocation: true,
    hasResponsible: false,
    arrivalValid: true,
    acceptanceValid: true,
  });
  assert.equal(progress.completed, 3);
  assert.equal(progress.total, 6);
  assert.deepEqual(progress.missing, [
    "Equipe escalada confirmada",
    "Foto da etapa",
    "Responsável",
  ]);
});
