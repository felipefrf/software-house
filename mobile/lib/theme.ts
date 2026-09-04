// Tokens alinhados ao DESIGN.md da torre web: papel quente, verde Império como única cor
// de ação, âmbar para atenção, vermelho para crítico. Uma família tipográfica (sistema).
export const colors = {
  ground: "#f6f4ef",
  surface: "#ffffff",
  ink: "#17211d",
  muted: "#5a645e",
  line: "#e3dfd6",
  lineStrong: "#c4bfb3",
  green: "#1f5c46",
  greenDark: "#173d34",
  sage: "#e3efe8",
  amber: "#8f4c00",
  amberSoft: "#fbf0dc",
  danger: "#a63a30",
  dangerSoft: "#fae8e5",
} as const;

// Sem serifa: títulos usam a sans do sistema com peso, não família, para hierarquia.
export const fonts = {
  display: undefined,
} as const;

export const radius = { control: 12, card: 16, pill: 999 } as const;

export const shadow = {
  shadowColor: "#17211d",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;
