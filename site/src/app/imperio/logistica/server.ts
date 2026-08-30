import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { getEstoqueNowStatus } from "./data";
import type {
  Incident,
  LogisticsSnapshot,
  Operation,
  OperationEvent,
  Person,
  Team,
  Vehicle,
} from "./types";

const now = new Date();

const demoSnapshot = (): LogisticsSnapshot => ({
  configured: false,
  user: {
    id: "demo-manager",
    full_name: "Gestor de demonstração",
    role: "manager",
    job_title: "Coordenação",
    phone: null,
    availability: "available",
    must_change_password: false,
  },
  people: [
    {
      id: "demo-manager",
      full_name: "Gestor de demonstração",
      role: "manager",
      job_title: "Coordenação",
      phone: null,
      availability: "available",
      must_change_password: false,
    },
    {
      id: "demo-worker",
      full_name: "Funcionário demonstrativo",
      role: "worker",
      job_title: "Motorista",
      phone: "(00) 00000-0000",
      availability: "available",
      must_change_password: false,
    },
  ],
  teams: [
    {
      id: "demo-team",
      name: "Equipe demonstração",
      leader_id: "demo-worker",
      member_ids: ["demo-worker"],
    },
  ],
  vehicles: [
    {
      id: "demo-vehicle",
      name: "VUC demonstração",
      plate: "DEMO-01",
      vehicle_type: "VUC",
      capacity_label: "Dados simulados",
      status: "available",
    },
  ],
  operations: [
    {
      id: "demo-operation",
      source: "manual",
      external_id: null,
      event_name: "Operação manual demonstrativa",
      destination: "Av. Cassiano Ricardo, 601 — São José dos Campos, SP",
      scheduled_at: now.toISOString(),
      stage: "arrival",
      status: "active",
      stage_started_at: new Date(now.getTime() - 36 * 60 * 1000).toISOString(),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team",
      vehicle_id: "demo-vehicle",
      driver_id: "demo-worker",
      notes: "Dado demonstrativo. Configure o Supabase para operar e persistir.",
      imported_at: null,
      waiting_since: null,
      events: [
        {
          id: "demo-event",
          device_action_id: "00000000-0000-4000-8000-000000000001",
          stage: "departure",
          event_type: "stage_completed",
          state: "confirmed",
          device_captured_at: new Date(now.getTime() - 54 * 60 * 1000).toISOString(),
          server_received_at: new Date(now.getTime() - 53 * 60 * 1000).toISOString(),
          checklist: { "Carga fotografada e conferida": true },
          latitude: -23.55052,
          longitude: -46.633308,
          accuracy: 11,
          duration_seconds: 1_620,
          arrival_access: null,
          arrival_reason: null,
          acceptance_name: null,
          note: "Evidência simulada para revisão visual.",
          actor_name: "Funcionário demonstrativo",
          responsible_name: "Funcionário demonstrativo",
          photo_url: null,
        },
      ],
    },
  ],
  incidents: [
    {
      id: "demo-incident",
      operation_id: "demo-operation",
      stage: "arrival",
      type: "access",
      severity: "medium",
      impact: "Aguardando liberação",
      description: "Ocorrência demonstrativa para revisão da torre.",
      status: "open",
      latitude: -23.55052,
      longitude: -46.633308,
      accuracy: 11,
      created_at: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      resolved_at: null,
      actor_name: "Funcionário demonstrativo",
      responsible_name: "Gestor de demonstração",
      photo_url: null,
    },
  ],
  estoquenow: getEstoqueNowStatus(),
});

type Relation = { full_name: string } | { full_name: string }[] | null;

