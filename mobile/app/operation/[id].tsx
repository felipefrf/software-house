import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrandHeader, Button, Card, Screen, StatusStrip } from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import { operationStages } from "@/lib/types";
import { missingRequiredAssignments, stageLabels } from "@/lib/checklist";
import { colors, fonts } from "@/lib/theme";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
const itemPhotoApi = process.env.EXPO_PUBLIC_IMPERIO_API_URL ?? "https://imperio-logistica.vercel.app";
const PHOTO_LOAD_CONCURRENCY = 4;

export default function OperationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { work, outbox, online, busy, session, setItemChecked, setMessage } = useApp();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const operation = work?.operations.find((item) => item.id === id);
  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const currentIndex = operation ? operationStages.indexOf(operation.stage) : 0;
  const rail = useRef<ScrollView>(null);
  const [railWidth, setRailWidth] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [loadedPhotos, setLoadedPhotos] = useState<Set<string>>(new Set());
  const settledPhotos = useRef(new Set<string>());
  const sourceItems = operation?.estoquenow_context?.items ?? [];
  const manifestPhotoKey = `${operation?.id ?? "unavailable"}:${operation?.imported_at ?? "unversioned"}`;
  const [photoQueue, setPhotoQueue] = useState({
    key: manifestPhotoKey,
    limit: PHOTO_LOAD_CONCURRENCY,
  });

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
  const checkedItems = new Map(
    operation.item_checks.map((item) => [item.source_item_id, item]),
  );
  const checkedCount = sourceItems.filter((item) => checkedItems.has(item.id)).length;
  const checkedPercent = sourceItems.length
    ? Math.round((checkedCount / sourceItems.length) * 100)
    : 0;
  const photoLoadLimit = photoQueue.key === manifestPhotoKey
    ? photoQueue.limit
    : PHOTO_LOAD_CONCURRENCY;
  const advancePhotoQueue = () => setPhotoQueue((current) => ({
    key: manifestPhotoKey,
    limit: Math.min(
      sourceItems.length,
      (current.key === manifestPhotoKey ? current.limit : PHOTO_LOAD_CONCURRENCY) + 1,
    ),
  }));
  const settlePhoto = (photoKey: string, loaded: boolean) => {
    if (settledPhotos.current.has(photoKey)) return;
    settledPhotos.current.add(photoKey);
    if (loaded) setLoadedPhotos((current) => new Set(current).add(photoKey));
    else setFailedPhotos((current) => new Set(current).add(photoKey));
    advancePhotoQueue();
  };

  return (
    <Screen>
      <BrandHeader
        eyebrow={operation.source === "manual" ? "Cadastro interno" : `EstoqueNOW · ${operation.external_id ?? "sem ID"}`}
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
        {sourceItems.length ? (
          <View style={styles.manifest}>
            <View style={styles.manifestHead}>
              <View>
                <Text style={styles.manifestEyebrow}>MANIFESTO DE CARGA</Text>
                <Text style={styles.manifestTitle}>{checkedCount} de {sourceItems.length} conferidos</Text>
              </View>
              <Text style={styles.manifestPercent}>{checkedPercent}%</Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${checkedCount} de ${sourceItems.length} equipamentos conferidos`}
              accessibilityValue={{ min: 0, max: sourceItems.length, now: checkedCount }}
              style={styles.progressTrack}
            >
              <View style={[styles.progressValue, { width: `${checkedPercent}%` }]} />
            </View>
            {!online ? <Text style={styles.offlineNote}>Conecte o aparelho para atualizar a conferência.</Text> : null}
            {sourceItems.map((item, itemIndex) => {
              const check = checkedItems.get(item.id);
              const marked = Boolean(check);
              const disabled = busy || !online || operation.status !== "active";
              const photoKey = `${operation.id}:${operation.imported_at ?? "unversioned"}:${item.id}`;
              const photoLoaded = loadedPhotos.has(photoKey);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marked, disabled }}
                  accessibilityLabel={`${item.name}, ${marked ? "conferido" : "pendente"}`}
                  disabled={disabled}
                  onPress={() => {
                    void setItemChecked(operation.id, item, !marked).catch((error) =>
                      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar este item."),
                    );
                  }}
                  style={({ pressed }) => [
                    styles.itemCard,
                    marked && styles.itemCardChecked,
                    disabled && styles.itemCardDisabled,
                    pressed && !disabled && styles.itemCardPressed,
                  ]}
                >
                  <View style={styles.photoPlaceholder}>
                    {!photoLoaded ? (
                      <>
                        <Text style={styles.photoIcon}>▧</Text>
                        <Text style={styles.photoLabel}>
                          {!online
                            ? "Foto exige conexão"
                            : failedPhotos.has(photoKey)
                              ? "Foto não disponível"
                              : itemIndex < photoLoadLimit
                                ? "Carregando foto"
                                : "Foto aguardando carregamento"}
                        </Text>
                      </>
                    ) : null}
                    {session && online && itemIndex < photoLoadLimit && !failedPhotos.has(photoKey) ? (
                      <Image
                        source={{
                          uri: `${itemPhotoApi}/api/imperio/item-photo?operationId=${encodeURIComponent(operation.id)}&itemId=${encodeURIComponent(item.id)}&version=${encodeURIComponent(operation.imported_at ?? "unversioned")}`,
                          headers: { Authorization: `Bearer ${session.access_token}` },
                        }}
                        accessibilityLabel={`Foto de ${item.name}`}
                        resizeMode="cover"
                        style={styles.photoImage}
                        onLoad={() => settlePhoto(photoKey, true)}
                        onError={() => settlePhoto(photoKey, false)}
                      />
                    ) : null}
                  </View>
                  <View style={styles.itemBody}>
                    <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.itemCode}>Item {item.itemId}</Text>
                    <View style={styles.checkRow}>
                      <View style={[styles.checkbox, marked && styles.checkboxChecked]}>
                        <Text style={styles.checkboxMark}>{marked ? "✓" : ""}</Text>
                      </View>
                      <View style={styles.checkCopy}>
                        <Text style={[styles.checkLabel, marked && styles.checkLabelDone]}>
                          {marked ? "Conferido" : "Marcar como conferido"}
                        </Text>
                        {check ? <Text style={styles.checkTime}>{formatDate(check.checked_at)}</Text> : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
  backLabel: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  eventName: { color: colors.ink, fontFamily: fonts.display, fontSize: 30, lineHeight: 35, fontWeight: "700" },
  destination: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  schedule: { color: colors.green, fontSize: 13, fontWeight: "700", marginTop: 9 },
  cacheAge: { color: colors.muted, fontSize: 12, marginTop: 5 },
  manifest: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  manifestHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  manifestEyebrow: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  manifestTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", marginTop: 4 },
  manifestPercent: { color: colors.green, fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.line },
  progressValue: { height: 8, borderRadius: 4, backgroundColor: colors.green },
  offlineNote: { color: colors.amber, fontSize: 12, lineHeight: 17, padding: 10, borderRadius: 8, backgroundColor: colors.amberSoft },
  itemCard: { minHeight: 112, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface },
  itemCardChecked: { borderColor: "#9fc8b9", backgroundColor: colors.sage },
  itemCardDisabled: { opacity: 0.65 },
  itemCardPressed: { transform: [{ scale: 0.99 }] },
  photoPlaceholder: { width: 96, minHeight: 112, alignItems: "center", justifyContent: "center", gap: 6, padding: 8, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: "#edf1ee" },
  photoImage: { position: "absolute", inset: 0, width: 96, height: 112 },
  photoIcon: { color: colors.muted, fontSize: 25 },
  photoLabel: { color: colors.muted, fontSize: 12, lineHeight: 16, textAlign: "center" },
  itemBody: { flex: 1, minWidth: 0, justifyContent: "space-between", gap: 8, padding: 12 },
  itemName: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "700" },
  itemCode: { color: colors.muted, fontSize: 12, marginTop: 3 },
  checkRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#87988f", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxChecked: { borderColor: colors.green, backgroundColor: colors.green },
  checkboxMark: { color: colors.surface, fontSize: 16, lineHeight: 18, fontWeight: "700" },
  checkCopy: { flex: 1 },
  checkLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  checkLabelDone: { color: colors.green },
  checkTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rail: { paddingVertical: 23, paddingHorizontal: 3, gap: 7 },
  stage: { width: 82, alignItems: "center" },
  node: { width: 44, height: 44, borderRadius: 22, borderColor: colors.line, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  nodeDone: { borderColor: colors.green, backgroundColor: colors.sage },
  nodeActive: { borderColor: colors.green, backgroundColor: colors.green },
  nodeText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  nodeTextDone: { color: colors.green },
  nodeTextActive: { color: colors.surface, fontSize: 15 },
  stageLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 8 },
  stageLabelActive: { color: colors.greenDark },
  nextCard: { backgroundColor: colors.sage, borderColor: colors.line },
  eyebrow: { color: colors.green, fontSize: 13, fontWeight: "600" },
  nextTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 25, fontWeight: "700", marginTop: 4 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  assignmentWarning: { marginTop: 13, padding: 12, borderRadius: 10, backgroundColor: colors.amberSoft },
  assignmentWarningTitle: { color: colors.amber, fontSize: 13, fontWeight: "700" },
  assignmentWarningItem: { color: "#705f3d", fontSize: 12, marginTop: 4 },
  buttonGap: { marginTop: 17 },
  buttonGapSmall: { marginTop: 10 },
  contextGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  contextCard: { width: "48%", minHeight: 106, flexGrow: 1 },
  contextLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  contextValue: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 7 },
  contextMeta: { color: colors.green, fontSize: 12, fontWeight: "700", marginTop: 4 },
  notesCard: { marginTop: 12 },
  notes: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 8 },
});
