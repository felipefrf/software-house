import assert from "node:assert/strict";
import test from "node:test";

import {
  EstoqueNowClient,
  isValidExternalId,
  isValidIsoDate,
  normalizeLogistics,
  sourceFieldsDiverged,
  toScheduledAt,
} from "./estoquenow.ts";

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
  assert.equal(toScheduledAt("31/02/2026", "08:00"), null);
  assert.equal(toScheduledAt("31/08/2026", "24:00"), null);
  assert.equal(toScheduledAt("31/08/2026", "08:00:30"), null);
  assert.equal(toScheduledAt("31/08/2026", ""), null);
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
