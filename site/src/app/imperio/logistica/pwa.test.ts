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
