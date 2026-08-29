export type DataSource = "estoquenow" | "mock";

export type OperationStatus =
  | "preparation"
  | "route"
  | "delivery"
  | "return"
  | "completed";

export type LogisticOperation = {
  id: string;
  orderId: string;
  eventName: string;
  venue: string;
  city: string;
  scheduledDate: string;
  scheduledTime: string;
  returnDate: string;
  status: OperationStatus;
  coordinator: string;
  crew: string;
  vehicle: string;
  nextMilestone: string;
  alert?: string;
};

export type LogisticsSnapshot = {
  source: DataSource;
  operations: LogisticOperation[];
  fetchedAt: string;
  notice: string;
};

export type LocationEvidence = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export type DepartureDraft = {
  operationId: string;
  driver: string;
  crew: string;
  vehicle: string;
  checks: Record<"load" | "documents" | "vehicle", boolean>;
  photoDataUrl: string;
  location: LocationEvidence | null;
  queuedAt: string | null;
};
