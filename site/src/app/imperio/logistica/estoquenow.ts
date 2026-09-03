export type EstoqueNowOperation = {
  id: string;
  orderId: string;
  protocol: string;
  sourceVersion: string;
  eventName: string;
  legacyEventName: string;
  venue: string;
  address: {
    zipcode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  city: string;
  scheduledDate: string;
  scheduledTime: string;
  returnDate: string;
  returnTime: string;
  deliveryStatus: EstoqueNowMovementStatus;
  returnStatus: EstoqueNowMovementStatus;
  itemCount: string;
  orderType: string;
  logisticTypeId: string;
  status: "preparation" | "route" | "delivery" | "return" | "completed";
  coordinator: string;
  crew: string;
  vehicle: string;
};

export type EstoqueNowMovementStatus = {
  id: string;
  type: string;
  concluded: boolean | null;
};

export type EstoqueNowContract = {
  pages: Array<{
    page: number | null;
    perPage: number | null;
    recordsTotal: number | null;
    recordsFiltered: number | null;
    records: number;
  }>;
  fields: Array<{ path: string; signatures: string[]; occurrences: number }>;
  facets: Array<{ field: string; values: Array<{ value: string; occurrences: number }> }>;
};

export type EstoqueNowDetailContract = {
  fields: Array<{ path: string; signatures: string[]; occurrences: number }>;
  mediaFields: Array<{ path: string; signatures: string[]; occurrences: number }>;
};

export type EstoqueNowItem = {
  id: string;
  itemId: string;
  orderId: string;
  name: string;
};

export type EstoqueNowItemPhoto = {
  item: EstoqueNowItem;
  url: string;
};

export const canonicalItems = (items: EstoqueNowItem[]) =>
  items
    .map(({ id, itemId, orderId, name }) => ({ id, itemId, orderId, name }))
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 :
      left.itemId < right.itemId ? -1 : left.itemId > right.itemId ? 1 :
      left.orderId < right.orderId ? -1 : left.orderId > right.orderId ? 1 : 0,
    );

type JsonObject = Record<string, unknown>;
type FetchLike = typeof fetch;

export type EstoqueNowConfirmation = 0 | 1;

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
const SAFE_FACET_FIELDS = ["type", "type_name", "status_type", "is_concluded"] as const;
const SAFE_DETAIL_KEYS = new Set([
  "data", "id", "order_id", "protocol", "nu_version", "order_items",
  "related_logistics", "drivers", "vehicles", "product", "product_id",
  "product_name", "item_id", "item_name", "name", "description", "quantity",
  "unit", "sku", "category", "type", "type_name", "status_id", "status_name",
  "status_type", "is_concluded", "movement_date", "movement_time",
]);
const MEDIA_KEY_PARTS = new Set([
  "product", "item", "photo", "foto", "image", "img", "imagem", "thumb",
  "thumbnail", "media", "file", "arquivo", "url", "uri", "path", "src",
  "attachment", "anexo", "id", "name",
]);
const isMediaKey = (key: string) =>
  /^[a-z][a-z0-9_]{0,63}$/.test(key) &&
  /photo|foto|image|img|imagem|thumb|media|file|arquivo|anexo/.test(key) &&
  key.split("_").every((part) => MEDIA_KEY_PARTS.has(part));

const asObject = (value: unknown): JsonObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const numberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed) ? parsed : null;
};

const booleanOrNull = (value: unknown) => {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
};

const signature = (value: unknown) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value !== "string") return typeof value;
  if (!value.length) return "empty-string";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "DD/MM/YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "YYYY-MM-DD";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return "HH:MM[:SS]";
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) return "datetime";
  if (/^(manha|tarde|noite)$/i.test(value)) return "turno";
  return "string";
};

