import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandHeader, Button, Card, Screen, StatusStrip } from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import { operationStages } from "@/lib/types";
import { missingRequiredAssignments, stageLabels } from "@/lib/checklist";
import { colors } from "@/lib/theme";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

export default function OperationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { work, outbox, online } = useApp();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const operation = work?.operations.find((item) => item.id === id);
  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const currentIndex = operation ? operationStages.indexOf(operation.stage) : 0;
  const rail = useRef<ScrollView>(null);
  const [railWidth, setRailWidth] = useState(0);

  useEffect(() => {
    if (!railWidth) return;
    rail.current?.scrollTo({
      x: Math.max(0, currentIndex * 89 - (railWidth - 82) / 2),
      animated: true,
    });
  }, [currentIndex, railWidth]);

  if (!operation)
    return (
      <Screen>
        <BrandHeader title="Operação indisponível" />
        <View style={styles.centered}>
          <Card>
            <Text style={styles.cardTitle}>Esta operação não está mais na sua escala.</Text>
            <Text style={styles.cardCopy}>Atualize a lista ou confirme com o gestor.</Text>
            <View style={styles.buttonGap}>
              <Button label="Voltar ao turno" onPress={() => router.replace("/")} />
            </View>
          </Card>
        </View>
      </Screen>
    );

  const team = work?.teams.find((item) => item.id === operation.team_id);
  const vehicle = work?.vehicles.find((item) => item.id === operation.vehicle_id);
  const driver = work?.people.find((item) => item.id === operation.driver_id);
  const hasCurrentAction = outbox.some(
    (item) =>
      item.operationId === operation.id &&
      item.stage === operation.stage &&
      item.state !== "confirmed",
  );
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(operation.destination)}`;
  const missingAssignments = missingRequiredAssignments(operation);

  return (
    <Screen>
      <BrandHeader
        eyebrow={operation.source === "manual" ? "Manual interna · não originada do EstoqueNOW" : "Origem EstoqueNOW"}
        title="Detalhe da operação"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backLabel}>Voltar</Text>
          </Pressable>
        }
      />
      <StatusStrip online={online} pending={pending} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eventName}>{operation.event_name}</Text>
        <Text style={styles.destination}>{operation.destination}</Text>
        <Text style={styles.schedule}>{formatDate(operation.scheduled_at)}</Text>
        {operation.estoquenow_context ? (
          <Text style={styles.cacheAge}>
            Pedido {operation.estoquenow_context.order_id ?? "não informado"}
            {operation.estoquenow_context.return_at
              ? ` · devolução ${formatDate(operation.estoquenow_context.return_at)}`
              : ""}
            {operation.estoquenow_context.item_count !== null
              ? ` · ${operation.estoquenow_context.item_count} item(ns)`
              : ""}
          </Text>
        ) : null}
        {work ? (
          <Text style={styles.cacheAge}>
            Escala carregada em {formatDate(work.fetchedAt)}
          </Text>
        ) : null}

        <ScrollView
          ref={rail}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          accessibilityLabel="Etapas da operação"
          onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
        >
          {operationStages.map((stage, index) => {
            const state =
              operation.status === "completed" || index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "active"
                  : "pending";
            return (
              <View
                key={stage}
                accessible
                accessibilityLabel={`${stageLabels[stage]}, ${state === "done" ? "concluída" : state === "active" ? "etapa atual" : "pendente"}`}
                style={styles.stage}
              >
                <View
                  style={[
                    styles.node,
                    state === "done" && styles.nodeDone,
                    state === "active" && styles.nodeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeText,
                      state === "done" && styles.nodeTextDone,
                      state === "active" && styles.nodeTextActive,
                    ]}
                  >
                    {state === "done" ? "OK" : index + 1}
                  </Text>
                </View>
                <Text style={[styles.stageLabel, state === "active" && styles.stageLabelActive]}>
                  {stageLabels[stage]}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <Card style={styles.nextCard}>
          <Text style={styles.eyebrow}>Etapa {currentIndex + 1} de {operationStages.length}</Text>
          <Text style={styles.nextTitle}>{stageLabels[operation.stage]}</Text>
          <Text style={styles.cardCopy}>
            {missingAssignments.length
              ? `A torre precisa vincular ${missingAssignments.join(", ")} antes de liberar esta etapa.`
              : hasCurrentAction
              ? "Esta etapa já possui uma ação aguardando confirmação neste aparelho."
              : "Conclua checklist, foto, GPS, horário e responsável para avançar."}
          </Text>
          {missingAssignments.length ? (
            <View style={styles.assignmentWarning}>
              <Text style={styles.assignmentWarningTitle}>Escala incompleta</Text>
              {missingAssignments.map((item) => (
                <Text key={item} style={styles.assignmentWarningItem}>
                  Falta vincular: {item}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.buttonGap}>
            <Button
              label={
                missingAssignments.length
                  ? "Aguardando escala completa"
                  : hasCurrentAction
                    ? "Abrir fila local"
                    : `Abrir ${stageLabels[operation.stage]}`
              }
              disabled={operation.status !== "active" || Boolean(missingAssignments.length)}
              onPress={() =>
                hasCurrentAction
                  ? router.push("/queue")
                  : router.push({ pathname: "/operation/[id]/stage", params: { id: operation.id } })
              }
            />
          </View>
        </Card>

        <View style={styles.contextGrid}>
          <Card style={styles.contextCard}>
            <Text style={styles.contextLabel}>Equipe</Text>
            <Text style={styles.contextValue}>{team?.name ?? "Não escalada"}</Text>
          </Card>
          <Card style={styles.contextCard}>
            <Text style={styles.contextLabel}>Veículo</Text>
            <Text style={styles.contextValue}>{vehicle?.name ?? "Não vinculado"}</Text>
            {vehicle ? <Text style={styles.contextMeta}>{vehicle.plate}</Text> : null}
          </Card>
          <Card style={styles.contextCard}>
            <Text style={styles.contextLabel}>Motorista</Text>
            <Text style={styles.contextValue}>{driver?.full_name ?? "Não vinculado"}</Text>
          </Card>
          <Card style={styles.contextCard}>
            <Text style={styles.contextLabel}>Origem</Text>
            <Text style={styles.contextValue}>
              {operation.source === "manual" ? "Operação interna" : "EstoqueNOW"}
            </Text>
          </Card>
        </View>

        {operation.notes ? (
          <Card style={styles.notesCard}>
            <Text style={styles.contextLabel}>Orientações do gestor</Text>
            <Text style={styles.notes}>{operation.notes}</Text>
          </Card>
        ) : null}

        <View style={styles.buttonGap}>
          <Button label="Abrir rota no Google Maps" variant="secondary" onPress={() => void Linking.openURL(mapsUrl)} />
        </View>
        <View style={styles.buttonGapSmall}>
          <Button
            label="Registrar ocorrência"
            variant="secondary"
            onPress={() => router.push({ pathname: "/operation/[id]/incident", params: { id: operation.id } })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 20, justifyContent: "center" },
  content: { padding: 16, paddingBottom: 38 },
  backButton: { minHeight: 46, minWidth: 58, borderColor: colors.line, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  backLabel: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  eventName: { color: colors.ink, fontSize: 29, lineHeight: 34, fontWeight: "900" },
  destination: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  schedule: { color: colors.green, fontSize: 12, fontWeight: "800", marginTop: 9 },
  cacheAge: { color: colors.muted, fontSize: 11, marginTop: 5 },
  rail: { paddingVertical: 23, paddingHorizontal: 3, gap: 7 },
  stage: { width: 82, alignItems: "center" },
  node: { width: 44, height: 44, borderRadius: 22, borderColor: colors.line, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  nodeDone: { borderColor: colors.green, backgroundColor: colors.sage },
  nodeActive: { borderColor: colors.purple, backgroundColor: colors.purple },
  nodeText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  nodeTextDone: { color: colors.green },
  nodeTextActive: { color: colors.surface, fontSize: 15 },
  stageLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
  stageLabelActive: { color: colors.purple },
  nextCard: { backgroundColor: "#fbfbfe", borderColor: "#d7d1f4" },
  eyebrow: { color: colors.purple, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "800" },
  nextTitle: { color: colors.ink, fontSize: 24, fontWeight: "900", marginTop: 5 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  assignmentWarning: { marginTop: 13, padding: 12, borderRadius: 10, backgroundColor: colors.amberSoft },
  assignmentWarningTitle: { color: colors.amber, fontSize: 12, fontWeight: "900" },
  assignmentWarningItem: { color: "#705f3d", fontSize: 12, marginTop: 4 },
  buttonGap: { marginTop: 17 },
  buttonGapSmall: { marginTop: 10 },
  contextGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  contextCard: { width: "48%", minHeight: 106, flexGrow: 1 },
  contextLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", fontWeight: "700" },
  contextValue: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "800", marginTop: 7 },
  contextMeta: { color: colors.green, fontSize: 11, fontWeight: "700", marginTop: 4 },
  notesCard: { marginTop: 12 },
  notes: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 8 },
});
