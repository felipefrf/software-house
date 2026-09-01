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
