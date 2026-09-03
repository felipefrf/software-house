import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomNavigation } from "@/components/Ui";
import { AppProvider } from "@/context/AppContext";
import { useApp } from "@/context/AppContext";
import "@/lib/route-tracking";
import { colors } from "@/lib/theme";

function AuthenticatedRoutes() {
  const { session, work } = useApp();
  const showNavigation = Boolean(
    session && work?.user.must_change_password !== true,
  );
  return (
    <View style={styles.shell}>
      <View style={styles.routes}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ground },
          }}
        />
      </View>
      {showNavigation ? <BottomNavigation /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.ground },
  routes: { flex: 1 },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <AuthenticatedRoutes />
      </AppProvider>
    </SafeAreaProvider>
  );
}
