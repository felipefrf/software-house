export type Surface = "showroom" | "account" | "ops";
export type PublicView = "home" | "catalog" | "cart" | "checkout";
export type OpsModule =
  | "overview"
  | "crm"
  | "inventory"
  | "intelligence"
  | "factory"
  | "logistics"
  | "returns"
  | "integrations"
  | "finance";
export type EventStatus =
  | "submitted"
  | "proposal"
  | "reserved"
  | "picking"
  | "route"
  | "event"
  | "return"
  | "completed";
export type UnitStatus =
  | "available"
  | "picking"
  | "out"
  | "inspection"
  | "maintenance"
  | "retired";
export type Condition = "ok" | "damaged" | "missing";
export type CoverageDecision = "produce" | "sublet" | "substitute" | "reduce";
export type PaymentStatus = "pending" | "paid" | "overdue";

export type DispatchPlan = {
  vehicle: string;
  driver: string;
  crewLead: string;
  scannedUnitIds: string[];
  loadedUnitIds: string[];
  deliveryProof: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  detail: string;
  image: string;
  dailyRate: number;
  volumeM3: number;
  productionCost: number;
  replacementCost: number;
  leadDays: number;
  baseLocation: string;
  tracking: "individual" | "lot";
};

export type Scene = {
  id: string;
  title: string;
  type: string;
  city: string;
  note: string;
  image: string;
  items: { productId: string; quantity: number; x: number; y: number }[];
};

export type Reservation = {
  eventId: string;
  start: string;
  end: string;
  status: "hold" | "confirmed" | "completed" | "cancelled";
};

export type StockUnit = {
  id: string;
  productId: string;
  status: UnitStatus;
  condition: Condition;
  location: string;
  source: "initial" | "factory" | "purchase";
  reservations: Reservation[];
  lastMovement: string;
  note?: string;
};

export type EventDetails = {
  name: string;
  type: string;
  guests: number;
  environment: string;
  spaceLength: number;
  spaceWidth: number;
  city: string;
  venue: string;
  address: string;
  deliveryDate: string;
  deliveryTime: string;
  returnDate: string;
  returnTime: string;
  access: string;
  floor: string;
  parking: string;
  loadWindow: string;
  contactName: string;
  contactPhone: string;
  notes: string;
};

export type EventProject = {
  id: string;
  orderId: string;
  accountId: string;
  status: EventStatus;
  createdAt: string;
  sceneIds: string[];
  cart: Record<string, number>;
  details: EventDetails;
  coverage: Record<string, CoverageDecision>;
  logisticsStep: number;
  proposalApproved: boolean;
  proposalVersion: number;
  proposalExpiresAt: string;
  paymentStatus: {
    signal: PaymentStatus;
    balance: PaymentStatus;
    deposit: PaymentStatus;
  };
  dispatch: DispatchPlan;
  history: string[];
};

export type WorkOrder = {
  id: string;
  eventId: string;
  productId: string;
  quantity: number;
  stage: number;
};

export type MaintenanceOrder = {
  id: string;
  eventId: string;
  unitId: string;
  stage: number;
  cost: number;
  note: string;
};

export type DemoState = {
  version: 4;
  products: Product[];
  scenes: Scene[];
  favoriteProductIds: string[];
  units: StockUnit[];
  events: EventProject[];
  workOrders: WorkOrder[];
  maintenanceOrders: MaintenanceOrder[];
  activeEventId: string;
};

export const STORAGE_KEY = "imperio-demo-v4";
export const WORKFLOW: EventStatus[] = [
  "submitted",
  "proposal",
  "reserved",
  "picking",
  "route",
  "event",
  "return",
  "completed",
];
export const STATUS_LABEL: Record<EventStatus, string> = {
  submitted: "Pedido recebido",
  proposal: "Proposta pronta",
  reserved: "Reserva confirmada",
  picking: "Em separação",
  route: "Em rota",
  event: "No evento",
  return: "Retorno e inspeção",
  completed: "Concluído",
};

export const CITY_DATA: Record<
  string,
  { zone: string; distance: number; freight: number }
