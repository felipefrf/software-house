import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readThroughItemPhotoCache } from "../../api/imperio/item-photo/cache.ts";

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

test("a agenda mantém sete dias e mostra cada operação no horário real", async () => {
  const dashboard = await readFile(
    new URL("./web-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /Array\.from\(\{ length: 7 \}/);
  assert.match(dashboard, /grid-cols-7/);
  assert.match(dashboard, /Date\.parse\(a\.scheduled_at\) - Date\.parse\(b\.scheduled_at\)/);
  assert.doesNotMatch(dashboard, /const slots = \[0, 6, 12, 18\]/);
  assert.doesNotMatch(dashboard, /hour < slot \+ 6/);
  assert.doesNotMatch(dashboard, /weekendOperations/);
});

test("estados dinâmicos de filtros, fotos e abas têm saída explícita", async () => {
  const [dashboard, field] = await Promise.all([
    readFile(new URL("./web-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("./field-app.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /const \[filtersOpen, setFiltersOpen\]/);
  assert.match(dashboard, /detailOpen && !filtersOpen \? "hidden"/);
  assert.match(dashboard, /onLoad=\{\(\) => setState\("loaded"\)\}/);
  assert.match(dashboard, /onError=\{\(\) => setState\("error"\)\}/);
  assert.match(dashboard, /state === "loading" &&/);
  assert.match(dashboard, /state === "error" &&/);
  assert.match(field, /window\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(field, /tabHeadingRef\.current\?\.focus/);
});

test("a torre distingue quem executou de quem ficou responsável", async () => {
  const dashboard = await readFile(
    new URL("./web-dashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /\{event\.actor_name\}/);
  assert.match(dashboard, /responsável \$\{event\.responsible_name\}/);
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
  assert.match(dashboard, /Exige decisão agora/);
  assert.match(dashboard, /Abrir operação/);
  assert.match(dashboard, /a cada 30 segundos/);
  assert.match(dashboard, /A atualização automática falhou/);
  assert.match(dashboard, /Mais filtros/);
  assert.match(dashboard, /Somente \$\{focusedOperation\.event_name\}/);
  assert.match(dashboard, /summary="Resolvidas"/);
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
  assert.match(manifest, /PHOTO_LOAD_CONCURRENCY = 4/);
  assert.match(manifest, /itemIndex < photoLoadLimit/);
  assert.match(manifest, /const photoLoaded = loadedPhotos\.has\(photoKey\)/);
  assert.match(manifest, /\{!photoLoaded && \(/);
  assert.match(manifest, /if \(settledPhotos\.current\.has\(photoKey\)\) return/);
  assert.match(route, /rpc\("set_operation_item_checked"/);
});

test("fotos de itens passam por proxy autenticado e limitado", async () => {
  const [route, manifest] = await Promise.all([
    readFile(new URL("../../api/imperio/item-photo/route.ts", import.meta.url), "utf8"),
    readFile(new URL("./item-manifest.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /auth\.getUser/);
  assert.match(route, /fetchEstoqueNowItemPhoto/);
  assert.match(route, /withEstoqueNowMediaSlot/);
  assert.match(route, /rpc\("claim_estoquenow_item_photo_request"/);
  assert.match(route, /MEDIA_QUEUE_BUSY/);
  assert.match(route, /ESTOQUENOW_PHOTO_SOURCE_UNAVAILABLE/);
  assert.match(route, /data\.imported_at !== version/);
  assert.match(route, /sourceHost/);
  assert.doesNotMatch(route, /pathname|searchParams\.toString/);
  assert.match(route, /x-content-type-options/);
  assert.match(route, /status: transient \? 503 : 404/);
  assert.match(route, /"cache-control": "no-store"/);
  assert.match(manifest, /loading="eager"/);
  assert.ok(
    route.indexOf('rpc("claim_estoquenow_item_photo_request"') <
      route.indexOf("await readThroughItemPhotoCache"),
  );
  assert.ok(
    route.indexOf('rpc("claim_estoquenow_item_photo_request"') <
      route.indexOf("await readEstoqueNowItemPhoto"),
  );
  assert.doesNotMatch(manifest, /setTimeout/);
});

test("cache de fotos evita nova leitura da origem e salva misses", async () => {
  const cached = { bytes: new Uint8Array([1]), contentType: "image/jpeg" };
  let sourceReads = 0;
  let writes = 0;
  assert.equal(
    await readThroughItemPhotoCache(
      async () => cached,
      async () => {
        sourceReads += 1;
        return cached;
      },
      async () => {
        writes += 1;
      },
    ),
    cached,
  );
  assert.equal(sourceReads, 0);
  assert.equal(writes, 0);

  const fetched = { bytes: new Uint8Array([2]), contentType: "image/png" };
  assert.equal(
    await readThroughItemPhotoCache(
      async () => null,
      async () => {
        sourceReads += 1;
        return fetched;
      },
      async () => {
        writes += 1;
      },
    ),
    fetched,
  );
  assert.equal(sourceReads, 1);
  assert.equal(writes, 1);
});

test("integrações expõem saúde sanitizada do pull e fila de revisão", async () => {
  const [dashboard, server, data, types, cron] = await Promise.all([
    readFile(new URL("./web-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("./server.ts", import.meta.url), "utf8"),
    readFile(new URL("./data.ts", import.meta.url), "utf8"),
    readFile(new URL("./types.ts", import.meta.url), "utf8"),
    readFile(new URL("../../api/imperio/estoquenow-pull/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(server, /rpc\("get_estoquenow_sync_health"/);
  assert.match(server, /if \(result\.error\) return null/);
  assert.match(types, /sync_health\?: EstoqueNowSyncHealth \| null/);
  assert.match(types, /pull_apply_enabled: boolean/);
  assert.match(data, /pull_apply_enabled: pullApplyEnabled/);
  assert.match(dashboard, /Conectado, automação saudável/);
  assert.match(dashboard, /Conectado, automação com falha/);
  assert.match(dashboard, /aplicação interna desabilitada/);
  assert.match(dashboard, /Último lote automático/);
  assert.match(dashboard, /45 \* 60 \* 1000/);
  assert.doesNotMatch(server, /demo-item-/);
  assert.match(dashboard, /Buscar alterações sem importar/);
  assert.match(dashboard, /Fila de revisão/);
  assert.match(dashboard, /aria-busy=\{previewRequestState === "loading"\}/);
  assert.match(dashboard, /role="alert"/);
  assert.match(dashboard, /Desatualizado/);
  assert.match(dashboard, /grid-cols-2 gap-3/);
  assert.match(cron, /result\.status === "failed" \? 502 : 200/);
});
