import { EstoqueNowClient } from "./estoquenow";

export type EstoqueNowStatus = {
  source: "estoquenow" | "mock";
  notice: string;
};

const dateForApi = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

let liveClient: EstoqueNowClient | null = null;

export async function getEstoqueNowStatus(): Promise<EstoqueNowStatus> {
  const clientId = process.env.ESTOQUENOW_CLIENT_ID;
  const clientSecret = process.env.ESTOQUENOW_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return {
      source: "mock",
      notice: "Credenciais ausentes. Operações internas não vieram do EstoqueNOW.",
    };

  try {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    liveClient ??= new EstoqueNowClient({
      clientId,
      clientSecret,
      baseUrl: process.env.ESTOQUENOW_API_URL,
    });
    await liveClient.listLogistics(dateForApi(today), dateForApi(tomorrow));
    return {
      source: "estoquenow",
      notice: "Leitura somente leitura disponível; nenhuma escrita foi feita no EstoqueNOW.",
    };
  } catch {
    return {
      source: "mock",
      notice: "Leitura indisponível. Operações internas seguem separadas e identificadas.",
    };
  }
}