const mediaSignature = (value: unknown) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value !== null && typeof value === "object") return "object";
  if (typeof value !== "string") return typeof value;
  if (!value.length) return "empty-string";
  if (/^data:image\//i.test(value)) return "data-url";
  if (/^https:\/\//i.test(value)) {
    const credentials = /https:\/\/[^/]*@/i.test(value);
    const query = /[?#]/.test(value);
    return credentials
      ? query ? "https-url-with-credentials-and-query" : "https-url-with-credentials"
      : query ? "https-url-with-query" : "https-url";
  }
  if (/^http:\/\//i.test(value)) {
    const credentials = /http:\/\/[^/]*@/i.test(value);
    const query = /[?#]/.test(value);
    return credentials
      ? query ? "http-url-with-credentials-and-query" : "http-url-with-credentials"
      : query ? "http-url-with-query" : "http-url";
  }
  if (/\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(value)) return "image-path";
  if (/^[./]/.test(value)) return "relative-path";
  return "string";
};

const mediaContractFromDetail = (payload: unknown) => {
  const root = asObject(payload);
  const detail = asObject(root?.data) ?? root;
  const rawItems = Array.isArray(detail?.order_items) ? detail.order_items : [];
  const candidates = new Map<string, { signatures: Set<string>; occurrences: number }>();
  for (const value of rawItems) {
    const item = asObject(value);
    if (!item) continue;
    for (const [key, field] of Object.entries(item)) {
      if (!isMediaKey(key)) continue;
      const current = candidates.get(key) ?? { signatures: new Set<string>(), occurrences: 0 };
      current.signatures.add(mediaSignature(field));
      current.occurrences += 1;
      candidates.set(key, current);
    }
  }
  const minimumOccurrences = Math.ceil(rawItems.length * 0.8);
  return [...candidates.entries()]
    .filter(([, field]) => field.occurrences >= minimumOccurrences)
    .map(([key, field]) => ({
      path: `order_items.[].${key}`,
      signatures: [...field.signatures].sort(),
      occurrences: field.occurrences,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
};

const contractFrom = (payload: unknown, allowedKeys?: ReadonlySet<string>) => {
  const fields = new Map<string, { signatures: Set<string>; occurrences: number }>();
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, path ? `${path}.[]` : "[]");
      return;
    }
    const record = asObject(value);
    if (record) {
      for (const [key, item] of Object.entries(record)) {
        const safeKey = !allowedKeys || allowedKeys.has(key) ? key : "[redacted]";
        visit(item, path ? `${path}.${safeKey}` : safeKey);
      }
      return;
    }
    const current = fields.get(path) ?? { signatures: new Set<string>(), occurrences: 0 };
    current.signatures.add(signature(value));
    current.occurrences += 1;
    fields.set(path, current);
  };
  visit(payload, "");
  return fields;
};

const pageMetadata = (payload: unknown, records: number) => {
  const record = asObject(payload);
  return {
    page: numberOrNull(record?.page),
    perPage: numberOrNull(record?.perPage ?? record?.per_page),
    recordsTotal: numberOrNull(record?.recordsTotal ?? record?.records_total),
    recordsFiltered: numberOrNull(record?.recordsFiltered ?? record?.records_filtered),
    records,
  };
};

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
  const timeMatch = time.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!isValidIsoDate(isoDate) || !timeMatch) return null;
  return new Date(
    `${isoDate}T${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? "00"}-03:00`,
  ).toISOString();
};

export const operationDestination = (operation: EstoqueNowOperation) =>
  [
    operation.venue.trim(),
    [operation.address.street.trim(), operation.address.number.trim()]
      .filter(Boolean)
      .join(", "),
    operation.address.complement.trim(),
    operation.address.neighborhood.trim(),
    [operation.address.city.trim(), operation.address.state.trim()]
      .filter(Boolean)
      .join(" - "),
    operation.address.zipcode.trim() ? `CEP ${operation.address.zipcode.trim()}` : "",
  ]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(" · ");

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

export const itemsFromDetail = (payload: unknown): EstoqueNowItem[] => {
  const root = asObject(payload);
  const detail = asObject(root?.data) ?? root;
  const rawItems = detail?.order_items;
  if (!Array.isArray(rawItems) || rawItems.length > 1_000)
    throw new Error("ESTOQUENOW_INVALID_ORDER_ITEMS");
  const items = new Map<string, EstoqueNowItem>();
  for (const value of rawItems) {
    const item = asObject(value);
    const normalized = {
      id: nestedText(item ?? {}, ["id"]),
      itemId: nestedText(item ?? {}, ["item_id"]),
      orderId: nestedText(item ?? {}, ["order_id"]),
      name: nestedText(item ?? {}, ["item_name"]),
    };
    if (
      !item ||
      !isValidExternalId(normalized.id) ||
      !isValidExternalId(normalized.itemId) ||
      !isValidExternalId(normalized.orderId) ||
      normalized.name.length < 1 ||
      normalized.name.length > 500
    )
      throw new Error("ESTOQUENOW_INVALID_ORDER_ITEMS");
    const current = items.get(normalized.id);
    if (current && JSON.stringify(current) !== JSON.stringify(normalized))
      throw new Error("ESTOQUENOW_ORDER_ITEM_CONFLICT");
    items.set(normalized.id, normalized);
  }
  return canonicalItems([...items.values()]);
};