> = {
  "Mogi das Cruzes": { zone: "Base", distance: 0, freight: 680 },
  Suzano: { zone: "Alto Tietê", distance: 21, freight: 820 },
  Guararema: { zone: "Alto Tietê", distance: 28, freight: 920 },
  Jacareí: { zone: "Vale do Paraíba", distance: 47, freight: 1120 },
  "São José dos Campos": { zone: "Vale do Paraíba", distance: 64, freight: 1320 },
  Caçapava: { zone: "Vale do Paraíba", distance: 84, freight: 1540 },
  Taubaté: { zone: "Vale do Paraíba", distance: 103, freight: 1780 },
  Pindamonhangaba: { zone: "Vale do Paraíba", distance: 122, freight: 1980 },
  Guaratinguetá: { zone: "Vale do Paraíba", distance: 151, freight: 2380 },
  Lorena: { zone: "Vale do Paraíba", distance: 164, freight: 2540 },
  Aparecida: { zone: "Vale do Paraíba", distance: 144, freight: 2260 },
  Cruzeiro: { zone: "Vale do Paraíba", distance: 185, freight: 2860 },
  "Campos do Jordão": { zone: "Mantiqueira", distance: 150, freight: 2580 },
  "Santo Antônio do Pinhal": {
    zone: "Mantiqueira",
    distance: 132,
    freight: 2380,
  },
  Caraguatatuba: { zone: "Litoral Norte", distance: 145, freight: 2680 },
  "São Sebastião": { zone: "Litoral Norte", distance: 170, freight: 3160 },
  Ilhabela: { zone: "Litoral Norte", distance: 185, freight: 3580 },
  Ubatuba: { zone: "Litoral Norte", distance: 197, freight: 3460 },
  Guarulhos: { zone: "Grande São Paulo", distance: 52, freight: 1260 },
  "São Paulo": { zone: "Capital", distance: 63, freight: 1480 },
  Campinas: { zone: "Interior", distance: 155, freight: 2680 },
  Santos: { zone: "Baixada Santista", distance: 120, freight: 2280 },
  "Fora da rota — análise manual": {
    zone: "Sob consulta",
    distance: 0,
    freight: 0,
  },
};

export const PRODUCTS: Product[] = [
  {
    id: "sofa-alba",
    sku: "SOF-NAT",
    name: "Sofá Nature",
    category: "Sofás",
    detail: "280 × 80 × 74 cm · Coleção Nature",
    image: "/imperio/real-sofa-nature.png",
    dailyRate: 680,
    volumeM3: 3.2,
    productionCost: 3800,
    replacementCost: 7200,
    leadDays: 18,
    baseLocation: "Mogi · Galpão A · R01",
    tracking: "individual",
  },
  {
    id: "poltrona-orla",
    sku: "POL-RIG",
    name: "Poltrona Riga Linho",
    category: "Poltronas",
    detail: "56 × 57 × 82 cm · linho natural",
    image: "/imperio/real-poltrona-riga.png",
    dailyRate: 260,
    volumeM3: 0.7,
    productionCost: 1450,
    replacementCost: 2800,
    leadDays: 14,
    baseLocation: "Mogi · Galpão A · R03",
    tracking: "individual",
  },
  {
    id: "mesa-arco",
    sku: "MES-BOT",
    name: "Mesa Retangular Botânica",
    category: "Mesas",
    detail: "320 × 120 × 77 cm · madeira natural",
    image: "/imperio/real-mesa-botanica.png",
    dailyRate: 420,
    volumeM3: 1.4,
    productionCost: 1750,
    replacementCost: 3900,
    leadDays: 12,
    baseLocation: "Mogi · Galpão B · B04",
    tracking: "individual",
  },
  {
    id: "banco-linha",
    sku: "BAN-SOH",
    name: "Banco Alto Soho",
    category: "Bancos",
    detail: "41 × 41 × 77 cm · madeira e couro",
    image: "/imperio/real-banco-soho.png",
    dailyRate: 310,
    volumeM3: 1.1,
    productionCost: 1620,
    replacementCost: 3400,
    leadDays: 10,
    baseLocation: "Mogi · Galpão B · B08",
    tracking: "individual",
  },
  {
    id: "bistro-halo",
    sku: "CAD-DAL",
    name: "Cadeira Dália",
    category: "Cadeiras",
    detail: "52 × 55 × 84 cm · tecido e madeira",
    image: "/imperio/real-cadeira-dalia.png",
    dailyRate: 190,
    volumeM3: 0.5,
    productionCost: 980,
    replacementCost: 1900,
    leadDays: 9,
    baseLocation: "Mogi · Galpão C · C02",
    tracking: "individual",
  },
  {
    id: "puff-duna",
    sku: "SOF-DUN",
    name: "Sofá Modular Dunas",
    category: "Sofás modulares",
    detail: "100 × 100 × 45 cm · módulo branco",
    image: "/imperio/real-modular-dunas.png",
    dailyRate: 140,
    volumeM3: 0.4,
    productionCost: 620,
    replacementCost: 1200,
    leadDays: 8,
    baseLocation: "Mogi · Galpão A · R08",
    tracking: "lot",
  },
];