const relationName = (relation: Relation) =>
  (Array.isArray(relation) ? relation[0]?.full_name : relation?.full_name) ?? null;

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
      incidents: [],
      estoquenow: getEstoqueNowStatus(),
    };

  const currentProfileResult = await supabase
    .from("profiles")
    .select("id,full_name,role,job_title,phone,availability,must_change_password")
    .eq("id", auth.user.id)
    .single();
  if (currentProfileResult.error || !currentProfileResult.data)
    throw new Error("Não foi possível carregar o perfil autenticado.");
  const currentProfile = currentProfileResult.data as Person;
  if (currentProfile.must_change_password)
    return {
      configured: true,
      user: currentProfile,
      people: [currentProfile],
      teams: [],
      vehicles: [],
      operations: [],
      incidents: [],
      estoquenow: getEstoqueNowStatus(),
    };

  const [profilesResult, teamsResult, membersResult, vehiclesResult, operationsResult, eventsResult, incidentsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,role,job_title,phone,availability,must_change_password")
        .order("full_name"),
      supabase.from("teams").select("id,name,leader_id").order("name"),
      supabase.from("team_members").select("team_id,person_id"),
      supabase
        .from("vehicles")
        .select("id,name,plate,vehicle_type,capacity_label,status")
        .order("name"),
      supabase
        .from("operations")
        .select(
          "id,source,external_id,event_name,destination,scheduled_at,stage,status,stage_started_at,completed_at,cancel_reason,manager_id,team_id,vehicle_id,driver_id,notes,imported_at,waiting_since",
        )
        .order("scheduled_at"),
      supabase
        .from("operation_events")
        .select(
          "id,operation_id,device_action_id,stage,event_type,state,device_captured_at,server_received_at,checklist,latitude,longitude,accuracy,duration_seconds,arrival_access,arrival_reason,acceptance_name,note,photo_path,actor:profiles!operation_events_actor_id_fkey(full_name),responsible:profiles!operation_events_responsible_id_fkey(full_name)",
        )
        .order("server_received_at", { ascending: false }),
      supabase
        .from("incidents")
        .select(
          "id,operation_id,stage,type,severity,impact,description,status,latitude,longitude,accuracy,photo_path,created_at,resolved_at,actor:profiles!incidents_actor_id_fkey(full_name),responsible:profiles!incidents_responsible_id_fkey(full_name)",
        )
        .order("created_at", { ascending: false }),
    ]);

  const error =
    profilesResult.error ??
    teamsResult.error ??
    membersResult.error ??
    vehiclesResult.error ??
    operationsResult.error ??
    eventsResult.error ??
    incidentsResult.error;
  if (error) throw new Error("Não foi possível carregar a operação persistida.");

  const people = (profilesResult.data ?? []) as Person[];
  const memberships = (membersResult.data ?? []) as {
    team_id: string;
    person_id: string;
  }[];
  const teams = ((teamsResult.data ?? []) as Omit<Team, "member_ids">[]).map(
    (team) => ({
      ...team,
      member_ids: memberships
        .filter((member) => member.team_id === team.id)
        .map((member) => member.person_id),
    }),
  );
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];

  const rawEvents = (eventsResult.data ?? []) as unknown as Array<
    Omit<OperationEvent, "actor_name" | "responsible_name" | "photo_url"> & {
      operation_id: string;
      photo_path: string | null;
      actor: Relation;
      responsible: Relation;
    }
  >;
  const rawIncidents = (incidentsResult.data ?? []) as unknown as Array<
    Omit<Incident, "actor_name" | "responsible_name" | "photo_url"> & {
      photo_path: string | null;
      actor: Relation;
      responsible: Relation;
    }
  >;
  const photoPaths = [
    ...new Set(
      [...rawEvents, ...rawIncidents]
        .map((item) => item.photo_path)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const signed = photoPaths.length
    ? await supabase.storage
        .from("operation-evidence")
        .createSignedUrls(photoPaths, 3600)
    : null;
  const signedUrls = new Map(
    (signed?.data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  const events = rawEvents.map(
    ({ operation_id, photo_path, actor, responsible, ...event }) => ({
      operationId: operation_id,
      event: {
        ...event,
        actor_name: relationName(actor) ?? "Não informado",
        responsible_name: relationName(responsible) ?? "Não informado",
        photo_url: photo_path ? signedUrls.get(photo_path) ?? null : null,
      } satisfies OperationEvent,
    }),
  );

  const operations = ((operationsResult.data ?? []) as Omit<Operation, "events">[]).map(
    (operation) => ({
      ...operation,
      events: events
        .filter((entry) => entry.operationId === operation.id)
        .map((entry) => entry.event),
    }),
  );

  const incidents = rawIncidents.map(
    ({ photo_path, actor, responsible, ...incident }) => ({
      ...incident,
      actor_name: relationName(actor) ?? "Não informado",
      responsible_name: relationName(responsible),
      photo_url: photo_path ? signedUrls.get(photo_path) ?? null : null,
    } satisfies Incident),
  );

  const imported = operations.filter(
    (operation) => operation.source === "estoquenow" && operation.imported_at,
  );
  const lastSyncAt = imported
    .map((operation) => operation.imported_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    configured: true,
    user: currentProfile,
    people,
    teams,
    vehicles,
    operations,
    incidents,
    estoquenow: getEstoqueNowStatus(lastSyncAt, imported.length),
  };
}
