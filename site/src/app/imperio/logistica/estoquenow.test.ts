import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalItems,
  EstoqueNowClient,
  fetchEstoqueNowItemPhoto,
  itemPhotoFromDetail,
  isValidExternalId,
  isValidIsoDate,
  normalizeLogistics,
  operationDestination,
  sourceFieldsDiverged,
  toScheduledAt,
  withEstoqueNowMediaSlot,
} from "./estoquenow.ts";

test("canonicaliza itens sem depender da ordem das chaves", () => {
  assert.equal(
    JSON.stringify(canonicalItems([{ name: "Mesa", orderId: "order-1", itemId: "item-1", id: "row-1" }])),
    '[{"id":"row-1","itemId":"item-1","orderId":"order-1","name":"Mesa"}]',
  );
});

test("detecta divergência sem confundir fusos equivalentes", () => {
  const current = {
    event_name: "Evento",
    destination: "Pavilhão",
    scheduled_at: "2026-08-30T15:00:00.000Z",
  };
  assert.equal(
    sourceFieldsDiverged(current, {
      ...current,
      scheduled_at: "2026-08-30T12:00:00-03:00",
    }),
    false,
  );
  assert.equal(
    sourceFieldsDiverged(current, { ...current, destination: "Novo local" }),
    true,
  );
});

test("normaliza lista sem presumir campos ausentes", () => {
  const operations = normalizeLogistics({
    data: [
      {
        id: 7,
        order_id: 42,
        delivery_date: "28/08/2026",
        delivery_time: "14:30",
        address_city: "São Paulo",
        local_name: "Pavilhão",
      },
    ],
  });
  assert.equal(operations[0]?.orderId, "42");
  assert.equal(operations[0]?.city, "São Paulo");
  assert.equal(operations[0]?.coordinator, "");
});

test("remove espaços e não fabrica ID, data, hora ou destino", () => {
  const operation = normalizeLogistics({
    data: [
      {
        id: "   ",
        event_name: "  Festa da equipe  ",
        delivery_date: " 31/08/2026 ",
        delivery_time: " 14:30 ",
      },
    ],
  })[0];
  assert.equal(operation?.id, "");
  assert.equal(operation?.eventName, "Festa da equipe");
  assert.equal(operation?.scheduledDate, "31/08/2026");
  assert.equal(operation?.scheduledTime, "14:30");
  assert.equal(operation?.venue, "");
  assert.equal(operation?.city, "");
});

test("valida calendário e horário sem aceitar normalização automática", () => {
  assert.equal(isValidIsoDate("2028-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-02-31"), false);
  assert.equal(toScheduledAt("31/08/2026", "23:59"), "2026-09-01T02:59:00.000Z");
  assert.equal(toScheduledAt("31/08/2026", "23:59:30"), "2026-09-01T02:59:30.000Z");
  assert.equal(toScheduledAt("31/02/2026", "08:00"), null);
  assert.equal(toScheduledAt("31/08/2026", "24:00"), null);
  assert.equal(toScheduledAt("31/08/2026", ""), null);
});

