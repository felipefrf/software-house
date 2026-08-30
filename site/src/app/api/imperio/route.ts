import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { getAppSnapshot } from "@/app/imperio/logistica/server";

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const text = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

export async function GET() {
  try {
    return NextResponse.json(await getAppSnapshot());
  } catch {
    return jsonError("Não foi possível atualizar a torre.", 500);
  }
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("Supabase não configurado.", 503);

  if (action === "login") {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return jsonError("Informe e-mail e senha.");
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    return error ? jsonError("Credenciais inválidas.", 401) : NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("Sessão expirada.", 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  try {
    if (action === "create-person") {
      if (profile?.role !== "manager") return jsonError("Apenas gestores cadastram pessoas.", 403);
      const admin = createSupabaseAdminClient();
      if (!admin) return jsonError("Chave secreta do Supabase não configurada.", 503);
      const body = (await request.json()) as {
        fullName?: string;
        email?: string;
        phone?: string;
        temporaryPassword?: string;
      };
      if (!body.fullName || !body.email || !body.temporaryPassword || body.temporaryPassword.length < 8)
        return jsonError("Nome, e-mail e senha temporária de 8 caracteres são obrigatórios.");
      const created = await admin.auth.admin.createUser({
        email: body.email,
        password: body.temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: body.fullName, role: "worker" },
      });
      if (created.error || !created.data.user) return jsonError("Não foi possível criar o acesso do funcionário.");
      const updated = await admin.from("profiles").update({ phone: body.phone || null }).eq("id", created.data.user.id);
      if (updated.error) {
        await admin.auth.admin.deleteUser(created.data.user.id);
        return jsonError("Cadastro revertido porque o perfil não pôde ser salvo.", 500);
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "create-team") {
      if (profile?.role !== "manager") return jsonError("Apenas gestores criam equipes.", 403);
      const body = (await request.json()) as { name?: string; leaderId?: string; memberIds?: string[] };
      if (!body.name || !body.leaderId) return jsonError("Nome e líder são obrigatórios.");
      const created = await supabase.rpc("create_team", {
        p_name: body.name,
        p_leader_id: body.leaderId,
        p_member_ids: body.memberIds ?? [],
      });
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "create-vehicle") {
      if (profile?.role !== "manager") return jsonError("Apenas gestores criam veículos.", 403);
      const body = (await request.json()) as { name?: string; plate?: string; capacityLabel?: string };
      if (!body.name || !body.plate) return jsonError("Nome e placa são obrigatórios.");
      const result = await supabase.from("vehicles").insert({
        name: body.name,
        plate: body.plate.toUpperCase(),
        capacity_label: body.capacityLabel || null,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "create-operation") {
      if (profile?.role !== "manager") return jsonError("Apenas gestores criam operações.", 403);
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
      const result = await supabase.from("operations").insert({
        source: "manual",
        event_name: body.eventName,
        destination: body.destination,
        scheduled_at: body.scheduledAt,
        manager_id: auth.user.id,
        team_id: body.teamId || null,
        vehicle_id: body.vehicleId || null,
        driver_id: body.driverId || null,
        notes: body.notes || null,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === "confirm-action") {
      const form = await request.formData();
      const photo = form.get("photo");
      const operationId = text(form.get("operationId"));
      const deviceActionId = text(form.get("deviceActionId"));
      const stage = text(form.get("stage"));
      const responsibleId = text(form.get("responsibleId"));
      const latitude = Number(text(form.get("latitude")));
      const longitude = Number(text(form.get("longitude")));
      const accuracy = Number(text(form.get("accuracy")));
      const deviceCapturedAt = text(form.get("deviceCapturedAt"));
      const checklist = JSON.parse(text(form.get("checklist")) || "{}") as Record<string, boolean>;
      if (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size > 6_000_000)
        return jsonError("Envie uma foto de até 6 MB.");
      if (!operationId || !deviceActionId || !responsibleId || !["preparation", "departure"].includes(stage))
        return jsonError("Ação incompleta.");
      if (!Object.keys(checklist).length || Object.values(checklist).some((checked) => !checked))
        return jsonError("Conclua todo o checklist.");
      if (![latitude, longitude, accuracy].every(Number.isFinite)) return jsonError("GPS inválido.");

      const extension = photo.type === "image/png" ? "png" : "jpg";
      const photoPath = `${operationId}/${deviceActionId}.${extension}`;
      const uploaded = await supabase.storage.from("operation-evidence").upload(photoPath, photo, {
        contentType: photo.type,
        upsert: true,
      });
      if (uploaded.error) return jsonError("Não foi possível armazenar a foto.", 500);
      const confirmed = await supabase.rpc("confirm_operation_action", {
        p_operation_id: operationId,
        p_device_action_id: deviceActionId,
        p_stage: stage,
        p_device_captured_at: deviceCapturedAt,
        p_checklist: checklist,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy,
        p_responsible_id: responsibleId,
        p_note: text(form.get("note")) || null,
        p_photo_path: photoPath,
      });
      if (confirmed.error) {
        await supabase.storage.from("operation-evidence").remove([photoPath]);
        return jsonError("A etapa mudou ou você não tem permissão. Atualize antes de reenviar.", 409);
      }
      return NextResponse.json({ state: "confirmed", event: confirmed.data });
    }
  } catch {
    return jsonError("A operação não pôde ser salva.", 500);
  }

  return jsonError("Ação desconhecida.", 404);
}