export const SCENES: Scene[] = [
  {
    id: "garden",
    title: "Lounge de casamento bordô",
    type: "Casamento",
    city: "Mogi das Cruzes",
    note: "Clássico, acolhedor e pensado para conversa",
    image: "/imperio/real-casamento.jpeg",
    items: [
      { productId: "sofa-alba", quantity: 2, x: 27, y: 64 },
      { productId: "poltrona-orla", quantity: 6, x: 58, y: 59 },
      { productId: "mesa-arco", quantity: 8, x: 75, y: 72 },
    ],
  },
  {
    id: "classic",
    title: "Recepção contemporânea",
    type: "Corporativo",
    city: "São Paulo",
    note: "Volumes naturais, vidro e circulação ampla",
    image: "/imperio/real-corporativo.jpeg",
    items: [
      { productId: "poltrona-orla", quantity: 8, x: 30, y: 67 },
      { productId: "mesa-arco", quantity: 10, x: 60, y: 58 },
      { productId: "puff-duna", quantity: 6, x: 80, y: 72 },
    ],
  },
  {
    id: "white",
    title: "Debutante em noite imperial",
    type: "Debutante",
    city: "Mogi das Cruzes",
    note: "Cristais, flores intensas e mesa de destaque",
    image: "/imperio/real-debutante.jpeg",
    items: [
      { productId: "sofa-alba", quantity: 3, x: 35, y: 63 },
      { productId: "poltrona-orla", quantity: 8, x: 63, y: 59 },
      { productId: "puff-duna", quantity: 10, x: 78, y: 75 },
    ],
  },
  {
    id: "rustic",
    title: "Casamento aberto para a serra",
    type: "Casamento",
    city: "Campos do Jordão",
    note: "Madeira natural e integração com a paisagem",
    image: "/imperio/real-inspiracao.jpeg",
    items: [
      { productId: "mesa-arco", quantity: 12, x: 42, y: 64 },
      { productId: "banco-linha", quantity: 8, x: 68, y: 72 },
      { productId: "bistro-halo", quantity: 10, x: 80, y: 49 },
    ],
  },
  {
    id: "sunset",
    title: "Celebração ao pôr do sol",
    type: "Casamento",
    city: "Ilhabela",
    note: "Layout externo com apoio de lounges",
    image: "/imperio/event-sunset.jpg",
    items: [
      { productId: "sofa-alba", quantity: 4, x: 25, y: 68 },
      { productId: "poltrona-orla", quantity: 8, x: 57, y: 62 },
      { productId: "bistro-halo", quantity: 12, x: 79, y: 71 },
    ],
  },
  {
    id: "color",
    title: "Mesa viva e colorida",
    type: "Corporativo",
    city: "São Paulo",
    note: "Cores fortes e pontos de encontro",
    image: "/imperio/event-color.jpg",
    items: [
      { productId: "mesa-arco", quantity: 8, x: 38, y: 64 },
      { productId: "bistro-halo", quantity: 14, x: 63, y: 58 },
      { productId: "puff-duna", quantity: 12, x: 82, y: 73 },
    ],
  },
];

const DEFAULT_DETAILS: EventDetails = {
  name: "Casamento Marina & Caio",
  type: "Casamento",
  guests: 220,
  environment: "Misto",
  spaceLength: 24,
  spaceWidth: 16,
  city: "Mogi das Cruzes",
  venue: "Fazenda Santa Clara",
  address: "Rodovia Mogi–Bertioga, km 12",
  deliveryDate: "2026-10-18",
  deliveryTime: "08:00",
  returnDate: "2026-10-20",
  returnTime: "10:00",
  access: "Doca no mesmo nível",
  floor: "Térreo",
  parking: "Área para 2 caminhões",
  loadWindow: "Montagem liberada entre 08:00 e 13:00",
  contactName: "Marina Souza",
  contactPhone: "(12) 99999-0284",
  notes: "Cerimônia externa e recepção interna. Proteger o piso do salão.",
};

