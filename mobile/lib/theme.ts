// App de campo: superfícies neutras, azul para ação e cores de estado com contraste.
// Os nomes legados green/sage são mantidos para não alterar os consumidores.
export const colors = {
  ground: "#f2f5f8",
  surface: "#ffffff",
  ink: "#243247",
  muted: "#59697b",
  line: "#dce3eb",
  lineStrong: "#8796a8",
  green: "#245a91",
  greenDark: "#204b76",
  sage: "#eaf1f9",
  success: "#28705a",
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
  shadowOpacity: 0,
  shadowRadius: 12,
  elevation: 0,
} as const;
