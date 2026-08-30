import { EstoqueNowClient, type EstoqueNowOperation } from "./estoquenow";
import type { EstoqueNowStatus } from "./types";

const dateForApi = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

let liveClient: EstoqueNowClient | null = null;

const credentials = () => ({
  clientId: process.env.ESTOQUENOW_CLIENT_ID,
  clientSecret: process.env.ESTOQUENOW_CLIENT_SECRET,
});

export function getEstoqueNowStatus(
  lastSyncAt: string | null = null,
  importedCount = 0,
): EstoqueNowStatus {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret)
    return {
      source: "mock",
      configured: false,
      notice: "Credenciais ausentes. Operações internas não vieram do EstoqueNOW.",
      last_sync_at: null,
      imported_count: 0,
    };

  return {
    source: lastSyncAt ? "estoquenow" : "mock",
    configured: true,
    notice: lastSyncAt
      ? "Última importação somente leitura confirmada."
      : "Credenciais configuradas; a primeira importação somente leitura ainda não foi executada.",
    last_sync_at: lastSyncAt,
    imported_count: importedCount,
  };
}

export async function readEstoqueNowOperations(
  startDate: Date,
  endDate: Date,
): Promise<EstoqueNowOperation[]> {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw new Error("ESTOQUENOW_NOT_CONFIGURED");
  liveClient ??= new EstoqueNowClient({
    clientId,
    clientSecret,
    baseUrl: process.env.ESTOQUENOW_API_URL,
  });
  return liveClient.listLogistics(dateForApi(startDate), dateForApi(endDate));
}
