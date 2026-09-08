import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../../api/imperio/operation-route/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function requestRoute({ user = true, role = "manager", password = false, operation = true, session = true, failure = "" } = {}) {
  const queries: Array<{ table: string; filters: Array<[string, unknown]>; limit?: number }> = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: user ? { id: "manager-id" } : null } }) },
    from: (table: string) => {
      const query: typeof queries[number] = { table, filters: [] };
      queries.push(query);
      const result = () => ({
        error: table === failure ? { message: "private database details" } : null,
        data: table === "profiles" ? { role, must_change_password: password }
          : table === "operations" ? operation ? { id: operationId } : null
          : table === "operation_tracking_sessions" ? session ? [{ id: "session-id", consented_at: "2026-09-08T12:00:00Z", stopped_at: null }] : []
          : Array.from({ length: 101 }, (_, index) => ({ id: String(index) })),
      });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
        order: () => chain,
        limit: (limit: number) => { query.limit = limit; return Promise.resolve(result()); },
        maybeSingle: async () => result(),
      };
      return chain;
    },
  };
  const compiled = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  vm.runInNewContext(source, {
    exports: compiled.exports, URL,
    require: (name: string) => name === "next/server"
      ? { NextResponse: { json: (body: unknown, init: ResponseInit) => Response.json(body, init) } }
      : { createSupabaseServerClient: async () => db },
  });
  const response = await compiled.exports.GET(new Request(`https://example.test/api/imperio/operation-route?operationId=${operationId}`));
  return { response, body: await response.json(), queries };
}

test("rota exige gestor autenticado com senha regularizada antes de ler coordenadas", async () => {
  for (const options of [{ user: false }, { role: "worker" }, { password: true }]) {
    const result = await requestRoute(options);
    assert.equal(result.response.status, options.user === false ? 401 : 403);
    assert.equal(result.queries.some(query => query.table.includes("tracking") || query.table.includes("route_points")), false);
    assert.match(result.response.headers.get("cache-control")!, /no-store/);
  }
});

test("rota limita leitura à operação acessível e à última sessão sem expor erros internos", async () => {
  const missing = await requestRoute({ operation: false });
  assert.equal(missing.response.status, 404);
  assert.equal(missing.queries.length, 2);
  const failed = await requestRoute({ failure: "operation_tracking_sessions" });
  assert.equal(failed.response.status, 503);
  assert.equal(JSON.stringify(failed.body).includes("private database details"), false);
  const empty = await requestRoute({ session: false });
  assert.deepEqual(empty.body, { session: null, points: [], truncated: false });
  const success = await requestRoute();
  assert.equal(success.body.points.length, 100);
  assert.equal(success.body.truncated, true);
  assert.deepEqual(success.queries.at(-1)?.filters, [["operation_id", operationId], ["session_id", "session-id"]]);
  assert.equal(success.queries.at(-1)?.limit, 101);
});