test("agrupa entrega e devolução conforme o contrato real sanitizado", () => {
  const operation = normalizeLogistics({
    data: [
      {
        id: "logistica-1",
        order_id: "pedido-1",
        type: "return",
        type_name: "Devolução",
        client_name: "Cliente exemplo",
        local_name: "Pavilhão exemplo",
        protocol: "PROTO-1",
        nu_version: "3",
        count_items: "12",
        address_street: "Rua Exemplo",
        address_number: "10",
        address_complement: "Portão B",
        address_neighborhood: "Centro",
        address_city: "Salvador",
        address_state: "BA",
        address_zipcode: "40000-000",
        movement_date: "2026-09-04",
        movement_time: "18:00:00",
        status_id: "1",
        status_type: "pending",
        is_concluded: "0",
      },
      {
        id: "logistica-1",
        order_id: "pedido-1",
        type: "delivery",
        type_name: "Entrega",
        client_name: "Cliente exemplo",
        local_name: "Pavilhão exemplo",
        protocol: "PROTO-1",
        nu_version: "3",
        count_items: "12",
        address_street: "Rua Exemplo",
        address_number: "10",
        address_complement: "Portão B",
        address_neighborhood: "Centro",
        address_city: "Salvador",
        address_state: "BA",
        address_zipcode: "40000-000",
        movement_date: "2026-09-03",
        movement_time: "08:30:15",
        status_id: "1",
        status_type: "pending",
        is_concluded: "0",
      },
    ],
  })[0];
  assert.equal(operation?.eventName, "Pedido pedido-1 · Pavilhão exemplo");
  assert.equal(operation?.legacyEventName, "Cliente exemplo");
  assert.equal(operation?.scheduledDate, "2026-09-03");
  assert.equal(operation?.scheduledTime, "08:30:15");
  assert.equal(operation?.returnDate, "2026-09-04");
  assert.equal(operation?.returnTime, "18:00:00");
  assert.equal(operation?.protocol, "PROTO-1");
  assert.equal(operation?.sourceVersion, "3");
  assert.equal(operation?.itemCount, "12");
  assert.deepEqual(operation?.address, {
    zipcode: "40000-000",
    street: "Rua Exemplo",
    number: "10",
    complement: "Portão B",
    neighborhood: "Centro",
    city: "Salvador",
    state: "BA",
  });
  assert.deepEqual(operation?.deliveryStatus, {
    id: "1",
    type: "pending",
    concluded: false,
  });
  assert.deepEqual(operation?.returnStatus, {
    id: "1",
    type: "pending",
    concluded: false,
  });
  assert.equal(
    operation ? operationDestination(operation) : "",
    "Pavilhão exemplo · Rua Exemplo, 10 · Portão B · Centro · Salvador - BA · CEP 40000-000",
  );
  assert.equal(operation?.status, "preparation");
});

test("usa entrega como contexto canônico sem descartar a janela de devolução", () => {
  const operation = normalizeLogistics({
    data: [
      { id: "1", type: "delivery", order_id: "pedido-1", movement_date: "2026-09-03" },
      { id: "1", type: "return", order_id: "pedido-2", movement_date: "2026-09-04" },
    ],
  })[0];
  assert.equal(operation?.orderId, "pedido-1");
  assert.equal(operation?.returnDate, "2026-09-04");
});

test("aceita IDs opacos, mas rejeita vazio, controle e tamanho excessivo", () => {
  assert.equal(isValidExternalId("  logistica/ABC 42  "), true);
  assert.equal(isValidExternalId("   "), false);
  assert.equal(isValidExternalId("ABC\n42"), false);
  assert.equal(isValidExternalId("x".repeat(201)), false);
});

test("aceita o token real, reutiliza e renova uma vez após 401", async () => {
  let tokens = 0;
  let reads = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) {
      tokens += 1;
      return Response.json({
        token: `token-${tokens}`,
        expires: "2099-09-02 12:27:59",
      });
    }
    reads += 1;
    if (reads === 2) return new Response(null, { status: 401 });
    return Response.json({ data: [] });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  await client.listLogistics("28/08/2026", "29/08/2026");
  await client.listLogistics("28/08/2026", "29/08/2026");
  assert.equal(tokens, 2);
  assert.equal(reads, 3);
});

test("aguarda e repete após 429", async () => {
  let tokens = 0;
  let reads = 0;
  const waits: number[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/oauth2/token")) {
      tokens += 1;
      return Response.json({ access_token: "token", expires_in: 1800 });
    }
    reads += 1;
    return reads === 1
      ? new Response(null, { status: 429, headers: { "retry-after": "2" } })
      : Response.json({ data: [] });
  };
  const client = new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
    sleep: async (milliseconds) => void waits.push(milliseconds),
  });
  await client.listLogistics("28/08/2026", "29/08/2026");
  assert.deepEqual(waits, [2_000]);
  assert.equal(tokens, 1);
  assert.equal(reads, 2);
});

