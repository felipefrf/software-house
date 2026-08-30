"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileJson,
  FileSignature,
  Heart,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Minus,
  PackagePlus,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShoppingBag,
  Truck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CITY_DATA,
  STATUS_LABEL,
  STORAGE_KEY,
  WORKFLOW,
  availableUnits,
  emptyDetails,
  eventEconomics,
  eventPlan,
  eventOpsDefaults,
  eventWindow,
  formatMoney,
  handoverFor,
  paymentSchedule,
  quote,
  reserveEvent,
  seedState,
  type CoverageDecision,
  type DemoState,
  type EventDetails,
  type EventProject,
  type OpsModule,
  type Product,
  type PublicView,
  type Scene,
  type StockUnit,
  type Surface,
} from "./model";

const inputClass =
  "mt-1.5 block w-full border border-[#bbc6ce] bg-white px-3 py-3 text-sm text-[#10243b] outline-none transition focus:border-[#2c63d6] focus:ring-2 focus:ring-[#2c63d6]/15";
const labelClass = "text-xs font-bold text-[#4e5e6a]";

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "blue" | "amber" | "red" | "neutral";
}) {
  const colors = {
    green: "bg-[#dcefe5] text-[#16533f]",
    blue: "bg-[#dfe8ff] text-[#234d9f]",
    amber: "bg-[#fae8cd] text-[#8a4c13]",
    red: "bg-[#f7dddd] text-[#923333]",
    neutral: "bg-[#e8ebe9] text-[#53605a]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${colors[tone]}`}
    >
      {children}
    </span>
  );
}

