import assert from "node:assert/strict";
import test from "node:test";

import { EstoqueNowClient, normalizeLogistics } from "./estoquenow.ts";

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
  assert.equal(operations[0]?.coordinator, "Não informado");
});

test("reutiliza token e renova uma vez após 401", async () => {
  let tokens = 0;
  let reads = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/oauth2/token")) {
      tokens += 1;
      return Response.json({ access_token: `token-${tokens}`, expires_in: 1800 });
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
