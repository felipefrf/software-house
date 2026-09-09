import { useState, type PropsWithChildren, type ReactNode } from "react";
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
        <Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
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
        <ActivityIndicator color={colors.muted} />
      ) : (
        <Text style={[styles.buttonText, primary && styles.buttonTextPrimary, variant === "danger" && styles.buttonTextDanger, disabled && styles.buttonTextDisabled]}>
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
      accessibilityLabel={`${online ? "Com conexão" : "Sem conexão"}. ${pending ? `${pending} registros para enviar` : "Nada para enviar"}.`}
      style={styles.statusStrip}
    >
      <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.amber }]} />
      <Text style={styles.statusText}>{online ? "Com conexão" : "Sem conexão"}</Text>
      <Text style={styles.statusQueue}>
        {pending ? `${pending} para enviar` : "Nada para enviar"}
      </Text>
    </View>
  );
}

export function Disclosure({ title, children }: PropsWithChildren<{ title: string }>) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.disclosure}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded}
      accessibilityLabel={title} onPress={() => setExpanded(value => !value)}
      style={styles.disclosureToggle}>
      <Text style={styles.disclosureTitle}>{title}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.disclosureTitle}>{expanded ? "−" : "+"}</Text>
    </Pressable>
    {expanded ? <View style={styles.disclosureBody}>{children}</View> : null}
  </View>;
}

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    { id: "today" as const, label: "Meu turno", path: "/" as const },
    { id: "evidence" as const, label: "Histórico", path: "/evidence" as const },
    { id: "queue" as const, label: "Envios", path: "/queue" as const },
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
  disclosure: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
  disclosureToggle: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  disclosureTitle: { color: colors.greenDark, fontSize: 16, lineHeight: 23, fontWeight: "500", flexShrink: 1 },
  disclosureBody: { paddingBottom: 12 },
  screen: { flex: 1, backgroundColor: colors.ground },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  headerTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, lineHeight: 28, fontWeight: "600", letterSpacing: -0.2, marginTop: 1 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    ...shadow,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonPrimary: { backgroundColor: colors.green, borderColor: colors.green },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonDanger: { borderColor: "#e1bbb7", backgroundColor: "#fff8f7" },
  buttonDisabled: { backgroundColor: colors.line, borderColor: colors.line },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: colors.greenDark, fontWeight: "600", fontSize: 16, lineHeight: 22 },
  buttonTextPrimary: { color: colors.surface },
  buttonTextDanger: { color: colors.danger },
  buttonTextDisabled: { color: colors.muted },
  statusStrip: {
    minHeight: 40,
    marginHorizontal: 20,
    marginTop: 0,
    paddingHorizontal: 0,
    backgroundColor: colors.ground,
    flexWrap: "wrap",
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: colors.ink, fontWeight: "400", fontSize: 13 },
  statusQueue: { marginLeft: "auto", color: colors.muted, fontSize: 13 },
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
  navigationItemActive: { backgroundColor: colors.sage, borderTopWidth: 3, borderTopColor: colors.green },
  navigationLabel: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  navigationLabelActive: { color: colors.greenDark },
});
