"use client";

import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  CloudOff,
  LocateFixed,
  MapPin,
  PackageCheck,
  Radio,
  Route,
  ShieldCheck,
  Truck,
  Users,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  DepartureDraft,
  LogisticOperation,
  LogisticsSnapshot,
  OperationStatus,
} from "./types";

const STORAGE_KEY = "imperio-logistics-departure-v1";
const blankDraft = (operation: LogisticOperation): DepartureDraft => ({
  operationId: operation.id,
  driver: "",
  crew: operation.crew === "Não informada" ? "" : operation.crew,
  vehicle: operation.vehicle === "Não informado" ? "" : operation.vehicle,
  checks: { load: false, documents: false, vehicle: false },
  photoDataUrl: "",
  location: null,
  queuedAt: null,
});

const STATUS: Record<OperationStatus, { label: string; tone: string }> = {
  preparation: { label: "Preparação", tone: "bg-[#f3be47] text-[#16323a]" },
  route: { label: "Em rota", tone: "bg-[#d8eef3] text-[#0b6e8a]" },
  delivery: { label: "Montagem", tone: "bg-[#ffe4d8] text-[#a33b19]" },
  return: { label: "Retorno", tone: "bg-[#e8e1f4] text-[#63458a]" },
  completed: { label: "Concluída", tone: "bg-[#dceee5] text-[#1d664d]" },
};

const formatCapturedAt = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));

function SourceBanner({ snapshot }: { snapshot: LogisticsSnapshot }) {
  const real = snapshot.source === "estoquenow";
  return (
    <div
      className={`flex flex-col gap-2 border-b px-4 py-3 text-xs font-bold sm:flex-row sm:items-center sm:justify-between sm:px-7 ${real ? "border-[#a8d2c0] bg-[#e8f5ee] text-[#15533e]" : "border-[#f2c2ae] bg-[#fff0e9] text-[#8c371c]"}`}
      role="status"
    >
      <span className="flex items-center gap-2">
        {real ? <Wifi size={15} /> : <CloudOff size={15} />}
        {real ? "Fonte: EstoqueNOW" : "AMBIENTE DEMONSTRATIVO"}
      </span>
      <span className="font-medium">{snapshot.notice}</span>
    </div>
  );
}