export const itemPhotoFromDetail = (
  payload: unknown,
  expected: EstoqueNowItem,
): EstoqueNowItemPhoto => {
  const item = itemsFromDetail(payload).find((candidate) => candidate.id === expected.id);
  if (!item || JSON.stringify(item) !== JSON.stringify(canonicalItems([expected])[0]))
    throw new Error("ESTOQUENOW_SOURCE_ITEM_CHANGED");
  const root = asObject(payload);
  const detail = asObject(root?.data) ?? root;
  const raw = Array.isArray(detail?.order_items)
    ? detail.order_items.map(asObject).find((candidate) => text(candidate?.id) === item.id)
    : null;
  const value = text(raw?.item_url_image);
  if (!value || value.length > 2_048) throw new Error("ESTOQUENOW_ITEM_PHOTO_UNAVAILABLE");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new Error("ESTOQUENOW_INVALID_ITEM_PHOTO");
  return { item, url: url.toString() };
};

const allowedMediaUrl = (value: string) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(host === "estoquenow.com.br" || host.endsWith(".estoquenow.com.br"))
  )
    throw new Error("MEDIA_HOST_NOT_ALLOWED");
  return url;
};

export const fetchEstoqueNowItemPhoto = async (
  initialUrl: string,
  fetchImpl: typeof fetch = fetch,
) => {
  let url = allowedMediaUrl(initialUrl);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetchImpl(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 2) throw new Error("MEDIA_REDIRECT_INVALID");
      url = allowedMediaUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error("MEDIA_FETCH_FAILED");
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(contentType))
      throw new Error("MEDIA_TYPE_INVALID");
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > 6_000_000)
      throw new Error("MEDIA_TOO_LARGE");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6_000_000) {
        await reader.cancel();
        throw new Error("MEDIA_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, contentType };
  }
  throw new Error("MEDIA_FETCH_FAILED");
};

const statusFrom = (record: JsonObject): EstoqueNowOperation["status"] => {
  if (record.is_concluded === 1 || record.is_concluded === "1" || record.is_concluded === true)
    return nestedText(record, ["type"]).toLowerCase() === "return"
      ? "completed"
      : "return";
  if (record.is_concluded_return === 1 || record.is_concluded_return === "1")
    return "completed";
  if (record.is_concluded_delivery === 1 || record.is_concluded_delivery === "1")
    return "return";
  const raw = nestedText(
    record,
    ["status_name"],
    ["status_type"],
    ["status"],
    ["logistic_status"],
    ["situation"],
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw.includes("rota") || raw.includes("transit")) return "route";
  if (raw.includes("entreg") || raw.includes("mont")) return "delivery";
  if (raw.includes("devol") || raw.includes("retorn")) return "return";
  if (raw.includes("conclu") || raw.includes("final")) return "completed";
  return "preparation";
};

