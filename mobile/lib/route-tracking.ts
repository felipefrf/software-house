import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  appendRouteTrackingPoints,
  confirmRouteTrackingPoints,
  listPendingRouteTrackingPoints,
  listRouteTrackingSessions,
  markRouteTrackingStopped,
  markRouteTrackingStopSynced,
  markRouteTrackingSyncAttempt,
  readActiveRouteTrackingSession,
  removeRouteTrackingSessionIfSettled,
  saveRouteTrackingSession,
} from "./database";
import {
  operationEndedForTracking,
  ROUTE_TRACKING_TERMS_VERSION,
  validRouteTrackingPoint,
} from "./route-tracking-policy";
import { supabase } from "./supabase";
import type {
  LocationEvidence,
  Operation,
  RouteTrackingPoint,
  RouteTrackingSession,
  RouteTrackingStopReason,
} from "./types";

export const ROUTE_TRACKING_TASK = "imperio-operation-route-v1";

type LocationTaskData = { locations?: Location.LocationObject[] };

const taskOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 100,
  timeInterval: 60_000,
  deferredUpdatesDistance: 200,
  deferredUpdatesInterval: 120_000,
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: true,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "Rota da Império em andamento",
    notificationBody: "A localização será encerrada no retorno da operação.",
    notificationColor: "#173D34",
    killServiceOnDestroy: false,
  },
};

const messageFrom = (failure: unknown) =>
  failure instanceof Error ? failure.message : "Falha ao sincronizar a rota.";

const routePoint = (
  sessionId: string,
  location: Location.LocationObject,
): RouteTrackingPoint | null => {
  const capturedAt = new Date(location.timestamp);
  if (!Number.isFinite(capturedAt.getTime())) return null;
  const speed = location.coords.speed;
  const heading = location.coords.heading;
  return {
    id: Crypto.randomUUID(),
    sessionId,
    capturedAt: capturedAt.toISOString(),
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 1_000,
    speed:
      speed !== null && Number.isFinite(speed) && speed >= -1 && speed <= 150
        ? speed
        : null,
    heading:
      heading !== null &&
      Number.isFinite(heading) &&
      (heading === -1 || (heading >= 0 && heading <= 360))
        ? heading
        : null,
    mocked: location.mocked === true,
  };
};

const initialRoutePoint = (
  sessionId: string,
  location: LocationEvidence,
): RouteTrackingPoint => ({
  id: Crypto.randomUUID(),
  sessionId,
  capturedAt: new Date().toISOString(),
  latitude: location.latitude,
  longitude: location.longitude,
  accuracy: location.accuracy,
  speed: null,
  heading: null,
  mocked: false,
});

async function stopNativeTask() {
  if (Platform.OS === "web") return;
  if (await Location.hasStartedLocationUpdatesAsync(ROUTE_TRACKING_TASK))
    await Location.stopLocationUpdatesAsync(ROUTE_TRACKING_TASK);
}

async function startNativeTaskWithoutPrompt() {
  if (Platform.OS === "web" || !(await TaskManager.isAvailableAsync())) return false;
  const [foreground, background, services] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);
  if (!foreground.granted || !background.granted || !services) return false;
  if (!(await Location.hasStartedLocationUpdatesAsync(ROUTE_TRACKING_TASK)))
    await Location.startLocationUpdatesAsync(ROUTE_TRACKING_TASK, taskOptions);
  return true;
}

async function requireBackgroundLocationPermission() {
  if (Platform.OS === "web")
    throw new Error("O rastreamento de rota está disponível somente no app nativo.");
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error(
      "O rastreamento em segundo plano exige um build nativo da Império; ele não funciona no Expo Go.",
    );
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Ative os Serviços de Localização do aparelho antes da saída.");
  const currentForeground = await Location.getForegroundPermissionsAsync();
  const foreground = currentForeground.granted
    ? currentForeground
    : await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted)
    throw new Error("Autorize a localização durante o uso para iniciar a rota.");
  const currentBackground = await Location.getBackgroundPermissionsAsync();
  const background = currentBackground.granted
    ? currentBackground
    : await Location.requestBackgroundPermissionsAsync();
  if (!background.granted)
    throw new Error(
      "Autorize localização sempre nos Ajustes para registrar a rota até o retorno.",
    );
}

