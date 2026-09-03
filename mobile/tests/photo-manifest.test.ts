import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manifesto limita a quatro fotos simultâneas e avança após cada resposta", async () => {
  const screen = await readFile(
    new URL("../app/operation/[id].tsx", import.meta.url),
    "utf8",
  );

  assert.match(screen, /PHOTO_LOAD_CONCURRENCY = 4/);
  assert.match(screen, /itemIndex < photoLoadLimit/);
  assert.match(screen, /const photoLoaded = loadedPhotos\.has\(photoKey\)/);
  assert.match(screen, /\{!photoLoaded \? \(/);
  assert.match(screen, /if \(settledPhotos\.current\.has\(photoKey\)\) return/);
  assert.match(screen, /operation\.id}:\$\{operation\.imported_at/);
  assert.doesNotMatch(screen, /setTimeout/);
});
