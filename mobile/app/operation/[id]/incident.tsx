import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { stageLabels } from "@/lib/checklist";
import { colors, fonts } from "@/lib/theme";
import type { IncidentDraft, LocationEvidence } from "@/lib/types";

const incidentTypes: Array<[IncidentDraft["type"], string]> = [
  ["delay", "Atraso"],
  ["damage", "Avaria"],
  ["missing_item", "Item faltante"],
  ["access", "Acesso"],
  ["other", "Outro"],
];

const severities: Array<[IncidentDraft["severity"], string]> = [
  ["low", "Baixa"],
  ["medium", "Média"],
  ["high", "Alta"],
];

export default function IncidentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { work, outbox, online, busy, createIncident } = useApp();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const operation = work?.operations.find((item) => item.id === id);
  const [incidentId] = useState(() => Crypto.randomUUID());
  const [type, setType] = useState<IncidentDraft["type"]>("delay");
  const [severity, setSeverity] = useState<IncidentDraft["severity"]>("medium");
  const [impact, setImpact] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [location, setLocation] = useState<LocationEvidence | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  if (!operation || !work)
    return (
      <Screen>
        <BrandHeader title="Operação indisponível" />
        <View style={styles.centered}>
          <Button label="Voltar ao turno" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );

  const pending = outbox.filter((item) => item.state !== "confirmed").length;
  const photoRequired = type === "damage" || type === "missing_item";
  const canSubmit =
    online && description.trim().length >= 3 && (!photoRequired || Boolean(photoUri));

  const captureLocation = async () => {
    setLocationBusy(true);
    setLocationDenied(false);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationDenied(true);
        throw new Error("Localização não autorizada.");
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
  };

  const submit = async () => {
    setError("");
    try {
      await createIncident({
        id: incidentId,
        operationId: operation.id,
        stage: operation.stage,
        type,
        severity,
        impact: impact.trim(),
        description: description.trim(),
        responsibleId,
        location,
        photoUri,
      });
      Alert.alert(
        "Ocorrência registrada",
        "A torre já pode ver o relato e as evidências.",
        [{ text: "Voltar à operação", onPress: () => router.back() }],
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Não foi possível registrar a ocorrência.",
      );
    }
  };

  return (
    <Screen>
      <BrandHeader
        eyebrow={`${operation.event_name} · ${stageLabels[operation.stage]}`}
        title="Nova ocorrência"
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!online ? (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>Ocorrência exige conexão</Text>
              <Text style={styles.warningCopy}>
                Neste corte, somente etapas entram na fila offline. O relato não será simulado nem armazenado parcialmente.
              </Text>
            </View>
          ) : null}

          <Card>
            <Text style={styles.eyebrow}>Tipo</Text>
            <View style={styles.chips}>
              {incidentTypes.map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: type === value }}
                  style={[styles.chip, type === value && styles.chipSelected]}
                  onPress={() => setType(value)}
                >
                  <Text style={[styles.chipText, type === value && styles.chipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.eyebrowGap}>Severidade</Text>
            <View style={styles.chips}>
              {severities.map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: severity === value }}
                  style={[styles.chip, severity === value && styles.chipSelected]}
                  onPress={() => setSeverity(value)}
                >
                  <Text style={[styles.chipText, severity === value && styles.chipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              accessibilityLabel="Descrição da ocorrência"
              placeholder="O que aconteceu e onde?"
              placeholderTextColor="#8a9690"
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <Text style={styles.label}>Impacto percebido</Text>
            <TextInput
              accessibilityLabel="Impacto da ocorrência"
              placeholder="Ex.: montagem pode atrasar 20 minutos"
              placeholderTextColor="#8a9690"
              value={impact}
              onChangeText={setImpact}
              style={styles.input}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.eyebrow}>Evidências</Text>
            <Text style={styles.sectionTitle}>
              {photoRequired ? "Foto obrigatória" : "Foto opcional"}
            </Text>
            <Text style={styles.sectionCopy}>
              Avaria e item faltante só podem ser enviados com foto.
            </Text>
            <View style={styles.captureGap}>
              <PhotoCapture captureId={`incident-${incidentId}`} value={photoUri} onChange={setPhotoUri} />
            </View>
            <View style={styles.buttonGapSmall}>
              <Button
                label={
                  location
                    ? `GPS anexado · precisão ${Math.round(location.accuracy)} m`
                    : "Anexar GPS"
                }
                variant="secondary"
                busy={locationBusy}
                onPress={() => void captureLocation()}
              />
            </View>
            {locationDenied ? (
              <View style={styles.buttonGapSmall}>
                <Button
                  label="Abrir Ajustes de localização"
                  variant="secondary"
                  onPress={() => void Linking.openSettings()}
                />
              </View>
            ) : null}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.eyebrow}>Responsável pelo tratamento</Text>
            <Text style={styles.sectionCopy}>Opcional no registro inicial.</Text>
            <View style={styles.chips}>
              {responsiblePeople.map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: responsibleId === person.id }}
                  style={[styles.chip, responsibleId === person.id && styles.chipSelected]}
                  onPress={() =>
                    setResponsibleId((current) => (current === person.id ? "" : person.id))
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      responsibleId === person.id && styles.chipTextSelected,
                    ]}
                  >
                    {person.full_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonGap}>
            <Button
              label="Registrar e enviar à torre"
              busy={busy}
              disabled={!canSubmit}
              onPress={() => void submit()}
            />
          </View>
        </ScrollView>
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
  warning: { backgroundColor: colors.amberSoft, borderColor: "#ecd49d", borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 12 },
  warningTitle: { color: colors.amber, fontSize: 15, fontWeight: "700" },
  warningCopy: { color: "#705f3d", fontSize: 12, lineHeight: 18, marginTop: 5 },
  eyebrow: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  eyebrowGap: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipSelected: { borderColor: colors.green, backgroundColor: colors.sage },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: colors.greenDark },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700", marginTop: 18 },
  input: { minHeight: 50, borderColor: colors.line, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.surface, fontSize: 15, marginTop: 8 },
  textarea: { minHeight: 105, paddingTop: 13, textAlignVertical: "top" },
  sectionCard: { marginTop: 12 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.display, fontSize: 22, fontWeight: "700", marginTop: 4 },
  sectionCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  captureGap: { marginTop: 13 },
  buttonGap: { marginTop: 16 },
  buttonGapSmall: { marginTop: 10 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 14 },
});
