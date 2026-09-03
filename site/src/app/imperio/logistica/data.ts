import { EstoqueNowClient } from "./estoquenow";
import type { EstoqueNowItem } from "./estoquenow";
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
  const importEnabled = process.env.ESTOQUENOW_IMPORT_ENABLED === "true";
  if (!clientId || !clientSecret)
    return {
      source: "mock",
      configured: false,
      import_enabled: importEnabled,
      notice: "Credenciais ausentes. Operações internas não vieram do EstoqueNOW.",
      last_sync_at: null,
      imported_count: 0,
    };

  return {
    source: lastSyncAt ? "estoquenow" : "mock",
    configured: true,
    import_enabled: importEnabled,
    notice: lastSyncAt
      ? "Última importação individual confirmada após leitura externa."
      : importEnabled
        ? "Leitura externa disponível; importação individual habilitada por ambiente."
        : "Credenciais no servidor; prévias de leitura não são persistidas. Importação individual desabilitada.",
    last_sync_at: lastSyncAt,
    imported_count: importedCount,
  };
}

export async function inspectEstoqueNowOperations(startDate: Date, endDate: Date) {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw new Error("ESTOQUENOW_NOT_CONFIGURED");
  liveClient ??= new EstoqueNowClient({
    clientId,
    clientSecret,
    baseUrl: process.env.ESTOQUENOW_API_URL,
    writeEnabled: process.env.ESTOQUENOW_WRITE_ENABLED === "true",
  });
  return liveClient.listLogisticsWithContract(dateForApi(startDate), dateForApi(endDate));
}

export async function inspectEstoqueNowDetail(externalId: string) {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw new Error("ESTOQUENOW_NOT_CONFIGURED");
  liveClient ??= new EstoqueNowClient({
    clientId,
    clientSecret,
    baseUrl: process.env.ESTOQUENOW_API_URL,
    writeEnabled: process.env.ESTOQUENOW_WRITE_ENABLED === "true",
  });
  return liveClient.inspectLogisticDetail(externalId, true);
}

export async function readEstoqueNowItems(externalId: string) {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw new Error("ESTOQUENOW_NOT_CONFIGURED");
  liveClient ??= new EstoqueNowClient({
    clientId,
    clientSecret,
    baseUrl: process.env.ESTOQUENOW_API_URL,
    writeEnabled: process.env.ESTOQUENOW_WRITE_ENABLED === "true",
  });
  return liveClient.listLogisticItems(externalId);
}

export async function readEstoqueNowItemPhoto(
  externalId: string,
  item: EstoqueNowItem,
) {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw new Error("ESTOQUENOW_NOT_CONFIGURED");
  liveClient ??= new EstoqueNowClient({
    clientId,
    clientSecret,
    baseUrl: process.env.ESTOQUENOW_API_URL,
    writeEnabled: process.env.ESTOQUENOW_WRITE_ENABLED === "true",
  });
  return liveClient.getLogisticItemPhoto(externalId, item);
}