export const normalizeLogistics = (payload: unknown): EstoqueNowOperation[] => {
  const groups = new Map<string, Map<string, JsonObject>>();
  for (const [index, value] of listFrom(payload).entries()) {
    const record = asObject(value);
    if (!record) continue;
    const id = nestedText(record, ["id"], ["logistic_id"]);
    const type = nestedText(record, ["type"]).toLowerCase() || "unspecified";
    const key = id ? `external:${id}` : `invalid:${index}`;
    const movements = groups.get(key) ?? new Map<string, JsonObject>();
    const existing = movements.get(type);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record))
      throw new Error("ESTOQUENOW_DUPLICATE_ID_CONFLICT");
    movements.set(type, record);
    groups.set(key, movements);
  }

  return [...groups.values()].map((movements) => {
    const delivery = movements.get("delivery");
    const returnMovement = movements.get("return");
    const record = delivery ?? returnMovement ?? [...movements.values()][0];
    const id = nestedText(record, ["id"], ["logistic_id"]);
    const orderId = nestedText(record, ["order_id"], ["order", "id"]);
    const venue = nestedText(record, ["local_name"], ["venue"], ["address_street"]);
    const legacyEventName = nestedText(
      record,
      ["client_name"],
      ["event_name"],
      ["local_name"],
      ["order", "event_name"],
      ["order", "client", "name"],
    );
    const address = {
      zipcode: nestedText(record, ["address_zipcode"]),
      street: nestedText(record, ["address_street"]),
      number: nestedText(record, ["address_number"]),
      complement: nestedText(record, ["address_complement"]),
      neighborhood: nestedText(record, ["address_neighborhood"]),
      city: nestedText(record, ["address_city"], ["city"]),
      state: nestedText(record, ["address_state"]),
    };
    const movementStatus = (movement?: JsonObject): EstoqueNowMovementStatus => ({
      id: nestedText(movement ?? {}, ["status_id"]),
      type: nestedText(movement ?? {}, ["status_type"]),
      concluded: booleanOrNull(movement?.is_concluded),
    });
    return {
      id,
      orderId,
      protocol: nestedText(record, ["protocol"]),
      sourceVersion: nestedText(record, ["nu_version"]),
      eventName:
        [orderId ? `Pedido ${orderId}` : id ? `Logística ${id}` : "", venue]
          .filter(Boolean)
          .join(" · ") || legacyEventName,
      legacyEventName,
      venue,
      address,
      city: address.city,
      scheduledDate: nestedText(delivery ?? record, ["movement_date"], ["delivery_date"]),
      scheduledTime: nestedText(delivery ?? record, ["movement_time"], ["delivery_time"]),
      returnDate: nestedText(returnMovement ?? record, ["movement_date"], ["return_date"]),
      returnTime: nestedText(returnMovement ?? record, ["movement_time"], ["return_time"]),
      deliveryStatus: movementStatus(delivery),
      returnStatus: movementStatus(returnMovement),
      itemCount: text(record.count_items),
      orderType: nestedText(record, ["order_type"]),
      logisticTypeId: nestedText(record, ["logistic_type_id"]),
      status:
        statusFrom(returnMovement ?? {}) === "completed"
          ? "completed"
          : statusFrom(delivery ?? record),
      coordinator: nestedText(record, ["coordinator", "name"], ["responsible", "name"]),
      crew: nestedText(record, ["crew_name"], ["team", "name"]),
      vehicle: nestedText(record, ["vehicle", "name"], ["vehicle_plate"]),
    };
  });
};

export class EstoqueNowClient {
  private token: { value: string; expiresAt: number } | null = null;
  private detailCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
  private readonly config: {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    fetchImpl?: FetchLike;
    sleep?: (milliseconds: number) => Promise<void>;
    writeEnabled?: boolean;
  };

