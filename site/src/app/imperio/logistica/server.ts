import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { checklistForStage } from "./action";
import { getEstoqueNowStatus } from "./data";
import type {
  Incident,
  LogisticsSnapshot,
  Operation,
  OperationEvent,
  OperationItemCheck,
  Person,
  Team,
  Vehicle,
  OperationStage,
} from "./types";

const now = new Date();
const ago = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();
const ahead = (hours: number) =>
  new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

const demoEvent = (
  sequence: number,
  stage: OperationStage,
  minutesAgo: number,
  actorName: string,
  photoUrl: string | null = null,
  note: string | null = null,
): OperationEvent => ({
  id: `demo-event-${sequence}`,
  device_action_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  stage,
  event_type: "stage_completed",
  state: "confirmed",
  device_captured_at: ago(minutesAgo),
  server_received_at: ago(minutesAgo - 1),
  checklist: Object.fromEntries(
    checklistForStage(stage).map((item) => [item, true]),
  ),
  latitude: -23.2237,
  longitude: -45.9009,
  accuracy: 9,
  duration_seconds: 1_380,
  arrival_access: stage === "arrival" ? "released" : null,
  arrival_reason: null,
  acceptance_name: stage === "delivery" ? "Responsável demonstrativo" : null,
  note,
  actor_name: actorName,
  responsible_name: actorName,
  photo_url: photoUrl,
});

