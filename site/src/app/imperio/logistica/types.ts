export type Role = "manager" | "worker";
export type OperationStage =
  | "preparation"
  | "departure"
  | "travel"
  | "arrival"
  | "assembly"
  | "delivery"
  | "disassembly"
  | "return"
  | "inspection";
export type OperationStatus = "active" | "completed" | "cancelled";
export type ActionState = "pending" | "confirmed";

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

export type Person = {
  id: string;
  full_name: string;
  role: Role;
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

export type OperationEvent = {
  id: string;
  device_action_id: string;
  stage: OperationStage;
  event_type: "stage_completed" | "arrival_blocked";
  state: "confirmed";
  device_captured_at: string;
  server_received_at: string;
  checklist: Record<string, boolean>;
  latitude: number;
  longitude: number;
  accuracy: number;
  duration_seconds: number | null;
  arrival_access: "released" | "blocked" | null;
  arrival_reason: string | null;
  acceptance_name: string | null;
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
  status: OperationStatus;
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
  events: OperationEvent[];
};

export type Incident = {
  id: string;
  operation_id: string;
  stage: OperationStage;
  type: "delay" | "damage" | "missing_item" | "access" | "other";
  severity: "low" | "medium" | "high";
  impact: string | null;
  description: string;
  status: "open" | "handling" | "resolved";
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  created_at: string;
  resolved_at: string | null;
  actor_name: string;
  responsible_name: string | null;
  photo_url: string | null;
};

export type EstoqueNowStatus = {
  source: "estoquenow" | "mock";
  configured: boolean;
  import_enabled: boolean;
  pull_apply_enabled: boolean;
  notice: string;
  last_sync_at: string | null;
  imported_count: number;
  sync_health?: EstoqueNowSyncHealth | null;
};

export type EstoqueNowSyncRun = {
  id: string;
  trigger: "scheduled" | "manual";
  mode: "observe" | "apply";
  status:
    | "running"
    | "succeeded"
    | "partial"
    | "failed"
    | "abandoned"
    | "skipped";
  windowStart: string;
  windowEnd: string;
  batchLimit: number | null;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  valid: number;
  eligible: number;
  attempted: number;
  applied: number;
  unchanged: number;
  blocked: number;
  deferred: number;
  failed: number;
  errorCode: string | null;
};

export type EstoqueNowSyncHealth = {
  lastRun: EstoqueNowSyncRun | null;
  lastSuccessfulScheduledRun: EstoqueNowSyncRun | null;
  recentRuns: EstoqueNowSyncRun[];
};

export type LogisticsSnapshot = {
  configured: boolean;
  user: Person | null;
  people: Person[];
  teams: Team[];
  vehicles: Vehicle[];
  operations: Operation[];
  incidents: Incident[];
  estoquenow: EstoqueNowStatus;
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
  arrivalAccess: "released" | "blocked" | "";
  arrivalReason: string;
  acceptanceName: string;
  photoDataUrl: string;
};
