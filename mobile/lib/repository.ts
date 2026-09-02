import { supabase } from "./supabase";
import type {
  Operation,
  OperationEvent,
  OperationItemCheck,
  Profile,
  Team,
  Vehicle,
  WorkData,
} from "./types";

export async function loadRemoteWork(userId: string): Promise<WorkData> {
  if (!supabase) throw new Error("Configure o Supabase antes de entrar.");

  const [profile, people, teams, members, vehicles, operations, itemChecks, events] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,role,job_title,phone,availability,must_change_password")
        .eq("id", userId)
        .single(),
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
          "id,operation_id,device_action_id,stage,event_type,state,device_captured_at,server_received_at,latitude,longitude,accuracy,note,photo_path,actor_id,responsible_id",
        )
        .order("server_received_at", { ascending: false }),
    ]);

  const error =
    profile.error ??
    people.error ??
    teams.error ??
    members.error ??
    vehicles.error ??
    operations.error ??
    itemChecks.error ??
    events.error;
  if (error) throw new Error(error.message);
  if (!profile.data) throw new Error("Perfil autenticado não encontrado.");

  const memberships = (members.data ?? []) as Array<{
    team_id: string;
    person_id: string;
  }>;
  const work: WorkData = {
    user: profile.data as Profile,
    people: (people.data ?? []) as Profile[],
    teams: ((teams.data ?? []) as Array<Omit<Team, "member_ids">>).map(
      (team) => ({
        ...team,
        member_ids: memberships
          .filter((member) => member.team_id === team.id)
          .map((member) => member.person_id),
      }),
    ),
    vehicles: (vehicles.data ?? []) as Vehicle[],
    operations: ((operations.data ?? []) as unknown as Omit<Operation, "item_checks">[]).map(
      (operation) => ({
        ...operation,
        item_checks: ((itemChecks.data ?? []) as OperationItemCheck[]).filter(
          (item) => item.operation_id === operation.id,
        ),
      }),
    ),
    events: (events.data ?? []) as OperationEvent[],
    fetchedAt: new Date().toISOString(),
  };
  return work;
}
