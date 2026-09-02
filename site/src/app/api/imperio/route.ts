import { NextResponse } from "next/server";

import { checklistForStage, operationStages } from "@/app/imperio/logistica/action";
import { inspectEstoqueNowOperations } from "@/app/imperio/logistica/data";
import {
  isValidExternalId,
  isValidIsoDate,
  sourceFieldsDiverged,
  toScheduledAt,
  type EstoqueNowOperation,
} from "@/app/imperio/logistica/estoquenow";
import { getAppSnapshot } from "@/app/imperio/logistica/server";
import type { OperationStage } from "@/app/imperio/logistica/types";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const isStage = (value: string): value is OperationStage =>
  operationStages.includes(value as OperationStage);

const isOptionalUuid = (value?: string) => !value || isUuid(value);

const validDateInput = (value: string) => isValidIsoDate(value);

type EstoqueNowImportRow = {
  source: "estoquenow";
  external_id: string;
  event_name: string;
  destination: string;
  scheduled_at: string;
  notes: string;
  imported_at: string;
};

type EstoqueNowSkipReason =
  | "missing_external_id"
  | "invalid_external_id"
  | "missing_event_name"
  | "invalid_event_name"
  | "missing_destination"
  | "invalid_destination"
  | "invalid_scheduled_date_or_time";

