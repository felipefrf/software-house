import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { colors } from "../lib/theme";

test("tema nativo mantém estados desabilitados sólidos e títulos sem ruído", async () => {
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

test("texto e ações mantêm contraste de leitura nas superfícies do app", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(start => {
      const value = parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  for (const [foreground, background] of [
    [colors.ink, colors.surface], [colors.muted, colors.ground],
    [colors.muted, colors.surface], [colors.surface, colors.green],
    [colors.greenDark, colors.sage], [colors.danger, colors.dangerSoft],
  ]) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${foreground} on ${background}`);
  }
});

test("login permite rolagem com teclado e próxima ação precede carga", async () => {
  const login = await readFile(new URL("../app/index.tsx", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
  const operation = await readFile(new URL("../app/operation/[id].tsx", import.meta.url), "utf8");
  assert.match(login, /KeyboardAvoidingView.*behavior=\{Platform.OS === "ios" \? "padding" : "height"\}/);
  assert.match(login, /ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle=\{styles.loginContent\}/);
  assert.equal(config.expo.android.softwareKeyboardLayoutMode, "resize");
  assert.ok(operation.indexOf('<Card style={styles.nextCard}>') < operation.indexOf('<View style={styles.manifest}>'));
  assert.match(operation, /Disclosure title="Ver todas as etapas"/);
});
