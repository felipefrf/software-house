export type Role = "manager" | "worker";
export type OperationStage = "preparation" | "departure";
export type ActionState = "pending" | "confirmed";

export type Person = {
  id: string;
  full_name: string;
  role: Role;
  phone: string | null;
};

export type Team = {
  id: string;
  name: string;
  leader_id: string | null;
  member_ids: string[];
};

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
  capacity_label: string | null;
  status: "available" | "maintenance";
};

export type OperationEvent = {
  id: string;
  device_action_id: string;
  stage: OperationStage;
  state: "confirmed";
  device_captured_at: string;
  server_received_at: string;
  checklist: Record<string, boolean>;
  latitude: number;
  longitude: number;
  accuracy: number;
  note: string | null;
  actor_name: string;
  responsible_name: string;
  photo_url: string | null;
};

export type Operation = {
  id: string;
  source: "manual" | "estoquenow";
  external_id: string | null;
  event_name: string;
  destination: string;
  scheduled_at: string;
  stage: OperationStage;
  manager_id: string;
  team_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  notes: string | null;
  events: OperationEvent[];
};

export type LogisticsSnapshot = {
  configured: boolean;
  user: Person | null;
  people: Person[];
  teams: Team[];
  vehicles: Vehicle[];
  operations: Operation[];
  estoquenow: { source: "estoquenow" | "mock"; notice: string };
};

export type PendingAction = {
  deviceActionId: string;
  operationId: string;
  stage: OperationStage;
  state: ActionState;
  checklist: Record<string, boolean>;
  location: { latitude: number; longitude: number; accuracy: number };
  deviceCapturedAt: string;
  note: string;
  responsibleId: string;
  photoDataUrl: string;
};
