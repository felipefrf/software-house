export type EstoqueNowOperation = {
  id: string;
  orderId: string;
  eventName: string;
  venue: string;
  city: string;
  scheduledDate: string;
  scheduledTime: string;
  returnDate: string;
  status: "preparation" | "route" | "delivery" | "return" | "completed";
  coordinator: string;
  crew: string;
  vehicle: string;
  nextMilestone: string;
};

type JsonObject = Record<string, unknown>;
type FetchLike = typeof fetch;

type SourceFields = {
  event_name: string;
  destination: string;
  scheduled_at: string;
};

export const sourceFieldsDiverged = (current: SourceFields, incoming: SourceFields) =>
  current.event_name !== incoming.event_name ||
  current.destination !== incoming.destination ||
  new Date(current.scheduled_at).getTime() !== new Date(incoming.scheduled_at).getTime();

const DEFAULT_BASE_URL = "https://api.estoquenow.com.br";
const REQUEST_TIMEOUT_MS = 8_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 100;

const asObject = (value: unknown): JsonObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

export const isValidExternalId = (value: string) => {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(normalized)
  );
};

export const isValidIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export const toScheduledAt = (date: string, time: string) => {
  const dateValue = date.trim();
  const dateMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    : dateValue;
  const timeMatch = time.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!isValidIsoDate(isoDate) || !timeMatch) return null;
  return new Date(`${isoDate}T${timeMatch[1]}:${timeMatch[2]}:00-03:00`).toISOString();
};

const nestedText = (record: JsonObject, ...paths: string[][]): string => {
  for (const keys of paths) {
    let value: unknown = record;
    for (const key of keys) value = asObject(value)?.[key];
    const result = text(value);
    if (result) return result;
  }
  return "";
};

const listFrom = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const record = asObject(payload);
  if (!record) return [];
  for (const key of ["data", "items", "logistics"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    const nested = asObject(value);
    if (Array.isArray(nested?.data)) return nested.data;
  }
  return [];
};

const statusFrom = (record: JsonObject): EstoqueNowOperation["status"] => {
  if (record.is_concluded_return === 1 || record.is_concluded_return === "1")
    return "completed";
  if (record.is_concluded_delivery === 1 || record.is_concluded_delivery === "1")
    return "return";
  const raw = nestedText(record, ["status"], ["logistic_status"], ["situation"])
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw.includes("rota") || raw.includes("transit")) return "route";
  if (raw.includes("entreg") || raw.includes("mont")) return "delivery";
  if (raw.includes("devol") || raw.includes("retorn")) return "return";
  if (raw.includes("conclu") || raw.includes("final")) return "completed";
  return "preparation";
};

export const normalizeLogistics = (payload: unknown): EstoqueNowOperation[] =>
  listFrom(payload).flatMap((value) => {
    const record = asObject(value);
    if (!record) return [];
    const id = nestedText(record, ["id"], ["logistic_id"]);
    const orderId = nestedText(record, ["order_id"], ["order", "id"]);
    const city = nestedText(record, ["address_city"], ["city"]);
    return [
      {
        id,
        orderId,
        eventName:
          nestedText(
            record,
            ["event_name"],
            ["local_name"],
            ["order", "event_name"],
            ["order", "client", "name"],
          ),
        venue:
          nestedText(record, ["local_name"], ["venue"], ["address_street"]),
        city,
        scheduledDate: nestedText(record, ["delivery_date"]),
        scheduledTime: nestedText(record, ["delivery_time"]),
        returnDate: nestedText(record, ["return_date"]),
        status: statusFrom(record),
        coordinator: nestedText(
          record,
          ["coordinator", "name"],
          ["responsible", "name"],
        ),
        crew: nestedText(record, ["crew_name"], ["team", "name"]),
        vehicle: nestedText(record, ["vehicle", "name"], ["vehicle_plate"]),
        nextMilestone: nestedText(record, ["next_milestone"]),
      },
    ];
  });

export class EstoqueNowClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly config: {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
    sleep?: (milliseconds: number) => Promise<void>;
  };

  constructor(
    config: {
      clientId: string;
      clientSecret: string;
      baseUrl?: string;
      fetchImpl?: FetchLike;
      sleep?: (milliseconds: number) => Promise<void>;
    },
  ) {
    this.config = config;
  }

  private async accessToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt > Date.now())
      return this.token.value;
    const response = await (this.config.fetchImpl ?? fetch)(
      `${this.config.baseUrl ?? DEFAULT_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error("ESTOQUENOW_AUTH_FAILED");
    const payload = asObject(await response.json());
    const accessToken = text(payload?.access_token ?? payload?.token);
    const expiresIn = Number(payload?.expires_in ?? 1800);
    if (!accessToken) throw new Error("ESTOQUENOW_INVALID_TOKEN_RESPONSE");
    this.token = {
      value: accessToken,
      expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000,
    };
    return accessToken;
  }

  private async request(
    path: string,
    rateAttempt = 0,
    renewToken = false,
  ): Promise<unknown> {
    const response = await (this.config.fetchImpl ?? fetch)(
      `${this.config.baseUrl ?? DEFAULT_BASE_URL}${path}`,
      {
        headers: { authorization: `Bearer ${await this.accessToken(renewToken)}` },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (response.status === 401 && !renewToken) {
      this.token = null;
      return this.request(path, rateAttempt, true);
    }
    if (response.status === 429 && rateAttempt < 2) {
      const seconds = Number(
        response.headers.get("retry-after") ??
          response.headers.get("rate-limit-reset") ??
          2 ** rateAttempt,
      );
      const delay = Math.min(Math.max(seconds * 1000, 1_000), 30_000);
      await (this.config.sleep ??
        ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))))(
        delay,
      );
      return this.request(path, rateAttempt + 1, false);
    }
    if (!response.ok) throw new Error(`ESTOQUENOW_HTTP_${response.status}`);
    return response.json();
  }

  async listLogistics(startDate: string, endDate: string) {
    const operations = new Map<string, EstoqueNowOperation>();
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        "order[id]": "desc",
        page: String(page),
        per_page: String(PAGE_SIZE),
        start_date: startDate,
        end_date: endDate,
      });
      const payload = await this.request(`/v1/logistic?${query}`);
      const rawCount = listFrom(payload).length;
      const batch = normalizeLogistics(payload);
      for (const [index, operation] of batch.entries()) {
        const key = operation.id
          ? `external:${operation.id}`
          : `invalid:${page}:${index + 1}`;
        const existing = operations.get(key);
        if (existing && JSON.stringify(existing) !== JSON.stringify(operation))
          throw new Error("ESTOQUENOW_DUPLICATE_ID_CONFLICT");
        operations.set(key, operation);
      }
      if (rawCount < PAGE_SIZE) break;
      if (page === MAX_PAGES) throw new Error("ESTOQUENOW_PAGE_LIMIT");
    }
    return [...operations.values()];
  }
}
