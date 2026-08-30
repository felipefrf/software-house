import { EstoqueNowClient } from "./estoquenow.ts";

const clientId = process.env.ESTOQUENOW_CLIENT_ID;
const clientSecret = process.env.ESTOQUENOW_CLIENT_SECRET;
if (!clientId || !clientSecret)
  throw new Error("Configure ESTOQUENOW_CLIENT_ID e ESTOQUENOW_CLIENT_SECRET.");

const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date());
const operations = await new EstoqueNowClient({
  clientId,
  clientSecret,
  baseUrl: process.env.ESTOQUENOW_API_URL,
}).listLogistics(date, date);

console.log(`Leitura concluída: ${operations.length} logística(s) retornada(s).`);