function makeUnits(): StockUnit[] {
  const counts: Record<string, number> = {
    "sofa-alba": 9,
    "poltrona-orla": 22,
    "mesa-arco": 8,
    "banco-linha": 14,
    "bistro-halo": 24,
    "puff-duna": 30,
  };
  return PRODUCTS.flatMap((product) =>
    Array.from(
      { length: counts[product.id] },
      (_, index): StockUnit => ({
        id: `${product.sku}-${String(index + 1).padStart(3, "0")}`,
        productId: product.id,
        status:
          index === counts[product.id] - 1 && product.id === "poltrona-orla"
            ? "maintenance"
            : "available",
        condition:
          index === counts[product.id] - 1 && product.id === "poltrona-orla"
            ? "damaged"
            : "ok",
        location:
          index === counts[product.id] - 1 && product.id === "poltrona-orla"
            ? "Quarentena · Q01"
            : product.baseLocation,
        source: "initial",
        reservations:
          (index < 2 && product.id === "mesa-arco") ||
          (index < 6 && product.id === "poltrona-orla")
            ? [
                {
                  eventId: "EV-2182",
                  start: "2026-10-16T08:00",
                  end: "2026-10-19T22:00",
                  status: "confirmed",
                },
              ]
            : [],
        lastMovement: "Inventário inicial conferido",
      }),
    ),
  );
}

export function emptyDetails(): EventDetails {
  return {
    ...DEFAULT_DETAILS,
    name: "Novo evento",
    venue: "",
    address: "",
    notes: "",
  };
}

export function eventOpsDefaults() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return {
    proposalVersion: 1,
    proposalExpiresAt: expiry.toISOString().slice(0, 10),
    paymentStatus: {
      signal: "pending" as PaymentStatus,
      balance: "pending" as PaymentStatus,
      deposit: "pending" as PaymentStatus,
    },
    dispatch: {
      vehicle: "HR-02 · baú 18 m³",
      driver: "Diego Martins",
      crewLead: "Carlos Nunes",
      scannedUnitIds: [],
      loadedUnitIds: [],
      deliveryProof: false,
    },
  };
}

export function seedState(): DemoState {
  const events: EventProject[] = [
    {
      id: "EV-2184",
      orderId: "PED-0284",
      accountId: "ACC-MARINA",
      status: "submitted",
      createdAt: "22 ago · 13:19",
      sceneIds: ["garden"],
      cart: { "sofa-alba": 2, "mesa-arco": 12, "bistro-halo": 6 },
      details: DEFAULT_DETAILS,
      coverage: {},
      logisticsStep: 0,
      proposalApproved: false,
      ...eventOpsDefaults(),
      history: ["Pedido enviado pelo site", "Briefing e referências anexados"],
    },
    {
      id: "EV-2182",
      orderId: "PED-0282",
      accountId: "ACC-MARINA",
      status: "reserved",
      createdAt: "14 ago · 10:42",
      sceneIds: ["white"],
      cart: { "mesa-arco": 2, "poltrona-orla": 6 },
      details: {
        ...DEFAULT_DETAILS,
        name: "Editorial Aurora",
        type: "Editorial",
        city: "São Paulo",
        venue: "Casa Higienópolis",
        address: "Higienópolis · São Paulo",
        deliveryDate: "2026-10-17",
        deliveryTime: "09:00",
        returnDate: "2026-10-19",
        returnTime: "10:00",
      },
      coverage: {},
      logisticsStep: 0,
      proposalApproved: true,
      ...eventOpsDefaults(),
      paymentStatus: {
        signal: "paid",
        balance: "pending",
        deposit: "pending",
      },
      history: ["Proposta aprovada", "Sinal conciliado", "Reserva confirmada"],
    },
    {
      id: "EV-2168",
      orderId: "PED-0268",
      accountId: "ACC-MARINA",
      status: "completed",
      createdAt: "02 jun · 09:10",
      sceneIds: ["classic"],
      cart: { "poltrona-orla": 4, "puff-duna": 8 },
      details: {
        ...DEFAULT_DETAILS,
        name: "Noivado Beatriz",
        guests: 90,
        city: "Taubaté",
        venue: "Espaço Mantiqueira",
        address: "Centro · Taubaté",
        deliveryDate: "2026-07-10",
        returnDate: "2026-07-12",
      },
      coverage: {},
      logisticsStep: 5,
      proposalApproved: true,
      ...eventOpsDefaults(),
      paymentStatus: {
        signal: "paid",
        balance: "paid",
        deposit: "paid",
      },
      dispatch: {
        ...eventOpsDefaults().dispatch,
        deliveryProof: true,
      },
      history: ["Evento concluído", "Retorno conferido sem divergências"],
    },
  ];
  return {
    version: 4,
    products: PRODUCTS,
    scenes: SCENES,
    favoriteProductIds: ["sofa-alba", "mesa-arco"],
    units: makeUnits(),
    events,
    workOrders: [],
    maintenanceOrders: [],
    activeEventId: "EV-2184",
  };
}

function shiftHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function eventWindow(details: EventDetails) {
  const start = `${details.deliveryDate}T${details.deliveryTime}`;
  const end = `${details.returnDate}T${details.returnTime}`;
  return { start: shiftHours(start, -24), end: shiftHours(end, 12) };
}

export function overlaps(start: string, end: string, reservation: Reservation) {
  return (
    reservation.status !== "cancelled" &&
    reservation.status !== "completed" &&
    start < reservation.end &&
    end > reservation.start
  );
}

export function availableUnits(
  state: DemoState,
  event: EventProject,
  productId: string,
) {
  const { start, end } = eventWindow(event.details);
  return state.units.filter(
    (unit) =>
      unit.productId === productId &&
      unit.status === "available" &&
      unit.condition === "ok" &&
      !unit.reservations.some(
        (reservation) =>
          reservation.eventId !== event.id && overlaps(start, end, reservation),
      ),
  );
}

export function eventPlan(state: DemoState, event: EventProject) {
  return Object.entries(event.cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, requested]) => {
      const own = Math.min(
        requested,
        availableUnits(state, event, productId).length,
      );
      return {
        productId,
        requested,
        own,
        shortage: Math.max(0, requested - own),
      };
    });
}

export function reserveEvent(state: DemoState, eventId: string): DemoState {
  const event = state.events.find((entry) => entry.id === eventId);
  if (!event) return state;
  const window = eventWindow(event.details);
  const ids = new Set(
    eventPlan(state, event).flatMap((item) =>
      availableUnits(state, event, item.productId)
        .slice(0, item.own)
        .map((unit) => unit.id),
    ),
  );
  return {
    ...state,
    units: state.units.map((unit) =>
      ids.has(unit.id) &&
      !unit.reservations.some((reservation) => reservation.eventId === eventId)
        ? {
            ...unit,
            reservations: [
              ...unit.reservations,
              {
                eventId,
                start: window.start,
                end: window.end,
                status: "confirmed" as const,
              },
            ],
            lastMovement: `Reserva ${eventId} confirmada`,
          }
        : unit,
    ),
    events: state.events.map((entry) =>
      entry.id === eventId
        ? {
            ...entry,
            status: "reserved",
            proposalApproved: true,
            paymentStatus: { ...entry.paymentStatus, signal: "paid" },
            history: [...entry.history, "Sinal confirmado e tags reservadas"],
          }
        : entry,
    ),
  };
}

export function handoverFor(state: DemoState, event: EventProject) {
  const shortages = eventPlan(state, event).filter((item) => item.shortage > 0);
  const unresolved = shortages.filter(
    (item) => !event.coverage[item.productId],
  );
  if (event.status === "submitted")
    return {
      owner: "Comercial",
      next: "Financeiro",
      action: "Emitir proposta v1 e validar prazo",
      blocker: "Proposta ainda não enviada",
    };
  if (event.status === "proposal")
    return {
      owner: "Financeiro",
      next: "Estoque",
      action: "Conciliar sinal e confirmar reserva",
      blocker: event.paymentStatus.signal === "paid" ? "" : "Sinal pendente",
    };
  if (event.status === "reserved" && unresolved.length)
    return {
      owner: "Planejamento",
      next: "Fábrica / Compras",
      action: `Resolver ${unresolved.reduce((sum, item) => sum + item.shortage, 0)} peças em falta`,
      blocker: "Cobertura não aprovada",
    };
  if (event.status === "reserved")
    return {
      owner: "Estoque",
      next: "Logística",
      action: "Separar e ler todas as tags",
      blocker: "Pull list não conferida",
    };
  if (event.status === "picking")
    return {
      owner: "Logística",
      next: "Equipe de campo",
      action: "Conferir carga e liberar veículo",
      blocker: "Carga incompleta",
    };
  if (event.status === "route" || event.status === "event")
    return {
      owner: "Equipe de campo",
      next: "Retorno",
      action: "Registrar entrega e evidência",
      blocker: event.dispatch.deliveryProof
        ? ""
        : "Comprovante de entrega pendente",
    };
  if (event.status === "return")
    return {
      owner: "Inspeção",
      next: "Financeiro",
      action: "Resolver divergências e avarias",
      blocker: "Evento aguardando conferência final",
    };
  return {
    owner: "Financeiro",
    next: "Arquivo",
    action: "Fechar resultado e liberar caução",
    blocker:
      event.paymentStatus.balance === "paid" ? "" : "Saldo financeiro pendente",
  };
}

