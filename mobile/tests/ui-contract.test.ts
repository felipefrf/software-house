import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tema nativo usa semântica verde e estados desabilitados sólidos", async () => {
  const [theme, ui, operation] = await Promise.all([
    readFile(new URL("../lib/theme.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/Ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operation/[id].tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(theme, /purple/);
  assert.doesNotMatch(ui, /buttonDisabled: \{ opacity/);
  assert.match(ui, /buttonDisabled: \{ backgroundColor: colors\.line/);
  assert.doesNotMatch(operation, /letterSpacing|textTransform: "uppercase"/);
  assert.doesNotMatch(operation, /fontSize: 10|fontSize: 11/);
});