const demoSnapshot = (): LogisticsSnapshot => ({
  configured: false,
  user: {
    id: "demo-manager",
    full_name: "Marina Costa",
    role: "manager",
    job_title: "Coordenação logística",
    phone: "(12) 99910-1001",
    availability: "available",
    must_change_password: false,
  },
  people: [
    {
      id: "demo-manager",
      full_name: "Marina Costa",
      role: "manager",
      job_title: "Coordenação logística",
      phone: "(12) 99910-1001",
      availability: "available",
      must_change_password: false,
    },
    {
      id: "demo-worker-1",
      full_name: "Diego Alves",
      role: "worker",
      job_title: "Líder e motorista",
      phone: "(12) 99910-1002",
      availability: "available",
      must_change_password: false,
    },
    {
      id: "demo-worker-2",
      full_name: "Lucas Martins",
      role: "worker",
      job_title: "Montagem",
      phone: "(12) 99910-1003",
      availability: "available",
      must_change_password: false,
    },
    {
      id: "demo-worker-3",
      full_name: "Rafael Souza",
      role: "worker",
      job_title: "Líder e motorista",
      phone: "(12) 99910-1004",
      availability: "available",
      must_change_password: false,
    },
    {
      id: "demo-worker-4",
      full_name: "Camila Rocha",
      role: "worker",
      job_title: "Conferência",
      phone: "(12) 99910-1005",
      availability: "unavailable",
      must_change_password: false,
    },
  ],
  teams: [
    {
      id: "demo-team-1",
      name: "Equipe Norte",
      leader_id: "demo-worker-1",
      member_ids: ["demo-worker-1", "demo-worker-2"],
    },
    {
      id: "demo-team-2",
      name: "Equipe Sul",
      leader_id: "demo-worker-3",
      member_ids: ["demo-worker-3", "demo-worker-4"],
    },
  ],
  vehicles: [
    {
      id: "demo-vehicle-1",
      name: "VUC 01",
      plate: "IMP-1A01",
      vehicle_type: "VUC",
      capacity_label: "3,5 t · baú",
      status: "in_use",
    },
    {
      id: "demo-vehicle-2",
      name: "Fiorino 02",
      plate: "IMP-2A02",
      vehicle_type: "Utilitário",
      capacity_label: "650 kg",
      status: "available",
    },
    {
      id: "demo-vehicle-3",
      name: "Caminhão 03",
      plate: "IMP-3A03",
      vehicle_type: "Caminhão",
      capacity_label: "8 t · sider",
      status: "maintenance",
    },
  ],
  operations: [
    {
      id: "demo-operation-1",
      source: "manual",
      external_id: null,
      event_name: "Casamento · Espaço Cassiano",
      destination: "Av. Cassiano Ricardo, 601 — São José dos Campos, SP",
      scheduled_at: ahead(2),
      stage: "arrival",
      status: "active",
      stage_started_at: ago(22),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-1",
      vehicle_id: "demo-vehicle-1",
      driver_id: "demo-worker-1",
      notes: "Dado demonstrativo. Acesso lateral liberado pela produção.",
      imported_at: null,
      waiting_since: ago(12),
      item_checks: [],
      events: [
        demoEvent(1, "preparation", 126, "Diego Alves", "/imperio/hero-operation.png"),
        demoEvent(2, "departure", 88, "Diego Alves", "/imperio/real-corporativo.jpeg"),
        demoEvent(3, "travel", 44, "Diego Alves", null, "Trânsito normal na Dutra."),
      ],
    },
    {
      id: "demo-operation-2",
      source: "manual",
      external_id: null,
      event_name: "Corporativo · Parque Tecnológico",
      destination: "Estrada Doutor Altino Bondesan, 500 — São José dos Campos, SP",
      scheduled_at: ahead(20),
      stage: "preparation",
      status: "active",
      stage_started_at: ago(8),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: null,
      vehicle_id: null,
      driver_id: null,
      notes: "Dado demonstrativo com escala propositalmente incompleta.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [],
    },
    {
      id: "demo-operation-3",
      source: "manual",
      external_id: null,
      event_name: "Debutante · Villa Mantiqueira",
      destination: "Av. Shishima Hifumi, 2.911 — São José dos Campos, SP",
      scheduled_at: ago(150),
      stage: "assembly",
      status: "active",
      stage_started_at: ago(48),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-2",
      vehicle_id: "demo-vehicle-2",
      driver_id: "demo-worker-3",
      notes: "Dado demonstrativo. Conferir poltrona sinalizada antes da entrega.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [
        demoEvent(4, "preparation", 260, "Rafael Souza", "/imperio/real-debutante.jpeg"),
        demoEvent(5, "departure", 220, "Rafael Souza"),
        demoEvent(6, "travel", 175, "Rafael Souza"),
        demoEvent(7, "arrival", 128, "Rafael Souza", "/imperio/event-garden.jpg"),
      ],
    },
    {
      id: "demo-operation-4",
      source: "manual",
      external_id: null,
      event_name: "Editorial · Estúdio Orla",
      destination: "Rua Madre Paula de São José, 84 — São José dos Campos, SP",
      scheduled_at: ago(1_560),
      stage: "inspection",
      status: "completed",
      stage_started_at: ago(1_320),
      completed_at: ago(1_280),
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-1",
      vehicle_id: "demo-vehicle-1",
      driver_id: "demo-worker-1",
      notes: "Dado demonstrativo. Retorno conferido sem divergências.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [
        demoEvent(8, "inspection", 1_280, "Lucas Martins", "/imperio/event-white.jpg", "Devolução conferida."),
      ],
    },
    {
      id: "demo-operation-5",
      source: "manual",
      external_id: null,
      event_name: "Formatura · Clube de Campo",
      destination: "Av. Lineu de Moura, 1.800 — São José dos Campos, SP",
      scheduled_at: ahead(5),
      stage: "departure",
      status: "active",
      stage_started_at: ago(16),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-2",
      vehicle_id: "demo-vehicle-2",
      driver_id: "demo-worker-3",
      notes: "Dado demonstrativo. Carga conferida e pronta para saída.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [demoEvent(9, "preparation", 54, "Rafael Souza")],
    },
    {
      id: "demo-operation-6",
      source: "manual",
      external_id: null,
      event_name: "Convenção · Novotel SJC",
      destination: "Av. Dr. Nelson D'Ávila, 2.200 — São José dos Campos, SP",
      scheduled_at: ahead(9),
      stage: "travel",
      status: "active",
      stage_started_at: ago(28),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-1",
      vehicle_id: "demo-vehicle-1",
      driver_id: "demo-worker-1",
      notes: "Dado demonstrativo. Equipe em deslocamento pela Via Dutra.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [
        demoEvent(10, "preparation", 102, "Diego Alves"),
        demoEvent(11, "departure", 66, "Diego Alves"),
      ],
    },
    {
      id: "demo-operation-7",
      source: "manual",
      external_id: null,
      event_name: "Lançamento · Colinas Shopping",
      destination: "Av. São João, 2.200 — São José dos Campos, SP",
      scheduled_at: ahead(28),
      stage: "delivery",
      status: "active",
      stage_started_at: ago(14),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-2",
      vehicle_id: "demo-vehicle-2",
      driver_id: "demo-worker-3",
      notes: "Dado demonstrativo. Aguardando aceite do produtor no salão.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [
        demoEvent(12, "arrival", 82, "Rafael Souza"),
        demoEvent(13, "assembly", 36, "Camila Rocha", "/imperio/event-garden.jpg"),
      ],
    },
    {
      id: "demo-operation-8",
      source: "manual",
      external_id: null,
      event_name: "Aniversário · Quinta dos Lagos",
      destination: "Estr. Mun. Glaudistom Pereira de Oliveira, 2.000 — Jacareí, SP",
      scheduled_at: ahead(52),
      stage: "return",
      status: "active",
      stage_started_at: ago(31),
      completed_at: null,
      cancel_reason: null,
      manager_id: "demo-manager",
      team_id: "demo-team-1",
      vehicle_id: "demo-vehicle-1",
      driver_id: "demo-worker-1",
      notes: "Dado demonstrativo. Retorno parcial com itens já conferidos.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [demoEvent(14, "disassembly", 74, "Lucas Martins")],
    },
    {
      id: "demo-operation-9",
      source: "manual",
      external_id: null,
      event_name: "Mostra · Parque Vicentina Aranha",
      destination: "Rua Eng. Prudente Meireles de Moraes, 302 — São José dos Campos, SP",
      scheduled_at: ahead(78),
      stage: "preparation",
      status: "cancelled",
      stage_started_at: ago(180),
      completed_at: null,
      cancel_reason: "Evento demonstrativo cancelado pelo contratante.",
      manager_id: "demo-manager",
      team_id: null,
      vehicle_id: null,
      driver_id: null,
      notes: "Dado demonstrativo para visualizar o estado cancelado.",
      imported_at: null,
      waiting_since: null,
      item_checks: [],
      events: [],
    },
  ],
  incidents: [
    {
      id: "demo-incident-1",
      operation_id: "demo-operation-1",
      stage: "arrival",
      type: "access",
      severity: "medium",
      impact: "Aguardando liberação",
      description: "Portaria pediu confirmação do produtor responsável.",
      status: "open",
      latitude: -23.2237,
      longitude: -45.9009,
      accuracy: 9,
      created_at: ago(12),
      resolved_at: null,
      actor_name: "Diego Alves",
      responsible_name: "Marina Costa",
      photo_url: null,
    },
    {
      id: "demo-incident-2",
      operation_id: "demo-operation-3",
      stage: "assembly",
      type: "damage",
      severity: "high",
      impact: "Uma poltrona fora da composição principal",
      description: "Pequeno rasgo identificado durante a conferência de montagem.",
      status: "handling",
      latitude: -23.2198,
      longitude: -45.8916,
      accuracy: 12,
      created_at: ago(36),
      resolved_at: null,
      actor_name: "Camila Rocha",
      responsible_name: "Marina Costa",
      photo_url: "/imperio/real-debutante.jpeg",
    },
    {
      id: "demo-incident-3",
      operation_id: "demo-operation-4",
      stage: "return",
      type: "delay",
      severity: "low",
      impact: "Retorno 18 minutos após o previsto",
      description: "Trânsito intenso no acesso à base.",
      status: "resolved",
      latitude: -23.2237,
      longitude: -45.9009,
      accuracy: 18,
      created_at: ago(1_360),
      resolved_at: ago(1_300),
      actor_name: "Diego Alves",
      responsible_name: "Marina Costa",
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

  const [profilesResult, teamsResult, membersResult, vehiclesResult, operationsResult, itemChecksResult, eventsResult, incidentsResult] =
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
          "id,source,external_id,event_name,destination,scheduled_at,stage,status,stage_started_at,completed_at,cancel_reason,manager_id,team_id,vehicle_id,driver_id,notes,imported_at,waiting_since,estoquenow_context:estoquenow_operation_contexts(order_id,protocol,source_version,return_at,venue,address_zipcode,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,delivery_status_id,delivery_status_type,delivery_concluded,return_status_id,return_status_type,return_concluded,item_count,order_type,logistic_type_id,items)",
        )
        .order("scheduled_at"),
      supabase
        .from("operation_item_checks")
        .select("operation_id,source_item_id,checked_by,checked_at"),
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
    itemChecksResult.error ??
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

  const itemChecks = (itemChecksResult.data ?? []) as OperationItemCheck[];
  const operations = ((operationsResult.data ?? []) as unknown as Omit<Operation, "events" | "item_checks">[]).map(
    (operation) => ({
      ...operation,
      item_checks: itemChecks.filter((item) => item.operation_id === operation.id),
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