function Tower({ operations }: { operations: LogisticOperation[] }) {
  const [selectedId, setSelectedId] = useState(operations[0]?.id ?? "");
  const selected = operations.find((item) => item.id === selectedId) ?? operations[0];
  const active = operations.filter((item) => item.status !== "completed").length;
  const attention = operations.filter((item) => item.alert).length;

  if (!selected)
    return (
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <PackageCheck className="mx-auto text-[#0b6e8a]" size={38} />
        <h1 className="mt-5 text-3xl font-black">Nenhuma operação no período</h1>
        <p className="mt-2 text-sm text-[#587078]">A leitura foi concluída sem logísticas para exibir.</p>
      </section>
    );

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:py-9">
      <section className="grid overflow-hidden border border-[#b9c8c5] bg-[#16323a] text-white lg:grid-cols-[1fr_420px]">
        <div className="p-6 md:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8bd2d9]">Turno de hoje · torre de controle</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[0.94] tracking-[-0.045em] md:text-6xl">
            Cada equipe sabe o próximo marco.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c8d7d8]">
            Operações, horários e bloqueios no mesmo despacho. Sem depender de memória ou mensagem solta.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-[#456068] lg:border-l lg:border-t-0">
          <div className="border-r border-[#456068] p-5 md:p-7">
            <p className="font-mono text-[10px] uppercase text-[#a9bec1]">Em curso</p>
            <p className="mt-2 text-5xl font-black text-[#f3be47]">{active}</p>
          </div>
          <div className="p-5 md:p-7">
            <p className="font-mono text-[10px] uppercase text-[#a9bec1]">Atenção</p>
            <p className="mt-2 text-5xl font-black text-[#ff875e]">{attention}</p>
          </div>
          <div className="col-span-2 border-t border-[#456068] bg-[#0b6e8a] px-5 py-4 text-sm font-bold">
            Próxima janela: {selected.scheduledTime} · {selected.city}
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(370px,.85fr)]">
        <section className="border border-[#b9c8c5] bg-white">
          <div className="flex items-end justify-between border-b border-[#d4ddda] p-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0b6e8a]">Fila operacional</p>
              <h2 className="mt-1 text-2xl font-black">Despachos do período</h2>
            </div>
            <span className="font-mono text-xs text-[#587078]">{operations.length} registros</span>
          </div>
          <div className="divide-y divide-[#d4ddda]">
            {operations.map((operation) => {
              const activeRow = operation.id === selected.id;
              return (
                <button
                  key={operation.id}
                  onClick={() => setSelectedId(operation.id)}
                  className={`grid w-full gap-4 p-5 text-left transition sm:grid-cols-[90px_1fr_auto] sm:items-center ${activeRow ? "bg-[#e8f4f5] shadow-[inset_4px_0_0_#0b6e8a]" : "hover:bg-[#f4f6f2]"}`}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[#587078]">Saída</p>
                    <p className="mt-1 text-2xl font-black tabular-nums">{operation.scheduledTime}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS[operation.status].tone}`}>
                        {STATUS[operation.status].label}
                      </span>
                      <span className="font-mono text-[10px] text-[#587078]">#{operation.orderId}</span>
                    </div>
                    <h3 className="mt-2 font-black">{operation.eventName}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#587078]">
                      <MapPin size={12} /> {operation.venue} · {operation.city}
                    </p>
                    {operation.alert && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-bold text-[#a33b19]">
                        <AlertTriangle size={13} /> {operation.alert}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="hidden text-[#0b6e8a] sm:block" size={20} />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="border border-[#b9c8c5] bg-white xl:sticky xl:top-5 xl:h-fit">
          <div className="border-b border-[#d4ddda] bg-[#f3be47] p-5 text-[#16323a]">
            <p className="font-mono text-[10px] uppercase">Próximo marco</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{selected.nextMilestone}</h2>
          </div>
          <div className="space-y-5 p-5">
            <div className="relative ml-2 border-l-2 border-dashed border-[#a9c3c1] pl-6">
              {[
                ["Agora", STATUS[selected.status].label, true],
                [selected.scheduledTime, "Chegada / montagem", false],
                [selected.returnDate, "Retorno e inspeção", false],
              ].map(([time, label, current]) => (
                <div key={label as string} className="relative pb-6 last:pb-0">
                  <span className={`absolute -left-[33px] top-0 grid size-4 place-items-center rounded-full border-2 border-white ${current ? "bg-[#f97345]" : "bg-[#a9c3c1]"}`} />
                  <p className="font-mono text-[10px] uppercase text-[#587078]">{time as string}</p>
                  <p className="mt-1 text-sm font-black">{label as string}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-px bg-[#d4ddda] sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                [Users, "Equipe", selected.crew],
                [Truck, "Veículo", selected.vehicle],
                [ShieldCheck, "Coordenação", selected.coordinator],
                [Clock3, "Retorno", selected.returnDate],
              ].map(([Icon, label, value]) => {
                const ItemIcon = Icon as typeof Users;
                return (
                  <div key={label as string} className="bg-[#f7f8f5] p-4">
                    <ItemIcon size={16} className="text-[#0b6e8a]" />
                    <p className="mt-2 font-mono text-[9px] uppercase text-[#587078]">{label as string}</p>
                    <p className="mt-1 text-xs font-bold">{value as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("PHOTO_READ_FAILED"));
    };
    image.src = objectUrl;
  });
}

function FieldOperation({ operations }: { operations: LogisticOperation[] }) {
  const [operationId, setOperationId] = useState(operations[0]?.id ?? "");
  const operation = operations.find((item) => item.id === operationId) ?? operations[0];
  const [drafts, setDrafts] = useState<Record<string, DepartureDraft>>({});
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const draft = operation ? drafts[operation.id] ?? blankDraft(operation) : null;

  useEffect(() => {
    let savedDrafts: Record<string, DepartureDraft> = {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) savedDrafts = JSON.parse(saved) as Record<string, DepartureDraft>;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      setDrafts(savedDrafts);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      // ponytail: localStorage cobre uma foto comprimida por saída; migrar para IndexedDB quando a fila offline aceitar múltiplas evidências.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      queueMicrotask(() =>
        setMessage("O armazenamento deste aparelho está cheio. Remova uma foto e tente novamente."),
      );
    }
  }, [drafts, ready]);

  const update = (patch: Partial<DepartureDraft>) => {
    if (!operation || !draft) return;
    setDrafts((current) => ({ ...current, [operation.id]: { ...draft, ...patch } }));
  };

  const complete =
    draft &&
    draft.driver.trim() &&
    draft.crew.trim() &&
    draft.vehicle.trim() &&
    Object.values(draft.checks).every(Boolean) &&
    draft.photoDataUrl &&
    draft.location;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Localização indisponível neste aparelho.");
      return;
    }
    setMessage("Capturando localização…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        update({
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            capturedAt: new Date().toISOString(),
          },
        });
        setMessage("Localização capturada.");
      },
      () => setMessage("Não foi possível obter o GPS. Verifique a permissão e tente novamente."),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  if (!operation || !draft)
    return <p className="p-8 text-center">Nenhuma operação disponível.</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
      <section className="overflow-hidden border border-[#b9c8c5] bg-white shadow-[0_18px_60px_rgba(22,50,58,0.12)]">
        <div className="bg-[#16323a] p-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8bd2d9]">
              <Radio size={14} /> Operação guiada
            </span>
            <span className="bg-[#f3be47] px-2 py-1 font-mono text-[9px] font-black text-[#16323a]">SALVO NESTE APARELHO</span>
          </div>
          <label className="mt-5 block">
            <span className="text-[10px] font-bold uppercase text-[#a9bec1]">Evento</span>
            <select
              value={operation.id}
              onChange={(event) => setOperationId(event.target.value)}
              className="mt-2 w-full border border-[#668087] bg-[#244750] px-3 py-4 text-base font-black text-white outline-none focus:border-[#f3be47]"
            >
              {operations.map((item) => (
                <option key={item.id} value={item.id}>{item.scheduledTime} · {item.eventName}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex items-start gap-2 text-sm text-[#d7e2e3]">
            <MapPin className="mt-0.5 shrink-0 text-[#f3be47]" size={15} />
            <span>{operation.venue} · {operation.city}</span>
          </div>
        </div>

        {draft.queuedAt ? (
          <div className="p-6 text-center sm:p-9">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#dceee5] text-[#1d7a5a]">
              <Check size={30} strokeWidth={3} />
            </span>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#1d7a5a]">Saída registrada localmente</p>
            <h1 className="mt-2 text-3xl font-black">Pronto para seguir.</h1>
            <p className="mt-3 text-sm leading-6 text-[#587078]">
              Registro feito às {formatCapturedAt(draft.queuedAt)}. A ação está neste aparelho e ainda não foi sincronizada com o EstoqueNOW.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 border border-[#f2c2ae] bg-[#fff0e9] p-3 text-xs font-bold text-[#8c371c]">
              <CloudOff size={15} /> Sincronização posterior ainda não implementada
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#d4ddda]">
            <div className="p-5 sm:p-6">
              <StepTitle number="01" title="Confirme quem sai" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <LargeInput label="Motorista" value={draft.driver} onChange={(driver) => update({ driver })} placeholder="Nome do motorista" />
                <LargeInput label="Veículo" value={draft.vehicle} onChange={(vehicle) => update({ vehicle })} placeholder="Veículo / placa" />
                <div className="sm:col-span-2">
                  <LargeInput label="Equipe" value={draft.crew} onChange={(crew) => update({ crew })} placeholder="Líder e equipe" />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <StepTitle number="02" title="Confira antes de fechar" />
              <div className="mt-4 space-y-2">
                {[
                  ["load", "Carga conferida", "Volumes e itens batem com o romaneio"],
                  ["documents", "Documentos a bordo", "Checklist e contatos acessíveis"],
                  ["vehicle", "Veículo liberado", "Combustível, pneus e portas verificados"],
                ].map(([key, title, detail]) => {
                  const checked = draft.checks[key as keyof DepartureDraft["checks"]];
                  return (
                    <button
                      key={key}
                      onClick={() => update({ checks: { ...draft.checks, [key]: !checked } })}
                      className={`flex min-h-16 w-full items-center gap-3 border p-3 text-left ${checked ? "border-[#8fc8af] bg-[#e8f5ee]" : "border-[#c7d2cf] bg-white"}`}
                      aria-pressed={checked}
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${checked ? "bg-[#1d7a5a] text-white" : "bg-[#e5ebe8] text-[#587078]"}`}>
                        {checked ? <Check size={18} /> : <CircleDot size={17} />}
                      </span>
                      <span>
                        <strong className="block text-sm">{title}</strong>
                        <small className="text-xs text-[#587078]">{detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <StepTitle number="03" title="Registre a saída" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={`relative flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed p-4 text-center ${draft.photoDataUrl ? "border-[#1d7a5a] bg-[#e8f5ee]" : "border-[#9cb3b1] bg-[#f4f6f2]"}`}>
                  {draft.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local capture has no stable URL for next/image.
                    <img src={draft.photoDataUrl} alt="Foto da carga capturada" className="absolute inset-0 size-full object-cover opacity-25" />
                  ) : null}
                  <Camera size={25} className="relative text-[#0b6e8a]" />
                  <strong className="relative mt-2 text-sm">{draft.photoDataUrl ? "Foto capturada" : "Tirar foto da carga"}</strong>
                  <span className="relative mt-1 text-[10px] text-[#587078]">Câmera traseira · obrigatório</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        update({ photoDataUrl: await resizePhoto(file) });
                        setMessage("Foto salva neste aparelho.");
                      } catch {
                        setMessage("Não foi possível salvar a foto. Tente novamente.");
                      }
                    }}
                  />
                </label>
                <button
                  onClick={captureLocation}
                  className={`flex min-h-32 flex-col items-center justify-center border-2 p-4 text-center ${draft.location ? "border-[#1d7a5a] bg-[#e8f5ee]" : "border-[#9cb3b1] bg-[#f4f6f2]"}`}
                >
                  <LocateFixed size={25} className="text-[#0b6e8a]" />
                  <strong className="mt-2 text-sm">{draft.location ? "GPS capturado" : "Capturar localização"}</strong>
                  <span className="mt-1 text-[10px] text-[#587078]">
                    {draft.location ? `Precisão aproximada: ${Math.round(draft.location.accuracy)} m` : "Local e horário · obrigatório"}
                  </span>
                </button>
              </div>
              <p className="mt-3 min-h-5 text-xs font-bold text-[#587078]" aria-live="polite">{message}</p>
              <button
                disabled={!complete}
                onClick={() => {
                  update({ queuedAt: new Date().toISOString() });
                  setMessage("Saída registrada localmente.");
                }}
                className="mt-3 flex min-h-16 w-full items-center justify-center gap-3 bg-[#f97345] px-5 text-lg font-black text-[#16323a] transition hover:bg-[#ff8b65] disabled:cursor-not-allowed disabled:bg-[#d9dfdc] disabled:text-[#7a8b8c]"
              >
                Confirmar saída <ArrowRight size={21} />
              </button>
              <p className="mt-3 text-center text-[10px] leading-4 text-[#6d7e7f]">
                O horário vem deste aparelho. A confiabilidade e conflitos serão validados quando a sincronização for implementada.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs font-black text-[#0b6e8a]">{number}</span>
      <h2 className="text-xl font-black tracking-[-0.02em]">{title}</h2>
    </div>
  );
}

function LargeInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-wide text-[#587078]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 min-h-14 w-full border border-[#a9bab7] bg-white px-3 text-base font-bold normal-case outline-none focus:border-[#0b6e8a] focus:ring-2 focus:ring-[#0b6e8a]/20"
      />
    </label>
  );
}

export function LogisticsWorkspace({ snapshot }: { snapshot: LogisticsSnapshot }) {
  const [view, setView] = useState<"tower" | "field">("tower");
  const sourceTime = useMemo(() => formatCapturedAt(snapshot.fetchedAt), [snapshot.fetchedAt]);

  return (
    <div className="imperio-shell min-h-screen bg-[#eef2ed] text-[#16323a]">
      <header className="border-b border-[#b9c8c5] bg-[#f8faf6]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#0b6e8a] text-white"><Route size={20} /></span>
            <div>
              <strong className="block text-sm tracking-[-0.01em]">IMPÉRIO · DESPACHO</strong>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#587078]">Logística em campo · atualizado {sourceTime}</span>
            </div>
          </div>
          <nav className="grid grid-cols-2 border border-[#9fb2af] bg-white p-1" aria-label="Superfície de operação">
            {[
              ["tower", "Torre de controle", Route],
              ["field", "Operação móvel", Truck],
            ].map(([id, label, Icon]) => {
              const NavIcon = Icon as typeof Route;
              return (
                <button
                  key={id as string}
                  onClick={() => setView(id as "tower" | "field")}
                  aria-pressed={view === id}
                  className={`flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-black ${view === id ? "bg-[#16323a] text-white" : "text-[#486168]"}`}
                >
                  <NavIcon size={15} /> {label as string}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <SourceBanner snapshot={snapshot} />
      <main>{view === "tower" ? <Tower operations={snapshot.operations} /> : <FieldOperation operations={snapshot.operations} />}</main>
    </div>
  );
}
