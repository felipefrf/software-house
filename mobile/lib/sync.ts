import { File } from "expo-file-system";

import { claimAction, listActions, transitionAction } from "./database";
import { classifySyncFailure, isAutoRetryable, isRetryable } from "./outbox-state";
import { supabase } from "./supabase";
import type { IncidentDraft, OutboxAction } from "./types";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Falha de comunicação com o servidor.";

const isAlreadyUploaded = (error: { message?: string; statusCode?: string } | null) =>
  Boolean(
    error &&
      (error.statusCode === "409" ||
        /already exists|duplicate/i.test(error.message ?? "")),
  );

async function uploadEvidence(path: string, uri: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const file = new File(uri);
  if (!file.exists) throw new Error("A foto local não está mais disponível.");
  const uploaded = await supabase.storage
    .from("operation-evidence")
    .upload(path, await file.bytes(), { contentType: "image/jpeg", upsert: false });
  if (uploaded.error && !isAlreadyUploaded(uploaded.error))
    throw new Error(uploaded.error.message);
  return !uploaded.error;
}

const deleteLocalFile = (uri: string | null) => {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A confirmação do servidor não pode ser revertida por uma limpeza local.
  }
};

const removeRemoteEvidence = async (path: string | null) => {
  if (!supabase || !path) return;
  try {
    await supabase.storage.from("operation-evidence").remove([path]);
  } catch {
    // A política do bucket impede apagar evidência já referenciada pelo servidor.
  }
};

export async function removeDiscardedRemoteEvidence(action: OutboxAction) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const removed = await supabase.storage
    .from("operation-evidence")
    .remove([action.photoPath]);
  if (removed.error)
    throw new Error(`A evidência remota não foi removida: ${removed.error.message}`);
}

export function cleanupDiscardedLocalEvidence(action: OutboxAction) {
  deleteLocalFile(action.photoUri);
}

export async function syncOne(
  userId: string,
  action: OutboxAction,
  manual = false,
) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const claimed = await claimAction(userId, action.deviceActionId, manual);
  if (!claimed) return "skipped" as const;
  try {
    await uploadEvidence(claimed.photoPath, claimed.photoUri);
    const confirmed = await supabase.rpc("confirm_operation_action", {
      p_operation_id: claimed.operationId,
      p_device_action_id: claimed.deviceActionId,
      p_stage: claimed.stage,
      p_device_captured_at: claimed.deviceCapturedAt,
      p_checklist: claimed.checklist,
      p_latitude: claimed.location.latitude,
      p_longitude: claimed.location.longitude,
      p_accuracy: claimed.location.accuracy,
      p_responsible_id: claimed.responsibleId,
      p_note: claimed.note || null,
      p_photo_path: claimed.photoPath,
      p_arrival_access: claimed.arrivalAccess || null,
      p_arrival_reason: claimed.arrivalReason || null,
      p_acceptance_name: claimed.acceptanceName || null,
    });
    if (confirmed.error) throw new Error(confirmed.error.message);
    const event = confirmed.data as { operation_id?: string; stage?: string } | null;
    if (event?.operation_id !== claimed.operationId || event.stage !== claimed.stage)
      throw new Error("A confirmação retornou uma etapa diferente.");
    const committed = await transitionAction(
      userId,
      claimed.deviceActionId,
      "sending",
      "confirmed",
      null,
    );
    if (committed) deleteLocalFile(claimed.photoUri);
    return "confirmed" as const;
  } catch (error) {
    const message = errorMessage(error);
    const state = classifySyncFailure(message);
    if (state === "conflict") await removeRemoteEvidence(claimed.photoPath);
    await transitionAction(
      userId,
      claimed.deviceActionId,
      "sending",
      state,
      message,
    );
    return state;
  }
}

export async function syncPending(userId: string, manual = false) {
  const actions = await listActions(userId);
  for (const action of actions.filter(
    (item) =>
      manual ? isRetryable(item.state) : isAutoRetryable(item.state, item.attempts),
  ))
    await syncOne(userId, action, manual);
}

export async function createIncident(userId: string, draft: IncidentDraft) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const photoPath = draft.photoUri
    ? `${draft.operationId}/incident-${draft.id}.jpg`
    : null;
  if (["damage", "missing_item"].includes(draft.type) && !photoPath)
    throw new Error("Avaria ou item faltante exige foto.");
  if (photoPath && draft.photoUri)
    await uploadEvidence(photoPath, draft.photoUri);
  const inserted = await supabase.rpc("create_operation_incident", {
    p_incident_id: draft.id,
    p_operation_id: draft.operationId,
    p_stage: draft.stage,
    p_type: draft.type,
    p_severity: draft.severity,
    p_impact: draft.impact || null,
    p_description: draft.description.trim(),
    p_responsible_id: draft.responsibleId || null,
    p_latitude: draft.location?.latitude ?? null,
    p_longitude: draft.location?.longitude ?? null,
    p_accuracy: draft.location?.accuracy ?? null,
    p_photo_path: photoPath,
  });
  if (inserted.error) throw new Error(inserted.error.message);
  const incident = inserted.data as {
    id?: string;
    operation_id?: string;
    actor_id?: string;
  } | null;
  if (
    incident?.id !== draft.id ||
    incident.operation_id !== draft.operationId ||
    incident.actor_id !== userId
  )
    throw new Error("A confirmação retornou uma ocorrência diferente.");
  deleteLocalFile(draft.photoUri);
}