  constructor(
    config: {
      clientId: string;
      clientSecret: string;
      baseUrl?: string;
      fetchImpl?: FetchLike;
      sleep?: (milliseconds: number) => Promise<void>;
      writeEnabled?: boolean;
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
    const expires = text(payload?.expires);
    if (!accessToken) throw new Error("ESTOQUENOW_INVALID_TOKEN_RESPONSE");
    const absoluteExpiry = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(expires)
      ? new Date(`${expires.replace(" ", "T")}-03:00`).getTime()
      : Date.parse(expires);
    this.token = {
      value: accessToken,
      expiresAt: Number.isFinite(absoluteExpiry)
        ? Math.max(Date.now(), absoluteExpiry - 30_000)
        : Date.now() + Math.max(60, expiresIn - 30) * 1000,
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

  private logisticDetail(id: string, useCache = false) {
    if (!isValidExternalId(id)) throw new Error("ESTOQUENOW_INVALID_LOGISTIC_ID");
    const key = id.trim();
    if (!useCache) {
      const value = this.request(`/v1/logistic/${encodeURIComponent(key)}`);
      void value.then(() => this.detailCache.delete(key));
      return value;
    }
    for (const [cacheKey, entry] of this.detailCache)
      if (entry.expiresAt <= Date.now()) this.detailCache.delete(cacheKey);
    const cached = this.detailCache.get(key);
    if (cached) return cached.value;
    if (this.detailCache.size >= 8) this.detailCache.delete(this.detailCache.keys().next().value!);
    const value = this.request(`/v1/logistic/${encodeURIComponent(key)}`);
    this.detailCache.set(key, { expiresAt: Date.now() + 60_000, value });
    void value.catch(() => this.detailCache.delete(key));
    return value;
  }

  private async write(path: string, body: JsonObject) {
    if (!this.config.writeEnabled) throw new Error("ESTOQUENOW_WRITE_DISABLED");
    const response = await (this.config.fetchImpl ?? fetch)(
      `${this.config.baseUrl ?? DEFAULT_BASE_URL}${path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`ESTOQUENOW_WRITE_HTTP_${response.status}`);
    return response.json();
  }

  confirmDelivery(id: number, value: EstoqueNowConfirmation) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("ESTOQUENOW_INVALID_LOGISTIC_ID");
    return this.write(`/v1/logistic/execute_confirmation_delivery/${id}`, {
      is_concluded_delivery: value,
    });
  }

  confirmReturn(id: number, value: EstoqueNowConfirmation) {
    if (!Number.isInteger(id) || id <= 0) throw new Error("ESTOQUENOW_INVALID_LOGISTIC_ID");
    return this.write(`/v1/logistic/execute_confirmation_return/${id}`, {
      is_concluded_return: value,
    });
  }

  async listLogisticsWithContract(startDate: string, endDate: string) {
    const records: unknown[] = [];
    const fields = new Map<string, { signatures: Set<string>; occurrences: number }>();
    const facets = new Map<string, Map<string, number>>();
    const pages: EstoqueNowContract["pages"] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        "order[id]": "desc",
        page: String(page),
        per_page: String(PAGE_SIZE),
        start_date: startDate,
        end_date: endDate,
      });
      const payload = await this.request(`/v1/logistic?${query}`);
      const pageRecords = listFrom(payload);
      records.push(...pageRecords);
      const rawCount = pageRecords.length;
      const metadata = pageMetadata(payload, rawCount);
      pages.push(metadata);
      for (const [path, incoming] of contractFrom(payload)) {
        const current = fields.get(path) ?? { signatures: new Set<string>(), occurrences: 0 };
        for (const item of incoming.signatures) current.signatures.add(item);
        current.occurrences += incoming.occurrences;
        fields.set(path, current);
      }
      for (const value of pageRecords) {
        const record = asObject(value);
        if (!record) continue;
        for (const field of SAFE_FACET_FIELDS) {
          const value = text(record[field]);
          if (!value || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) continue;
          const counts = facets.get(field) ?? new Map<string, number>();
          counts.set(value, (counts.get(value) ?? 0) + 1);
          facets.set(field, counts);
        }
      }
      const total = metadata.recordsFiltered ?? metadata.recordsTotal;
      const currentPage = metadata.page ?? page;
      const serverPageSize = metadata.perPage ?? rawCount;
      if (total !== null ? currentPage * serverPageSize >= total : rawCount < PAGE_SIZE) break;
      if (page === MAX_PAGES) throw new Error("ESTOQUENOW_PAGE_LIMIT");
    }
    return {
      operations: normalizeLogistics({ data: records }),
      contract: {
        pages,
        fields: [...fields.entries()]
          .map(([path, field]) => ({
            path,
            signatures: [...field.signatures].sort(),
            occurrences: field.occurrences,
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        facets: [...facets.entries()].map(([field, values]) => ({
          field,
          values: [...values.entries()]
            .map(([value, occurrences]) => ({ value, occurrences }))
            .sort((left, right) => left.value.localeCompare(right.value)),
        })),
      },
    };
  }

  async listLogistics(startDate: string, endDate: string) {
    return (await this.listLogisticsWithContract(startDate, endDate)).operations;
  }

  async inspectLogisticDetail(id: string) {
    const payload = await this.logisticDetail(id);
    const fields = contractFrom(payload, SAFE_DETAIL_KEYS);
    return {
      contract: {
        fields: [...fields.entries()]
          .map(([path, field]) => ({
            path,
            signatures: [...field.signatures].sort(),
            occurrences: field.occurrences,
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
        mediaFields: mediaContractFromDetail(payload),
      } satisfies EstoqueNowDetailContract,
      items: itemsFromDetail(payload),
    };
  }

  async listLogisticItems(id: string): Promise<EstoqueNowItem[]> {
    return itemsFromDetail(await this.logisticDetail(id));
  }

  async getLogisticItemPhoto(id: string, item: EstoqueNowItem) {
    return itemPhotoFromDetail(await this.logisticDetail(id, true), item);
  }
}
