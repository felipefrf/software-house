import { EstoqueNowClient } from "./estoquenow";
import type { LogisticOperation, LogisticsSnapshot } from "./types";

const MOCK_OPERATIONS: LogisticOperation[] = [
  {
    id: "demo-1048",
    orderId: "DEMO-1048",
    eventName: "Evento demonstração · montagem principal",
    venue: "Pavilhão Norte",
    city: "São Paulo",
    scheduledDate: "28/08/2026",
    scheduledTime: "14:30",
    returnDate: "29/08/2026",
    status: "preparation",
    coordinator: "Coordenação simulada",
    crew: "Equipe Alfa · 4 pessoas",
    vehicle: "Caminhão 01 · DEMO",
    nextMilestone: "Concluir conferência e liberar saída",
    alert: "Janela de carga em 42 min",
  },
  {
    id: "demo-1052",
    orderId: "DEMO-1052",
    eventName: "Evento demonstração · lounge corporativo",
    venue: "Centro de Convenções",
    city: "Guarulhos",
    scheduledDate: "28/08/2026",
    scheduledTime: "16:00",
    returnDate: "30/08/2026",
    status: "route",
    coordinator: "Coordenação simulada",
    crew: "Equipe Bravo · 3 pessoas",
    vehicle: "Van 02 · DEMO",
    nextMilestone: "Confirmar chegada ao local",
  },
  {
    id: "demo-1061",
    orderId: "DEMO-1061",
    eventName: "Evento demonstração · cerimônia",
    venue: "Espaço Jardim",
    city: "Mogi das Cruzes",
    scheduledDate: "28/08/2026",
    scheduledTime: "18:20",
    returnDate: "29/08/2026",
    status: "delivery",
    coordinator: "Coordenação simulada",
    crew: "Equipe Charlie · 5 pessoas",
    vehicle: "Caminhão 03 · DEMO",
    nextMilestone: "Finalizar montagem e registrar evidências",
  },
];

const dateForApi = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

let liveClient: EstoqueNowClient | null = null;

export async function getLogisticsSnapshot(): Promise<LogisticsSnapshot> {
  const fetchedAt = new Date().toISOString();
  const clientId = process.env.ESTOQUENOW_CLIENT_ID;
  const clientSecret = process.env.ESTOQUENOW_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return {
      source: "mock",
      operations: MOCK_OPERATIONS,
      fetchedAt,
      notice: "Credenciais ausentes. Dados demonstrativos; nenhuma chamada ao EstoqueNOW foi feita.",
    };

  try {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    liveClient ??= new EstoqueNowClient({
        clientId,
        clientSecret,
        baseUrl: process.env.ESTOQUENOW_API_URL,
      });
    const operations = await liveClient.listLogistics(
      dateForApi(today),
      dateForApi(tomorrow),
    );
    return {
      source: "estoquenow",
      operations,
      fetchedAt,
      notice: operations.length
        ? "Leitura concluída na API do EstoqueNOW."
        : "Leitura real concluída; nenhuma logística foi retornada para o período.",
    };
  } catch {
    return {
      source: "mock",
      operations: MOCK_OPERATIONS,
      fetchedAt,
      notice: "A leitura do EstoqueNOW falhou com segurança. Exibindo dados demonstrativos sem expor detalhes da integração.",
    };
  }
}