test("inspeciona detalhe por GET e normaliza somente os itens permitidos", async () => {
  const paths: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) return Response.json({ token: "redacted" });
    paths.push(new URL(url).pathname);
    return Response.json({
      id: "123",
      order_items: [
        { id: "row-2", item_id: "item-2", order_id: "order-1", item_name: "Cadeira", product_image: "https://media.invalid/cadeira.jpg?secret=redacted", alice_photo: "privado" },
        { id: "row-1", item_id: "item-1", order_id: "order-1", item_name: "Mesa", product_image: null, alice_photo: "privado" },
      ],
      private_dynamic_map: { Alice: "valor privado" },
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  const inspection = await client.inspectLogisticDetail("123");
  assert.deepEqual(paths, ["/v1/logistic/123"]);
  assert.deepEqual(
    inspection.contract.fields.map((field) => field.path),
    ["[redacted].[redacted]", "id", "order_items.[].[redacted]", "order_items.[].id", "order_items.[].item_id", "order_items.[].item_name", "order_items.[].order_id"],
  );
  assert.deepEqual(inspection.items, [
    { id: "row-1", itemId: "item-1", orderId: "order-1", name: "Mesa" },
    { id: "row-2", itemId: "item-2", orderId: "order-1", name: "Cadeira" },
  ]);
  assert.deepEqual(inspection.contract.mediaFields, [
    { path: "order_items.[].product_image", signatures: ["https-url-with-query@media.invalid", "null"], occurrences: 2 },
  ]);
  assert.equal(/Alice|alice|valor privado|cadeira\.jpg|secret/.test(JSON.stringify(inspection)), false);
  await assert.rejects(() => client.inspectLogisticDetail(""), /INVALID_LOGISTIC_ID/);
});

test("rejeita item duplicado conflitante no detalhe", async () => {
  const fetchImpl: typeof fetch = async (input) =>
    String(input).endsWith("/oauth2/token")
      ? Response.json({ token: "redacted" })
      : Response.json({
          order_items: [
            { id: "row-1", item_id: "item-1", order_id: "order-1", item_name: "Mesa" },
            { id: "row-1", item_id: "item-2", order_id: "order-1", item_name: "Cadeira" },
          ],
        });
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  await assert.rejects(() => client.inspectLogisticDetail("123"), /ORDER_ITEM_CONFLICT/);
});

test("resolve foto somente quando o item ainda corresponde ao snapshot", () => {
  const payload = {
    order_items: [{
      id: "row-1",
      item_id: "item-1",
      order_id: "order-1",
      item_name: "Mesa",
      item_url_image: "https://media.estoquenow.com.br/mesa.jpg?signature=redacted",
    }],
  };
  const expected = { id: "row-1", itemId: "item-1", orderId: "order-1", name: "Mesa" };
  assert.equal(itemPhotoFromDetail(payload, expected).url.startsWith("https://"), true);
  assert.throws(
    () => itemPhotoFromDetail(payload, { ...expected, name: "Mesa antiga" }),
    /SOURCE_ITEM_CHANGED/,
  );
});

test("prova a mídia sem retornar URL assinada", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) return Response.json({ token: "redacted" });
    if (url.startsWith("https://thumb110.estoquenow.com.br:8443/"))
      return new Response("image", { headers: { "content-type": "image/jpeg" } });
    return Response.json({
      order_items: [{
        id: "row-1",
        item_id: "item-1",
        order_id: "order-1",
        item_name: "Mesa",
        item_url_image: "https://thumb110.estoquenow.com.br:8443/item.jpg?signature=redacted",
      }],
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  const detail = await client.inspectLogisticDetail("123", true);
  assert.deepEqual(detail.mediaProbe, {
    available: true,
    sourceHost: "thumb110.estoquenow.com.br",
    contentType: "image/jpeg",
    reason: null,
  });
  assert.equal(JSON.stringify(detail).includes("signature=redacted"), false);
});

test("reutiliza detalhe somente entre fotos e mantém a confirmação fresca", async () => {
  let reads = 0;
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/oauth2/token")) return Response.json({ token: "redacted" });
    reads += 1;
    return Response.json({
      order_items: [{
        id: "row-1",
        item_id: "item-1",
        order_id: "order-1",
        item_name: "Mesa",
        item_url_image: "https://media.estoquenow.com.br/mesa.jpg?signature=redacted",
      }],
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  const item = { id: "row-1", itemId: "item-1", orderId: "order-1", name: "Mesa" };
  await Promise.all([
    client.getLogisticItemPhoto("123", item),
    client.getLogisticItemPhoto("123", item),
  ]);
  assert.equal(reads, 1);
  await client.listLogisticItems("123");
  assert.equal(reads, 2);
  await client.getLogisticItemPhoto("123", item);
  assert.equal(reads, 3);
});

test("proxy de foto bloqueia hosts, redirects, tipos e tamanhos inseguros", async () => {
  const noFetch: typeof fetch = async () => {
    assert.fail("não deveria buscar URL rejeitada");
  };
  for (const url of [
    "http://media.estoquenow.com.br/item.jpg",
    "https://evilestoquenow.com.br/item.jpg",
    "https://estoquenow.com.br.evil.test/item.jpg",
    "https://user:pass@estoquenow.com.br/item.jpg",
    "https://estoquenow.com.br:8443/item.jpg",
    "https://thumb110.estoquenow.com.br/item.jpg",
    "https://api.estoquenow.com.br:8443/item.jpg",
    "https://thumb110.estoquenow.com.br:9443/item.jpg",
  ]) await assert.rejects(() => fetchEstoqueNowItemPhoto(url, noFetch));

  let redirects = 0;
  const badRedirect: typeof fetch = async () => {
    redirects += 1;
    return new Response(null, { status: 302, headers: { location: "https://evil.test/item.jpg" } });
  };
  await assert.rejects(
    () => fetchEstoqueNowItemPhoto("https://thumb110.estoquenow.com.br:8443/item.jpg", badRedirect),
    /MEDIA_HOST_NOT_ALLOWED@evil\.test/,
  );
  assert.equal(redirects, 1);

  const response = (body: BodyInit, headers: HeadersInit) =>
    async () => new Response(body, { headers });
  await assert.rejects(
    () => fetchEstoqueNowItemPhoto(
      "https://thumb110.estoquenow.com.br:8443/item.jpg",
      response("html", { "content-type": "text/html" }),
    ),
    /MEDIA_TYPE_INVALID/,
  );
  await assert.rejects(
    () => fetchEstoqueNowItemPhoto(
      "https://thumb110.estoquenow.com.br:8443/item.jpg",
      response("x", { "content-type": "image/jpeg", "content-length": "6000001" }),
    ),
    /MEDIA_TOO_LARGE/,
  );
  await assert.rejects(
    () => fetchEstoqueNowItemPhoto(
      "https://thumb110.estoquenow.com.br:8443/item.jpg",
      response(new Uint8Array(6_000_001), { "content-type": "image/jpeg" }),
    ),
    /MEDIA_TOO_LARGE/,
  );

  const image = await fetchEstoqueNowItemPhoto(
    "https://thumb110.estoquenow.com.br:8443/item.jpg?signature=secret",
    response("ok", { "content-type": "image/webp" }),
  );
  assert.equal(image.contentType, "image/webp");
  assert.equal(image.bytes.byteLength, 2);
});

test("proxy limita concorrência de mídia e repete somente falhas transitórias", async () => {
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const tasks = Array.from({ length: 8 }, () =>
    withEstoqueNowMediaSlot(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
    }),
  );
  while (releases.length < 4) await Promise.resolve();
  assert.equal(peak, 4);
  releases.splice(0).forEach((release) => release());
  while (releases.length < 4) await Promise.resolve();
  releases.splice(0).forEach((release) => release());
  await Promise.all(tasks);
  assert.equal(peak, 4);

  let reads = 0;
  const delays: number[] = [];
  const image = await fetchEstoqueNowItemPhoto(
    "https://thumb110.estoquenow.com.br:8443/item.jpg",
    async () => {
      reads += 1;
      return reads < 3
        ? new Response(null, { status: 503 })
        : new Response("ok", { headers: { "content-type": "image/jpeg" } });
    },
    async (milliseconds) => {
      delays.push(milliseconds);
    },
  );
  assert.equal(reads, 3);
  assert.deepEqual(delays, [250, 500]);
  assert.equal(image.bytes.byteLength, 2);

  reads = 0;
  await assert.rejects(
    () => fetchEstoqueNowItemPhoto(
      "https://thumb110.estoquenow.com.br:8443/missing.jpg",
      async () => {
        reads += 1;
        return new Response(null, { status: 404 });
      },
      async () => undefined,
    ),
    /MEDIA_FETCH_FAILED/,
  );
  assert.equal(reads, 1);

  const holders: Array<() => void> = [];
  const activeHolders = Array.from({ length: 4 }, () =>
    withEstoqueNowMediaSlot(
      () => new Promise<void>((resolve) => holders.push(resolve)),
    ),
  );
  while (holders.length < 4) await Promise.resolve();
  const queued = Array.from({ length: 32 }, () =>
    withEstoqueNowMediaSlot(async () => undefined, 1_000),
  );
  await assert.rejects(
    () => withEstoqueNowMediaSlot(async () => undefined, 1_000),
    /MEDIA_QUEUE_BUSY/,
  );
  holders.splice(0).forEach((release) => release());
  await Promise.all([...activeHolders, ...queued]);

  const timeoutHolders: Array<() => void> = [];
  const activeTimeoutHolders = Array.from({ length: 4 }, () =>
    withEstoqueNowMediaSlot(
      () => new Promise<void>((resolve) => timeoutHolders.push(resolve)),
    ),
  );
  while (timeoutHolders.length < 4) await Promise.resolve();
  await assert.rejects(
    () => withEstoqueNowMediaSlot(async () => undefined, 1),
    /MEDIA_QUEUE_BUSY/,
  );
  timeoutHolders.splice(0).forEach((release) => release());
  await Promise.all(activeTimeoutHolders);
});

test("detalhe de foto normaliza timeout, rede, 429 e 5xx como indisponibilidade transitória", async () => {
  for (const failure of [
    () => new Response(null, { status: 429 }),
    () => new Response(null, { status: 503 }),
    () => { throw new TypeError("network unavailable"); },
    () => { const error = new Error("timed out"); error.name = "TimeoutError"; throw error; },
  ]) {
    let authenticated = false;
    const client = new EstoqueNowClient({
      clientId: "id",
      clientSecret: "secret",
      sleep: async () => undefined,
      fetchImpl: async (input) => {
        if (String(input).endsWith("/oauth2/token")) {
          authenticated = true;
          return Response.json({ token: "token", expires: "2099-01-01 00:00:00" });
        }
        return failure();
      },
    });
    await assert.rejects(
      () => client.getLogisticItemPhoto(
        "123",
        { id: "row-1", itemId: "item-1", orderId: "order-1", name: "Mesa" },
      ),
      /ESTOQUENOW_PHOTO_SOURCE_UNAVAILABLE/,
    );
    assert.equal(authenticated, true);
  }
});

test("pagina a listagem sem duplicar IDs", async () => {
  const pages: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token"))
      return Response.json({ access_token: "token", expires_in: 1800 });
    const page = new URL(url).searchParams.get("page") ?? "";
    pages.push(page);
    return Response.json({
      data:
        page === "1"
          ? Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }))
          : [{ id: 50 }, { id: 51 }],
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  const operations = await client.listLogistics("01/08/2026", "31/08/2026");
  assert.deepEqual(pages, ["1", "2"]);
  assert.equal(operations.length, 51);
});

test("respeita paginação real do servidor e redige valores do contrato", async () => {
  const pages: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token"))
      return Response.json({ access_token: "token", expires_in: 1800 });
    const page = new URL(url).searchParams.get("page") ?? "";
    pages.push(page);
    const start = page === "1" ? 1 : 26;
    const count = page === "1" ? 25 : 22;
    return Response.json({
      page: Number(page),
      perPage: 25,
      recordsTotal: 47,
      recordsFiltered: 47,
      data: Array.from({ length: count }, (_, index) => ({
        id: start + index,
        event_name: "Nome privado",
        delivery_date: "31/08/2026",
        delivery_time: "manha",
      })),
    });
  };
  const result = await new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
  }).listLogisticsWithContract("01/08/2026", "31/08/2026");
  assert.deepEqual(pages, ["1", "2"]);
  assert.equal(result.operations.length, 47);
  assert.equal(JSON.stringify(result.contract).includes("Nome privado"), false);
  assert.deepEqual(
    result.contract.fields.find((field) => field.path === "data.[].delivery_time")?.signatures,
    ["turno"],
  );
  assert.deepEqual(result.contract.facets, []);
});

