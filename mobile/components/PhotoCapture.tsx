import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

export function PhotoCapture({
  captureId,
  value,
  onChange,
}: {
  captureId: string;
  value: string | null;
  onChange: (uri: string | null) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const camera = useRef<CameraView>(null);

  const start = async () => {
    setCaptureError("");
    try {
      const current = permission?.granted ? permission : await requestPermission();
      if (current.granted) {
        setReady(false);
        setOpen(true);
      } else {
        setCaptureError(
          current.canAskAgain
            ? "A câmera não foi autorizada. Toque em Tirar foto para solicitar novamente."
            : "A câmera está bloqueada. Abra os Ajustes para autorizar.",
        );
      }
    } catch {
      setCaptureError("Não foi possível abrir a permissão da câmera.");
    }
  };

  const capture = async () => {
    if (!ready) return;
    try {
      const result = await camera.current?.takePictureAsync({ quality: 0.45 });
      if (!result?.uri) throw new Error("empty capture");
      const directory = new Directory(Paths.document, "operation-evidence");
      directory.create({ idempotent: true, intermediates: true });
      const destination = new File(
        directory,
        `${captureId}-${Crypto.randomUUID()}.jpg`,
      );
      await new File(result.uri).copy(destination);
      if (destination.size > 5_800_000) {
        destination.delete();
        setCaptureError(
          "A foto ultrapassou 6 MB. Tente novamente com o aparelho mais próximo da cena.",
        );
        setOpen(false);
        return;
      }
      onChange(destination.uri);
      setOpen(false);
      if (value) {
        try {
          const previous = new File(value);
          if (previous.exists && previous.uri !== destination.uri) previous.delete();
        } catch {
          // A nova captura válida não deve ser perdida por uma limpeza antiga.
        }
      }
    } catch {
      setCaptureError("A câmera não conseguiu salvar a foto. Libere espaço e tente novamente.");
      setOpen(false);
    }
  };

  if (open)
    return (
      <View style={styles.cameraShell}>
        <CameraView
          ref={camera}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setReady(true)}
        />
        <View style={styles.cameraActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar foto"
            style={styles.cancel}
            onPress={() => setOpen(false)}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Tirar foto"
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            style={[styles.shutter, !ready && styles.disabled]}
            onPress={() => void capture()}
          >
            <Text style={styles.shutterText}>Tirar foto</Text>
          </Pressable>
        </View>
      </View>
    );

  return (
    <View>
      {value ? <Image source={{ uri: value }} style={styles.preview} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? "Refazer foto" : "Tirar foto"}
        style={styles.captureButton}
        onPress={() => void start()}
      >
        <Text style={styles.captureTitle}>{value ? "Refazer foto" : "Tirar foto"}</Text>
        <Text style={styles.captureCopy}>
          {value ? "Foto salva neste aparelho" : "A câmera abre em primeiro plano"}
        </Text>
      </Pressable>
      {permission && !permission.granted && !permission.canAskAgain ? (
        <View style={styles.settingsBlock}>
          <Text style={styles.permissionError} accessibilityLiveRegion="polite">
            Libere a câmera nos Ajustes do aparelho para registrar a evidência.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir Ajustes da câmera"
            style={styles.settingsButton}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={styles.settingsButtonText}>Abrir Ajustes</Text>
          </Pressable>
        </View>
      ) : null}
      {captureError ? (
        <Text style={styles.permissionError} accessibilityLiveRegion="polite">
          {captureError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraShell: { overflow: "hidden", borderRadius: 14, backgroundColor: colors.ink },
  camera: { height: 380 },
  cameraActions: { flexDirection: "row", padding: 12, gap: 10 },
  cancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#55635d",
    borderWidth: 1,
  },
  cancelText: { color: colors.surface, fontWeight: "700" },
  shutter: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  shutterText: { color: colors.ink, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  preview: { height: 200, width: "100%", borderRadius: 12, marginBottom: 10 },
  captureButton: {
    minHeight: 76,
    borderRadius: 12,
    padding: 14,
    justifyContent: "center",
    backgroundColor: colors.sage,
    borderColor: colors.line,
    borderWidth: 1,
  },
  captureTitle: { color: colors.greenDark, fontWeight: "800", fontSize: 15 },
  captureCopy: { color: colors.muted, fontSize: 12, marginTop: 3 },
  permissionError: { color: colors.danger, fontSize: 12, marginTop: 8 },
  settingsBlock: { marginTop: 8 },
  settingsButton: {
    minHeight: 44,
    marginTop: 8,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  settingsButtonText: { color: colors.greenDark, fontSize: 13, fontWeight: "800" },
});
