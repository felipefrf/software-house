import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  BrandHeader,
  Button,
  Card,
  Screen,
  StatusStrip,
} from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import { stageLabels } from "@/lib/checklist";
import { isRetryable, outboxStateLabel } from "@/lib/outbox-state";
import { colors, fonts } from "@/lib/theme";
import type { OutboxState } from "@/lib/types";

const stateColor: Record<OutboxState, string> = {
  pending: colors.amber,
  sending: colors.green,
  confirmed: colors.green,
  conflict: colors.danger,
  failed: colors.amber,
  discarding: colors.green,
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(
    new Date(value),
  );

export default function QueueScreen() {
  const { outbox, online, busy, message, retry, discard, setMessage } = useApp();
  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const retryable = outbox.some((item) => isRetryable(item.state));
  const runRetry = async (deviceActionId?: string) => {
    try {
      await retry(deviceActionId);
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : "Não foi possível reenviar agora.",
      );
    }
  };
  const runDiscard = async (deviceActionId: string) => {
    try {
      await discard(deviceActionId);
      setMessage("Registro local descartado após revisão.");
    } catch (failure) {
      setMessage(
        failure instanceof Error ? failure.message : "Não foi possível descartar.",
      );
    }
  };

  return (
    <Screen>
      <BrandHeader eyebrow="Envios deste aparelho" title="Fila local" />
      <StatusStrip online={online} pending={pending} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cada ação tem um estado claro.</Text>
        <Text style={styles.copy}>
          O app tenta enviar ao abrir, ao voltar para o primeiro plano, quando a conexão retorna e quando você solicita.
        </Text>

        {message ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText} accessibilityLiveRegion="polite">
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonGap}>
          <Button
            label="Tentar envios pendentes"
            disabled={!online || !retryable}
            busy={busy}
            onPress={() => void runRetry()}
          />
        </View>

        {outbox.length ? (
          <View style={styles.list}>
            {outbox.map((action) => (
              <Card key={action.deviceActionId} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.operation}>{action.operationName}</Text>
                    <Text style={styles.stage}>{stageLabels[action.stage]}</Text>
                  </View>
                  <Text style={[styles.state, { color: stateColor[action.state] }]}>
                    {action.state === "failed" && action.attempts >= 3
                      ? "Pausado: reenvio manual"
                      : outboxStateLabel[action.state]}
                  </Text>
                </View>
                <Text style={styles.meta}>Capturada em {formatDate(action.deviceCapturedAt)}</Text>
                <Text style={styles.meta}>Tentativas: {action.attempts}</Text>
                {action.lastError ? (
                  <Text style={styles.failure} selectable>
                    {action.lastError}
                  </Text>
                ) : null}
                {action.state === "conflict" || action.state === "failed" ? (
                  <>
                    <Text style={styles.conflictHelp}>
                      {action.state === "conflict"
                        ? "Atualize a escala e confirme com a torre. O app não sobrescreve a etapa do servidor."
                        : action.attempts >= 3
                          ? "O reenvio automático parou após três tentativas. Você ainda pode tentar manualmente ou descartar após revisar."
                          : "Você pode tentar novamente ou descartar este registro após revisar."}
                    </Text>
                    <View style={styles.retryGap}>
                      <Button
                        label="Descartar registro"
                        variant="danger"
                        disabled={!online || busy}
                        onPress={() =>
                          Alert.alert(
                            "Descartar registro local?",
                            "Faça isso somente após revisar com a torre. O app tentará remover as cópias local e remota que não estejam confirmadas.",
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Descartar",
                                style: "destructive",
                                onPress: () => void runDiscard(action.deviceActionId),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  </>
                ) : null}
                {isRetryable(action.state) ? (
                  <View style={styles.retryGap}>
                    <Button
                      label="Tentar novamente"
                      variant="secondary"
                      disabled={!online || busy}
                      onPress={() => void runRetry(action.deviceActionId)}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>Fila local vazia</Text>
            <Text style={styles.emptyCopy}>
              As próximas ações feitas no campo aparecerão aqui antes e depois da confirmação.
            </Text>
          </Card>
        )}

        <View style={styles.boundary}>
          <Text style={styles.boundaryTitle}>Limite operacional</Text>
          <Text style={styles.boundaryCopy}>
            Não existe sincronização em background neste corte. Conflitos ficam parados para decisão humana.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, lineHeight: 34, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  notice: { backgroundColor: colors.sage, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 15 },
  noticeText: { color: colors.greenDark, fontSize: 13, lineHeight: 19 },
  buttonGap: { marginTop: 17 },
  list: { marginTop: 14, gap: 10 },
  item: { padding: 15 },
  itemHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  itemCopy: { flex: 1 },
  operation: { color: colors.ink, fontFamily: fonts.display, fontSize: 17, fontWeight: "700" },
  stage: { color: colors.greenDark, fontSize: 13, fontWeight: "700", marginTop: 3 },
  state: { maxWidth: 135, textAlign: "right", fontSize: 12, lineHeight: 16, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 8 },
  failure: { color: colors.danger, backgroundColor: "#fff8f7", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 12, lineHeight: 17 },
  conflictHelp: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 9 },
  retryGap: { marginTop: 12 },
  empty: { marginTop: 18, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 20, fontWeight: "700" },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
  boundary: { marginTop: 22, backgroundColor: colors.amberSoft, borderColor: "#ecd49d", borderWidth: 1, borderRadius: 12, padding: 14 },
  boundaryTitle: { color: colors.amber, fontSize: 13, fontWeight: "700" },
  boundaryCopy: { color: "#705f3d", fontSize: 12, lineHeight: 18, marginTop: 4 },
});
