import { Platform } from "react-native";

export const colors = {
  ground: "#f4f6f4",
  surface: "#ffffff",
  ink: "#17231f",
  muted: "#64716b",
  line: "#d7dfd9",
  green: "#237452",
  greenDark: "#173d34",
  sage: "#edf3ee",
  amber: "#8a5a00",
  amberSoft: "#fff7e6",
  danger: "#9b3b32",
} as const;

export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
} as const;

export const shadow = {
  shadowColor: "#17231f",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 14,
  elevation: 2,
} as const;
