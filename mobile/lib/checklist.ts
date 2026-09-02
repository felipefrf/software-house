import type { Operation, OperationStage } from "./types";

export const stageLabels: Record<OperationStage, string> = {
  preparation: "Preparação",
  departure: "Saída",
  travel: "Deslocamento",
  arrival: "Chegada",
  assembly: "Montagem",
  delivery: "Entrega",
  disassembly: "Desmontagem",
  return: "Retorno",
  inspection: "Conclusão",
};

export const checklistByStage: Record<OperationStage, string[]> = {
  preparation: [
    "Pedido e separação conferidos",
    "Equipe escalada confirmada",
    "Veículo e motorista vinculados",
  ],
  departure: [
    "Motorista e veículo confirmados",
    "Toda a equipe presente",
    "Carga fotografada e conferida",
  ],
  travel: [
    "Rota aberta no Google Maps",
    "Contato do local disponível",
    "Nenhuma ocorrência pendente sem registro",
  ],
  arrival: [
    "Chegada registrada no local",
    "Condição de acesso verificada",
    "Equipe orientada para a próxima etapa",
  ],
  assembly: [
    "Itens e quantidades conferidos",
    "Montagem final fotografada",
    "Divergências registradas como ocorrência",
  ],
  delivery: [
    "Entrega conferida com o responsável local",
    "Aceite interno identificado",
    "Pendências registradas",
  ],
  disassembly: [
    "Volumes retirados conferidos",
    "Condição do local fotografada",
    "Faltas ou avarias registradas",
  ],
  return: [
    "Saída do evento confirmada",
    "Chegada à base registrada",
    "Itens avariados separados para revisão",
  ],
  inspection: [
    "Devolução conferida",
    "Avarias separadas e registradas",
    "Operação pronta para encerramento",
  ],
};

export function stageRequirementProgress({
  stage,
  checklist,
  hasPhoto,
  hasLocation,
  hasResponsible,
  arrivalValid,
  acceptanceValid,
}: {
  stage: OperationStage;
  checklist: Record<string, boolean>;
  hasPhoto: boolean;
  hasLocation: boolean;
  hasResponsible: boolean;
  arrivalValid: boolean;
  acceptanceValid: boolean;
}) {
  const requirements = [
    ...checklistByStage[stage].map((item) => ({
      label: item,
      complete: checklist[item] === true,
    })),
    { label: "Foto da etapa", complete: hasPhoto },
    { label: "GPS", complete: hasLocation },
    { label: "Responsável", complete: hasResponsible },
    ...(stage === "arrival"
      ? [{ label: "Situação do acesso", complete: arrivalValid }]
      : []),
    ...(stage === "delivery"
      ? [{ label: "Nome do aceite", complete: acceptanceValid }]
      : []),
  ];
  return {
    completed: requirements.filter((item) => item.complete).length,
    total: requirements.length,
    missing: requirements
      .filter((item) => !item.complete)
      .map((item) => item.label),
  };
}

export const missingRequiredAssignments = (
  operation: Pick<
    Operation,
    "stage" | "team_id" | "vehicle_id" | "driver_id"
  >,
) =>
  operation.stage === "preparation" || operation.stage === "departure"
    ? [
        !operation.team_id ? "equipe" : null,
        !operation.vehicle_id ? "veículo" : null,
        !operation.driver_id ? "motorista" : null,
      ].filter((item): item is string => Boolean(item))
    : [];