function Header({
  surface,
  setSurface,
  cartCount,
  reset,
}: {
  surface: Surface;
  setSurface: (surface: Surface) => void;
  cartCount: number;
  reset: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-[90] h-16 border-b border-[#2c4158] bg-[#10243b] text-white shadow-lg">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-3 sm:px-6">
        <button
          onClick={() => setSurface("showroom")}
          className="flex items-center gap-3 text-left"
        >
          <span className="grid size-9 place-items-center bg-[#d7ad5d] text-[#10243b]">
            <Armchair size={18} />
          </span>
          <span>
            <strong className="block text-sm tracking-[0.08em]">IMPÉRIO</strong>
            <small className="hidden font-mono text-[8px] uppercase tracking-[0.16em] text-[#b7c5d4] sm:block">
              Mogi · Vale do Paraíba · Estado de São Paulo
            </small>
          </span>
        </button>
        <nav className="flex h-full items-center">
          {[
            ["showroom", "Escolher peças"],
            ["account", "Meus eventos"],
            ["ops", "Operação"],
          ].map(([id, name]) => (
            <button
              key={id}
              onClick={() => setSurface(id as Surface)}
              aria-pressed={surface === id}
              className={`relative h-full border-x border-[#2c4158] px-3 text-[11px] font-black sm:px-5 sm:text-xs ${surface === id ? "bg-[#d7ad5d] text-[#10243b]" : "text-[#d6dfe8] hover:bg-[#19324e]"}`}
            >
              {name}
              {id === "showroom" && cartCount > 0 && (
                <span className="absolute right-1 top-2 grid size-5 place-items-center rounded-full bg-[#2c63d6] text-[9px] text-white">
                  {cartCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          onClick={reset}
          title="Restaurar demonstração"
          className="hidden items-center gap-2 border border-[#45627d] px-3 py-2 text-[10px] font-bold sm:flex"
        >
          <RotateCcw size={13} />
          Restaurar
        </button>
      </div>
    </header>
  );
}

function SceneModal({
  scene,
  products,
  close,
  addItem,
  addScene,
}: {
  scene: Scene;
  products: Product[];
  close: () => void;
  addItem: (id: string, qty: number) => void;
  addScene: (scene: Scene) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-[#06101c]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Produtos do ambiente ${scene.title}`}
    >
      <div className="mx-auto grid min-h-full max-w-6xl place-items-center">
        <div className="w-full overflow-hidden bg-white shadow-2xl lg:grid lg:grid-cols-[1.35fr_0.65fr]">
          <div className="relative min-h-[430px] bg-[#dfe4e7] lg:min-h-[680px]">
            <Image
              src={scene.image}
              alt={scene.title}
              fill
              className="object-cover"
              sizes="70vw"
              loading="eager"
            />
            {scene.items.map((item, index) => {
              const product = products.find(
                (entry) => entry.id === item.productId,
              );
              return (
                <button
                  key={item.productId}
                  onClick={() =>
                    document
                      .getElementById(`scene-product-${item.productId}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d7ad5d] text-xs font-black text-[#10243b] shadow-lg"
                  aria-label={`Ver ${product?.name}`}
                >
                  {index + 1}
                </button>
              );
            })}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07111d]/95 to-transparent p-6 pt-20 text-white">
              <Pill tone="amber">
                {scene.type} · {scene.city}
              </Pill>
              <h2 className="mt-3 font-serif text-4xl font-bold">
                {scene.title}
              </h2>
              <p className="mt-2 text-sm text-[#d5dde4]">{scene.note}</p>
            </div>
          </div>
          <aside className="flex max-h-[760px] flex-col">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#2c63d6]">
                  Peças nesta foto
                </p>
                <h3 className="mt-1 text-xl font-black text-[#10243b]">
                  Compre a composição
                </h3>
              </div>
              <button
                onClick={close}
                aria-label="Fechar ambiente"
                className="p-2"
              >
                <X size={19} />
              </button>
            </div>
            <div className="flex-1 divide-y overflow-y-auto">
              {scene.items.map((item, index) => {
                const product = products.find(
                  (entry) => entry.id === item.productId,
                )!;
                return (
                  <article
                    id={`scene-product-${item.productId}`}
                    key={item.productId}
                    className="grid grid-cols-[76px_1fr] gap-3 p-4"
                  >
                    <div className="relative size-[76px] overflow-hidden bg-[#edf1f3]">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="76px"
                      />
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-[#687783]">
                        {index + 1} · {product.sku}
                      </p>
                      <p className="font-black text-[#10243b]">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#687783]">{product.detail}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-bold">
                          {item.quantity} sugeridas
                        </span>
                        <button
                          onClick={() => addItem(product.id, item.quantity)}
                          className="flex items-center gap-1 bg-[#10243b] px-3 py-2 text-[10px] font-black text-white"
                        >
                          <Plus size={12} />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="border-t bg-[#f3f6f7] p-5">
              <button
                onClick={() => addScene(scene)}
                className="flex w-full items-center justify-center gap-2 bg-[#2c63d6] px-5 py-4 text-sm font-black text-white"
              >
                Adicionar ambiente completo <ShoppingBag size={16} />
              </button>
              <p className="mt-2 text-center text-[10px] text-[#687783]">
                As quantidades continuam editáveis no carrinho.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProductGrid({
  state,
  cart,
  setQuantity,
  toggleFavorite,
}: {
  state: DemoState;
  cart: Record<string, number>;
  setQuantity: (id: string, quantity: number) => void;
  toggleFavorite: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const categories = [
    "Todos",
    ...new Set(state.products.map((product) => product.category)),
  ];
  const visible = state.products.filter(
    (product) =>
      (category === "Todos" || product.category === category) &&
      `${product.name} ${product.detail}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 border px-4 py-2.5 text-xs font-black ${category === item ? "border-[#10243b] bg-[#10243b] text-white" : "border-[#c8d0d6] bg-white text-[#52616c]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="flex min-w-72 items-center gap-2 border border-[#c8d0d6] bg-white px-3 py-2.5">
          <Search size={15} className="text-[#687783]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar peça ou acabamento"
            className="w-full text-sm outline-none"
          />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((product) => {
          const quantity = cart[product.id] ?? 0;
          const currentStock = state.units.filter(
            (unit) =>
              unit.productId === product.id &&
              unit.status === "available" &&
              unit.condition === "ok",
          ).length;
          const favorite = state.favoriteProductIds.includes(product.id);
          return (
            <article
              key={product.id}
              className={`border bg-white p-3 transition ${quantity > 0 ? "border-[#2c63d6] ring-1 ring-[#2c63d6]" : "border-[#d0d6da] hover:-translate-y-1 hover:shadow-xl"}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#e5e8e6]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1280px) 25vw, 50vw"
                  unoptimized={product.image.startsWith("data:")}
                />
                <div className="absolute left-3 top-3">
                  <Pill tone="green">{currentStock} no galpão hoje</Pill>
                </div>
                <button
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={`${favorite ? "Remover" : "Adicionar"} ${product.name} dos favoritos`}
                  className={`absolute right-3 top-3 grid size-10 place-items-center rounded-full border bg-white shadow-lg ${favorite ? "border-[#d7ad5d] text-[#a56a00]" : "border-white text-[#687783]"}`}
                >
                  <Heart size={17} fill={favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="p-2 pt-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#68747d]">
                  {product.sku} · {product.category}
                </p>
                <h3 className="mt-1 text-xl font-black text-[#10243b]">
                  {product.name}
                </h3>
                <p className="text-xs text-[#68747d]">{product.detail}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold text-[#68747d]">
                      DIÁRIA A PARTIR DE
                    </p>
                    <p className="text-lg font-black text-[#10243b]">
                      {formatMoney(product.dailyRate)}
                    </p>
                  </div>
                  {quantity === 0 ? (
                    <button
                      onClick={() => setQuantity(product.id, 1)}
                      className="flex items-center gap-2 bg-[#10243b] px-4 py-3 text-xs font-black text-white"
                    >
                      <Plus size={14} />
                      Adicionar
                    </button>
                  ) : (
                    <div className="flex items-center border border-[#aebbc5]">
                      <button
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        aria-label={`Diminuir ${product.name}`}
                        className="p-2.5"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-9 text-center text-sm font-black">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        aria-label={`Aumentar ${product.name}`}
                        className="p-2.5"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CartView({
  state,
  cart,
  sceneIds,
  setQuantity,
  checkout,
  back,
}: {
  state: DemoState;
  cart: Record<string, number>;
  sceneIds: string[];
  setQuantity: (id: string, quantity: number) => void;
  checkout: () => void;
  back: () => void;
}) {
  const items = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const subtotal = items.reduce(
    (sum, [id, quantity]) =>
      sum +
      state.products.find((product) => product.id === id)!.dailyRate * quantity,
    0,
  );
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f1f4f5] px-5 py-12 text-[#10243b] lg:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={back}
          className="flex items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft size={15} />
          Continuar escolhendo
        </button>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#2c63d6]">
              Sua bandeja
            </p>
            <h1 className="mt-2 font-serif text-5xl font-bold">
              Revise as peças.
            </h1>
            <p className="mt-3 text-sm text-[#63727d]">
              Datas, local e logística entram no próximo passo. Aqui você só
              fecha a seleção.
            </p>
            <div className="mt-8 divide-y border-y border-[#cbd3d9] bg-white">
              {items.map(([id, quantity]) => {
                const product = state.products.find(
                  (entry) => entry.id === id,
                )!;
                return (
                  <article
                    key={id}
                    className="grid grid-cols-[88px_1fr] gap-4 p-4 sm:grid-cols-[110px_1fr_auto]"
                  >
                    <div className="relative h-24 overflow-hidden bg-[#e6eaec]">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="110px"
                        unoptimized={product.image.startsWith("data:")}
                      />
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-[#687783]">
                        {product.sku}
                      </p>
                      <h3 className="font-black">{product.name}</h3>
                      <p className="text-xs text-[#687783]">{product.detail}</p>
                      <p className="mt-2 text-sm font-bold">
                        {formatMoney(product.dailyRate)} / diária
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:block">
                      <div className="flex items-center border">
                        <button
                          onClick={() => setQuantity(id, quantity - 1)}
                          className="p-2"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-9 text-center font-black">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(id, quantity + 1)}
                          className="p-2"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => setQuantity(id, 0)}
                        className="mt-2 text-xs font-bold text-[#923333]"
                      >
                        Remover
                      </button>
                    </div>
                  </article>
                );
              })}
              {items.length === 0 && (
                <div className="p-12 text-center">
                  <ShoppingBag className="mx-auto text-[#89969f]" />
                  <h3 className="mt-4 text-xl font-black">
                    Sua bandeja está vazia.
                  </h3>
                  <button
                    onClick={back}
                    className="mt-5 bg-[#10243b] px-5 py-3 text-sm font-black text-white"
                  >
                    Ver catálogo
                  </button>
                </div>
              )}
            </div>
            {sceneIds.length > 0 && (
              <div className="mt-5 border border-[#cbd3d9] bg-white p-4">
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Referências anexadas
                </p>
                <div className="mt-3 flex gap-3 overflow-x-auto">
                  {sceneIds.map((id) => {
                    const scene = state.scenes.find(
                      (entry) => entry.id === id,
                    )!;
                    return (
                      <div
                        key={id}
                        className="flex min-w-56 items-center gap-3"
                      >
                        <div className="relative size-14 overflow-hidden">
                          <Image
                            src={scene.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-black">{scene.title}</p>
                          <p className="text-xs text-[#687783]">{scene.city}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          <aside className="h-fit border border-[#c5ced5] bg-white p-6 lg:sticky lg:top-24">
            <p className="font-mono text-[10px] uppercase text-[#687783]">
              Estimativa inicial
            </p>
            <div className="mt-4 flex justify-between text-sm">
              <span>
                {items.reduce((sum, [, quantity]) => sum + quantity, 0)} peças
              </span>
              <strong>{formatMoney(subtotal)} / diária</strong>
            </div>
            <div className="mt-5 border-y py-4 text-xs leading-5 text-[#63727d]">
              A disponibilidade real depende do intervalo do evento. Transporte,
              equipe, montagem e retirada serão calculados com o endereço.
            </div>
            <button
              onClick={checkout}
              disabled={items.length === 0}
              className="mt-5 flex w-full items-center justify-center gap-2 bg-[#2c63d6] px-5 py-4 text-sm font-black text-white disabled:opacity-35"
            >
              Continuar para o evento <ArrowRight size={15} />
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Checkout({
  state,
  cart,
  sceneIds,
  submit,
  cancel,
}: {
  state: DemoState;
  cart: Record<string, number>;
  sceneIds: string[];
  submit: (details: EventDetails) => void;
  cancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<EventDetails>(emptyDetails());
  const update = (patch: Partial<EventDetails>) =>
    setDetails((current) => ({ ...current, ...patch }));
  const preview: EventProject = {
    id: "PREVIEW",
    orderId: "PREVIEW",
    accountId: "ACC-MARINA",
    status: "submitted",
    createdAt: "agora",
    cart,
    sceneIds,
    details,
    coverage: {},
    logisticsStep: 0,
    proposalApproved: false,
    ...eventOpsDefaults(),
    history: [],
  };
  const plan = eventPlan(state, preview);
  const totals = quote(state, preview);
  const validPeriod =
    `${details.returnDate}T${details.returnTime}` >
    `${details.deliveryDate}T${details.deliveryTime}`;
  const valid =
    step === 0
      ? Boolean(
          details.name &&
            details.guests > 0 &&
            details.spaceLength > 0 &&
            details.spaceWidth > 0,
        )
      : step === 1
        ? Boolean(
            details.city && details.venue && details.address && validPeriod,
          )
        : Boolean(details.contactName && details.contactPhone);
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#edf1f3] px-4 py-10 text-[#10243b] lg:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={cancel}
          className="flex items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft size={15} />
          Voltar ao carrinho
        </button>
        <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_330px]">
          <section className="border border-[#c8d0d6] bg-white">
            <div className="grid grid-cols-3 border-b">
              {["Evento", "Local e agenda", "Disponibilidade"].map(
                (name, index) => (
                  <div
                    key={name}
                    className={`p-4 text-center text-xs font-black ${step === index ? "bg-[#10243b] text-white" : index < step ? "bg-[#e5f2eb] text-[#16533f]" : "text-[#72808a]"}`}
                  >
                    <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-[#d7ad5d] text-[#10243b]">
                      {index + 1}
                    </span>
                    {name}
                  </div>
                ),
              )}
            </div>
            <div className="p-5 md:p-8">
              {step === 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#2c63d6]">
                    Conta de Marina Souza
                  </p>
                  <h1 className="mt-2 text-3xl font-black">
                    Crie um novo evento nesta conta.
                  </h1>
                  <p className="mt-2 text-sm text-[#687783]">
                    Você poderá alternar entre todos os projetos depois do
                    envio.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className={labelClass}>
                      Nome do evento
                      <input
                        value={details.name}
                        onChange={(event) =>
                          update({ name: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Tipo
                      <select
                        value={details.type}
                        onChange={(event) =>
                          update({ type: event.target.value })
                        }
                        className={inputClass}
                      >
                        <option>Casamento</option>
                        <option>Corporativo</option>
                        <option>Debutante</option>
                        <option>Formatura</option>
                        <option>Aniversário</option>
                        <option>Feira e congresso</option>
                        <option>Editorial</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      Convidados
                      <input
                        type="number"
                        min="1"
                        value={details.guests}
                        onChange={(event) =>
                          update({ guests: Number(event.target.value) })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Ambiente
                      <select
                        value={details.environment}
                        onChange={(event) =>
                          update({ environment: event.target.value })
                        }
                        className={inputClass}
                      >
                        <option>Interno climatizado</option>
                        <option>Externo coberto</option>
                        <option>Externo descoberto</option>
                        <option>Misto</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      Comprimento útil (m)
                      <input
                        type="number"
                        min="1"
                        value={details.spaceLength}
                        onChange={(event) =>
                          update({ spaceLength: Number(event.target.value) })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Largura útil (m)
                      <input
                        type="number"
                        min="1"
                        value={details.spaceWidth}
                        onChange={(event) =>
                          update({ spaceWidth: Number(event.target.value) })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div>
                  <h1 className="text-3xl font-black">
                    Onde e quando a operação acontece?
                  </h1>
                  <p className="mt-2 text-sm text-[#687783]">
                    Usamos uma margem de 24 h antes e 12 h depois para separação
                    e inspeção.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className={labelClass}>
                      Cidade atendida
                      <select
                        value={details.city}
                        onChange={(event) =>
                          update({ city: event.target.value })
                        }
                        className={inputClass}
                      >
                        {Object.entries(CITY_DATA).map(([city, data]) => (
                          <option key={city} value={city}>
                            {city}
                            {data.distance ? ` · ${data.distance} km` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Espaço / venue
                      <input
                        value={details.venue}
                        onChange={(event) =>
                          update({ venue: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={`${labelClass} md:col-span-2`}>
                      Endereço completo
                      <input
                        value={details.address}
                        onChange={(event) =>
                          update({ address: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Entrega
                      <input
                        type="datetime-local"
                        value={`${details.deliveryDate}T${details.deliveryTime}`}
                        onChange={(event) => {
                          const [date, time] = event.target.value.split("T");
                          update({ deliveryDate: date, deliveryTime: time });
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Retirada concluída
                      <input
                        type="datetime-local"
                        value={`${details.returnDate}T${details.returnTime}`}
                        onChange={(event) => {
                          const [date, time] = event.target.value.split("T");
                          update({ returnDate: date, returnTime: time });
                        }}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Acesso de carga
                      <select
                        value={details.access}
                        onChange={(event) =>
                          update({ access: event.target.value })
                        }
                        className={inputClass}
                      >
                        <option>Doca no mesmo nível</option>
                        <option>Elevador com janela</option>
                        <option>Escadas / acesso restrito</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      Pavimento
                      <input
                        value={details.floor}
                        onChange={(event) =>
                          update({ floor: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Estacionamento / caminhões
                      <input
                        value={details.parking}
                        onChange={(event) =>
                          update({ parking: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Janela de montagem
                      <input
                        value={details.loadWindow}
                        onChange={(event) =>
                          update({ loadWindow: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                  {!validPeriod && (
                    <p className="mt-4 flex gap-2 border border-[#d8a1a1] bg-[#fbeaea] p-3 text-sm font-bold text-[#923333]">
                      <AlertTriangle size={17} />A retirada precisa terminar
                      depois da entrega.
                    </p>
                  )}
                </div>
              )}
              {step === 2 && (
                <div>
                  <h1 className="text-3xl font-black">
                    Disponibilidade e envio
                  </h1>
                  <p className="mt-2 text-sm text-[#687783]">
                    Falta não vira produção automaticamente. O time compara
                    alternativas depois do pedido.
                  </p>
                  <div className="mt-6 overflow-x-auto border">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-[#edf1f3] font-mono text-[9px] uppercase text-[#687783]">
                        <tr>
                          {[
                            "Peça",
                            "Pedido",
                            "Acervo no período",
                            "Falta",
                            "Tratamento",
                          ].map((name) => (
                            <th key={name} className="px-4 py-3 font-medium">
                              {name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plan.map((item) => {
                          const product = state.products.find(
                            (entry) => entry.id === item.productId,
                          )!;
                          return (
                            <tr key={item.productId}>
                              <td className="px-4 py-3 font-black">
                                {product.name}
                              </td>
                              <td className="px-4 py-3">{item.requested}</td>
                              <td className="px-4 py-3 text-[#16533f]">
                                {item.own}
                              </td>
                              <td className="px-4 py-3 font-black text-[#8a4c13]">
                                {item.shortage}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {item.shortage
                                  ? "Produzir, substituir, sublocar ou reduzir"
                                  : "Coberto"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className={labelClass}>
                      Responsável
                      <input
                        value={details.contactName}
                        onChange={(event) =>
                          update({ contactName: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      WhatsApp
                      <input
                        value={details.contactPhone}
                        onChange={(event) =>
                          update({ contactPhone: event.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className={`${labelClass} md:col-span-2`}>
                      Observações
                      <textarea
                        value={details.notes}
                        onChange={(event) =>
                          update({ notes: event.target.value })
                        }
                        rows={3}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t bg-[#f7f9fa] p-4">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold disabled:opacity-25"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
              {step < 2 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!valid}
                  className="flex items-center gap-2 bg-[#10243b] px-5 py-3 text-sm font-black text-white disabled:opacity-30"
                >
                  Continuar <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => submit(details)}
                  disabled={!valid}
                  className="flex items-center gap-2 bg-[#2c63d6] px-5 py-3 text-sm font-black text-white disabled:opacity-30"
                >
                  Enviar para análise <ArrowRight size={14} />
                </button>
              )}
            </div>
          </section>
          <aside className="h-fit border border-[#c8d0d6] bg-white xl:sticky xl:top-24">
            <div className="bg-[#10243b] p-5 text-white">
              <p className="font-mono text-[9px] uppercase text-[#d7ad5d]">
                Resumo vivo
              </p>
              <h2 className="mt-2 text-xl font-black">{details.name}</h2>
              <p className="mt-1 text-xs text-[#b7c5d4]">
                {details.city} · {details.deliveryDate}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#d7dee3]">
              {[
                [
                  "Peças",
                  Object.values(cart).reduce((sum, value) => sum + value, 0),
                ],
                ["Volume", `${totals.volume.toFixed(1)} m³`],
                ["Veículos", totals.vehicles],
                [
                  "Distância",
                  totals.manualFreight ? "analisar" : `${totals.distance} km`,
                ],
              ].map(([name, value]) => (
                <div key={name as string} className="bg-white p-4">
                  <p className="text-[9px] uppercase text-[#687783]">{name}</p>
                  <p className="mt-1 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between">
                <span>Locação</span>
                <strong>{formatMoney(totals.rental)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Transporte</span>
                <strong>
                  {totals.manualFreight
                    ? "Sob análise"
                    : formatMoney(totals.freight)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Equipe</span>
                <strong>{formatMoney(totals.crew)}</strong>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg">
                <strong>Estimativa</strong>
                <strong>
                  {totals.manualFreight ? "Parcial" : formatMoney(totals.total)}
                </strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Showroom({
  state,
  view,
  setView,
  cart,
  setQuantity,
  sceneIds,
  addScene,
  submit,
  toggleFavorite,
}: {
  state: DemoState;
  view: PublicView;
  setView: (view: PublicView) => void;
  cart: Record<string, number>;
  setQuantity: (id: string, quantity: number) => void;
  sceneIds: string[];
  addScene: (scene: Scene) => void;
  submit: (details: EventDetails) => void;
  toggleFavorite: (id: string) => void;
}) {
  const [scene, setScene] = useState<Scene | null>(null);
  if (view === "cart")
    return (
      <CartView
        state={state}
        cart={cart}
        sceneIds={sceneIds}
        setQuantity={setQuantity}
        checkout={() => setView("checkout")}
        back={() => setView("catalog")}
      />
    );
  if (view === "checkout")
    return (
      <Checkout
        state={state}
        cart={cart}
        sceneIds={sceneIds}
        submit={submit}
        cancel={() => setView("cart")}
      />
    );
  return (
    <div className="bg-[#f5f7f6] text-[#10243b]">
      {scene && (
        <SceneModal
          scene={scene}
          products={state.products}
          close={() => setScene(null)}
          addItem={(id, quantity) => {
            addScene({
              ...scene,
              items: [{ productId: id, quantity, x: 0, y: 0 }],
            });
          }}
          addScene={(selected) => {
            addScene(selected);
            setScene(null);
            setView("catalog");
          }}
        />
      )}
      {view === "home" && (
        <>
          <section className="relative min-h-[720px] overflow-hidden bg-[#10243b] text-white">
            <Image
              src="/imperio/real-inspiracao.jpeg"
              alt="Evento com mobiliário da Império"
              fill
              className="object-cover opacity-60"
              sizes="100vw"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071523]/95 via-[#071523]/55 to-transparent" />
            <div className="relative mx-auto flex min-h-[720px] max-w-[1500px] items-center px-5 py-20 lg:px-10">
              <div className="max-w-3xl">
                <Pill tone="amber">
                  Há mais de uma década criando ambientes em São Paulo
                </Pill>
                <h1 className="mt-6 font-serif text-6xl font-bold leading-[0.9] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
                  O acervo certo transforma o espaço.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#d4dde4]">
                  Explore ambientes reais da Império, encontre as peças da foto
                  e monte seu projeto antes de definir a operação.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      document
                        .getElementById("mural")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="flex items-center gap-2 bg-[#d7ad5d] px-6 py-4 text-sm font-black text-[#10243b]"
                  >
                    Explorar o mural <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => setView("catalog")}
                    className="border border-white/45 bg-white/10 px-6 py-4 text-sm font-black backdrop-blur"
                  >
                    Abrir catálogo
                  </button>
                </div>
                <div className="mt-12 grid max-w-2xl grid-cols-3 gap-px bg-white/20">
                  <div className="bg-[#10243b]/70 p-4">
                    <p className="text-2xl font-black">406</p>
                    <p className="text-[10px] uppercase text-[#c4d0d9]">
                      itens no catálogo atual
                    </p>
                  </div>
                  <div className="bg-[#10243b]/70 p-4">
                    <p className="text-2xl font-black">SP</p>
                    <p className="text-[10px] uppercase text-[#c4d0d9]">
                      logística própria no estado
                    </p>
                  </div>
                  <div className="bg-[#10243b]/70 p-4">
                    <p className="text-2xl font-black">10%</p>
                    <p className="text-[10px] uppercase text-[#c4d0d9]">
                      cashback Meu Império
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="mural" className="bg-[#0b1b2b] py-20 text-white">
            <div className="mx-auto max-w-[1500px] px-5 lg:px-10">
              <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d7ad5d]">
                    Mural comprável
                  </p>
                  <h2 className="mt-3 max-w-3xl font-serif text-5xl font-bold leading-[0.95] md:text-7xl">
                    Clique na foto. Encontre a peça.
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-[#afbdca]">
                  Cada ambiente está ligado aos produtos que aparecem nele.
                  Adicione uma peça ou copie a composição inteira.
                </p>
              </div>
              <div className="grid auto-rows-[260px] gap-4 md:grid-cols-2 lg:grid-cols-12">
                {state.scenes.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setScene(item)}
                    className={`group relative overflow-hidden text-left ${index === 0 ? "lg:col-span-7 lg:row-span-2" : index < 3 ? "lg:col-span-5" : "lg:col-span-4"}`}
                  >
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-[1.04]"
                      sizes="(min-width: 1024px) 55vw, 100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#06101c]/95 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                      <Pill tone="amber">
                        {item.items.length} produtos vinculados
                      </Pill>
                      <h3 className="mt-3 text-2xl font-black">{item.title}</h3>
                      <p className="mt-1 text-sm text-[#c6d0d9]">
                        {item.type} · {item.city}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#d7ad5d]">
                        Ver peças na foto <Camera size={14} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="bg-white py-16">
            <div className="mx-auto grid max-w-[1500px] gap-6 px-5 lg:grid-cols-3 lg:px-10">
              {[
                [
                  ShoppingBag,
                  "1. Escolha",
                  "Comece pelo mural ou catálogo, sem formulário no caminho.",
                ],
                [
                  CalendarDays,
                  "2. Contextualize",
                  "No checkout, informe cidade, espaço, entrega e retirada.",
                ],
                [
                  ClipboardCheck,
                  "3. Acompanhe",
                  "O pedido aparece na sua conta e na operação com o mesmo código.",
                ],
              ].map(([Icon, title, text]) => {
                const ItemIcon = Icon as typeof ShoppingBag;
                return (
                  <div
                    key={title as string}
                    className="border-l-4 border-[#d7ad5d] bg-[#f2f5f6] p-6"
                  >
                    <ItemIcon size={22} />
                    <h3 className="mt-5 text-xl font-black">
                      {title as string}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#687783]">
                      {text as string}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
      {view === "catalog" && (
        <main className="min-h-[calc(100vh-4rem)] bg-[#f1f4f5] py-14">
          <div className="mx-auto max-w-[1500px] px-5 lg:px-10">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#2c63d6]">
                  Catálogo
                </p>
                <h1 className="mt-2 font-serif text-5xl font-bold">
                  Escolha sem preencher formulário.
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-[#687783]">
                  O saldo abaixo é a posição de hoje. Datas e conflitos são
                  validados depois do carrinho.
                </p>
              </div>
              <button
                onClick={() => setView("home")}
                className="text-sm font-bold"
              >
                Voltar ao mural
              </button>
            </div>
            <div className="mt-10">
              <ProductGrid
                state={state}
                cart={cart}
                setQuantity={setQuantity}
                toggleFavorite={toggleFavorite}
              />
            </div>
          </div>
        </main>
      )}
      <button
        onClick={() => setView("cart")}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-4 bg-[#d7ad5d] px-5 py-4 text-left text-[#10243b] shadow-2xl"
      >
        <span className="grid size-9 place-items-center bg-[#10243b] text-white">
          <ShoppingBag size={17} />
        </span>
        <span>
          <strong className="block text-sm">Revisar seleção</strong>
          <small className="text-[10px] font-bold">
            {Object.values(cart).reduce((sum, value) => sum + value, 0)} peças
          </small>
        </span>
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

function Account({
  state,
  setActive,
  updateEvent,
  openShowroom,
  openOps,
}: {
  state: DemoState;
  setActive: (id: string) => void;
  updateEvent: (id: string, patch: Partial<EventProject>) => void;
  openShowroom: () => void;
  openOps: () => void;
}) {
  const event =
    state.events.find((entry) => entry.id === state.activeEventId) ??
    state.events[0];
  const totals = quote(state, event);
  const cashback = state.events
    .filter((entry) => entry.status === "completed")
    .reduce((sum, entry) => sum + quote(state, entry).rental * 0.1, 0);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#edf1f3] p-5 text-[#10243b] lg:p-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#2c63d6]">
              Conta de Marina Souza
            </p>
            <h1 className="mt-2 text-4xl font-black">Meus eventos</h1>
            <p className="mt-2 text-sm text-[#687783]">
              Um login, vários projetos independentes.
            </p>
          </div>
          <button
            onClick={openShowroom}
            className="flex items-center gap-2 bg-[#10243b] px-5 py-3 text-sm font-black text-white"
          >
            <Plus size={15} />
            Criar outro evento
          </button>
        </div>
        <section className="mt-6 grid overflow-hidden border-2 border-[#d7ad5d] bg-[#10243b] text-white md:grid-cols-[1fr_auto]">
          <div className="p-5 md:p-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#d7ad5d]">
              Meu Império Black · carteira de relacionamento
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {formatMoney(cashback)} em cashback disponível
            </h2>
            <p className="mt-2 text-xs text-[#b9c8d5]">
              Crédito gerado após eventos concluídos, com validade e regras de
              uso visíveis na conta.
            </p>
          </div>
          <div className="border-t border-[#40566b] bg-[#d7ad5d] p-5 text-[#10243b] md:min-w-72 md:border-l md:border-t-0">
            <p className="text-[10px] font-black uppercase">Próximo uso</p>
            <p className="mt-2 text-sm font-black">
              Disponível em pedidos a partir de {formatMoney(cashback * 20)}
            </p>
            <p className="mt-1 text-[10px]">Benefício demonstrativo · 10%</p>
          </div>
        </section>
        <div className="mt-8 grid gap-5 xl:grid-cols-[330px_1fr]">
          <aside className="space-y-3">
            {state.events.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full border p-4 text-left ${item.id === event.id ? "border-[#2c63d6] bg-[#e8efff] ring-1 ring-[#2c63d6]" : "border-[#ccd4da] bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] text-[#687783]">
                      {item.id} · {item.orderId}
                    </p>
                    <h3 className="mt-1 font-black">{item.details.name}</h3>
                    <p className="mt-1 text-xs text-[#687783]">
                      {item.details.city} · {item.details.deliveryDate}
                    </p>
                  </div>
                  <Pill
                    tone={
                      item.status === "completed"
                        ? "green"
                        : item.status === "submitted"
                          ? "amber"
                          : "blue"
                    }
                  >
                    {STATUS_LABEL[item.status]}
                  </Pill>
                </div>
              </button>
            ))}
          </aside>
          <main className="space-y-5">
            <section className="border border-[#cbd3d9] bg-white p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[#2c63d6]">
                    {event.id} · {event.orderId}
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    {event.details.name}
                  </h2>
                  <p className="mt-2 text-sm text-[#687783]">
                    {event.details.venue} · {event.details.city}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.status === "submitted" && (
                    <button
                      onClick={() =>
                        updateEvent(event.id, {
                          status: "proposal",
                          history: [
                            ...event.history,
                            "Proposta comercial emitida",
                          ],
                        })
                      }
                      className="bg-[#2c63d6] px-4 py-3 text-sm font-black text-white"
                    >
                      Abrir proposta
                    </button>
                  )}
                  {event.status === "proposal" && (
                    <button
                      onClick={() =>
                        updateEvent(event.id, { proposalApproved: true })
                      }
                      className="bg-[#1b674c] px-4 py-3 text-sm font-black text-white"
                    >
                      Aprovar proposta + sinal
                    </button>
                  )}
                  <button
                    onClick={openOps}
                    className="border border-[#10243b] px-4 py-3 text-sm font-black"
                  >
                    Ver fluxo interno
                  </button>
                </div>
              </div>
              <div className="mt-7 flex gap-2 overflow-x-auto">
                {WORKFLOW.map((status, index) => {
                  const activeIndex = WORKFLOW.indexOf(event.status);
                  return (
                    <div key={status} className="min-w-28 text-center">
                      <span
                        className={`mx-auto grid size-8 place-items-center rounded-full text-xs font-black ${index <= activeIndex ? "bg-[#1b674c] text-white" : "bg-[#e1e6e9] text-[#7c8992]"}`}
                      >
                        {index < activeIndex ? <Check size={13} /> : index + 1}
                      </span>
                      <p className="mt-2 text-[10px] font-bold">
                        {STATUS_LABEL[status]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="border border-[#cbd3d9] bg-white p-5">
                <h3 className="font-black">Peças e referências</h3>
                <div className="mt-4 space-y-3">
                  {Object.entries(event.cart).map(([id, quantity]) => {
                    const product = state.products.find(
                      (entry) => entry.id === id,
                    )!;
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <div className="relative size-12 overflow-hidden">
                          <Image
                            src={product.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized={product.image.startsWith("data:")}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black">{product.name}</p>
                          <p className="text-xs text-[#687783]">
                            {quantity} un. · {product.sku}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {event.sceneIds.length > 0 && (
                  <p className="mt-4 border-t pt-3 text-xs font-bold text-[#2c63d6]">
                    {event.sceneIds.length} referência(s) visual(is) anexada(s)
                  </p>
                )}
              </section>
              <section className="border border-[#cbd3d9] bg-white p-5">
                <h3 className="font-black">Resumo comercial</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Locação</span>
                    <strong>{formatMoney(totals.rental)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Transporte</span>
                    <strong>
                      {totals.manualFreight
                        ? "Sob análise"
                        : formatMoney(totals.freight)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Equipe</span>
                    <strong>{formatMoney(totals.crew)}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-lg">
                    <strong>Estimativa</strong>
                    <strong>{formatMoney(totals.total)}</strong>
                  </div>
                </div>
                <p className="mt-5 text-xs text-[#687783]">
                  Proposta, sinal e documentos são demonstrativos nesta versão.
                </p>
              </section>
            </div>
            <section className="border-2 border-[#d7ad5d] bg-[#10243b] p-5 text-white">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#d7ad5d]">
                    Proposta v{event.proposalVersion} · válida até{" "}
                    {event.proposalExpiresAt}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    Contrato e pagamentos em uma visão
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-[#b9c8d5]">
                    O aceite do sinal reserva as peças; saldo e caução continuam
                    visíveis até a conciliação.
                  </p>
                </div>
                <FileSignature className="text-[#d7ad5d]" size={28} />
              </div>
              <div className="mt-5 grid gap-px bg-[#40566b] md:grid-cols-3">
                {paymentSchedule(state, event).map((payment) => (
                  <div key={payment.id} className="bg-[#142c43] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black">{payment.label}</p>
                      <Pill
                        tone={
                          payment.status === "paid"
                            ? "green"
                            : payment.status === "overdue"
                              ? "red"
                              : "amber"
                        }
                      >
                        {payment.status === "paid"
                          ? "Conciliado"
                          : payment.status === "overdue"
                            ? "Atrasado"
                            : "Pendente"}
                      </Pill>
                    </div>
                    <p className="mt-3 text-xl font-black">
                      {formatMoney(payment.amount)}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-[#9fb0bf]">
                      Vencimento {payment.dueDate}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="border border-[#cbd3d9] bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase text-[#2c63d6]">
                    Projeto visual compartilhado
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Moodboard de Marina
                  </h3>
                </div>
                <Pill tone="blue">
                  {state.favoriteProductIds.length + event.sceneIds.length}{" "}
                  referências
                </Pill>
              </div>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {event.sceneIds.map((id) => {
                  const scene = state.scenes.find((item) => item.id === id);
                  return scene ? (
                    <div key={id} className="min-w-44">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                          src={scene.image}
                          alt={scene.title}
                          fill
                          className="object-cover"
                          sizes="176px"
                        />
                      </div>
                      <p className="mt-2 text-xs font-black">{scene.title}</p>
                    </div>
                  ) : null;
                })}
                {state.favoriteProductIds.map((id) => {
                  const product = state.products.find((item) => item.id === id);
                  return product ? (
                    <div key={id} className="min-w-32">
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="128px"
                          unoptimized={product.image.startsWith("data:")}
                        />
                      </div>
                      <p className="mt-2 text-xs font-black">{product.name}</p>
                    </div>
                  ) : null;
                })}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProductRegistration({
  state,
  changeState,
}: {
  state: DemoState;
  changeState: React.Dispatch<React.SetStateAction<DemoState>>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "Estar",
    detail: "",
    image: "/imperio/real-cadeira-dalia.png",
    dailyRate: 240,
    productionCost: 1200,
    replacementCost: 2600,
    leadDays: 12,
    volumeM3: 0.8,
    baseLocation: "Galpão A · R10",
    tracking: "individual" as "individual" | "lot",
    quantity: 1,
  });
  const readImage = (file?: File) => {
    if (!file) return;
    if (file.size > 900_000) {
      setForm((current) => ({
        ...current,
        image: "/imperio/real-cadeira-dalia.png",
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((current) => ({
        ...current,
        image:
          typeof reader.result === "string"
            ? reader.result
            : "/imperio/real-cadeira-dalia.png",
      }));
    reader.readAsDataURL(file);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const id = `produto-${Date.now()}`;
    const product: Product = {
      id,
      sku: form.sku || `NOV-${state.products.length + 1}`,
      name: form.name,
      category: form.category,
      detail: form.detail,
      image: form.image,
      dailyRate: form.dailyRate,
      productionCost: form.productionCost,
      replacementCost: form.replacementCost,
      leadDays: form.leadDays,
      volumeM3: form.volumeM3,
      baseLocation: form.baseLocation,
      tracking: form.tracking,
    };
    const units: StockUnit[] = Array.from(
      { length: form.quantity },
      (_, index) => ({
        id: `${product.sku}-${String(index + 1).padStart(3, "0")}`,
        productId: id,
        status: "available",
        condition: "ok",
        location: product.baseLocation,
        source: "purchase",
        reservations: [],
        lastMovement: "Cadastro e entrada inicial · agora",
      }),
    );
    changeState((current) => ({
      ...current,
      products: [...current.products, product],
      units: [...current.units, ...units],
    }));
    setOpen(false);
  };
  return (
    <>
      {
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 bg-[#10243b] px-4 py-3 text-sm font-black text-white"
        >
          <PackagePlus size={15} />
          Cadastrar modelo
        </button>
      }
      {open && (
        <form
          onSubmit={submit}
          className="mt-5 border-2 border-[#2c63d6] bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase text-[#2c63d6]">
                Modelo + primeiro estoque
              </p>
              <h3 className="text-xl font-black">Cadastro de produto</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className={labelClass}>
              Nome
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              SKU
              <input
                value={form.sku}
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Categoria
              <input
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Acabamento e dimensões
              <input
                value={form.detail}
                onChange={(event) =>
                  setForm({ ...form, detail: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Foto
              <input
                type="file"
                accept="image/*"
                onChange={(event) => readImage(event.target.files?.[0])}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Rastreio
              <select
                value={form.tracking}
                onChange={(event) =>
                  setForm({
                    ...form,
                    tracking: event.target.value as "individual" | "lot",
                  })
                }
                className={inputClass}
              >
                <option value="individual">QR individual</option>
                <option value="lot">Lote e quantidade</option>
              </select>
            </label>
            <label className={labelClass}>
              Diária
              <input
                type="number"
                min="0"
                value={form.dailyRate}
                onChange={(event) =>
                  setForm({ ...form, dailyRate: Number(event.target.value) })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Custo de fabricação
              <input
                type="number"
                min="0"
                value={form.productionCost}
                onChange={(event) =>
                  setForm({
                    ...form,
                    productionCost: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Reposição
              <input
                type="number"
                min="0"
                value={form.replacementCost}
                onChange={(event) =>
                  setForm({
                    ...form,
                    replacementCost: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Lead fabril (dias)
              <input
                type="number"
                min="1"
                value={form.leadDays}
                onChange={(event) =>
                  setForm({ ...form, leadDays: Number(event.target.value) })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Volume m³
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={form.volumeM3}
                onChange={(event) =>
                  setForm({ ...form, volumeM3: Number(event.target.value) })
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Quantidade inicial
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) =>
                  setForm({ ...form, quantity: Number(event.target.value) })
                }
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Localização
              <input
                value={form.baseLocation}
                onChange={(event) =>
                  setForm({ ...form, baseLocation: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <div className="relative min-h-28 overflow-hidden bg-[#edf1f3]">
              <Image
                src={form.image}
                alt="Prévia"
                fill
                className="object-cover"
                sizes="240px"
                unoptimized={form.image.startsWith("data:")}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-[#687783]">
              Fotos de até 900 KB persistem localmente; acima disso usamos uma
              prévia padrão.
            </p>
            <button className="bg-[#2c63d6] px-5 py-3 text-sm font-black text-white">
              Salvar e gerar tags
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function ReceivablesBoard({
  state,
  changeState,
}: {
  state: DemoState;
  changeState: React.Dispatch<React.SetStateAction<DemoState>>;
}) {
  const rows = state.events.flatMap((event) =>
    paymentSchedule(state, event).map((payment) => ({ event, payment })),
  );
  const total = rows.reduce((sum, row) => sum + row.payment.amount, 0);
  const received = rows
    .filter((row) => row.payment.status === "paid")
    .reduce((sum, row) => sum + row.payment.amount, 0);
  const overdue = rows
    .filter((row) => row.payment.status === "overdue")
    .reduce((sum, row) => sum + row.payment.amount, 0);
  const setPayment = (
    eventId: string,
    id: "signal" | "balance" | "deposit",
    status: "pending" | "paid" | "overdue",
  ) =>
    changeState((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              paymentStatus: { ...event.paymentStatus, [id]: status },
              history: [...event.history, `${id}: ${status}`],
            }
          : event,
      ),
    }));
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[9px] uppercase text-[#687783]">
            Agenda financeira consolidada
          </p>
          <h1 className="mt-1 text-3xl font-black">Recebíveis e conciliação</h1>
          <p className="mt-2 text-sm text-[#687783]">
            O Comercial e o Estoque enxergam o mesmo sinal que libera a reserva.
          </p>
        </div>
        <CircleDollarSign size={30} className="text-[#1b674c]" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Carteira", total],
          ["Recebido", received],
          ["Em atraso", overdue],
        ].map(([label, value]) => (
          <div key={label as string} className="border bg-white p-5">
            <p className="text-xs text-[#687783]">{label as string}</p>
            <p className="mt-2 text-3xl font-black">
              {formatMoney(value as number)}
            </p>
          </div>
        ))}
      </div>
      <section className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
            <tr>
              {[
                "Evento",
                "Parcela",
                "Vencimento",
                "Valor",
                "Estado",
                "Ação",
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ event, payment }) => (
              <tr key={`${event.id}-${payment.id}`}>
                <td className="px-4 py-4">
                  <p className="font-black">{event.details.name}</p>
                  <p className="font-mono text-[9px] text-[#687783]">
                    {event.id}
                  </p>
                </td>
                <td className="px-4 py-4">{payment.label}</td>
                <td className="px-4 py-4">{payment.dueDate}</td>
                <td className="px-4 py-4 font-black">
                  {formatMoney(payment.amount)}
                </td>
                <td className="px-4 py-4">
                  <Pill
                    tone={
                      payment.status === "paid"
                        ? "green"
                        : payment.status === "overdue"
                          ? "red"
                          : "amber"
                    }
                  >
                    {payment.status === "paid"
                      ? "Conciliado"
                      : payment.status === "overdue"
                        ? "Atrasado"
                        : "Pendente"}
                  </Pill>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() =>
                      setPayment(
                        event.id,
                        payment.id,
                        payment.status === "paid" ? "pending" : "paid",
                      )
                    }
                    className="border border-[#10243b] px-3 py-2 text-xs font-black"
                  >
                    {payment.status === "paid" ? "Reabrir" : "Conciliar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CommercialCrm({
  state,
  changeState,
  setActive,
  setModule,
}: {
  state: DemoState;
  changeState: React.Dispatch<React.SetStateAction<DemoState>>;
  setActive: (id: string) => void;
  setModule: (module: OpsModule) => void;
}) {
  const [search, setSearch] = useState("");
  const [contactRegistered, setContactRegistered] = useState("");
  const openEvents = state.events.filter(
    (event) => event.status !== "completed",
  );
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = openEvents.filter((event) =>
    [
      event.details.name,
      event.details.contactName,
      event.details.city,
      event.id,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const selected =
    openEvents.find((event) => event.id === state.activeEventId) ??
    openEvents[0];
  const pipelineValue = openEvents.reduce(
    (sum, event) => sum + quote(state, event).total,
    0,
  );
  const newOrders = openEvents.filter(
    (event) => event.status === "submitted",
  ).length;
  const stageIndex = (event: EventProject) =>
    event.status === "submitted" ? 0 : event.status === "proposal" ? 1 : 2;
  const updateById = (id: string, patch: Partial<EventProject>) =>
    changeState((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === id ? { ...event, ...patch } : event,
      ),
    }));

  if (!selected)
    return (
      <section className="border bg-white p-8">
        <h1 className="text-2xl font-black">Nenhuma oportunidade aberta</h1>
        <p className="mt-2 text-sm text-[#687783]">
          Novos pedidos feitos pelo site aparecerão aqui.
        </p>
      </section>
    );

  const totals = quote(state, selected);
  const economics = eventEconomics(state, selected);
  const handover = handoverFor(state, selected);
  const missing = eventPlan(state, selected).reduce(
    (sum, item) => sum + item.shortage,
    0,
  );
  const scene = state.scenes.find((entry) =>
    selected.sceneIds.includes(entry.id),
  );
  const actionLabel =
    selected.status === "submitted"
      ? "Emitir proposta"
      : selected.status === "proposal"
        ? "Confirmar sinal e reservar"
        : "Abrir operação do evento";
  const advance = () => {
    if (selected.status === "submitted") {
      updateById(selected.id, {
        status: "proposal",
        history: [...selected.history, "Proposta emitida pelo Comercial"],
      });
      return;
    }
    if (selected.status === "proposal") {
      changeState((current) => reserveEvent(current, selected.id));
      return;
    }
    setModule("overview");
  };
  const registerContact = () => {
    updateById(selected.id, {
      history: [...selected.history, "Contato comercial registrado agora"],
    });
    setContactRegistered(selected.id);
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden border-2 border-[#10243b] bg-[#10243b] text-white">
        <div className="grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="p-6 md:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#d7ad5d]">
              Comercial · demanda que vira operação
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-[-0.035em] md:text-5xl">
              O próximo evento não pode depender da memória de alguém.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c5d0da]">
              Pedido, conversa, proposta, sinal e disponibilidade avançam no
              mesmo registro até o handover para Estoque e Logística.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-[#3a526a] lg:border-l lg:border-t-0">
            <div className="border-r border-[#3a526a] p-5">
              <p className="text-xs text-[#aebdca]">Pipeline aberto</p>
              <p className="mt-2 text-3xl font-black">
                {formatMoney(pipelineValue)}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-[#aebdca]">Projetos ativos</p>
              <p className="mt-2 text-3xl font-black">{openEvents.length}</p>
            </div>
            <div className="col-span-2 border-t border-[#3a526a] bg-[#d7ad5d] p-5 text-[#10243b]">
              <p className="font-mono text-[9px] uppercase">Ação de hoje</p>
              <p className="mt-1 font-black">
                {newOrders === 0
                  ? "Nenhum pedido aguardando proposta"
                  : `${newOrders} pedido${newOrders > 1 ? "s" : ""} aguardando proposta`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid border bg-white md:grid-cols-3">
        {[
          ["Pedidos recebidos", "submitted"],
          ["Propostas em aberto", "proposal"],
          ["Negócios confirmados", "confirmed"],
        ].map(([label, status], index) => {
          const count = openEvents.filter((event) =>
            status === "confirmed"
              ? stageIndex(event) === 2
              : event.status === status,
          ).length;
          return (
            <div
              key={status}
              className={`flex items-center justify-between p-4 ${index < 2 ? "border-b md:border-b-0 md:border-r" : ""}`}
            >
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  {index + 1} · etapa comercial
                </p>
                <p className="mt-1 text-sm font-black">{label}</p>
              </div>
              <span className="grid size-9 place-items-center bg-[#edf1f3] text-sm font-black">
                {count}
              </span>
            </div>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <section className="border bg-white">
          <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase text-[#2c63d6]">
                Fila comercial viva
              </p>
              <h2 className="mt-1 text-2xl font-black">Oportunidades</h2>
            </div>
            <label className="relative block sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#687783]"
              />
              <span className="sr-only">Buscar oportunidade</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Evento, cliente ou cidade"
                className="w-full border bg-[#f5f7f8] py-3 pl-9 pr-3 text-xs outline-none focus:border-[#2c63d6]"
              />
            </label>
          </div>
          <div className="divide-y">
            {visibleEvents.map((entry) => {
              const entryTotals = quote(state, entry);
              const entryEconomics = eventEconomics(state, entry);
              const entryHandover = handoverFor(state, entry);
              const active = entry.id === selected.id;
              const progress = stageIndex(entry);
              return (
                <button
                  key={entry.id}
                  onClick={() => setActive(entry.id)}
                  className={`w-full p-5 text-left transition ${active ? "bg-[#e9f0ff]" : "hover:bg-[#f5f7f8]"}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-[9px] uppercase text-[#687783]">
                        {entry.id} · {entry.createdAt}
                      </p>
                      <h3 className="mt-1 text-lg font-black">
                        {entry.details.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#687783]">
                        {entry.details.contactName} · {entry.details.city}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-lg font-black">
                        {formatMoney(entryTotals.total)}
                      </p>
                      <p className="text-xs text-[#687783]">
                        {Math.round(entryEconomics.margin * 100)}% margem · score {entryEconomics.score}
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-4 grid grid-cols-3 gap-1"
                    aria-label="Progresso comercial"
                  >
                    {["Pedido", "Proposta", "Confirmado"].map(
                      (label, index) => (
                        <div key={label}>
                          <span
                            className={`block h-1.5 ${index <= progress ? "bg-[#1b674c]" : "bg-[#dbe2e6]"}`}
                          />
                          <span className="mt-1 block text-[9px] font-bold text-[#687783]">
                            {label}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                    <div>
                      <p className="text-xs font-black">
                        {entryHandover.action}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#687783]">
                        {entryHandover.owner} entrega para {entryHandover.next}
                      </p>
                    </div>
                    <ChevronRight size={17} className="shrink-0" />
                  </div>
                </button>
              );
            })}
            {visibleEvents.length === 0 && (
              <div className="p-8 text-center text-sm text-[#687783]">
                Nenhuma oportunidade corresponde à busca.
              </div>
            )}
          </div>
        </section>

        <aside className="self-start border-2 border-[#10243b] bg-white xl:sticky xl:top-20">
          <div className="relative h-40 overflow-hidden bg-[#dfe5e8]">
            {scene ? (
              <Image
                src={scene.image}
                alt={scene.title}
                fill
                className="object-cover"
                sizes="520px"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-[#687783]">
                Sem referência visual
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#10243b] to-transparent p-5 pt-14 text-white">
              <p className="font-mono text-[9px] uppercase text-[#d7ad5d]">
                Dossiê comercial · {selected.id}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {selected.details.name}
              </h2>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="border p-3">
                <p className="text-[10px] text-[#687783]">Cliente</p>
                <p className="mt-1 text-sm font-black">
                  {selected.details.contactName}
                </p>
                <p className="mt-1 text-[10px] text-[#687783]">
                  {selected.details.contactPhone}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-[10px] text-[#687783]">Data e local</p>
                <p className="mt-1 text-sm font-black">
                  {selected.details.deliveryDate}
                </p>
                <p className="mt-1 text-[10px] text-[#687783]">
                  {selected.details.venue} · {selected.details.city}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-px border border-[#d6dde2] bg-[#d6dde2]">
              {[
                ["Margem", `${Math.round(economics.margin * 100)}%`],
                ["Faltas", missing],
                ["Score", economics.score],
                ["Total", formatMoney(totals.total)],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-[#f5f7f8] p-3">
                  <p className="text-[9px] text-[#687783]">{label}</p>
                  <p className="mt-1 text-sm font-black">{value}</p>
                </div>
              ))}
            </div>

            <section className="border-l-4 border-[#d7ad5d] bg-[#f7f2e8] p-4">
              <p className="font-mono text-[9px] uppercase text-[#7a5a1e]">
                Próxima passagem
              </p>
              <p className="mt-1 font-black">{handover.action}</p>
              <p className="mt-1 text-xs text-[#687783]">
                {handover.blocker || "Sem bloqueios para avançar"}
              </p>
            </section>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">Seleção do cliente</h3>
                <span className="font-mono text-[9px] text-[#687783]">
                  {selected.sceneIds.length} referência(s)
                </span>
              </div>
              <div className="mt-3 divide-y border-y">
                {Object.entries(selected.cart).map(([productId, quantity]) => (
                  <div
                    key={productId}
                    className="flex justify-between py-2 text-xs"
                  >
                    <span>
                      {
                        state.products.find(
                          (product) => product.id === productId,
                        )?.name
                      }
                    </span>
                    <strong>{quantity} un.</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={registerContact}
                className="border border-[#10243b] px-4 py-3 text-xs font-black"
              >
                {contactRegistered === selected.id
                  ? "Contato registrado"
                  : "Registrar contato"}
              </button>
              <button
                onClick={advance}
                className="bg-[#10243b] px-4 py-3 text-xs font-black text-white"
              >
                {actionLabel}
              </button>
            </div>
            <p className="text-[10px] leading-4 text-[#687783]">
              Última atividade: {selected.history.at(-1)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PortfolioDecisionBoard({
  state,
  openEvent,
}: {
  state: DemoState;
  openEvent: (id: string, hasShortage: boolean) => void;
}) {
  const rows = state.events
    .filter((event) => event.status !== "completed")
    .map((event) => ({ event, economics: eventEconomics(state, event) }))
    .sort((a, b) => b.economics.score - a.economics.score);
  const pipeline = rows.reduce(
    (sum, row) => sum + row.economics.totals.total,
    0,
  );
  const contribution = rows.reduce(
    (sum, row) => sum + row.economics.contribution,
    0,
  );
  const averageMargin = rows.length
    ? rows.reduce((sum, row) => sum + row.economics.margin, 0) / rows.length
    : 0;

  return (
    <section className="overflow-hidden border-2 border-[#10243b] bg-white">
      <div className="grid bg-[#10243b] text-white xl:grid-cols-[1.25fr_.75fr]">
        <div className="p-6 md:p-8">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#d7ad5d]">
            Mesa de decisão · carteira de eventos
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.04em] md:text-5xl">
            Mais vendas. Mais controle. Melhores eventos.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c5d0da]">
            O mesmo dado que acelera a proposta mostra capacidade, risco e
            contribuição antes de comprometer acervo, fábrica e logística.
          </p>
        </div>
        <div className="grid grid-cols-3 border-t border-[#3a526a] xl:border-l xl:border-t-0">
          {[
            ["Vender mais", formatMoney(pipeline), "pipeline visível"],
            ["Organizar", `${rows.length}`, "eventos coordenados"],
            [
              "Priorizar",
              `${Math.round(averageMargin * 100)}%`,
              "margem média",
            ],
          ].map(([label, value, note], index) => (
            <div
              key={label}
              className={`p-4 ${index < 2 ? "border-r border-[#3a526a]" : ""}`}
            >
              <p className="text-[9px] font-black uppercase text-[#d7ad5d]">
                {label}
              </p>
              <p className="mt-3 text-lg font-black xl:text-xl">{value}</p>
              <p className="mt-1 text-[9px] text-[#9fb0bf]">{note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-px bg-[#d5dde2] sm:grid-cols-3">
        <div className="bg-[#f7f9fa] p-4">
          <p className="text-[10px] text-[#687783]">Receita em análise</p>
          <p className="mt-1 text-xl font-black">{formatMoney(pipeline)}</p>
        </div>
        <div className="bg-[#f7f9fa] p-4">
          <p className="text-[10px] text-[#687783]">Contribuição projetada</p>
          <p className="mt-1 text-xl font-black text-[#16533f]">
            {formatMoney(contribution)}
          </p>
        </div>
        <div className="bg-[#f7f9fa] p-4">
          <p className="text-[10px] text-[#687783]">Eventos com falta</p>
          <p className="mt-1 text-xl font-black text-[#8a4c13]">
            {rows.filter((row) => row.economics.shortage > 0).length}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
            <tr>
              {["Evento", "Receita", "Margem", "Capacidade", "Score", "Decisão", ""].map(
                (label) => (
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ event, economics }) => (
              <tr key={event.id}>
                <td className="px-4 py-4">
                  <p className="font-black">{event.details.name}</p>
                  <p className="mt-1 text-[10px] text-[#687783]">
                    {event.details.deliveryDate} · {event.details.city}
                  </p>
                </td>
                <td className="px-4 py-4 font-black">
                  {formatMoney(economics.totals.total)}
                  <p className="mt-1 text-[10px] font-normal text-[#687783]">
                    contribuição {formatMoney(economics.contribution)}
                  </p>
                </td>
                <td className="px-4 py-4 font-black text-[#16533f]">
                  {Math.round(economics.margin * 100)}%
                </td>
                <td className="px-4 py-4">
                  <p className="font-black">{economics.requested} peças</p>
                  <p className={`mt-1 text-[10px] ${economics.shortage ? "text-[#923333]" : "text-[#16533f]"}`}>
                    {economics.shortage
                      ? `${economics.shortage} dependem de cobertura`
                      : "cobertura própria"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className="grid size-10 place-items-center rounded-full bg-[#10243b] font-black text-white">
                    {economics.score}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <Pill
                    tone={
                      economics.recommendation === "Priorizar"
                        ? "green"
                        : economics.shortage
                          ? "amber"
                          : "blue"
                    }
                  >
                    {economics.recommendation}
                  </Pill>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => openEvent(event.id, economics.shortage > 0)}
                    className="bg-[#10243b] px-4 py-2.5 text-xs font-black text-white"
                  >
                    Abrir decisão
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-[#f7f9fa] px-4 py-3 text-[10px] text-[#687783]">
        Score demonstrativo e explicável: margem, maturidade comercial e falta
        de acervo. A decisão final continua humana.
      </p>
    </section>
  );
}

function ControlTower({
  state,
  setActive,
}: {
  state: DemoState;
  setActive: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden border-2 border-[#10243b] bg-white">
      <div className="flex flex-col justify-between gap-3 bg-[#10243b] p-5 text-white md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#d7ad5d]">
            Linha de custódia · todos os eventos
          </p>
          <h1 className="mt-2 text-3xl font-black">Torre de controle</h1>
          <p className="mt-2 text-sm text-[#b9c8d5]">
            Cada área enxerga sua entrega, o próximo responsável e o bloqueio
            que impede o avanço.
          </p>
        </div>
        <ClipboardList className="text-[#d7ad5d]" size={30} />
      </div>
      <div className="divide-y">
        {state.events
          .filter((event) => event.status !== "completed")
          .map((event) => {
            const handover = handoverFor(state, event);
            return (
              <button
                key={event.id}
                onClick={() => setActive(event.id)}
                className="grid w-full gap-4 p-5 text-left transition hover:bg-[#f4f7f8] lg:grid-cols-[1.2fr_1fr_1.35fr_auto] lg:items-center"
              >
                <div>
                  <p className="font-mono text-[9px] text-[#687783]">
                    {event.id} · {event.details.deliveryDate}
                  </p>
                  <p className="mt-1 font-black">{event.details.name}</p>
                  <p className="mt-1 text-xs text-[#687783]">
                    {event.details.city} · {STATUS_LABEL[event.status]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#d7ad5d] text-xs font-black">
                    {handover.owner.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[9px] uppercase text-[#687783]">
                      Responsável atual
                    </p>
                    <p className="text-sm font-black">{handover.owner}</p>
                    <p className="text-[10px] text-[#687783]">
                      entrega para {handover.next}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black">{handover.action}</p>
                  <p
                    className={`mt-1 text-xs ${handover.blocker ? "text-[#923333]" : "text-[#16533f]"}`}
                  >
                    {handover.blocker || "Pronto para avançar"}
                  </p>
                </div>
                <ChevronRight size={17} />
              </button>
            );
          })}
      </div>
    </section>
  );
}

function Ops({
  state,
  changeState,
  setActive,
  openShowroom,
}: {
  state: DemoState;
  changeState: React.Dispatch<React.SetStateAction<DemoState>>;
  setActive: (id: string) => void;
  openShowroom: () => void;
}) {
  const [module, setModule] = useState<OpsModule>("overview");
  const [integrationPayload, setIntegrationPayload] = useState("");
  const event =
    state.events.find((entry) => entry.id === state.activeEventId) ??
    state.events[0];
  const plan = eventPlan(state, event);
  const shortages = plan.filter((item) => item.shortage > 0);
  const linkedUnits = state.units.filter((unit) =>
    unit.reservations.some(
      (reservation) =>
        reservation.eventId === event.id && reservation.status !== "cancelled",
    ),
  );
  const hasReturnPending =
    linkedUnits.some(
      (unit) =>
        unit.status === "inspection" ||
        unit.status === "maintenance" ||
        unit.status === "out" ||
        unit.condition === "missing",
    ) ||
    state.maintenanceOrders.some(
      (order) => order.eventId === event.id && order.stage < 3,
    );
  useEffect(() => {
    if (
      event.status !== "return" ||
      event.logisticsStep < 4 ||
      hasReturnPending
    )
      return;
    queueMicrotask(() =>
      changeState((current) => ({
        ...current,
        events: current.events.map((entry) =>
          entry.id === event.id
            ? {
                ...entry,
                status: "completed",
                logisticsStep: 5,
                history: [
                  ...entry.history,
                  "Retorno, inspeções e revisões concluídos",
                ],
              }
            : entry,
        ),
        units: current.units.map((unit) => ({
          ...unit,
          reservations: unit.reservations.map((reservation) =>
            reservation.eventId === event.id
              ? { ...reservation, status: "completed" }
              : reservation,
          ),
        })),
      })),
    );
  }, [
    changeState,
    event.id,
    event.logisticsStep,
    event.status,
    hasReturnPending,
  ]);
  const updateEvent = (patch: Partial<EventProject>) =>
    changeState((current) => ({
      ...current,
      events: current.events.map((entry) =>
        entry.id === event.id ? { ...entry, ...patch } : entry,
      ),
    }));
  const confirmReservation = () => {
    const window = eventWindow(event.details);
    changeState((current) => {
      const target = current.events.find((entry) => entry.id === event.id)!;
      const ids = new Set(
        eventPlan(current, target).flatMap((item) =>
          availableUnits(current, target, item.productId)
            .slice(0, item.own)
            .map((unit) => unit.id),
        ),
      );
      return {
        ...current,
        units: current.units.map((unit) =>
          ids.has(unit.id) &&
          !unit.reservations.some(
            (reservation) => reservation.eventId === event.id,
          )
            ? {
                ...unit,
                reservations: [
                  ...unit.reservations,
                  {
                    eventId: event.id,
                    start: window.start,
                    end: window.end,
                    status: "confirmed",
                  },
                ],
                lastMovement: `Reserva ${event.id} confirmada`,
              }
            : unit,
        ),
        events: current.events.map((entry) =>
          entry.id === event.id
            ? {
                ...entry,
                status: "reserved",
                proposalApproved: true,
                history: [
                  ...entry.history,
                  "Sinal confirmado e tags reservadas",
                ],
              }
            : entry,
        ),
      };
    });
  };
  const decideCoverage = (
    productId: string,
    decision: CoverageDecision,
    quantity: number,
  ) =>
    changeState((current) => {
      const hasOrder = current.workOrders.some(
        (order) => order.eventId === event.id && order.productId === productId,
      );
      return {
        ...current,
        events: current.events.map((entry) =>
          entry.id === event.id
            ? {
                ...entry,
                coverage: { ...entry.coverage, [productId]: decision },
                history: [
                  ...entry.history,
                  `Cobertura definida: ${decision} para ${productId}`,
                ],
              }
            : entry,
        ),
        workOrders:
          decision === "produce" && !hasOrder
            ? [
                ...current.workOrders,
                {
                  id: `OP-${Date.now()}`,
                  eventId: event.id,
                  productId,
                  quantity,
                  stage: 0,
                },
              ]
            : current.workOrders.filter(
                (order) =>
                  !(
                    order.eventId === event.id && order.productId === productId
                  ),
              ),
      };
    });
  const advanceWorkOrder = (id: string) =>
    changeState((current) => {
      const order = current.workOrders.find((entry) => entry.id === id)!;
      if (order.stage < 4)
        return {
          ...current,
          workOrders: current.workOrders.map((entry) =>
            entry.id === id ? { ...entry, stage: entry.stage + 1 } : entry,
          ),
        };
      const product = current.products.find(
        (entry) => entry.id === order.productId,
      )!;
      const targetEvent = current.events.find(
        (entry) => entry.id === order.eventId,
      )!;
      const window = eventWindow(targetEvent.details);
      const start = current.units.filter(
        (unit) => unit.productId === product.id,
      ).length;
      const units: StockUnit[] = Array.from(
        { length: order.quantity },
        (_, index) => ({
          id: `${product.sku}-${String(start + index + 1).padStart(3, "0")}`,
          productId: product.id,
          status: "available",
          condition: "ok",
          location: product.baseLocation,
          source: "factory",
          reservations: [
            {
              eventId: order.eventId,
              start: window.start,
              end: window.end,
              status: "confirmed",
            },
          ],
          lastMovement: `${order.id} recebida após qualidade`,
        }),
      );
      return {
        ...current,
        units: [...current.units, ...units],
        workOrders: current.workOrders.map((entry) =>
          entry.id === id ? { ...entry, stage: 5 } : entry,
        ),
      };
    });
  const updateDispatch = (patch: Partial<EventProject["dispatch"]>) =>
    changeState((current) => ({
      ...current,
      events: current.events.map((entry) =>
        entry.id === event.id
          ? { ...entry, dispatch: { ...entry.dispatch, ...patch } }
          : entry,
      ),
    }));
  const scanDispatchUnit = (unitId: string, phase: "separate" | "load") =>
    changeState((current) => ({
      ...current,
      units: current.units.map((unit) =>
        unit.id !== unitId
          ? unit
          : {
              ...unit,
              status: phase === "separate" ? "picking" : "out",
              location:
                phase === "separate"
                  ? `Separação · ${event.id}`
                  : `${event.dispatch.vehicle} · rota ${event.details.city}`,
              lastMovement:
                phase === "separate"
                  ? "Tag lida na separação"
                  : "Tag lida na carga",
            },
      ),
      events: current.events.map((entry) =>
        entry.id !== event.id
          ? entry
          : {
              ...entry,
              dispatch: {
                ...entry.dispatch,
                [phase === "separate" ? "scannedUnitIds" : "loadedUnitIds"]: [
                  ...new Set([
                    ...entry.dispatch[
                      phase === "separate" ? "scannedUnitIds" : "loadedUnitIds"
                    ],
                    unitId,
                  ]),
                ],
              },
            },
      ),
    }));
  const advanceLogistics = () =>
    changeState((current) => {
      const currentEvent = current.events.find(
        (entry) => entry.id === event.id,
      )!;
      const step = currentEvent.logisticsStep;
      const reserved = (unit: StockUnit) =>
        unit.reservations.some(
          (reservation) =>
            reservation.eventId === event.id &&
            reservation.status === "confirmed",
        );
      let units = current.units;
      let status = currentEvent.status;
      if (step === 0) {
        const ids = units.filter(reserved).map((unit) => unit.id);
        if (
          ids.some((id) => !currentEvent.dispatch.scannedUnitIds.includes(id))
        )
          return current;
        status = "picking";
      }
      if (step === 1) {
        const ids = units.filter(reserved).map((unit) => unit.id);
        if (ids.some((id) => !currentEvent.dispatch.loadedUnitIds.includes(id)))
          return current;
        status = "route";
      }
      if (step === 2) {
        if (!currentEvent.dispatch.deliveryProof) return current;
        units = units.map((unit) =>
          reserved(unit)
            ? {
                ...unit,
                location: `${event.details.venue} · montado`,
                lastMovement: "Entrega confirmada",
              }
            : unit,
        );
        status = "event";
      }
      if (step === 3) {
        let index = 0;
        units = units.map((unit) => {
          if (!reserved(unit)) return unit;
          index += 1;
          if (index === linkedUnits.length)
            return {
              ...unit,
              condition: "missing",
              note: "Tag não localizada no retorno",
              lastMovement: "Divergência aberta",
            };
          return {
            ...unit,
            status: "inspection",
            condition: index === 1 ? "damaged" : "ok",
            location: "Doca 02 · inspeção",
            note:
              index === 1
                ? "Risco no acabamento · evidência fotográfica simulada"
                : "Aguardando inspeção",
            lastMovement: "Retorno escaneado",
          };
        });
        status = "return";
      }
      return {
        ...current,
        units,
        events: current.events.map((entry) =>
          entry.id === event.id
            ? {
                ...entry,
                status,
                logisticsStep: Math.min(4, step + 1),
                history: [
                  ...entry.history,
                  `Logística: etapa ${step + 1} confirmada`,
                ],
              }
            : entry,
        ),
      };
    });
  const inspect = (
    unitId: string,
    decision: "approve" | "repair" | "retire" | "found",
  ) =>
    changeState((current) => {
      const unit = current.units.find((entry) => entry.id === unitId)!;
      const maintenance =
        decision === "repair" &&
        !current.maintenanceOrders.some((order) => order.unitId === unitId)
          ? [
              ...current.maintenanceOrders,
              {
                id: `OS-${Date.now()}`,
                eventId: event.id,
                unitId,
                stage: 0,
                cost: 480,
                note: unit.note ?? "Revisão pós-evento",
              },
            ]
          : current.maintenanceOrders;
      return {
        ...current,
        maintenanceOrders: maintenance,
        units: current.units.map((entry) =>
          entry.id !== unitId
            ? entry
            : decision === "approve" || decision === "found"
              ? {
                  ...entry,
                  status: "available",
                  condition: "ok",
                  location:
                    state.products.find(
                      (product) => product.id === entry.productId,
                    )?.baseLocation ?? "Galpão",
                  lastMovement:
                    decision === "found"
                      ? "Peça localizada e aprovada"
                      : "Inspeção aprovada",
                  reservations: entry.reservations.map((reservation) =>
                    reservation.eventId === event.id
                      ? { ...reservation, status: "completed" }
                      : reservation,
                  ),
                }
              : decision === "repair"
                ? {
                    ...entry,
                    status: "maintenance",
                    location: "Tapeçaria · OS aberta",
                    lastMovement: "Enviada para manutenção",
                  }
                : {
                    ...entry,
                    status: "retired",
                    location: "Baixa patrimonial",
                    lastMovement: "Baixa aprovada",
                  },
        ),
      };
    });
  const advanceMaintenance = (id: string) =>
    changeState((current) => {
      const order = current.maintenanceOrders.find((entry) => entry.id === id)!;
      if (order.stage < 2)
        return {
          ...current,
          maintenanceOrders: current.maintenanceOrders.map((entry) =>
            entry.id === id ? { ...entry, stage: entry.stage + 1 } : entry,
          ),
        };
      const product = current.products.find(
        (entry) =>
          entry.id ===
          current.units.find((unit) => unit.id === order.unitId)?.productId,
      );
      return {
        ...current,
        maintenanceOrders: current.maintenanceOrders.map((entry) =>
          entry.id === id ? { ...entry, stage: 3 } : entry,
        ),
        units: current.units.map((unit) =>
          unit.id === order.unitId
            ? {
                ...unit,
                status: "available",
                condition: "ok",
                location: product?.baseLocation ?? "Galpão",
                lastMovement: "Reparo e qualidade concluídos",
                reservations: unit.reservations.map((reservation) =>
                  reservation.eventId === order.eventId
                    ? { ...reservation, status: "completed" }
                    : reservation,
                ),
              }
            : unit,
        ),
      };
    });
  const nav = [
    ["overview", "Central", LayoutDashboard],
    ["crm", "CRM", UserRound],
    ["inventory", "Acervo", Boxes],
    ["intelligence", "Margem e capacidade", Lightbulb],
    ["factory", "Fábrica", Factory],
    ["logistics", "Logística", Truck],
    ["returns", "Retorno e revisão", Wrench],
    ["integrations", "Integrações", Link2],
    ["finance", "Financeiro", BarChart3],
  ] as const;
  const totals = quote(state, event);
  const reservedUnitIds = linkedUnits.map((unit) => unit.id);
  const logisticsReady =
    event.logisticsStep === 0
      ? reservedUnitIds.every((id) =>
          event.dispatch.scannedUnitIds.includes(id),
        )
      : event.logisticsStep === 1
        ? reservedUnitIds.every((id) =>
            event.dispatch.loadedUnitIds.includes(id),
          )
        : event.logisticsStep === 2
          ? event.dispatch.deliveryProof
          : true;
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#edf1f3] text-[#10243b] lg:grid lg:grid-cols-[235px_1fr]">
      <aside className="border-b border-[#2d455d] bg-[#10243b] text-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-0">
        <div className="p-5">
          <p className="font-black">Central de operações</p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.15em] text-[#aebdca]">
            base Mogi das Cruzes · logística própria
          </p>
          <button
            onClick={openShowroom}
            className="mt-5 w-full border border-[#49657e] px-3 py-2 text-xs font-bold"
          >
            Abrir site público
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1">
          {nav.map(([id, name, Icon]) => (
            <button
              key={id}
              onClick={() => setModule(id)}
              className={`flex shrink-0 items-center gap-3 px-4 py-3 text-left text-sm font-bold lg:w-full ${module === id ? "bg-[#d7ad5d] text-[#10243b]" : "text-[#c5d0da] hover:bg-[#1b3650]"}`}
            >
              <Icon size={15} />
              {name}
            </button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0">
        <header className="flex flex-col justify-between gap-3 border-b border-[#c9d1d7] bg-white px-5 py-4 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="font-mono text-[9px] uppercase text-[#687783]">
              Protótipo · dados e integrações simulados
            </p>
            <p className="mt-1 font-black">Operação conectada por evento</p>
          </div>
          <label className="text-xs font-bold">
            Evento ativo
            <select
              value={event.id}
              onChange={(eventTarget) => setActive(eventTarget.target.value)}
              className="ml-2 border px-3 py-2 text-sm"
            >
              {state.events.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id} · {entry.details.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="p-5 pb-24 lg:p-8">
          {module === "overview" && (
            <div className="space-y-5">
              <PortfolioDecisionBoard
                state={state}
                openEvent={(id, hasShortage) => {
                  setActive(id);
                  setModule(hasShortage ? "intelligence" : "crm");
                }}
              />
              <ControlTower state={state} setActive={setActive} />
              <div className="border border-[#9bc7b1] bg-[#e7f3ec] p-5">
                <p className="font-mono text-[9px] uppercase text-[#16533f]">
                  Pedido do site visível em toda a operação
                </p>
                <h1 className="mt-2 text-3xl font-black">
                  {event.details.name}
                </h1>
                <p className="mt-2 text-sm text-[#52646f]">
                  {event.id} · {event.orderId} · {event.details.city} ·{" "}
                  {event.details.deliveryDate}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ["Etapa", STATUS_LABEL[event.status]],
                  [
                    "Peças",
                    Object.values(event.cart).reduce(
                      (sum, value) => sum + value,
                      0,
                    ),
                  ],
                  [
                    "Faltas",
                    shortages.reduce((sum, item) => sum + item.shortage, 0),
                  ],
                  ["Valor", formatMoney(totals.total)],
                ].map(([name, value]) => (
                  <div
                    key={name as string}
                    className="border border-[#cbd3d9] bg-white p-5"
                  >
                    <p className="text-xs text-[#687783]">{name}</p>
                    <p className="mt-2 text-2xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              <section className="border border-[#cbd3d9] bg-white p-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="font-mono text-[9px] uppercase text-[#2c63d6]">
                      Próxima ação
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      {event.status === "submitted"
                        ? "Preparar proposta"
                        : event.status === "proposal"
                          ? "Confirmar sinal e reserva"
                          : event.status === "reserved" &&
                              shortages.some(
                                (item) => !event.coverage[item.productId],
                              )
                            ? "Resolver faltas do pedido"
                            : event.status === "reserved"
                              ? "Liberar separação"
                              : "Acompanhar execução"}
                    </h2>
                  </div>
                  {event.status === "submitted" && (
                    <button
                      onClick={() =>
                        updateEvent({
                          status: "proposal",
                          history: [
                            ...event.history,
                            "Proposta emitida pela operação",
                          ],
                        })
                      }
                      className="bg-[#2c63d6] px-5 py-3 text-sm font-black text-white"
                    >
                      Emitir proposta
                    </button>
                  )}
                  {event.status === "proposal" && (
                    <button
                      onClick={confirmReservation}
                      className="bg-[#1b674c] px-5 py-3 text-sm font-black text-white"
                    >
                      Confirmar sinal e reservar
                    </button>
                  )}
                  {event.status === "reserved" &&
                    shortages.some(
                      (item) => !event.coverage[item.productId],
                    ) && (
                      <button
                        onClick={() => setModule("intelligence")}
                        className="bg-[#a65b18] px-5 py-3 text-sm font-black text-white"
                      >
                        Comparar alternativas
                      </button>
                    )}
                  {event.status === "reserved" &&
                    shortages.every(
                      (item) => event.coverage[item.productId],
                    ) && (
                      <button
                        onClick={() => setModule("logistics")}
                        className="bg-[#10243b] px-5 py-3 text-sm font-black text-white"
                      >
                        Abrir logística
                      </button>
                    )}
                </div>
              </section>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="border border-[#cbd3d9] bg-white p-5">
                  <h3 className="font-black">Histórico auditável</h3>
                  <div className="mt-4 divide-y">
                    {event.history
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <div
                          key={`${entry}-${index}`}
                          className="flex gap-3 py-3 text-sm"
                        >
                          <span className="mt-1 size-2 rounded-full bg-[#2c63d6]" />
                          <span>{entry}</span>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="bg-[#10243b] p-5 text-white">
                  <p className="font-mono text-[9px] uppercase text-[#d7ad5d]">
                    Integrações
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    Nenhuma conexão externa é fingida.
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#b7c5d4]">
                    Os gatilhos abaixo abrem somente payloads fictícios para
                    demonstrar o contrato futuro.
                  </p>
                  <button
                    onClick={() => setModule("integrations")}
                    className="mt-5 border border-[#557089] px-4 py-3 text-sm font-bold"
                  >
                    Ver mapa de integrações
                  </button>
                </section>
              </div>
            </div>
          )}
          {module === "crm" && (
            <CommercialCrm
              state={state}
              changeState={changeState}
              setActive={setActive}
              setModule={setModule}
            />
          )}
          {module === "inventory" && (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[9px] uppercase text-[#687783]">
                    Modelo, tag, reserva e custódia
                  </p>
                  <h1 className="mt-1 text-3xl font-black">Acervo</h1>
                </div>
                <ProductRegistration state={state} changeState={changeState} />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  [
                    "Disponíveis",
                    state.units.filter(
                      (unit) =>
                        unit.status === "available" && unit.condition === "ok",
                    ).length,
                  ],
                  [
                    "Com reserva",
                    state.units.filter((unit) =>
                      unit.reservations.some(
                        (reservation) => reservation.status === "confirmed",
                      ),
                    ).length,
                  ],
                  [
                    "Fora",
                    state.units.filter((unit) => unit.status === "out").length,
                  ],
                  [
                    "Inspeção / revisão",
                    state.units.filter(
                      (unit) =>
                        unit.status === "inspection" ||
                        unit.status === "maintenance",
                    ).length,
                  ],
                ].map(([name, value]) => (
                  <div key={name as string} className="border bg-white p-5">
                    <p className="text-xs text-[#687783]">{name}</p>
                    <p className="mt-2 text-3xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              <section className="overflow-x-auto border bg-white">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
                    <tr>
                      {[
                        "Modelo",
                        "Hoje",
                        "No período",
                        "Total",
                        "Rastreio",
                        "Base",
                      ].map((name) => (
                        <th key={name} className="px-4 py-3 font-medium">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {state.products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative size-12 overflow-hidden">
                              <Image
                                src={product.image}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                                unoptimized={product.image.startsWith("data:")}
                              />
                            </div>
                            <div>
                              <p className="font-black">{product.name}</p>
                              <p className="font-mono text-[9px] text-[#687783]">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {
                            state.units.filter(
                              (unit) =>
                                unit.productId === product.id &&
                                unit.status === "available" &&
                                unit.condition === "ok",
                            ).length
                          }
                        </td>
                        <td className="px-4 py-3 font-black text-[#16533f]">
                          {availableUnits(state, event, product.id).length}
                        </td>
                        <td className="px-4 py-3">
                          {
                            state.units.filter(
                              (unit) =>
                                unit.productId === product.id &&
                                unit.status !== "retired",
                            ).length
                          }
                        </td>
                        <td className="px-4 py-3">
                          {product.tracking === "individual"
                            ? "QR individual"
                            : "Lote"}
                        </td>
                        <td className="px-4 py-3">{product.baseLocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="overflow-x-auto border bg-white">
                <div className="border-b p-4">
                  <h2 className="font-black">Tags e posição física</h2>
                </div>
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
                    <tr>
                      {[
                        "Tag",
                        "Modelo",
                        "Estado",
                        "Condição",
                        "Localização",
                        "Reserva",
                        "Movimento",
                      ].map((name) => (
                        <th key={name} className="px-4 py-3 font-medium">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {state.units.slice(0, 70).map((unit) => (
                      <tr key={unit.id}>
                        <td className="px-4 py-3 font-mono text-xs font-bold">
                          {unit.id}
                        </td>
                        <td className="px-4 py-3">
                          {
                            state.products.find(
                              (product) => product.id === unit.productId,
                            )?.name
                          }
                        </td>
                        <td className="px-4 py-3">
                          <Pill
                            tone={
                              unit.status === "available"
                                ? "green"
                                : unit.status === "out"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {unit.status}
                          </Pill>
                        </td>
                        <td className="px-4 py-3">{unit.condition}</td>
                        <td className="px-4 py-3">{unit.location}</td>
                        <td className="px-4 py-3 text-xs">
                          {unit.reservations.find(
                            (reservation) => reservation.status === "confirmed",
                          )?.eventId ?? "Livre"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#687783]">
                          {unit.lastMovement}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
          {module === "intelligence" && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Rentabilidade, capacidade e decisão humana
                </p>
                <h1 className="mt-1 text-3xl font-black">
                  Vale aceitar, reprecificar ou produzir?
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[#687783]">
                  Comparamos custo, prazo, margem e demanda destravada. Nenhuma
                  ordem de produção nasce sem aprovação.
                </p>
              </div>
              {shortages.length === 0 ? (
                <div className="border bg-white p-10 text-center">
                  <Check className="mx-auto text-[#1b674c]" />
                  <h2 className="mt-3 text-xl font-black">
                    O acervo cobre este pedido.
                  </h2>
                </div>
              ) : (
                shortages.map((item) => {
                  const product = state.products.find(
                    (entry) => entry.id === item.productId,
                  )!;
                  const rentalRevenue = item.shortage * product.dailyRate * 2;
                  const options = [
                    {
                      id: "produce" as const,
                      name: "Produzir",
                      cost: item.shortage * product.productionCost,
                      lead: `${product.leadDays} dias`,
                      margin:
                        rentalRevenue - item.shortage * product.productionCost,
                      note: "Cria patrimônio e pode recuperar demandas antigas",
                    },
                    {
                      id: "substitute" as const,
                      name: "Substituir",
                      cost: item.shortage * 160,
                      lead: "Hoje",
                      margin: rentalRevenue - item.shortage * 160,
                      note: "Modelo similar sujeito ao aceite do cliente",
                    },
                    {
                      id: "sublet" as const,
                      name: "Sublocar",
                      cost: item.shortage * product.dailyRate * 1.2,
                      lead: "3 dias",
                      margin:
                        rentalRevenue - item.shortage * product.dailyRate * 1.2,
                      note: "Preserva o desenho sem aumentar o acervo",
                    },
                    {
                      id: "reduce" as const,
                      name: "Reduzir",
                      cost: 0,
                      lead: "Agora",
                      margin: -rentalRevenue,
                      note: "Perde receita e altera o layout",
                    },
                  ];
                  const best = options.reduce((winner, option) =>
                    option.margin > winner.margin ? option : winner,
                  );
                  return (
                    <section
                      key={item.productId}
                      className="overflow-hidden border bg-white"
                    >
                      <div className="flex flex-col justify-between gap-3 bg-[#fff1df] p-5 md:flex-row md:items-center">
                        <div>
                          <p className="font-mono text-[9px] text-[#8a4c13]">
                            FALTA · {product.sku}
                          </p>
                          <h2 className="mt-1 text-2xl font-black">
                            {item.shortage} {product.name}
                          </h2>
                        </div>
                        <Pill tone="amber">
                          Recomendação simulada: {best.name}
                        </Pill>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead className="bg-[#edf1f3] font-mono text-[9px] uppercase text-[#687783]">
                            <tr>
                              {[
                                "Alternativa",
                                "Custo",
                                "Prazo",
                                "Margem incremental",
                                "Leitura",
                                "Decisão",
                              ].map((name) => (
                                <th
                                  key={name}
                                  className="px-4 py-3 font-medium"
                                >
                                  {name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {options.map((option) => (
                              <tr
                                key={option.id}
                                className={
                                  event.coverage[product.id] === option.id
                                    ? "bg-[#e7f3ec]"
                                    : ""
                                }
                              >
                                <td className="px-4 py-4 font-black">
                                  {option.name}
                                </td>
                                <td className="px-4 py-4">
                                  {formatMoney(option.cost)}
                                </td>
                                <td className="px-4 py-4">{option.lead}</td>
                                <td
                                  className={`px-4 py-4 font-black ${option.margin >= 0 ? "text-[#16533f]" : "text-[#923333]"}`}
                                >
                                  {formatMoney(option.margin)}
                                </td>
                                <td className="px-4 py-4 text-xs text-[#687783]">
                                  {option.note}
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    onClick={() =>
                                      decideCoverage(
                                        product.id,
                                        option.id,
                                        item.shortage,
                                      )
                                    }
                                    className={`px-3 py-2 text-xs font-black ${event.coverage[product.id] === option.id ? "bg-[#1b674c] text-white" : "border"}`}
                                  >
                                    {event.coverage[product.id] === option.id
                                      ? "Escolhida"
                                      : option.id === "produce"
                                        ? "Aprovar produção"
                                        : "Escolher"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {optionDemand(product.id)}
                    </section>
                  );
                })
              )}
            </div>
          )}
          {module === "factory" && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Somente produção aprovada
                </p>
                <h1 className="mt-1 text-3xl font-black">Fábrica</h1>
              </div>
              {state.workOrders.filter((order) => order.eventId === event.id)
                .length === 0 ? (
                <div className="border bg-white p-10 text-center">
                  <Factory className="mx-auto text-[#7a8790]" />
                  <h2 className="mt-3 text-xl font-black">
                    Nenhuma ordem para este evento.
                  </h2>
                  <p className="mt-2 text-sm text-[#687783]">
                    Faltas aparecem primeiro em “Vale produzir?”.
                  </p>
                </div>
              ) : (
                state.workOrders
                  .filter((order) => order.eventId === event.id)
                  .map((order) => {
                    const product = state.products.find(
                      (entry) => entry.id === order.productId,
                    )!;
                    const stages = [
                      "Planejamento",
                      "CNC / estrutura",
                      "Tapeçaria",
                      "Qualidade",
                      "Recebimento",
                    ];
                    return (
                      <section
                        key={order.id}
                        className="border-2 border-[#2c63d6] bg-white"
                      >
                        <div className="flex flex-col justify-between gap-3 border-b p-5 md:flex-row md:items-center">
                          <div>
                            <p className="font-mono text-[9px] text-[#2c63d6]">
                              {order.id} · {event.id}
                            </p>
                            <h2 className="mt-1 text-2xl font-black">
                              {product.name} · {order.quantity} un.
                            </h2>
                            <p className="mt-1 text-sm text-[#687783]">
                              Prazo {product.leadDays} dias · custo{" "}
                              {formatMoney(
                                product.productionCost * order.quantity,
                              )}
                            </p>
                          </div>
                          <Pill tone={order.stage === 5 ? "green" : "blue"}>
                            {order.stage === 5
                              ? "Recebido e reservado"
                              : stages[order.stage]}
                          </Pill>
                        </div>
                        <div className="grid gap-px bg-[#d4dbe0] md:grid-cols-5">
                          {stages.map((name, index) => (
                            <div
                              key={name}
                              className={`p-4 ${index < order.stage || order.stage === 5 ? "bg-[#e7f3ec]" : index === order.stage ? "bg-[#e9f0ff]" : "bg-white"}`}
                            >
                              <span
                                className={`grid size-7 place-items-center rounded-full text-xs font-black ${index <= order.stage ? "bg-[#2c63d6] text-white" : "bg-[#e5e9ec]"}`}
                              >
                                {index < order.stage || order.stage === 5 ? (
                                  <Check size={12} />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <p className="mt-4 text-sm font-black">{name}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end p-5">
                          <button
                            onClick={() => advanceWorkOrder(order.id)}
                            disabled={order.stage === 5}
                            className="bg-[#10243b] px-5 py-3 text-sm font-black text-white disabled:opacity-30"
                          >
                            {order.stage === 4
                              ? "Receber e gerar tags"
                              : order.stage === 5
                                ? "Lote recebido"
                                : "Concluir etapa"}
                          </button>
                        </div>
                      </section>
                    );
                  })
              )}
            </div>
          )}
          {module === "logistics" && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Pull list, custódia e divergência
                </p>
                <h1 className="mt-1 text-3xl font-black">
                  Logística · {event.id}
                </h1>
              </div>
              <section className="grid gap-px border bg-[#cfd7dc] md:grid-cols-4">
                <label className="bg-white p-4 text-xs font-bold">
                  Veículo
                  <input
                    value={event.dispatch.vehicle}
                    onChange={(target) =>
                      updateDispatch({ vehicle: target.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="bg-white p-4 text-xs font-bold">
                  Motorista
                  <input
                    value={event.dispatch.driver}
                    onChange={(target) =>
                      updateDispatch({ driver: target.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="bg-white p-4 text-xs font-bold">
                  Líder de montagem
                  <input
                    value={event.dispatch.crewLead}
                    onChange={(target) =>
                      updateDispatch({ crewLead: target.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <div className="bg-white p-4">
                  <p className="text-xs font-bold">Comprovante de entrega</p>
                  <button
                    onClick={() =>
                      updateDispatch({
                        deliveryProof: !event.dispatch.deliveryProof,
                      })
                    }
                    className={`mt-3 flex w-full items-center justify-center gap-2 px-3 py-3 text-xs font-black ${event.dispatch.deliveryProof ? "bg-[#1b674c] text-white" : "border border-[#10243b]"}`}
                  >
                    <Camera size={14} />
                    {event.dispatch.deliveryProof
                      ? "Foto e assinatura registradas"
                      : "Registrar foto + assinatura"}
                  </button>
                </div>
              </section>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  [
                    "Previstas",
                    Object.values(event.cart).reduce(
                      (sum, value) => sum + value,
                      0,
                    ),
                  ],
                  ["Tags reservadas", linkedUnits.length],
                  ["Lidas na separação", event.dispatch.scannedUnitIds.length],
                  ["Lidas na carga", event.dispatch.loadedUnitIds.length],
                ].map(([name, value]) => (
                  <div key={name as string} className="border bg-white p-5">
                    <p className="text-xs text-[#687783]">{name}</p>
                    <p className="mt-2 text-3xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              {event.logisticsStep < 2 && linkedUnits.length > 0 && (
                <section className="overflow-x-auto border bg-white">
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase text-[#2c63d6]">
                        Leitura individual
                      </p>
                      <h2 className="font-black">
                        {event.logisticsStep === 0
                          ? "Separação por tag"
                          : "Conferência da carga"}
                      </h2>
                    </div>
                    <ScanLine size={24} />
                  </div>
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
                      <tr>
                        <th className="px-4 py-3 font-medium">Tag</th>
                        <th className="px-4 py-3 font-medium">Produto</th>
                        <th className="px-4 py-3 font-medium">Local</th>
                        <th className="px-4 py-3 font-medium">Conferência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {linkedUnits.map((unit) => {
                        const done =
                          event.logisticsStep === 0
                            ? event.dispatch.scannedUnitIds.includes(unit.id)
                            : event.dispatch.loadedUnitIds.includes(unit.id);
                        return (
                          <tr key={unit.id}>
                            <td className="px-4 py-3 font-mono text-xs font-bold">
                              {unit.id}
                            </td>
                            <td className="px-4 py-3">
                              {
                                state.products.find(
                                  (product) => product.id === unit.productId,
                                )?.name
                              }
                            </td>
                            <td className="px-4 py-3 text-xs text-[#687783]">
                              {unit.location}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                disabled={done}
                                onClick={() =>
                                  scanDispatchUnit(
                                    unit.id,
                                    event.logisticsStep === 0
                                      ? "separate"
                                      : "load",
                                  )
                                }
                                className={`flex items-center gap-2 px-3 py-2 text-xs font-black ${done ? "bg-[#dcefe5] text-[#16533f]" : "bg-[#10243b] text-white"}`}
                              >
                                {done ? (
                                  <Check size={13} />
                                ) : (
                                  <ScanLine size={13} />
                                )}
                                {done ? "Conferida" : "Ler tag"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}
              <section className="border bg-white">
                <div className="grid gap-px bg-[#d4dbe0] md:grid-cols-4">
                  {[
                    ["Separar por QR", "Galpão → separação"],
                    ["Conferir carga", "Separação → caminhão"],
                    ["Confirmar entrega", `Caminhão → ${event.details.venue}`],
                    ["Registrar retorno", "Local → inspeção"],
                  ].map(([name, note], index) => (
                    <div
                      key={name}
                      className={`p-5 ${index < event.logisticsStep ? "bg-[#e7f3ec]" : index === event.logisticsStep ? "bg-[#e9f0ff]" : "bg-white"}`}
                    >
                      <span
                        className={`grid size-8 place-items-center rounded-full text-xs font-black ${index < event.logisticsStep ? "bg-[#1b674c] text-white" : index === event.logisticsStep ? "bg-[#2c63d6] text-white" : "bg-[#e4e9ec]"}`}
                      >
                        {index < event.logisticsStep ? (
                          <Check size={13} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <h3 className="mt-5 font-black">{name}</h3>
                      <p className="mt-1 text-xs text-[#687783]">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col justify-between gap-3 border-t p-5 md:flex-row md:items-center">
                  <p className="text-sm text-[#687783]">
                    {event.logisticsStep === 4
                      ? "Retorno parcial registrado: uma tag faltante e uma avaria aguardam decisão."
                      : `Próxima leitura simulada: etapa ${event.logisticsStep + 1}.`}
                  </p>
                  <button
                    onClick={advanceLogistics}
                    disabled={
                      event.logisticsStep >= 4 ||
                      event.status === "submitted" ||
                      event.status === "proposal" ||
                      !logisticsReady
                    }
                    className="bg-[#10243b] px-5 py-3 text-sm font-black text-white disabled:opacity-30"
                  >
                    {event.logisticsStep === 3
                      ? "Registrar retorno parcial"
                      : event.logisticsStep === 0
                        ? "Liberar separação"
                        : event.logisticsStep === 1
                          ? "Liberar veículo"
                          : "Confirmar entrega"}
                  </button>
                </div>
              </section>
              {event.logisticsStep === 4 && (
                <div className="flex gap-3 border border-[#e0b77f] bg-[#fff1df] p-4 text-sm">
                  <AlertTriangle className="shrink-0 text-[#a65b18]" />
                  <div>
                    <p className="font-black">Evento não pode ser encerrado.</p>
                    <p className="mt-1 text-[#7d5a36]">
                      Resolva a peça faltante, a inspeção e qualquer ordem de
                      manutenção.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {module === "returns" && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Retorno → inspeção → OS → estoque
                </p>
                <h1 className="mt-1 text-3xl font-black">Retorno e revisão</h1>
              </div>
              <section className="border bg-white">
                <div className="border-b p-5">
                  <h2 className="font-black">
                    Pendências do evento {event.id}
                  </h2>
                </div>
                <div className="divide-y">
                  {linkedUnits
                    .filter(
                      (unit) =>
                        unit.status === "inspection" ||
                        unit.condition === "missing",
                    )
                    .map((unit) => (
                      <article
                        key={unit.id}
                        className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center"
                      >
                        <div>
                          <p className="font-mono text-[9px] text-[#687783]">
                            {unit.id}
                          </p>
                          <p className="font-black">
                            {
                              state.products.find(
                                (product) => product.id === unit.productId,
                              )?.name
                            }
                          </p>
                          <p className="mt-1 text-xs text-[#8a4c13]">
                            {unit.note}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unit.condition === "missing" ? (
                            <button
                              onClick={() => inspect(unit.id, "found")}
                              className="bg-[#2c63d6] px-3 py-2 text-xs font-black text-white"
                            >
                              Localizar e conferir
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => inspect(unit.id, "approve")}
                                className="border border-[#1b674c] px-3 py-2 text-xs font-black text-[#1b674c]"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => inspect(unit.id, "repair")}
                                className="bg-[#a65b18] px-3 py-2 text-xs font-black text-white"
                              >
                                Abrir OS de revisão
                              </button>
                              <button
                                onClick={() => inspect(unit.id, "retire")}
                                className="border border-[#923333] px-3 py-2 text-xs font-black text-[#923333]"
                              >
                                Dar baixa
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  {linkedUnits.filter(
                    (unit) =>
                      unit.status === "inspection" ||
                      unit.condition === "missing",
                  ).length === 0 && (
                    <div className="p-10 text-center">
                      <Check className="mx-auto text-[#1b674c]" />
                      <p className="mt-3 font-black">
                        Nenhuma inspeção pendente.
                      </p>
                    </div>
                  )}
                </div>
              </section>
              <section className="border bg-white">
                <div className="border-b p-5">
                  <h2 className="font-black">Ordens de manutenção</h2>
                </div>
                <div className="divide-y">
                  {state.maintenanceOrders
                    .filter((order) => order.eventId === event.id)
                    .map((order) => (
                      <article
                        key={order.id}
                        className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center"
                      >
                        <div>
                          <p className="font-mono text-[9px] text-[#687783]">
                            {order.id} · {order.unitId}
                          </p>
                          <p className="font-black">
                            {
                              [
                                "Triagem e orçamento",
                                "Reparo / tapeçaria",
                                "Qualidade",
                                "Concluída",
                              ][order.stage]
                            }
                          </p>
                          <p className="mt-1 text-xs text-[#687783]">
                            {order.note} · custo {formatMoney(order.cost)}
                          </p>
                        </div>
                        <button
                          onClick={() => advanceMaintenance(order.id)}
                          disabled={order.stage === 3}
                          className="bg-[#10243b] px-4 py-3 text-xs font-black text-white disabled:opacity-30"
                        >
                          {order.stage === 2
                            ? "Aprovar e voltar ao estoque"
                            : order.stage === 3
                              ? "Finalizada"
                              : "Concluir etapa"}
                        </button>
                      </article>
                    ))}
                  {state.maintenanceOrders.filter(
                    (order) => order.eventId === event.id,
                  ).length === 0 && (
                    <p className="p-6 text-sm text-[#687783]">
                      Nenhuma OS vinculada a este evento.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}
          {module === "integrations" && (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[9px] uppercase text-[#687783]">
                  Contrato futuro · sem chamadas externas
                </p>
                <h1 className="mt-1 text-3xl font-black">Integrações</h1>
              </div>
              <section className="overflow-x-auto border bg-white">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-[#e9eef1] font-mono text-[9px] uppercase text-[#687783]">
                    <tr>
                      {[
                        "Conexão",
                        "Dado",
                        "Gatilho",
                        "Estado",
                        "Demonstração",
                      ].map((name) => (
                        <th key={name} className="px-4 py-3 font-medium">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      [
                        "Catálogo Estoque NOW ↔ CRM",
                        "406 itens, fotos, tags e carrinho",
                        "Publicação / pedido",
                        "Simulação frontend",
                      ],
                      [
                        "WhatsApp",
                        "Proposta, sinal e rota",
                        "Mudança de etapa",
                        "Simulação frontend",
                      ],
                      [
                        "Pix / cartão",
                        "Sinal e caução",
                        "Pagamento aprovado",
                        "Planejada",
                      ],
                      [
                        "Google Maps",
                        "Distância, pedágio e rota",
                        "Endereço alterado",
                        "Simulação frontend",
                      ],
                      [
                        "QR mobile",
                        "Custódia por tag",
                        "Leitura de câmera",
                        "Simulação frontend",
                      ],
                      [
                        "ERP / NF-e",
                        "Contrato, saldo e avaria",
                        "Documento final",
                        "Planejada",
                      ],
                      [
                        "Router CNC",
                        "OP e arquivo versionado",
                        "Produção aprovada",
                        "Planejada",
                      ],
                      [
                        "Fotos",
                        "Mural, produto e avaria",
                        "Upload vinculado",
                        "Simulação frontend",
                      ],
                      [
                        "Meu Império",
                        "Cashback, validade e elegibilidade",
                        "Pagamento / evento concluído",
                        "Simulação frontend",
                      ],
                    ].map(([name, data, trigger, status]) => (
                      <tr key={name}>
                        <td className="px-4 py-4 font-black">{name}</td>
                        <td className="px-4 py-4">{data}</td>
                        <td className="px-4 py-4 text-xs text-[#687783]">
                          {trigger}
                        </td>
                        <td className="px-4 py-4">
                          <Pill
                            tone={status === "Planejada" ? "neutral" : "blue"}
                          >
                            {status}
                          </Pill>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() =>
                              setIntegrationPayload(
                                JSON.stringify(
                                  {
                                    demo: true,
                                    integration: name,
                                    eventId: event.id,
                                    orderId: event.orderId,
                                    timestamp: "simulado",
                                  },
                                  null,
                                  2,
                                ),
                              )
                            }
                            className="flex items-center gap-2 border px-3 py-2 text-xs font-black"
                          >
                            <FileJson size={13} />
                            Ver payload fictício
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              {integrationPayload && (
                <pre
                  className="overflow-x-auto border border-[#95afd9] bg-[#10243b] p-5 font-mono text-xs text-[#dce7f0]"
                  aria-live="polite"
                >
                  {integrationPayload}
                </pre>
              )}
            </div>
          )}
          {module === "finance" && (
            <ReceivablesBoard state={state} changeState={changeState} />
          )}
        </div>
      </main>
    </div>
  );
}

function optionDemand(productId: string) {
  const rows: Record<string, string[]> = {
    "mesa-arco": [
      "Summit Nexus · 21 nov · 2 un.",
      "Gala Horizonte · 08 dez · 1 un.",
    ],
    "poltrona-orla": ["Casamento Lia & Tom · 15 dez · 4 un."],
    "banco-linha": ["Prêmio Inova Vale · 03 dez · 3 un."],
  };
  return (
    <div className="border-t bg-[#f7f9fa] p-4">
      <p className="font-mono text-[9px] uppercase text-[#687783]">
        Demanda perdida compatível nos próximos 120 dias
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(rows[productId] ?? ["Nenhuma oportunidade compatível"]).map((row) => (
          <Pill key={row} tone={rows[productId] ? "blue" : "neutral"}>
            {row}
          </Pill>
        ))}
      </div>
    </div>
  );
}

export default function ImperioPage() {
  const [state, setState] = useState<DemoState>(() => seedState());
  const [hydrated, setHydrated] = useState(false);
  const [surface, setSurface] = useState<Surface>("showroom");
  const [view, setView] = useState<PublicView>("home");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, value) => sum + value, 0),
    [cart],
  );

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as DemoState) : null;
        if (
          saved?.version === 4 &&
          Array.isArray(saved.events) &&
          Array.isArray(saved.units)
        )
          setState(saved);
        else if (raw) localStorage.removeItem(STORAGE_KEY);
        const draft = localStorage.getItem(`${STORAGE_KEY}-cart`);
        if (draft) {
          const parsed = JSON.parse(draft) as {
            cart: Record<string, number>;
            sceneIds: string[];
          };
          setCart(parsed.cart ?? {});
          setSceneIds(parsed.sceneIds ?? []);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(`${STORAGE_KEY}-cart`);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        `${STORAGE_KEY}-cart`,
        JSON.stringify({ cart, sceneIds }),
      );
  }, [cart, hydrated, sceneIds]);

  const setQuantity = (id: string, quantity: number) =>
    setCart((current) => ({ ...current, [id]: Math.max(0, quantity) }));
  const toggleFavorite = (id: string) =>
    setState((current) => ({
      ...current,
      favoriteProductIds: current.favoriteProductIds.includes(id)
        ? current.favoriteProductIds.filter((productId) => productId !== id)
        : [...current.favoriteProductIds, id],
    }));
  const addScene = (scene: Scene) => {
    setCart((current) => {
      const next = { ...current };
      scene.items.forEach((item) => {
        next[item.productId] = (next[item.productId] ?? 0) + item.quantity;
      });
      return next;
    });
    setSceneIds((current) =>
      current.includes(scene.id) ? current : [...current, scene.id],
    );
  };
  const submit = (details: EventDetails) => {
    const suffix = String(Date.now()).slice(-4);
    const project: EventProject = {
      id: `EV-${suffix}`,
      orderId: `PED-${suffix}`,
      accountId: "ACC-MARINA",
      status: "submitted",
      createdAt: "agora",
      sceneIds,
      cart: Object.fromEntries(
        Object.entries(cart).filter(([, quantity]) => quantity > 0),
      ),
      details,
      coverage: {},
      logisticsStep: 0,
      proposalApproved: false,
      ...eventOpsDefaults(),
      history: [
        "Pedido enviado pelo site",
        "Carrinho, briefing e referências recebidos",
      ],
    };
    setState((current) => ({
      ...current,
      events: [project, ...current.events],
      activeEventId: project.id,
    }));
    setCart({});
    setSceneIds([]);
    setSurface("account");
    setView("home");
  };
  const updateEvent = (id: string, patch: Partial<EventProject>) =>
    setState((current) =>
      patch.proposalApproved
        ? reserveEvent(current, id)
        : {
            ...current,
            events: current.events.map((event) =>
              event.id === id ? { ...event, ...patch } : event,
            ),
          },
    );
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}-cart`);
    setState(seedState());
    setCart({});
    setSceneIds([]);
    setSurface("showroom");
    setView("home");
  };

  return (
    <div className="imperio-shell fixed inset-0 z-[80] overflow-y-auto bg-[#edf1f3] font-sans">
      <Header
        surface={surface}
        setSurface={setSurface}
        cartCount={cartCount}
        reset={reset}
      />
      <div className="pt-16">
        {surface === "showroom" && (
          <Showroom
            state={state}
            view={view}
            setView={setView}
            cart={cart}
            setQuantity={setQuantity}
            sceneIds={sceneIds}
            addScene={addScene}
            submit={submit}
            toggleFavorite={toggleFavorite}
          />
        )}
        {surface === "account" && (
          <Account
            state={state}
            setActive={(id) =>
              setState((current) => ({ ...current, activeEventId: id }))
            }
            updateEvent={updateEvent}
            openShowroom={() => {
              setSurface("showroom");
              setView("home");
            }}
            openOps={() => setSurface("ops")}
          />
        )}
        {surface === "ops" && (
          <Ops
            state={state}
            changeState={setState}
            setActive={(id) =>
              setState((current) => ({ ...current, activeEventId: id }))
            }
            openShowroom={() => setSurface("showroom")}
          />
        )}
      </div>
    </div>
  );
}
