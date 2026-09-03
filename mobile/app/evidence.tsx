import * as Linking from "expo-linking";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  BrandHeader,
  Button,
  Card,
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
      <BrandHeader eyebrow="Confirmações persistidas" title="Evidências" />
      <StatusStrip online={online} pending={pending} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ações confirmadas pelo servidor.</Text>
        <Text style={styles.copy}>
          Esta lista vem de operation_events e pode incluir ações enviadas por outros
          aparelhos autorizados. As fotos privadas abrem com um link válido por 60
          segundos.
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
                  {event.note ? <Text style={styles.note}>{event.note}</Text> : null}
                  <View style={styles.buttonGap}>
                    <Button
                      label="Abrir foto privada"
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
              Uma evidência só aparece aqui depois que a RPC confirma a ação no
              servidor.
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 29, lineHeight: 34, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  freshness: { color: colors.green, fontSize: 11, fontWeight: "700", marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, marginTop: 14 },
  refreshGap: { marginTop: 14 },
  list: { marginTop: 16, gap: 10 },
  item: { padding: 15 },
  operation: { color: colors.ink, fontFamily: fonts.display, fontSize: 18, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 7,
  },
  stage: { color: colors.purple, fontSize: 12, fontWeight: "800" },
  confirmed: { color: colors.green, fontSize: 11, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  note: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.sage,
  },
  buttonGap: { marginTop: 13 },
  empty: { marginTop: 18, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 20, fontWeight: "700" },
  emptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
});