export async function syncRouteTracking(userId: string) {
  if (!supabase) return false;
  const sessions = await listRouteTrackingSessions(userId);
  let shouldStopNativeTask = false;
  for (const session of sessions) {
    let batch = await listPendingRouteTrackingPoints(session.sessionId);
    while (batch.length) {
      const pointIds = batch.map((point) => point.id);
      const response = await supabase.rpc("append_operation_route_points", {
        p_session_id: session.sessionId,
        p_points: batch.map((point) => ({
          id: point.id,
          captured_at: point.capturedAt,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          speed: point.speed,
          heading: point.heading,
          mocked: point.mocked,
        })),
      });
      if (response.error) {
        await markRouteTrackingSyncAttempt(
          session.sessionId,
          pointIds,
          response.error.message,
        );
        break;
      }
      const result = response.data as {
        accepted_ids?: string[];
        should_stop?: boolean;
        stopped_at?: string | null;
        stop_reason?: RouteTrackingStopReason | null;
      } | null;
      const accepted = Array.isArray(result?.accepted_ids)
        ? result.accepted_ids.filter((id): id is string => typeof id === "string")
        : [];
      if (!accepted.length) {
        await markRouteTrackingSyncAttempt(
          session.sessionId,
          pointIds,
          "O servidor não confirmou os pontos enviados.",
        );
        break;
      }
      await confirmRouteTrackingPoints(session.sessionId, accepted);
      await markRouteTrackingSyncAttempt(session.sessionId, [], null);
      if (result?.should_stop && result.stopped_at) {
        await markRouteTrackingStopped(
          session.sessionId,
          result.stopped_at,
          result.stop_reason ?? "operation_ended",
          true,
        );
        shouldStopNativeTask = true;
      }
      batch = await listPendingRouteTrackingPoints(session.sessionId);
    }

    const refreshed = (await listRouteTrackingSessions(userId)).find(
      (candidate) => candidate.sessionId === session.sessionId,
    );
    if (refreshed?.stoppedAt && !refreshed.stopSynced) {
      const stopped = await supabase.rpc("stop_operation_tracking", {
        p_session_id: refreshed.sessionId,
        p_device_stopped_at: refreshed.stoppedAt,
        p_reason: refreshed.stopReason,
      });
      if (stopped.error) {
        await markRouteTrackingSyncAttempt(
          refreshed.sessionId,
          [],
          stopped.error.message,
        );
      } else {
        await markRouteTrackingStopSynced(refreshed.sessionId);
      }
    }
    await removeRouteTrackingSessionIfSettled(session.sessionId);
  }
  if (shouldStopNativeTask) await stopNativeTask();
  return shouldStopNativeTask;
}