test("expõe somente categorias operacionais explicitamente permitidas", async () => {
  const fetchImpl: typeof fetch = async (input) =>
    String(input).endsWith("/oauth2/token")
      ? Response.json({ access_token: "token", expires_in: 1800 })
      : Response.json({
          data: [
            { type: "delivery", type_name: "Entrega", status_type: "pending", client_name: "Privado" },
            { type: "return", type_name: "Retorno", status_type: "pending", client_phone: "000" },
          ],
        });
  const result = await new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
  }).listLogisticsWithContract("01/08/2026", "31/08/2026");
  assert.deepEqual(result.contract.facets, [
    { field: "type", values: [{ value: "delivery", occurrences: 1 }, { value: "return", occurrences: 1 }] },
    { field: "type_name", values: [{ value: "Entrega", occurrences: 1 }, { value: "Retorno", occurrences: 1 }] },
    { field: "status_type", values: [{ value: "pending", occurrences: 2 }] },
  ]);
  assert.equal(JSON.stringify(result.contract.facets).includes("Privado"), false);
  assert.equal(JSON.stringify(result.contract.facets).includes("000"), false);
});

test("bloqueia escrita por padrão e valida o contrato somente com mock", async () => {
  let called = false;
  const blocked = new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl: async () => {
      called = true;
      return Response.json({});
    },
  });
  await assert.rejects(blocked.confirmDelivery(7, 1), /ESTOQUENOW_WRITE_DISABLED/);
  assert.equal(called, false);

  const requests: Array<{ url: string; body: string }> = [];
  const mocked = new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    writeEnabled: true,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/oauth2/token"))
        return Response.json({ access_token: "mock-token", expires_in: 1800 });
      requests.push({ url, body: String(init?.body) });
      return Response.json({ type: "success" });
    },
  });
  await mocked.confirmDelivery(7, 1);
  await mocked.confirmReturn(7, 0);
  assert.deepEqual(requests, [
    {
      url: "https://api.estoquenow.com.br/v1/logistic/execute_confirmation_delivery/7",
      body: '{"is_concluded_delivery":1}',
    },
    {
      url: "https://api.estoquenow.com.br/v1/logistic/execute_confirmation_return/7",
      body: '{"is_concluded_return":0}',
    },
  ]);
});

