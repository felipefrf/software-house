import type { OperationStage } from "./types";

export const checklistForStage = (stage: OperationStage) =>
  stage === "preparation"
    ? ["Carga conferida", "Documentos separados", "Veículo inspecionado"]
    : ["Equipe confirmada", "Veículo carregado", "Destino revisado"];

export const isChecklistComplete = (checks: Record<string, boolean>) =>
  Object.keys(checks).length > 0 && Object.values(checks).every(Boolean);