export async function startOperationRouteTracking({
  userId,
  operationId,
  initialLocation,
  termsAccepted,
}: {
  userId: string;
  operationId: string;
  initialLocation: LocationEvidence;
  termsAccepted: boolean;
}) {
  if (!termsAccepted)
    throw new Error("Aceite os termos de rastreamento antes de confirmar a saída.");
  if (!validRouteTrackingPoint(initialLocation))
    throw new Error("Capture novamente o GPS antes de iniciar o rastreamento da rota.");
  if (!supabase) throw new Error("Supabase não configurado.");
  const active = await readActiveRouteTrackingSession();
  if (active?.operationId === operationId) {
    if (active.userId !== userId)
      throw new Error("Encerre a rota iniciada pela conta anterior neste aparelho.");
    if (!(await startNativeTaskWithoutPrompt()))
      throw new Error("A permissão de localização em segundo plano não está ativa.");
    return active;
  }
  if (active)
    throw new Error("Finalize o rastreamento da operação anterior antes desta saída.");

  await requireBackgroundLocationPermission();
  const now = new Date().toISOString();
  const trackingSession: RouteTrackingSession = {
    sessionId: Crypto.randomUUID(),
    userId,
    operationId,
    termsVersion: ROUTE_TRACKING_TERMS_VERSION,
    consentedAt: now,
    startedAt: now,
    stoppedAt: null,
    stopReason: null,
    stopSynced: false,
    lastError: null,
  };
  const accepted = await supabase.rpc("start_operation_tracking", {
    p_session_id: trackingSession.sessionId,
    p_operation_id: operationId,
    p_terms_version: trackingSession.termsVersion,
    p_device_consented_at: trackingSession.consentedAt,
  });
  if (accepted.error)
    throw new Error(`O aceite dos termos não pôde ser registrado: ${accepted.error.message}`);

  try {
    await saveRouteTrackingSession(trackingSession);
    await appendRouteTrackingPoints([
      initialRoutePoint(trackingSession.sessionId, initialLocation),
    ]);
    await Location.startLocationUpdatesAsync(ROUTE_TRACKING_TASK, taskOptions);
    await syncRouteTracking(userId).catch(() => false);
    return trackingSession;
  } catch (failure) {
    const stoppedAt = new Date().toISOString();
    await stopNativeTask().catch(() => undefined);
    let remoteStopped = false;
    try {
      const remoteStop = await supabase.rpc("stop_operation_tracking", {
        p_session_id: trackingSession.sessionId,
        p_device_stopped_at: stoppedAt,
        p_reason: "departure_failed",
      });
      remoteStopped = !remoteStop.error;
    } catch {
      // A sessão local preserva o encerramento para a próxima reconciliação.
    }
    await markRouteTrackingStopped(
      trackingSession.sessionId,
      stoppedAt,
      "departure_failed",
      remoteStopped,
    );
    await syncRouteTracking(userId).catch(() => false);
    throw new Error(`Não foi possível iniciar o rastreamento: ${messageFrom(failure)}`);
  }
}

export async function stopOperationRouteTracking(
  userId: string,
  operationId: string,
  reason: RouteTrackingStopReason,
) {
  const active = await readActiveRouteTrackingSession(userId);
  if (!active || active.operationId !== operationId) return;
  await markRouteTrackingStopped(active.sessionId, new Date().toISOString(), reason);
  await stopNativeTask();
  await syncRouteTracking(userId).catch(() => false);
}

export async function stopRouteTrackingForSignOut(userId: string) {
  const active = await readActiveRouteTrackingSession(userId);
  if (!active) return;
  await markRouteTrackingStopped(
    active.sessionId,
    new Date().toISOString(),
    "sign_out",
  );
  await stopNativeTask();
  await syncRouteTracking(userId).catch(() => false);
}

export async function reconcileOperationRouteTracking(
  userId: string,
  operations: Operation[],
) {
  const serverEnded = await syncRouteTracking(userId).catch(() => false);
  let active = await readActiveRouteTrackingSession(userId);
  if (active) {
    const operation = operations.find((candidate) => candidate.id === active?.operationId);
    if (operation && operationEndedForTracking(operation)) {
      const reason: RouteTrackingStopReason =
        operation.status === "cancelled"
          ? "cancelled"
          : operation.status === "completed"
            ? "completed"
            : "operation_ended";
      await stopOperationRouteTracking(userId, operation.id, reason);
      active = null;
    }
  }
  if (serverEnded || !active) {
    await stopNativeTask();
    return false;
  }
  return startNativeTaskWithoutPrompt();
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(ROUTE_TRACKING_TASK))
  TaskManager.defineTask<LocationTaskData>(ROUTE_TRACKING_TASK, async ({ data, error }) => {
    try {
      const active = await readActiveRouteTrackingSession();
      if (!active) {
        await stopNativeTask().catch(() => undefined);
        return;
      }
      if (error) {
        await markRouteTrackingSyncAttempt(active.sessionId, [], error.message);
        return;
      }
      const points = (data?.locations ?? [])
        .map((location) => routePoint(active.sessionId, location))
        .filter((point): point is RouteTrackingPoint => point !== null)
        .filter(validRouteTrackingPoint);
      await appendRouteTrackingPoints(points);
      await syncRouteTracking(active.userId).catch(() => false);
    } catch {
      // A tarefa não registra coordenadas em logs; dados persistidos serão retomados no foreground.
    }
  });
