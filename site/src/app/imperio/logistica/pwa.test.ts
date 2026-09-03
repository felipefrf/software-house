import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("o manifesto abre o app de campo em modo standalone", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../../../public/imperio/logistica.webmanifest", import.meta.url),
      "utf8",
    ),
  ) as {
    display?: string;
    icons?: Array<{ sizes?: string }>;
    start_url?: string;
  };

  assert.equal(manifest.start_url, "/imperio/logistica?surface=field");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(
    new Set(manifest.icons?.map((icon) => icon.sizes)),
    new Set(["192x192", "512x512"]),
  );
});

test("a agenda mantém sábado e domingo na grade principal", async () => {
  const dashboard = await readFile(
    new URL("./web-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /Array\.from\(\{ length: 7 \}/);
  assert.match(dashboard, /repeat\(7,minmax\(140px,1fr\)\)/);
  assert.doesNotMatch(dashboard, /weekendOperations/);
});

test("a torre distingue quem executou de quem ficou responsável", async () => {
  const dashboard = await readFile(
    new URL("./web-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /Executado por \{event\.actor_name\}/);
  assert.match(dashboard, /Responsável: \{event\.responsible_name\}/);
});

test("a torre 1B expõe busca, filtros, decisões e navegação cruzada", async () => {
  const dashboard = await readFile(
    new URL("./web-dashboard.tsx", import.meta.url),
    "utf8",
  );
  const workspace = await readFile(
    new URL("./workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /Buscar operação/);
  assert.match(dashboard, /Risco operacional/);
  assert.match(dashboard, /Bloqueios prioritários/);
  assert.match(dashboard, /Abrir operação/);
  assert.match(dashboard, /Atualização automática ativa a cada 30 segundos/);
  assert.match(dashboard, /Modo demonstrativo: os dados desta tela não são atualizados/);
  assert.match(dashboard, /Filtros avançados/);
  assert.match(dashboard, /group-open:grid/);
  assert.match(dashboard, /Mostrando somente/);
  assert.match(dashboard, /Histórico resolvido/);
  assert.match(dashboard, /A operação selecionada está fora dos filtros/);
  assert.match(workspace, /window\.setInterval\(refreshWhenVisible, 30_000\)/);
  assert.match(workspace, /prioritizeOperations/);
});

test("ocorrências passam pela RPC idempotente", async () => {
  const route = await readFile(
    new URL("../../api/imperio/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /rpc\("create_operation_incident"/);
  assert.doesNotMatch(route, /from\("incidents"\)\.insert/);
});

test("reenvio de ação exige o mesmo ator", async () => {
  const route = await readFile(
    new URL("../../api/imperio/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /select\("id,operation_id,stage,actor_id"\)/);
  assert.match(route, /existing\.data\.actor_id !== auth\.user\.id/);
});

test("manifesto de carga expõe progresso e checkbox acessível", async () => {
  const manifest = await readFile(
    new URL("./item-manifest.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../../api/imperio/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(manifest, /role="progressbar"/);
  assert.match(manifest, /type="checkbox"/);
  assert.match(manifest, /Foto não disponível/);
  assert.match(route, /rpc\("set_operation_item_checked"/);
});

test("fotos de itens passam por proxy autenticado e limitado", async () => {
  const route = await readFile(
    new URL("../../api/imperio/item-photo/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /auth\.getUser/);
  assert.match(route, /fetchEstoqueNowItemPhoto/);
  assert.match(route, /data\.imported_at !== version/);
  assert.match(route, /sourceHost/);
  assert.doesNotMatch(route, /pathname|searchParams\.toString/);
  assert.match(route, /x-content-type-options/);
});