test("falha fechada quando o mesmo ID chega com conteúdo conflitante", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token"))
      return Response.json({ access_token: "token", expires_in: 1800 });
    return Response.json({
      data: [
        { id: "duplicado", event_name: "Evento A" },
        { id: "duplicado", event_name: "Evento B" },
      ],
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  await assert.rejects(
    client.listLogistics("01/08/2026", "31/08/2026"),
    /ESTOQUENOW_DUPLICATE_ID_CONFLICT/,
  );
});

test("preserva registros sem ID para que a prévia os conte como inválidos", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token"))
      return Response.json({ access_token: "token", expires_in: 1800 });
    const page = new URL(url).searchParams.get("page");
    return Response.json({
      data: page === "1" ? Array.from({ length: 50 }, () => ({})) : [{}],
    });
  };
  const operations = await new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
  }).listLogistics("01/08/2026", "31/08/2026");
  assert.equal(operations.length, 51);
  assert.equal(operations.every((operation) => operation.id === ""), true);
});

test("preserva ID externo legítimo com prefixo logistica", async () => {
  const fetchImpl: typeof fetch = async (input) =>
    String(input).endsWith("/oauth2/token")
      ? Response.json({ access_token: "token", expires_in: 1800 })
      : Response.json({ data: [{ id: "  logistica-real  " }] });
  const operations = await new EstoqueNowClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
  }).listLogistics("01/08/2026", "31/08/2026");
  assert.equal(operations[0]?.id, "logistica-real");
});

test("falha fechada quando a página máxima também vem cheia", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token"))
      return Response.json({ access_token: "token", expires_in: 1800 });
    const page = Number(new URL(url).searchParams.get("page"));
    return Response.json({
      data: Array.from({ length: 50 }, (_, index) => ({ id: `${page}-${index}` })),
    });
  };
  const client = new EstoqueNowClient({ clientId: "id", clientSecret: "secret", fetchImpl });
  await assert.rejects(
    client.listLogistics("01/08/2026", "31/08/2026"),
    /ESTOQUENOW_PAGE_LIMIT/,
  );
});
