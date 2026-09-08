import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "cache-control": "private, no-store", vary: "Cookie" },
});

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("operationId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return reply({ error: "Operação inválida." }, 400);
  const db = await createSupabaseServerClient();
  if (!db) return reply({ error: "Serviço indisponível." }, 503);
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return reply({ error: "Sessão expirada." }, 401);
  const profile = await db.from("profiles").select("role,must_change_password").eq("id", auth.user.id).maybeSingle();
  if (profile.error) return reply({ error: "Consulta indisponível." }, 503);
  if (profile.data?.role !== "manager" || profile.data.must_change_password)
    return reply({ error: "Acesso restrito ao gestor." }, 403);
  // Cliente autenticado: as políticas RLS continuam sendo a fronteira de acesso.
  const operation = await db.from("operations").select("id").eq("id", id).maybeSingle();
  if (operation.error) return reply({ error: "Consulta indisponível." }, 503);
  if (!operation.data) return reply({ error: "Operação indisponível." }, 404);
  const sessions = await db.from("operation_tracking_sessions")
    .select("id,consented_at,stopped_at").eq("operation_id", id)
    .order("consented_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  if (sessions.error) return reply({ error: "Rastreamento indisponível." }, 503);
  const session = sessions.data[0] ?? null;
  if (!session) return reply({ session: null, points: [], truncated: false });
  const points = await db.from("operation_route_points")
    .select("id,device_captured_at,latitude,longitude,accuracy,mocked")
    .eq("operation_id", id).eq("session_id", session.id)
    .order("device_captured_at", { ascending: false }).order("id", { ascending: false }).limit(101);
  if (points.error) return reply({ error: "Posições indisponíveis." }, 503);
  return reply({ session, points: points.data.slice(0, 100), truncated: points.data.length > 100 });
}
