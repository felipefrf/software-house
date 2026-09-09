import * as Linking from "expo-linking";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  BrandHeader,
  Button,
  Card,
  Disclosure,
  Screen,
  StatusStrip,
} from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import { stageLabels } from "@/lib/checklist";
import { supabase } from "@/lib/supabase";
import { colors, fonts } from "@/lib/theme";
import type { OperationEvent } from "@/lib/types";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));

export default function EvidenceScreen() {
  const { work, outbox, online, busy, workError, refresh } = useApp();
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");
  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const events = work?.events ?? [];

  const openPhoto = async (event: OperationEvent) => {
    if (!supabase || !online) return;
    setOpeningId(event.id);
    setError("");
    try {
      const signed = await supabase.storage
        .from("operation-evidence")
        .createSignedUrl(event.photo_path, 60);
      if (signed.error || !signed.data?.signedUrl)
        throw new Error("Não foi possível autorizar esta foto.");
      await Linking.openURL(signed.data.signedUrl);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível abrir a foto.",
      );
    } finally {
      setOpeningId("");
    }
  };

  return (
    <Screen>
      <BrandHeader title="Histórico" />
      <StatusStrip online={online} pending={pending} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Registros recebidos</Text>
        <Text style={styles.copy}>
          Veja as etapas confirmadas e suas fotos. Registros que ainda não chegaram ficam na aba Envios.
        </Text>
        {work ? (
          <Text style={styles.freshness}>
            {online && !workError ? "Última consulta" : "Cópia salva"} ·{" "}
            {formatDate(work.fetchedAt)}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <View style={styles.refreshGap}>
          <Button
            label="Atualizar evidências"
            variant="secondary"
            disabled={!online}
            busy={busy}
            onPress={() =>
              void refresh().catch((failure) =>
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Não foi possível atualizar as evidências.",
                ),
              )
            }
          />
        </View>

        {events.length ? (
          <View style={styles.list}>
            {events.map((event) => {
              const operation = work?.operations.find(
                (item) => item.id === event.operation_id,
              );
              const actor = work?.people.find((person) => person.id === event.actor_id);
              const responsible = work?.people.find(
                (person) => person.id === event.responsible_id,
              );
              return (
                <Card key={event.id} style={styles.item}>
                  <Text style={styles.operation}>
                    {operation?.event_name ?? "Operação autorizada"}
                  </Text>
                  <View style={styles.row}>
                    <Text style={styles.stage}>{stageLabels[event.stage]}</Text>
                    <Text style={styles.confirmed}>Confirmada</Text>
                  </View>
                  <Text style={styles.meta}>
                    Capturada em {formatDate(event.device_captured_at)}
                  </Text>
                  <Disclosure title="Detalhes do registro">
                  <Text style={styles.meta}>
                    Servidor recebeu em {formatDate(event.server_received_at)}
                  </Text>
                  <Text style={styles.meta}>
                    Responsável: {responsible?.full_name ?? "Perfil autorizado"}
                  </Text>
                  <Text style={styles.meta}>
                    Enviada por: {actor?.full_name ?? "Perfil autorizado"}
                  </Text>
                  <Text style={styles.meta}>
                    GPS {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)} ·
                    precisão {Math.round(event.accuracy)} m
                  </Text>
                  </Disclosure>
                  {event.note ? <Text style={styles.note}>{event.note}</Text> : null}
                  <View style={styles.buttonGap}>
                    <Button
                      label="Ver foto"
                      variant="secondary"
                      disabled={!online}
                      busy={openingId === event.id}
                      onPress={() => void openPhoto(event)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhuma evidência confirmada</Text>
            <Text style={styles.emptyCopy}>
              Depois de concluir uma etapa e enviar seu registro, a confirmação aparecerá aqui.
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 24, lineHeight: 31, fontWeight: "600" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 6 },
  freshness: { color: colors.green, fontSize: 14, fontWeight: "600", marginTop: 10 },
  error: { color: colors.danger, fontSize: 15, marginTop: 14 },
  refreshGap: { marginTop: 14 },
  list: { marginTop: 16, gap: 10 },
  item: { padding: 15 },
  operation: { color: colors.ink, fontFamily: fonts.display, fontSize: 18, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 7,
  },
  stage: { color: colors.greenDark, fontSize: 15, fontWeight: "600" },
  confirmed: { color: colors.green, fontSize: 14, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 5 },
  note: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.sage,
  },
  buttonGap: { marginTop: 13 },
  empty: { marginTop: 18, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 20, fontWeight: "600" },
  emptyCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 6,
  },
});
