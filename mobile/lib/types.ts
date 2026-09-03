export const operationStages = [
  "preparation",
  "departure",
  "travel",
  "arrival",
  "assembly",
  "delivery",
  "disassembly",
  "return",
  "inspection",
] as const;

export type OperationStage = (typeof operationStages)[number];
export type OutboxState =
  | "pending"
  | "sending"
  | "confirmed"
  | "conflict"
  | "failed"
  | "discarding";

export type Profile = {
  id: string;
  full_name: string;
  role: "manager" | "worker";
  job_title: string;
  phone: string | null;
  availability: "available" | "unavailable";
  must_change_password: boolean;
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
  vehicle_type: string;
  capacity_label: string | null;
  status: "available" | "in_use" | "maintenance";
};

export type EstoqueNowOperationContext = {
  order_id: string | null;
  protocol: string | null;
  source_version: string | null;
  return_at: string | null;
  venue: string | null;
  address_zipcode: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  delivery_status_id: string | null;
  delivery_status_type: string | null;
  delivery_concluded: boolean | null;
  return_status_id: string | null;
  return_status_type: string | null;
  return_concluded: boolean | null;
  item_count: string | null;
  order_type: string | null;
  logistic_type_id: string | null;
  items: Array<{ id: string; itemId: string; orderId: string; name: string }>;
};

export type OperationItemCheck = {
  operation_id: string;
  source_item_id: string;
  checked_by: string;
  checked_at: string;
};

export type Operation = {
  id: string;
  source: "manual" | "estoquenow";
  external_id: string | null;
  event_name: string;
  destination: string;
  scheduled_at: string;
  stage: OperationStage;
  status: "active" | "completed" | "cancelled";
  stage_started_at: string;
  completed_at: string | null;
  cancel_reason: string | null;
  manager_id: string;
  team_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  notes: string | null;
  imported_at: string | null;
  waiting_since: string | null;
  estoquenow_context?: EstoqueNowOperationContext | null;
  item_checks: OperationItemCheck[];
};

export type OperationEvent = {
  id: string;
  operation_id: string;
  device_action_id: string;
  stage: OperationStage;
  event_type: "stage_completed" | "arrival_blocked";
  state: "confirmed";
  device_captured_at: string;
  server_received_at: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  note: string | null;
  photo_path: string;
  actor_id: string;
  responsible_id: string;
};

export type WorkData = {
  user: Profile;
  people: Profile[];
  teams: Team[];
  vehicles: Vehicle[];
  operations: Operation[];
  events: OperationEvent[];
  fetchedAt: string;
};

export type LocationEvidence = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type RouteTrackingStopReason =
  | "returned"
  | "completed"
  | "cancelled"
  | "sign_out"
  | "departure_failed"
  | "operation_ended";

export type RouteTrackingSession = {
  sessionId: string;
  userId: string;
  operationId: string;
  termsVersion: string;
  consentedAt: string;
  startedAt: string;
  stoppedAt: string | null;
  stopReason: RouteTrackingStopReason | null;
  stopSynced: boolean;
  lastError: string | null;
};

export type RouteTrackingPoint = {
  id: string;
  sessionId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  mocked: boolean;
};

export type OutboxAction = {
  deviceActionId: string;
  operationId: string;
  operationName: string;
  stage: OperationStage;
  state: OutboxState;
  checklist: Record<string, boolean>;
  location: LocationEvidence;
  deviceCapturedAt: string;
  responsibleId: string;
  note: string;
  photoUri: string;
  photoPath: string;
  arrivalAccess: "released" | "blocked" | "";
  arrivalReason: string;
  acceptanceName: string;
  trackingTermsAccepted?: boolean;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

export type IncidentDraft = {
  id: string;
  operationId: string;
  stage: OperationStage;
  type: "delay" | "damage" | "missing_item" | "access" | "other";
  severity: "low" | "medium" | "high";
  impact: string;
  description: string;
  responsibleId: string;
  location: LocationEvidence | null;
  photoUri: string | null;
};
