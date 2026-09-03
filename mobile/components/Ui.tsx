import type { PropsWithChildren, ReactNode } from "react";
import { usePathname, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fonts, shadow } from "@/lib/theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      {children}
    </SafeAreaView>
  );
}

export function BrandHeader({
  eyebrow = "Império Eventos",
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  busy = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.surface : colors.greenDark} />
      ) : (
        <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusStrip({ online, pending }: { online: boolean; pending: number }) {
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${online ? "Com conexão" : "Sem conexão"}. ${pending ? `${pending} ações na fila` : "Fila local vazia"}.`}
      style={styles.statusStrip}
    >
      <View style={[styles.dot, { backgroundColor: online ? colors.green : colors.amber }]} />
      <Text style={styles.statusText}>{online ? "Com conexão" : "Sem conexão"}</Text>
      <Text style={styles.statusQueue}>
        {pending ? `${pending} na fila` : "Fila local vazia"}
      </Text>
    </View>
  );
}

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    { id: "today" as const, label: "Hoje", path: "/" as const },
    { id: "evidence" as const, label: "Evidências", path: "/evidence" as const },
    { id: "queue" as const, label: "Fila", path: "/queue" as const },
  ];
  const current = pathname.startsWith("/evidence")
    ? "evidence"
    : pathname.startsWith("/queue")
      ? "queue"
      : "today";
  return (
    <SafeAreaView edges={["bottom"]} style={styles.navigationSafeArea}>
      <View accessibilityRole="tablist" style={styles.navigation}>
        {items.map((item) => {
          const selected = item.id === current;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => router.replace(item.path)}
              style={[styles.navigationItem, selected && styles.navigationItemActive]}
            >
              <Text
                style={[
                  styles.navigationLabel,
                  selected && styles.navigationLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  headerTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 24, fontWeight: "700", marginTop: 1 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    ...shadow,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonPrimary: { backgroundColor: colors.purple, borderColor: colors.purple },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonDanger: { borderColor: "#e1bbb7", backgroundColor: "#fff8f7" },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: colors.greenDark, fontWeight: "700", fontSize: 15 },
  buttonTextPrimary: { color: colors.surface },
  statusStrip: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  statusQueue: { marginLeft: "auto", color: colors.muted, fontSize: 12 },
  navigationSafeArea: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navigation: {
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    backgroundColor: colors.surface,
  },
  navigationItem: {
    flex: 1,
    minHeight: 52,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  navigationItemActive: { backgroundColor: colors.sage },
  navigationLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  navigationLabelActive: { color: colors.greenDark },
});
