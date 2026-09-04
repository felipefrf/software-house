import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  BrandHeader,
  Button,
  Card,
  Screen,
  StatusStrip,
} from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import { stageLabels } from "@/lib/checklist";
import { splitActiveOperations } from "@/lib/schedule";
import { colors, fonts } from "@/lib/theme";
import type { Operation } from "@/lib/types";

const portalUrl =
  "https://imperio-logistica.vercel.app/imperio/logistica?surface=field";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function Login() {
  const { busy, signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível entrar.",
      );
    }
  };

  return (
    <Screen>
      <View style={styles.centered}>
        <Card style={styles.loginCard}>
          <Text style={styles.eyebrow}>Império logística</Text>
          <Text style={styles.loginTitle}>Acesse sua operação</Text>
          <Text style={styles.loginCopy}>
            Entre com o e-mail e a senha criados pelo gestor.
          </Text>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            accessibilityLabel="E-mail"
          />
          <Text style={styles.label}>Senha</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            accessibilityLabel="Senha"
          />
          <View style={styles.buttonGap}>
            <Button
              label="Entrar"
              busy={busy}
              disabled={!email.trim() || !password}
              onPress={() => void submit()}
            />
          </View>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

function OperationList({
  operations,
  onOpen,
}: {
  operations: Operation[];
  onOpen: (operation: Operation) => void;
}) {
  return (
    <View style={styles.operationList}>
      {operations.map((operation) => (
        <Pressable
          key={operation.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${operation.event_name}, etapa ${stageLabels[operation.stage]}`}
          style={({ pressed }) => [styles.operationRow, pressed && styles.pressed]}
          onPress={() => onOpen(operation)}
        >
          <View style={styles.timeColumn}>
            <Text style={styles.time}>{formatDate(operation.scheduled_at)}</Text>
          </View>
          <View style={styles.operationCopy}>
            <Text style={styles.operationName}>{operation.event_name}</Text>
            <Text style={styles.operationDestination} numberOfLines={2}>
              {operation.destination}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.stagePill}>{stageLabels[operation.stage]}</Text>
              <Text
                style={operation.source === "manual" ? styles.manual : styles.imported}
              >
                {operation.source === "manual" ? "Origem manual" : "EstoqueNOW"}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const {
    configured,
    ready,
    session,
    work,
    outbox,
    online,
    busy,
    message,
    workResolved,
    workError,
    setMessage,
    refresh,
    signOut,
  } = useApp();

  const logout = async () => {
    try {
      await signOut();
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Não foi possível encerrar a sessão.",
      );
    }
  };

  const operationGroups = useMemo(() => {
    return splitActiveOperations(work?.operations ?? []);
  }, [work?.operations]);
  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const totalActive = operationGroups.current.length + operationGroups.upcoming.length;
  const openOperation = (operation: Operation) =>
    router.push({ pathname: "/operation/[id]", params: { id: operation.id } });

  if (!ready)
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loading}>Abrindo seu turno...</Text>
        </View>
      </Screen>
    );

  if (!configured)
    return (
      <Screen>
        <View style={styles.centered}>
          <Card style={styles.loginCard}>
            <Text style={styles.eyebrow}>Configuração necessária</Text>
            <Text style={styles.loginTitle}>Conecte o projeto Supabase</Text>
            <Text style={styles.loginCopy}>
              Defina EXPO_PUBLIC_SUPABASE_URL e
              EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente do app.
            </Text>
          </Card>
        </View>
      </Screen>
    );

  if (!session) return <Login />;

  if (!work && !workResolved)
    return (
      <Screen>
        <BrandHeader title="App de campo" />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loading}>Carregando operações...</Text>
        </View>
      </Screen>
    );

  if (!work)
    return (
      <Screen>
        <BrandHeader title="App de campo" />
        <View style={styles.centered}>
          <Card style={styles.loginCard}>
            <Text style={styles.eyebrow}>Escala indisponível</Text>
            <Text style={styles.loginTitle}>Não foi possível abrir seu turno</Text>
            <Text style={styles.loginCopy}>
              {workError || "Nenhuma escala foi encontrada neste aparelho."}
            </Text>
            <View style={styles.buttonGap}>
              <Button
                label="Tentar novamente"
                disabled={!online}
                busy={busy}
                onPress={() =>
                  void refresh().catch((failure) =>
                    setMessage(
                      failure instanceof Error
                        ? failure.message
                        : "Não foi possível atualizar.",
                    ),
                  )
                }
              />
            </View>
            {message ? <Text style={styles.error}>{message}</Text> : null}
          </Card>
        </View>
      </Screen>
    );

  if (work.user.must_change_password)
    return (
      <Screen>
        <BrandHeader title="Primeiro acesso" />
        <View style={styles.centered}>
          <Card style={styles.loginCard}>
            <Text style={styles.eyebrow}>Acesso protegido</Text>
            <Text style={styles.loginTitle}>Defina sua senha no portal</Text>
            <Text style={styles.loginCopy}>
              A política atual do backend exige que a primeira troca seja concluída na
              torre web. Volte ao app depois disso.
            </Text>
            <View style={styles.buttonGap}>
              <Button
                label="Abrir portal seguro"
                onPress={() => void Linking.openURL(portalUrl)}
              />
            </View>
            <View style={styles.buttonGapSmall}>
              <Button
                label="Sair"
                variant="secondary"
                onPress={() => void logout()}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );

  return (
    <Screen>
      <BrandHeader title="Seu turno" />
      <StatusStrip online={online} pending={pending} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() =>
              void refresh().catch((failure) =>
                setMessage(
                  failure instanceof Error
                    ? failure.message
                    : "Não foi possível atualizar.",
                ),
              )
            }
            tintColor={colors.green}
          />
        }
      >
        <View style={styles.pageTitleRow}>
          <View style={styles.pageTitleCopy}>
            <Text style={styles.pageTitle}>Operações escaladas</Text>
            <Text style={styles.pageCopy}>Abra uma operação e siga a próxima ação.</Text>
          </View>
          <Text style={styles.identity}>{work.user.full_name}</Text>
        </View>
        <Text style={styles.freshness}>
          {online && !workError
            ? "Dados carregados do servidor"
            : "Cópia salva no aparelho"}{" "}
          · {formatDate(work.fetchedAt)}
        </Text>

        {message ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText} accessibilityLiveRegion="polite">
              {message}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Hoje e atrasadas</Text>
        {operationGroups.current.length ? (
          <OperationList operations={operationGroups.current} onOpen={openOperation} />
        ) : (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {totalActive ? "Nenhuma operação para hoje" : "Nenhuma operação escalada"}
            </Text>
            <Text style={styles.emptyCopy}>
              {totalActive
                ? "As próximas escalas aparecem separadas logo abaixo."
                : "O gestor precisa associar você ou sua equipe a uma operação. Atualize quando a escala for publicada."}
            </Text>
            {!totalActive ? (
              <View style={styles.buttonGap}>
                <Button
                  label="Atualizar escala"
                  variant="secondary"
                  disabled={!online}
                  onPress={() => void refresh().catch(() => undefined)}
                />
              </View>
            ) : null}
          </Card>
        )}

        {operationGroups.upcoming.length ? (
          <>
            <Text style={styles.sectionTitle}>Próximas operações</Text>
            <OperationList operations={operationGroups.upcoming} onOpen={openOperation} />
          </>
        ) : null}

        <Text style={styles.boundary}>
          A fila de ações sincroniza com o app aberto ou ao voltar para o primeiro
          plano. Durante uma rota iniciada com aceite, o GPS continua em segundo plano.
          {pending
            ? " Ao sair, registros não resolvidos permanecem separados para este usuário neste aparelho."
            : ""}
        </Text>
        <Button
          label="Sair deste aparelho"
          variant="secondary"
          onPress={() => void logout()}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  loginCard: { width: "100%", maxWidth: 430, padding: 24 },
  eyebrow: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  loginTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, fontWeight: "700", marginTop: 7 },
  loginCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 12 },
  loading: { color: colors.muted, fontSize: 14, marginTop: 14, textAlign: "center" },
  buttonGap: { marginTop: 22 },
  buttonGapSmall: { marginTop: 10 },
  content: { padding: 16, paddingBottom: 36 },
  pageTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  pageTitleCopy: { flex: 1 },
  pageTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, lineHeight: 34, fontWeight: "700" },
  pageCopy: { color: colors.muted, fontSize: 13, marginTop: 4 },
  identity: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 120,
    textAlign: "right",
  },
  freshness: { color: colors.muted, fontSize: 12, marginTop: 10 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 19, fontWeight: "700", marginTop: 22 },
  notice: {
    backgroundColor: colors.amberSoft,
    borderColor: "#ecd49d",
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginTop: 16,
  },
  noticeText: { color: colors.amber, fontSize: 13, lineHeight: 19 },
  operationList: {
    marginTop: 10,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  operationRow: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pressed: { backgroundColor: colors.sage },
  timeColumn: { width: 72 },
  time: { color: colors.green, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  operationCopy: { flex: 1 },
  operationName: { color: colors.ink, fontFamily: fonts.display, fontSize: 17, fontWeight: "700" },
  operationDestination: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 9,
  },
  stagePill: {
    color: colors.greenDark,
    backgroundColor: colors.sage,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  manual: { color: colors.amber, fontSize: 12, fontWeight: "700" },
  imported: { color: colors.green, fontSize: 12, fontWeight: "700" },
  chevron: { color: colors.greenDark, fontSize: 28, fontWeight: "300" },
  empty: { marginTop: 10, alignItems: "stretch" },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 7,
  },
  boundary: { color: colors.muted, fontSize: 12, lineHeight: 18, marginVertical: 22 },
});
