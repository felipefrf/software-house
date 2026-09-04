import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PhotoCapture } from "@/components/PhotoCapture";
import { BrandHeader, Button, Card, Screen, StatusStrip } from "@/components/Ui";
import { useApp } from "@/context/AppContext";
import {
  checklistByStage,
  missingRequiredAssignments,
  stageRequirementProgress,
  stageLabels,
} from "@/lib/checklist";
import { ROUTE_TRACKING_TERMS_TEXT } from "@/lib/route-tracking-policy";
import { colors, fonts } from "@/lib/theme";
import type { LocationEvidence, OutboxAction } from "@/lib/types";

export default function StageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { work, outbox, online, busy, enqueue, setMessage } = useApp();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const operation = work?.operations.find((item) => item.id === id);
  const [deviceActionId] = useState(() => Crypto.randomUUID());
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationEvidence | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [arrivalAccess, setArrivalAccess] = useState<"released" | "blocked" | "">("");
  const [arrivalReason, setArrivalReason] = useState("");
  const [acceptanceName, setAcceptanceName] = useState("");
  const [trackingTermsAccepted, setTrackingTermsAccepted] = useState(false);
  const [error, setError] = useState("");

  const captureLocation = useCallback(async () => {
    setError("");
    setLocationDenied(false);
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationDenied(true);
        throw new Error("Libere a localização durante o uso para registrar a ação.");
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 0,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "GPS indisponível.");
    } finally {
      setLocationBusy(false);
    }
  }, []);

  const responsiblePeople = useMemo(() => {
    if (!operation || !work) return [];
    if (work.user.role === "manager") return work.people;
    const team = work.teams.find((item) => item.id === operation.team_id);
    const allowed = new Set([
      work.user.id,
      operation.driver_id ?? "",
      ...(team?.member_ids ?? []),
    ]);
    return work.people.filter((person) => allowed.has(person.id));
  }, [operation, work]);

  useEffect(() => {
    if (!operation || operation.stage === "preparation") return;
    if (operation.stage === "departure" && !trackingTermsAccepted) return;
    void captureLocation();
  }, [captureLocation, operation, trackingTermsAccepted]);

  if (!operation || !work)
    return (
      <Screen>
        <BrandHeader title="Etapa indisponível" />
        <View style={styles.centered}>
          <Button label="Voltar ao turno" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );

  const missingAssignments = missingRequiredAssignments(operation);
  const pending = outbox.filter((item) => item.state !== "confirmed").length;

  if (missingAssignments.length)
    return (
      <Screen>
        <BrandHeader
          eyebrow={`Etapa bloqueada · ${operation.event_name}`}
          title={stageLabels[operation.stage]}
        />
        <StatusStrip online={online} pending={pending} />
        <View style={styles.centered}>
          <Card>
            <Text style={styles.warningTitle}>Complete a escala na torre</Text>
            <Text style={styles.warningCopy}>
              Esta etapa exige equipe, veículo e motorista antes de qualquer foto ou
              GPS.
            </Text>
            {missingAssignments.map((item) => (
              <Text key={item} style={styles.missingItem}>
                Falta vincular: {item}
              </Text>
            ))}
            <View style={styles.buttonGap}>
              <Button label="Voltar à operação" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </Screen>
    );

  const effectiveResponsible =
    responsibleId ||
    responsiblePeople.find((person) => person.id === operation.driver_id)?.id ||
    responsiblePeople.find((person) => person.id === work.user.id)?.id ||
    responsiblePeople[0]?.id ||
    "";
  const duplicate = outbox.some(
    (item) =>
      item.operationId === operation.id &&
      item.stage === operation.stage &&
      item.state !== "confirmed",
  );
  const arrivalValid =
    operation.stage !== "arrival" ||
    (arrivalAccess === "released" ||
      (arrivalAccess === "blocked" && arrivalReason.trim().length >= 3));
  const acceptanceValid =
    operation.stage !== "delivery" || acceptanceName.trim().length >= 2;
  const progress = stageRequirementProgress({
    stage: operation.stage,
    checklist,
    hasPhoto: Boolean(photoUri),
    hasLocation: Boolean(location),
    hasResponsible: Boolean(effectiveResponsible),
    arrivalValid,
    acceptanceValid,
  });
  const trackingConsentRequired = operation.stage === "departure";
  const trackingConsentValid = !trackingConsentRequired || trackingTermsAccepted;
  const missingRequirements = [
    ...progress.missing,
    ...(trackingConsentValid ? [] : ["Aceite dos termos de rastreamento"]),
  ];
  const completedRequirements =
    progress.completed + (trackingConsentRequired && trackingTermsAccepted ? 1 : 0);
  const totalRequirements = progress.total + (trackingConsentRequired ? 1 : 0);
  const complete = missingRequirements.length === 0;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(operation.destination)}`;

  const submit = async () => {
    if (!complete || !photoUri || !location || duplicate || submitting) return;
    setSubmitting(true);
    setError("");
    const action: OutboxAction = {
      deviceActionId,
      operationId: operation.id,
      operationName: operation.event_name,
      stage: operation.stage,
      state: "pending",
      checklist,
      location,
      deviceCapturedAt: new Date().toISOString(),
      responsibleId: effectiveResponsible,
      note: note.trim(),
      photoUri,
      photoPath: `${operation.id}/${deviceActionId}.jpg`,
      arrivalAccess,
      arrivalReason: arrivalReason.trim(),
      acceptanceName: acceptanceName.trim(),
      trackingTermsAccepted,
      attempts: 0,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    try {
      await enqueue(action);
      setMessage(
        online
          ? "Ação processada. Confira a confirmação do servidor na fila."
          : "Ação salva neste aparelho e aguardando conexão.",
      );
      router.replace("/queue");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "A ação não pôde ser salva neste aparelho.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <BrandHeader
        eyebrow={`Etapa atual · ${operation.event_name}`}
        title={stageLabels[operation.stage]}
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {duplicate ? (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>Esta etapa já está na fila</Text>
              <Text style={styles.warningCopy}>
                Abra a fila para reenviar ou revisar o conflito. Um segundo registro não será criado.
              </Text>
              <View style={styles.buttonGap}>
                <Button label="Abrir fila local" onPress={() => router.replace("/queue")} />
              </View>
            </View>
          ) : null}

          <Card>
            <Text style={styles.sectionEyebrow}>1 · Checklist obrigatório</Text>
            <Text style={styles.sectionTitle}>O que precisa estar pronto</Text>
            <View style={styles.checklist}>
              {checklistByStage[operation.stage].map((item) => {
                const checked = checklist[item] === true;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    style={styles.checkRow}
                    onPress={() =>
                      setChecklist((current) => ({ ...current, [item]: !checked }))
                    }
                  >
                    <View style={[styles.check, checked && styles.checkDone]}>
                      <Text style={[styles.checkMark, checked && styles.checkMarkDone]}>
                        {checked ? "OK" : ""}
                      </Text>
                    </View>
                    <Text style={styles.checkLabel}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>2 · Evidência fotográfica</Text>
            <Text style={styles.sectionTitle}>Registre o estado agora</Text>
            <Text style={styles.sectionCopy}>
              A foto é guardada no armazenamento persistente antes de entrar na fila.
            </Text>
            <View style={styles.captureGap}>
              <PhotoCapture captureId={deviceActionId} value={photoUri} onChange={setPhotoUri} />
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>3 · Local e horário</Text>
            <Text style={styles.sectionTitle}>
              {operation.stage === "preparation" ? "Registre o ponto inicial" : "GPS automático"}
            </Text>
            <Text style={styles.sectionCopy}>
              {operation.stage === "departure"
                ? "Ao aceitar os termos, o app captura este ponto e continua em segundo plano até o retorno."
                : operation.stage === "preparation"
                  ? "Este ponto comprova o local e a precisão da preparação."
                  : "O app captura o local desta etapa sem exigir uma ação manual."}
            </Text>
            <View style={styles.captureGap}>
              <Button
                label={
                  location
                    ? `GPS capturado · precisão ${Math.round(location.accuracy)} m`
                    : operation.stage === "preparation"
                      ? "Registrar GPS"
                      : "Atualizar GPS"
                }
                variant="secondary"
                busy={locationBusy}
                onPress={() => void captureLocation()}
              />
            </View>
            {locationDenied ? (
              <View style={styles.buttonGap}>
                <Button
                  label="Abrir Ajustes de localização"
                  variant="secondary"
                  onPress={() => void Linking.openSettings()}
                />
              </View>
            ) : null}
          </Card>

          {trackingConsentRequired ? (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Termos de uso do rastreamento</Text>
              <Text style={styles.sectionTitle}>Autorize somente para esta rota</Text>
              <Text style={styles.sectionCopy}>{ROUTE_TRACKING_TERMS_TEXT}</Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: trackingTermsAccepted }}
                accessibilityLabel="Aceito os termos de uso do rastreamento desta operação"
                style={styles.trackingConsent}
                onPress={() => setTrackingTermsAccepted((accepted) => !accepted)}
              >
                <View style={[styles.check, trackingTermsAccepted && styles.checkDone]}>
                  <Text
                    style={[
                      styles.checkMark,
                      trackingTermsAccepted && styles.checkMarkDone,
                    ]}
                  >
                    {trackingTermsAccepted ? "OK" : ""}
                  </Text>
                </View>
                <Text style={styles.checkLabel}>
                  Li e aceito os termos de uso do rastreamento desta operação.
                </Text>
              </Pressable>
              <Text style={styles.termsNotice}>
                O aceite será registrado com usuário, operação, versão e horário antes de a
                permissão do aparelho ser usada.
              </Text>
            </Card>
          ) : null}

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>4 · Responsável</Text>
            <Text style={styles.sectionTitle}>Quem responde por esta ação?</Text>
            <View style={styles.chips}>
              {responsiblePeople.map((person) => {
                const selected = effectiveResponsible === person.id;
                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setResponsibleId(person.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {person.full_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {operation.stage === "arrival" ? (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>5 · Acesso ao local</Text>
              <Text style={styles.sectionTitle}>A entrada foi liberada?</Text>
              <View style={styles.chips}>
                {([
                  ["released", "Acesso liberado"],
                  ["blocked", "Acesso bloqueado"],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: arrivalAccess === value }}
                    style={[styles.chip, arrivalAccess === value && styles.chipSelected]}
                    onPress={() => setArrivalAccess(value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        arrivalAccess === value && styles.chipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {arrivalAccess === "blocked" ? (
                <>
                  <Text style={styles.blockedHelp}>
                    O registro informa a torre, mas não avança a operação enquanto o
                    acesso continuar bloqueado.
                  </Text>
                  <TextInput
                    accessibilityLabel="Motivo do bloqueio"
                    placeholder="Descreva o motivo do bloqueio"
                    placeholderTextColor="#8a9690"
                    value={arrivalReason}
                    onChangeText={setArrivalReason}
                    multiline
                    style={[styles.input, styles.textarea]}
                  />
                </>
              ) : null}
            </Card>
          ) : null}

          {operation.stage === "delivery" ? (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>5 · Aceite interno</Text>
              <Text style={styles.sectionTitle}>Identifique quem conferiu</Text>
              <TextInput
                accessibilityLabel="Nome do responsável pelo aceite"
                placeholder="Nome do responsável no local"
                placeholderTextColor="#8a9690"
                value={acceptanceName}
                onChangeText={setAcceptanceName}
                style={styles.input}
              />
            </Card>
          ) : null}

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Observação opcional</Text>
            <TextInput
              accessibilityLabel="Observação da etapa"
              placeholder="Contexto útil para a torre"
              placeholderTextColor="#8a9690"
              value={note}
              onChangeText={setNote}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </Card>

          <View style={styles.buttonGap}>
            <Button
              label="Abrir rota no Google Maps"
              variant="secondary"
              onPress={() => void Linking.openURL(mapsUrl)}
            />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

        </ScrollView>
        <View style={styles.submitCard}>
          <Text style={styles.requirementCount}>
            {completedRequirements} de {totalRequirements} requisitos
          </Text>
          {missingRequirements.length ? (
            <Text style={styles.missingRequirements}>
              Falta: {missingRequirements.join(" · ")}
            </Text>
          ) : null}
          <Text style={styles.submitHint}>
            {arrivalAccess === "blocked" && complete
              ? "O bloqueio será registrado sem avançar a etapa."
              : complete
                ? online
                  ? "Tudo pronto para enviar ao servidor."
                  : "Tudo pronto; a ação ficará pendente neste aparelho."
                : "Conclua os requisitos para confirmar."}
          </Text>
          <Button
            label={
              operation.stage === "arrival" && arrivalAccess === "blocked"
                ? "Registrar acesso bloqueado"
                : `Concluir ${stageLabels[operation.stage].toLowerCase()}`
            }
            busy={busy || submitting}
            disabled={!complete || duplicate || operation.status !== "active"}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, padding: 20, justifyContent: "center" },
  content: { padding: 16, paddingBottom: 42 },
  backButton: { minHeight: 46, minWidth: 58, borderColor: colors.line, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  backLabel: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  warning: { backgroundColor: colors.amberSoft, borderColor: "#ecd49d", borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  warningTitle: { color: colors.amber, fontSize: 16, fontWeight: "700" },
  warningCopy: { color: "#705f3d", fontSize: 13, lineHeight: 19, marginTop: 4 },
  missingItem: { color: colors.danger, fontSize: 13, fontWeight: "700", marginTop: 9 },
  sectionCard: { marginTop: 12 },
  sectionEyebrow: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", marginTop: 4 },
  sectionCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  checklist: { marginTop: 13, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth },
  trackingConsent: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  termsNotice: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 10 },
  checkRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 30, height: 30, borderColor: colors.amber, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkDone: { borderColor: colors.green, backgroundColor: colors.green },
  checkMark: { fontSize: 12, fontWeight: "700" },
  checkMarkDone: { color: colors.surface },
  checkLabel: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  captureGap: { marginTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { borderColor: colors.green, backgroundColor: colors.sage },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: colors.greenDark },
  input: { minHeight: 50, borderColor: colors.line, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.surface, fontSize: 15, marginTop: 14 },
  textarea: { minHeight: 96, paddingTop: 13, textAlignVertical: "top" },
  blockedHelp: { color: colors.amber, fontSize: 12, lineHeight: 18, marginTop: 12 },
  buttonGap: { marginTop: 14 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 14 },
  submitCard: { padding: 14, backgroundColor: colors.ink, gap: 8, borderTopColor: "#31423b", borderTopWidth: 1 },
  requirementCount: { color: colors.surface, fontSize: 13, fontWeight: "700" },
  missingRequirements: { color: "#f0cfa2", fontSize: 12, lineHeight: 17 },
  submitHint: { color: "#cbd5d0", fontSize: 12, lineHeight: 18 },
});
