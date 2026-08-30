import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { getEstoqueNowStatus } from "./data";
import type {
  LogisticsSnapshot,
  Operation,
  OperationEvent,
  Person,
  Team,
  Vehicle,
} from "./types";

const demoSnapshot = async (): Promise<LogisticsSnapshot> => ({
  configured: false,
  user: { id: "demo-manager", full_name: "Gestor de demonstração", role: "manager", phone: null },
  people: [
    { id: "demo-manager", full_name: "Gestor de demonstração", role: "manager", phone: null },
    { id: "demo-worker", full_name: "Funcionário demonstrativo", role: "worker", phone: "(00) 00000-0000" },
  ],
  teams: [{ id: "demo-team", name: "Equipe demonstração", leader_id: "demo-worker", member_ids: ["demo-worker"] }],
  vehicles: [{ id: "demo-vehicle", name: "Caminhão demonstração", plate: "DEMO-01", capacity_label: "Dados simulados", status: "available" }],
  operations: [{
    id: "demo-operation",
    source: "manual",
    external_id: null,
    event_name: "Operação manual demonstrativa",
    destination: "Av. Cassiano Ricardo, 601 — São José dos Campos, SP",
    scheduled_at: new Date().toISOString(),
    stage: "preparation",
    manager_id: "demo-manager",
    team_id: "demo-team",
    vehicle_id: "demo-vehicle",
    driver_id: "demo-worker",
    notes: "Não persistida: configure o Supabase para operar.",
    events: [],
  }],
  estoquenow: await getEstoqueNowStatus(),
});

export async function getAppSnapshot(): Promise<LogisticsSnapshot> {
  if (!isSupabaseConfigured()) return demoSnapshot();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return demoSnapshot();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return {
      configured: true,
      user: null,
      people: [],
      teams: [],
      vehicles: [],
      operations: [],
      estoquenow: await getEstoqueNowStatus(),
    };

  const [profilesResult, teamsResult, membersResult, vehiclesResult, operationsResult, eventsResult] =
    await Promise.all([
      supabase.from("profiles").select("id,full_name,role,phone").order("full_name"),
      supabase.from("teams").select("id,name,leader_id").order("name"),
      supabase.from("team_members").select("team_id,person_id"),
      supabase.from("vehicles").select("id,name,plate,capacity_label,status").order("name"),
      supabase.from("operations").select("id,source,external_id,event_name,destination,scheduled_at,stage,manager_id,team_id,vehicle_id,driver_id,notes").order("scheduled_at"),
      supabase.from("operation_events").select("id,operation_id,device_action_id,stage,state,device_captured_at,server_received_at,checklist,latitude,longitude,accuracy,note,photo_path,actor:profiles!operation_events_actor_id_fkey(full_name),responsible:profiles!operation_events_responsible_id_fkey(full_name)").order("server_received_at", { ascending: false }),
    ]);

  const error = profilesResult.error ?? teamsResult.error ?? membersResult.error ??
    vehiclesResult.error ?? operationsResult.error ?? eventsResult.error;
  if (error) throw new Error("Não foi possível carregar a operação persistida.");

  const people = (profilesResult.data ?? []) as Person[];
  const memberships = (membersResult.data ?? []) as { team_id: string; person_id: string }[];
  const teams = ((teamsResult.data ?? []) as Omit<Team, "member_ids">[]).map((team) => ({
    ...team,
    member_ids: memberships.filter((member) => member.team_id === team.id).map((member) => member.person_id),
  }));
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];
  const rawEvents = (eventsResult.data ?? []) as unknown as Array<{
    id: string;
    operation_id: string;
    device_action_id: string;
    stage: OperationEvent["stage"];
    state: "confirmed";
    device_captured_at: string;
    server_received_at: string;
    checklist: Record<string, boolean>;
    latitude: number;
    longitude: number;
    accuracy: number;
    note: string | null;
    photo_path: string | null;
    actor: { full_name: string } | { full_name: string }[] | null;
    responsible: { full_name: string } | { full_name: string }[] | null;
  }>;

  const events = await Promise.all(rawEvents.map(async ({ operation_id, photo_path, actor, responsible, ...event }) => {
    const relationName = (relation: { full_name: string } | { full_name: string }[] | null) =>
      (Array.isArray(relation) ? relation[0]?.full_name : relation?.full_name) ?? "Não informado";
    const photo = photo_path
      ? await supabase.storage.from("operation-evidence").createSignedUrl(photo_path, 3600)
      : null;
    return {
      operationId: operation_id,
      event: {
        ...event,
        actor_name: relationName(actor),
        responsible_name: relationName(responsible),
        photo_url: photo?.data?.signedUrl ?? null,
      } satisfies OperationEvent,
    };
  }));

  const operations = ((operationsResult.data ?? []) as Omit<Operation, "events">[]).map((operation) => ({
    ...operation,
    events: events.filter((entry) => entry.operationId === operation.id).map((entry) => entry.event),
  }));

  return {
    configured: true,
    user: people.find((person) => person.id === auth.user?.id) ?? null,
    people,
    teams,
    vehicles,
    operations,
    estoquenow: await getEstoqueNowStatus(),
  };
}