export function paymentSchedule(state: DemoState, event: EventProject) {
  const totals = quote(state, event);
  return [
    {
      id: "signal" as const,
      label: "Sinal de 40%",
      amount: totals.total * 0.4,
      dueDate: event.proposalExpiresAt,
      status: event.paymentStatus.signal,
    },
    {
      id: "balance" as const,
      label: "Saldo de 60%",
      amount: totals.total * 0.6,
      dueDate: event.details.deliveryDate,
      status: event.paymentStatus.balance,
    },
    {
      id: "deposit" as const,
      label: "Caução",
      amount: totals.rental * 0.1,
      dueDate: event.details.deliveryDate,
      status: event.paymentStatus.deposit,
    },
  ];
}

export function quote(
  state: DemoState,
  event: Pick<EventProject, "cart" | "details">,
) {
  const start = new Date(
    `${event.details.deliveryDate}T${event.details.deliveryTime}`,
  ).getTime();
  const end = new Date(
    `${event.details.returnDate}T${event.details.returnTime}`,
  ).getTime();
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const rental = state.products.reduce(
    (sum, product) =>
      sum + (event.cart[product.id] ?? 0) * product.dailyRate * days,
    0,
  );
  const volume = state.products.reduce(
    (sum, product) => sum + (event.cart[product.id] ?? 0) * product.volumeM3,
    0,
  );
  const city =
    CITY_DATA[event.details.city] ?? CITY_DATA["Fora da rota — análise manual"];
  const vehicles = Math.max(1, Math.ceil(volume / 18));
  const accessExtra =
    event.details.access === "Doca no mesmo nível"
      ? 0
      : event.details.access === "Elevador com janela"
        ? 480
        : 920;
  const freight = city.freight
    ? city.freight + Math.max(0, vehicles - 1) * 760 + accessExtra
    : 0;
  const crew = Math.max(4, Math.ceil(volume / 8)) * 6 * 85;
  return {
    rental,
    volume,
    vehicles,
    freight,
    crew,
    distance: city.distance,
    total: rental + freight + crew,
    manualFreight: city.freight === 0,
  };
}

export function eventEconomics(state: DemoState, event: EventProject) {
  const totals = quote(state, event);
  const plan = eventPlan(state, event);
  const requested = plan.reduce((sum, item) => sum + item.requested, 0);
  const shortage = plan.reduce((sum, item) => sum + item.shortage, 0);
  const coverageCost = plan.reduce((sum, item) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    if (!product || item.shortage === 0) return sum;
    const decision = event.coverage[item.productId] ?? "sublet";
    if (decision === "produce")
      return sum + item.shortage * product.productionCost;
    if (decision === "substitute") return sum + item.shortage * 160;
    if (decision === "reduce") return sum;
    return sum + item.shortage * product.dailyRate * 1.2;
  }, 0);
  const operatingCost =
    totals.freight * 0.62 +
    totals.crew * 0.82 +
    totals.rental * 0.07 +
    coverageCost;
  const contribution = Math.max(0, totals.total - operatingCost);
  const margin = totals.total ? contribution / totals.total : 0;
  const shortageRate = requested ? shortage / requested : 0;
  const readiness =
    event.status === "submitted" ? 0.35 : event.status === "proposal" ? 0.55 : 0.9;
  const score = Math.max(
    0,
    Math.min(100, Math.round(margin * 70 + readiness * 30 - shortageRate * 45)),
  );
  const recommendation =
    shortageRate >= 0.2
      ? "Condicionar à cobertura"
      : margin < 0.45
        ? "Reprecificar operação"
        : score >= 70
          ? "Priorizar"
          : "Aceitar com ajuste";
  return {
    totals,
    requested,
    shortage,
    operatingCost,
    contribution,
    margin,
    score,
    recommendation,
  };
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