const estoqueNowImportRow = (
  operation: EstoqueNowOperation,
  importedAt: string,
): { row: EstoqueNowImportRow | null; reason: EstoqueNowSkipReason | null } => {
  const externalId = operation.id.trim();
  if (!externalId) return { row: null, reason: "missing_external_id" };
  if (!isValidExternalId(externalId)) return { row: null, reason: "invalid_external_id" };
  const eventName = operation.eventName.trim();
  if (!eventName) return { row: null, reason: "missing_event_name" };
  if (eventName.length < 2) return { row: null, reason: "invalid_event_name" };
  const destinationParts = [operation.venue.trim(), operation.city.trim()].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
  if (!destinationParts.length) return { row: null, reason: "missing_destination" };
  const destination = destinationParts.join(" · ");
  if (destination.length < 5) return { row: null, reason: "invalid_destination" };
  const scheduledAt = toScheduledAt(operation.scheduledDate, operation.scheduledTime);
  if (!scheduledAt)
    return { row: null, reason: "invalid_scheduled_date_or_time" };

  const notes = [
    operation.orderId.trim() ? `Pedido ${operation.orderId.trim()}.` : "",
    operation.returnDate.trim() ? `Retorno previsto: ${operation.returnDate.trim()}.` : "",
    operation.nextMilestone.trim()
      ? `Marco externo: ${operation.nextMilestone.trim()}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    row: {
      source: "estoquenow",
      external_id: externalId,
      event_name: eventName,
      destination,
      scheduled_at: scheduledAt,
      notes: ["Importado por leitura do EstoqueNOW.", notes].filter(Boolean).join(" "),
      imported_at: importedAt,
    },
    reason: null,
  };
};

const evidenceFile = (value: FormDataEntryValue | null) => {
  if (!(value instanceof File)) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(value.type)) return null;
  return value.size > 0 && value.size <= 6_000_000 ? value : null;
};

const extensionFor = (file: File) =>
  file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

export async function GET() {
  try {
    return NextResponse.json(await getAppSnapshot());
  } catch {
    return jsonError("Não foi possível atualizar a torre.", 500);
  }
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== requestUrl.origin) return jsonError("Origem não permitida.", 403);

  const action = requestUrl.searchParams.get("action");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("Supabase não configurado.", 503);

  if (action === "login") {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return jsonError("Informe e-mail e senha.");
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    return error
      ? jsonError("Credenciais inválidas.", 401)
      : NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("Sessão expirada.", 401);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,must_change_password")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile)
    return jsonError("Não foi possível validar o perfil autenticado.", 500);
  const manager = profile?.role === "manager";

  try {
    if (action === "change-password") {
      const body = (await request.json()) as { password?: string };
      if (!body.password || body.password.length < 10)
        return jsonError("Use uma nova senha com pelo menos 10 caracteres.");
      const admin = createSupabaseAdminClient();
      if (!admin) return jsonError("Chave secreta do Supabase não configurada.", 503);
      const changed = await supabase.auth.updateUser({ password: body.password });
      if (changed.error) return jsonError("Não foi possível trocar a senha.");
      const marked = await admin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", auth.user.id);
      if (marked.error) return jsonError("Senha alterada; atualize a página para confirmar o perfil.", 500);
      return NextResponse.json({ ok: true });
    }

    if (profile?.must_change_password)
      return jsonError("Troque a senha temporária antes de operar.", 403);

    if (action === "create-person") {
      if (!manager) return jsonError("Apenas gestores cadastram pessoas.", 403);
      const admin = createSupabaseAdminClient();
      if (!admin) return jsonError("Chave secreta do Supabase não configurada.", 503);
      const body = (await request.json()) as {
        fullName?: string;
        email?: string;
        phone?: string;
        jobTitle?: string;
        temporaryPassword?: string;
      };
      if (
        !body.fullName ||
        !body.email ||
        !body.jobTitle ||
        !body.temporaryPassword ||
        body.temporaryPassword.length < 10
      )
        return jsonError(
          "Nome, e-mail, função e senha temporária de 10 caracteres são obrigatórios.",
        );
      const created = await admin.auth.admin.createUser({
        email: body.email,
        password: body.temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: body.fullName },
      });
      if (created.error || !created.data.user)
        return jsonError("Não foi possível criar o acesso do funcionário.");
      const updated = await admin
        .from("profiles")
        .update({
          phone: body.phone || null,
          job_title: body.jobTitle,
          must_change_password: true,
        })
        .eq("id", created.data.user.id);
      if (updated.error) {
        await admin.auth.admin.deleteUser(created.data.user.id);
        return jsonError("Cadastro revertido porque o perfil não pôde ser salvo.", 500);
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "create-team") {
      if (!manager) return jsonError("Apenas gestores criam equipes.", 403);
      const body = (await request.json()) as {
        name?: string;
        leaderId?: string;
        memberIds?: string[];
      };
      if (
        !body.name ||
        !body.leaderId ||
        !isUuid(body.leaderId) ||
        !Array.isArray(body.memberIds) ||
        !body.memberIds.every(isUuid)
      )
        return jsonError("Nome e líder são obrigatórios.");
      const created = await supabase.rpc("create_team", {
        p_name: body.name,
        p_leader_id: body.leaderId,
        p_member_ids: body.memberIds ?? [],
      });
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "create-vehicle") {
      if (!manager) return jsonError("Apenas gestores criam veículos.", 403);
      const body = (await request.json()) as {
        name?: string;
        plate?: string;
        vehicleType?: string;
        capacityLabel?: string;
      };
      if (!body.name || !body.plate || !body.vehicleType)
        return jsonError("Nome, placa e tipo são obrigatórios.");
      const result = await supabase.from("vehicles").insert({
        name: body.name,
        plate: body.plate.toUpperCase(),
        vehicle_type: body.vehicleType,
        capacity_label: body.capacityLabel || null,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "set-vehicle-status") {
      if (!manager) return jsonError("Apenas gestores alteram a frota.", 403);
      const body = (await request.json()) as { id?: string; status?: string };
      if (
        !body.id ||
        !isUuid(body.id) ||
        !["available", "in_use", "maintenance"].includes(body.status ?? "")
      )
        return jsonError("Veículo ou status inválido.");
      const result = await supabase
        .from("vehicles")
        .update({ status: body.status })
        .eq("id", body.id);
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }

    if (action === "create-operation") {
      if (!manager) return jsonError("Apenas gestores criam operações.", 403);
      const body = (await request.json()) as {
        eventName?: string;
        destination?: string;
        scheduledAt?: string;
        teamId?: string;
        vehicleId?: string;
        driverId?: string;
        notes?: string;
      };
      if (!body.eventName || !body.destination || !body.scheduledAt)
        return jsonError("Evento, destino e horário são obrigatórios.");
      if (!Number.isFinite(new Date(body.scheduledAt).getTime()))
        return jsonError("Data da operação inválida.");
      if (
        !isOptionalUuid(body.teamId) ||
        !isOptionalUuid(body.vehicleId) ||
        !isOptionalUuid(body.driverId)
      )
        return jsonError("Equipe, veículo ou motorista inválido.");
      const result = await supabase.rpc("create_manual_operation", {
        p_event_name: body.eventName,
        p_destination: body.destination,
        p_scheduled_at: body.scheduledAt,
        p_team_id: body.teamId || null,
        p_vehicle_id: body.vehicleId || null,
        p_driver_id: body.driverId || null,
        p_notes: body.notes || null,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "update-operation") {
      if (!manager) return jsonError("Apenas gestores alteram operações.", 403);
      const body = (await request.json()) as {
        id?: string;
        destination?: string;
        scheduledAt?: string;
        teamId?: string;
        vehicleId?: string;
        driverId?: string;
        notes?: string;
      };
      if (!body.id || !body.destination || !body.scheduledAt)
        return jsonError("Operação, destino e horário são obrigatórios.");
      if (
        !isUuid(body.id) ||
        !Number.isFinite(new Date(body.scheduledAt).getTime()) ||
        !isOptionalUuid(body.teamId) ||
        !isOptionalUuid(body.vehicleId) ||
        !isOptionalUuid(body.driverId)
      )
        return jsonError("Dados da escala inválidos.");
      const result = await supabase.rpc("update_operation_assignment", {
        p_id: body.id,
        p_destination: body.destination,
        p_scheduled_at: body.scheduledAt,
        p_team_id: body.teamId || null,
        p_vehicle_id: body.vehicleId || null,
        p_driver_id: body.driverId || null,
        p_notes: body.notes || null,
      });
      if (result.error) throw result.error;
      if (!result.data)
        return jsonError("A operação não está mais ativa. Atualize a torre.", 409);
      return NextResponse.json({ ok: true });
    }

    if (action === "cancel-operation") {
      if (!manager) return jsonError("Apenas gestores cancelam operações.", 403);
      const body = (await request.json()) as { id?: string; reason?: string };
      if (!body.id || !isUuid(body.id) || !body.reason || body.reason.trim().length < 3)
        return jsonError("Informe a operação e o motivo do cancelamento.");
      const result = await supabase.rpc("cancel_operation", {
        p_id: body.id,
        p_reason: body.reason.trim(),
      });
      if (result.error) throw result.error;
      if (!result.data)
        return jsonError("A operação não está mais ativa. Atualize a torre.", 409);
      return NextResponse.json({ ok: true });
    }

    if (action === "sync-estoquenow") {
      if (!manager) return jsonError("Apenas gestores consultam a integração.", 403);
      const body = (await request.json()) as {
        startDate?: string;
        endDate?: string;
        mode?: "preview" | "canary" | "bulk";
        externalId?: string;
        reviewedEventName?: string;
        reviewedDestination?: string;
        reviewedScheduledAt?: string;
      };
      const startDate = body.startDate?.trim() ?? "";
      const endDate = body.endDate?.trim() ?? "";
      const mode = body.mode ?? "preview";
      const externalId = body.externalId?.trim() ?? "";
      if (!startDate || !endDate || !validDateInput(startDate) || !validDateInput(endDate))
        return jsonError("Informe um período com datas válidas.");
      if (mode === "bulk")
        return jsonError("A importação em lote permanece bloqueada até validação do contrato.", 409);
      if (mode !== "preview" && mode !== "canary") return jsonError("Modo de leitura inválido.");
      if (mode === "canary" && process.env.ESTOQUENOW_IMPORT_ENABLED !== "true")
        return jsonError("A gravação canário do EstoqueNOW está desabilitada por ambiente.", 403);
      if (mode === "canary" && !externalId)
        return jsonError("Informe exatamente um ID externo para a gravação canário.");
      if (mode === "canary" && !isValidExternalId(externalId))
        return jsonError("Informe um ID externo válido para a gravação canário.");

      const start = new Date(`${startDate}T00:00:00-03:00`);
      const end = new Date(`${endDate}T23:59:59-03:00`);
      const days = (end.getTime() - start.getTime()) / 86_400_000;
      if (days < 0 || days > 366) return jsonError("Use um período de até 366 dias.");

      let external;
      let contract;
      try {
        const inspected = await inspectEstoqueNowOperations(start, end);
        external = inspected.operations;
        contract = inspected.contract;
      } catch {
        return jsonError(
          "A leitura do EstoqueNOW falhou. Verifique credenciais, URL e disponibilidade da API.",
          502,
        );
      }
      const importedAt = new Date().toISOString();
      const skippedReasons: Record<EstoqueNowSkipReason, number> = {
        missing_external_id: 0,
        invalid_external_id: 0,
        missing_event_name: 0,
        invalid_event_name: 0,
        missing_destination: 0,
        invalid_destination: 0,
        invalid_scheduled_date_or_time: 0,
      };
      const rows: EstoqueNowImportRow[] = [];
      for (const operation of external) {
        const candidate = estoqueNowImportRow(operation, importedAt);
        if (candidate.row) rows.push(candidate.row);
        else if (candidate.reason) skippedReasons[candidate.reason] += 1;
      }

      const existingById = new Map<
        string,
        { external_id: string | null; event_name: string; destination: string; scheduled_at: string }
      >();
      for (let index = 0; index < rows.length; index += 100) {
        const externalIds = rows.slice(index, index + 100).map((row) => row.external_id);
        const existing = await supabase
          .from("operations")
          .select("external_id,event_name,destination,scheduled_at")
          .eq("source", "estoquenow")
          .in("external_id", externalIds);
        if (existing.error) throw existing.error;
        for (const operation of existing.data ?? []) {
          if (operation.external_id) existingById.set(operation.external_id, operation);
        }
      }

      const candidates = rows.map((row) => {
        const existing = existingById.get(row.external_id);
        const state = !existing
          ? ("new" as const)
          : sourceFieldsDiverged(existing, row)
            ? ("diverged" as const)
            : ("unchanged" as const);
        return {
          externalId: row.external_id,
          eventName: row.event_name,
          destination: row.destination,
          scheduledAt: row.scheduled_at,
          state,
          row,
        };
      });

      if (mode === "preview") {
        return NextResponse.json({
          ok: true,
          mode,
          startDate,
          endDate,
          importEnabled: process.env.ESTOQUENOW_IMPORT_ENABLED === "true",
          total: external.length,
          movementsTotal: contract.pages.reduce((total, page) => total + page.records, 0),
          candidates: candidates.map((candidate) => ({
            externalId: candidate.externalId,
            eventName: candidate.eventName,
            destination: candidate.destination,
            scheduledAt: candidate.scheduledAt,
            state: candidate.state,
          })),
          counts: {
            new: candidates.filter((candidate) => candidate.state === "new").length,
            unchanged: candidates.filter((candidate) => candidate.state === "unchanged").length,
            diverged: candidates.filter((candidate) => candidate.state === "diverged").length,
            skipped: external.length - rows.length,
          },
          skippedReasons,
          contract,
        });
      }

      const matching = candidates.filter((candidate) => candidate.externalId === externalId);
      if (matching.length !== 1)
        return jsonError("O ID externo informado não corresponde a um único candidato válido.", 409);
      const candidate = matching[0];
      if (candidate.state === "diverged")
        return jsonError(
          "Divergência detectada. Nenhum dado foi gravado; revise a prévia antes de continuar.",
          409,
        );
      if (
        body.reviewedEventName !== candidate.eventName ||
        body.reviewedDestination !== candidate.destination ||
        body.reviewedScheduledAt !== candidate.scheduledAt
      )
        return jsonError(
          "O registro mudou desde a prévia. Revise os dados novamente antes de confirmar.",
          409,
        );

      const admin = createSupabaseAdminClient();
      if (!admin) return jsonError("Chave secreta do Supabase não configurada.", 503);
      const confirmed = await admin.rpc("confirm_estoquenow_canary", {
        p_external_id: candidate.row.external_id,
        p_event_name: candidate.row.event_name,
        p_destination: candidate.row.destination,
        p_scheduled_at: candidate.row.scheduled_at,
        p_notes: candidate.row.notes,
        p_imported_at: candidate.row.imported_at,
        p_manager_id: auth.user.id,
      });
      if (
        confirmed.error?.code === "23505" ||
        confirmed.error?.message.includes("source divergence")
      )
        return jsonError("O canário mudou durante a confirmação. Execute uma nova prévia.", 409);
      if (confirmed.error) throw confirmed.error;
      const imported = confirmed.data === "new";
      return NextResponse.json({
        ok: true,
        mode,
        externalId: candidate.externalId,
        imported: imported ? 1 : 0,
        preserved: imported ? 0 : 1,
        diverged: 0,
        skipped: external.length - rows.length,
      });
    }

    if (action === "confirm-action") {
      const form = await request.formData();
      const photo = evidenceFile(form.get("photo"));
      const operationId = text(form.get("operationId"));
      const deviceActionId = text(form.get("deviceActionId"));
      const stageValue = text(form.get("stage"));
      const responsibleId = text(form.get("responsibleId"));
      const latitude = Number(text(form.get("latitude")));
      const longitude = Number(text(form.get("longitude")));
      const accuracy = Number(text(form.get("accuracy")));
      const deviceCapturedAt = text(form.get("deviceCapturedAt"));
      let checklist: Record<string, boolean> = {};
      try {
        checklist = JSON.parse(text(form.get("checklist")) || "{}") as Record<
          string,
          boolean
        >;
      } catch {
        return jsonError("Checklist inválido.");
      }
      if (
        !isUuid(operationId) ||
        !isUuid(deviceActionId) ||
        !isUuid(responsibleId) ||
        !isStage(stageValue)
      )
        return jsonError("Ação incompleta.");

      const existing = await supabase
        .from("operation_events")
        .select("id,operation_id,stage,actor_id")
        .eq("device_action_id", deviceActionId)
        .maybeSingle();
      if (existing.error)
        return jsonError("Não foi possível verificar o reenvio da ação.", 500);
      if (existing.data) {
        if (
          existing.data.operation_id !== operationId ||
          existing.data.stage !== stageValue ||
          existing.data.actor_id !== auth.user.id
        )
          return jsonError("O identificador da ação já pertence a outro registro.", 409);
        return NextResponse.json({ state: "confirmed", event: existing.data });
      }

      if (!photo) return jsonError("Envie uma foto JPEG, PNG ou WebP de até 6 MB.");
      const required = checklistForStage(stageValue);
      if (!required.every((item) => checklist[item] === true))
        return jsonError("Conclua todo o checklist desta etapa.");
      if (
        ![latitude, longitude, accuracy].every(Number.isFinite) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        accuracy < 0
      )
        return jsonError("GPS inválido.");
      const capturedAt = new Date(deviceCapturedAt).getTime();
      if (
        !Number.isFinite(capturedAt) ||
        capturedAt > Date.now() + 5 * 60_000 ||
        capturedAt < Date.now() - 30 * 86_400_000
      )
        return jsonError("Horário do aparelho inválido.");
      const arrivalAccess = text(form.get("arrivalAccess"));
      const arrivalReason = text(form.get("arrivalReason"));
      const acceptanceName = text(form.get("acceptanceName"));
      if (
        stageValue === "arrival" &&
        (!["released", "blocked"].includes(arrivalAccess) ||
          (arrivalAccess === "blocked" && arrivalReason.length < 3))
      )
        return jsonError("Informe se o acesso foi liberado e, se não, o motivo.");
      if (stageValue === "delivery" && acceptanceName.length < 2)
        return jsonError("Identifique o responsável pelo aceite interno.");

      const photoPath = `${operationId}/${deviceActionId}.${extensionFor(photo)}`;
      const uploaded = await supabase.storage
        .from("operation-evidence")
        .upload(photoPath, photo, { contentType: photo.type, upsert: false });
      if (uploaded.error && uploaded.error.status !== 409)
        return jsonError("Não foi possível armazenar a foto.", 500);
      const uploadedByThisRequest = !uploaded.error;
      const confirmed = await supabase.rpc("confirm_operation_action", {
        p_operation_id: operationId,
        p_device_action_id: deviceActionId,
        p_stage: stageValue,
        p_device_captured_at: deviceCapturedAt,
        p_checklist: checklist,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy,
        p_responsible_id: responsibleId,
        p_note: text(form.get("note")) || null,
        p_photo_path: photoPath,
        p_arrival_access: arrivalAccess || null,
        p_arrival_reason: arrivalReason || null,
        p_acceptance_name: acceptanceName || null,
      });
      if (confirmed.error) {
        if (uploadedByThisRequest)
          await supabase.storage.from("operation-evidence").remove([photoPath]);
        return jsonError(
          "A etapa mudou ou você não tem permissão. Atualize antes de reenviar.",
          409,
        );
      }
      if (
        confirmed.data?.operation_id !== operationId ||
        confirmed.data?.stage !== stageValue
      )
        return jsonError("A confirmação retornou uma etapa diferente. Atualize a operação.", 409);
      return NextResponse.json({ state: "confirmed", event: confirmed.data });
    }

    if (action === "create-incident") {
      const form = await request.formData();
      const operationId = text(form.get("operationId"));
      const incidentId = text(form.get("incidentId"));
      const stageValue = text(form.get("stage"));
      const incidentType = text(form.get("type"));
      const severity = text(form.get("severity"));
      const description = text(form.get("description"));
      const responsibleId = text(form.get("responsibleId"));
      const photo = evidenceFile(form.get("photo"));
      if (!isUuid(operationId) || !isUuid(incidentId) || !isStage(stageValue))
        return jsonError("Ocorrência incompleta.");
      if (!["delay", "damage", "missing_item", "access", "other"].includes(incidentType))
        return jsonError("Tipo de ocorrência inválido.");
      if (!["low", "medium", "high"].includes(severity) || description.length < 3)
        return jsonError("Informe severidade e descrição.");
      if (responsibleId && !isUuid(responsibleId))
        return jsonError("Responsável inválido.");
      if (["damage", "missing_item"].includes(incidentType) && !photo)
        return jsonError("Avaria ou falta exige foto.");

      const latitudeText = text(form.get("latitude"));
      const longitudeText = text(form.get("longitude"));
      const accuracyText = text(form.get("accuracy"));
      const location = latitudeText
        ? {
            latitude: Number(latitudeText),
            longitude: Number(longitudeText),
            accuracy: Number(accuracyText),
          }
        : null;
      if (
        location &&
        (!Number.isFinite(location.latitude) ||
          !Number.isFinite(location.longitude) ||
          !Number.isFinite(location.accuracy))
      )
        return jsonError("GPS da ocorrência inválido.");

      const photoPath = photo
        ? `${operationId}/incident-${incidentId}.${extensionFor(photo)}`
        : null;
      if (photo && photoPath) {
        const uploaded = await supabase.storage
          .from("operation-evidence")
          .upload(photoPath, photo, { contentType: photo.type, upsert: false });
        if (
          uploaded.error &&
          uploaded.error.statusCode !== "409" &&
          !/already exists|duplicate/i.test(uploaded.error.message)
        )
          return jsonError("Não foi possível armazenar a foto.", 500);
      }
      const inserted = await supabase.rpc("create_operation_incident", {
        p_incident_id: incidentId,
        p_operation_id: operationId,
        p_stage: stageValue,
        p_type: incidentType,
        p_severity: severity,
        p_impact: text(form.get("impact")) || null,
        p_description: description,
        p_responsible_id: responsibleId || null,
        p_latitude: location?.latitude ?? null,
        p_longitude: location?.longitude ?? null,
        p_accuracy: location?.accuracy ?? null,
        p_photo_path: photoPath,
      });
      if (inserted.error) {
        if (photoPath) await supabase.storage.from("operation-evidence").remove([photoPath]);
        throw inserted.error;
      }
      const incident = inserted.data as {
        id?: string;
        operation_id?: string;
        actor_id?: string;
      } | null;
      if (
        incident?.id !== incidentId ||
        incident.operation_id !== operationId ||
        incident.actor_id !== auth.user.id
      )
        throw new Error("Confirmação de ocorrência inválida.");
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "update-incident-status") {
      if (!manager) return jsonError("Apenas gestores tratam ocorrências.", 403);
      const body = (await request.json()) as { id?: string; status?: string };
      if (
        !body.id ||
        !isUuid(body.id) ||
        !["open", "handling", "resolved"].includes(body.status ?? "")
      )
        return jsonError("Ocorrência ou status inválido.");
      const result = await supabase.rpc("set_incident_status", {
        p_id: body.id,
        p_status: body.status,
      });
      if (result.error) throw result.error;
      if (!result.data) return jsonError("Ocorrência não encontrada.", 404);
      return NextResponse.json({ ok: true });
    }
  } catch {
    return jsonError("A operação não pôde ser salva.", 500);
  }

  return jsonError("Ação desconhecida.", 404);
}
