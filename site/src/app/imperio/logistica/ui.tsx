"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { operationStages, stageLabels, stageState } from "./action";
import type { Operation } from "./types";

export type Tone = "neutral" | "green" | "amber" | "red";

const toneClass: Record<Tone, string> = {
  neutral: "bg-imp-ground text-imp-muted ring-imp-line",
  green: "bg-imp-green-tint text-imp-green ring-imp-green/15",
  amber: "bg-imp-amber-tint text-imp-amber ring-imp-amber/15",
  red: "bg-imp-red-tint text-imp-red ring-imp-red/15",
};

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5 ring-1 ring-inset ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

// Desabilitado usa cor sólida (não opacidade) para manter contraste legível.
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold leading-none transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100";

export const buttonClass = {
  primary: `${buttonBase} bg-imp-green text-white shadow-imp-soft hover:bg-imp-green-deep hover:shadow-imp-lift disabled:bg-imp-line disabled:text-imp-muted disabled:shadow-none`,
  secondary: `${buttonBase} border border-imp-line bg-imp-surface text-imp-ink shadow-imp-soft hover:border-imp-line-strong hover:bg-imp-ground disabled:border-imp-line disabled:bg-imp-ground disabled:text-imp-muted disabled:shadow-none`,
  ghost: `${buttonBase} text-imp-green hover:bg-imp-green-tint disabled:text-imp-muted`,
  danger: `${buttonBase} border border-imp-red/30 bg-imp-surface text-imp-red hover:bg-imp-red-tint disabled:border-imp-line disabled:bg-imp-ground disabled:text-imp-muted`,
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonClass }) {
  return <button type={props.type ?? "button"} {...props} className={`${buttonClass[variant]} ${className}`} />;
}

export const linkClass = "inline-flex min-h-11 items-center font-semibold text-imp-green underline";

export const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-imp-line bg-imp-surface px-3.5 py-2 text-[15px] text-imp-ink shadow-imp-soft transition-colors hover:border-imp-line-strong read-only:bg-imp-ground read-only:text-imp-muted read-only:shadow-none disabled:bg-imp-ground disabled:text-imp-muted disabled:shadow-none";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-imp-ink ${className}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-[13px] font-normal text-imp-muted">{hint}</span>}
    </label>
  );
}

export function Notice({
  tone = "amber",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const band =
    tone === "red" ? "bg-imp-red" : tone === "green" ? "bg-imp-green" : tone === "amber" ? "bg-imp-amber" : "bg-imp-line-strong";
  const surface =
    tone === "red" ? "bg-imp-red-tint/70" : tone === "green" ? "bg-imp-green-tint/70" : tone === "amber" ? "bg-imp-amber-tint/80" : "bg-imp-ground";
  return (
    <div className={`flex overflow-hidden rounded-xl border border-imp-line/70 ${surface}`} role={tone === "red" ? "alert" : undefined}>
      <span aria-hidden="true" className={`w-1.5 shrink-0 ${band}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="font-semibold text-imp-ink">{title}</p>
        {children && <div className="mt-1 text-[14px] leading-5 text-imp-muted">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-imp-line-strong bg-imp-surface/70 px-5 py-9 text-center text-[15px] leading-6 text-imp-muted">
      <p className="mx-auto max-w-md">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageTitle({
  title,
  lead,
  aside,
}: {
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-imp-ink md:text-[30px]">{title}</h1>
        {lead && <p className="mt-1 max-w-[70ch] text-[15px] leading-6 text-imp-muted">{lead}</p>}
      </div>
      {aside && <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{aside}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  count,
  action,
  as: Tag = "h3",
}: {
  children: ReactNode;
  count?: number | string;
  action?: ReactNode;
  as?: "h3" | "h4";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tag className="flex items-center gap-2.5 text-[17px] font-semibold leading-6">
        {children}
        {count !== undefined && <span className="rounded-full bg-imp-ground px-2 py-0.5 text-[12px] font-semibold tabular-nums text-imp-muted">{count}</span>}
      </Tag>
      {action}
    </div>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-imp-line/70 bg-imp-surface shadow-imp-card ${className}`}>
      {children}
    </section>
  );
}

export function Disclosure({
  summary,
  meta,
  children,
  open,
  className = "",
}: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={`group border-t border-imp-line/70 ${className}`} open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 text-[16px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="grid size-5 place-items-center text-imp-muted transition-transform group-open:rotate-90">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5 6.5 5 3 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          {summary}
        </span>
        {meta && <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-imp-muted">{meta}</span>}
      </summary>
      <div className="pb-4 pl-7">{children}</div>
    </details>
  );
}

export function RouteDots({ operation, className = "" }: { operation: Operation; className?: string }) {
  const current = operationStages.indexOf(operation.stage);
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="img"
      aria-label={`Etapa ${current + 1} de ${operationStages.length}: ${stageLabels[operation.stage]}`}
    >
      {operationStages.map((stage, index) => {
        const done = operation.events.some((e) => e.stage === stage && e.event_type === "stage_completed");
        const state = stageState(index, current, operation.status, done);
        return (
          <span
            key={stage}
            className={`block h-2 rounded-full ${
              state === "done" ? "w-3 bg-imp-green" : state === "active" ? "w-5 bg-imp-ink" : "w-3 bg-imp-line-strong"
            }`}
          />
        );
      })}
    </span>
  );
}

/** Caixa de estado. `todo` (âmbar) é para o executor: falta fazer. `neutral` é para quem só observa. */
export function CheckMark({
  checked,
  size = "md",
  tone = "todo",
}: {
  checked: boolean;
  size?: "sm" | "md";
  tone?: "todo" | "neutral";
}) {
  const box = size === "sm" ? "size-5" : "size-6";
  return (
    <span
      aria-hidden="true"
      className={`grid ${box} shrink-0 place-items-center rounded-md border-2 ${
        checked
          ? "border-imp-green bg-imp-green text-white"
          : tone === "todo"
            ? "border-imp-amber bg-imp-amber-tint"
            : "border-imp-line-strong bg-imp-surface"
      }`}
    >
      {checked && <Check size={size === "sm" ? 12 : 15} strokeWidth={3} />}
    </span>
  );
}

/** "1 operação" / "4 operações". */
export const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const capitalize = (value: string) => value.replace(/^./, (c) => c.toUpperCase());

export const mapsPointUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

export const formatTime = (value: string) => timeFormatter.format(new Date(value));
export const formatShortDate = (value: string) => shortDateFormatter.format(new Date(value));

/** "Hoje, 10:00" | "Amanhã, 08:00" | "sáb. 05/09, 14:00" */
export const formatWhen = (value: string, now = new Date()) => {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const date = new Date(value);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const key = dayKey(date);
  const time = formatTime(value);
  if (key === today) return `Hoje, ${time}`;
  if (key === tomorrow) return `Amanhã, ${time}`;
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date);
  return `${weekday} ${formatShortDate(value)}, ${time}`;
};

export const sourceText = (operation: Operation) =>
  operation.source === "estoquenow"
    ? `EstoqueNOW · ${operation.external_id ?? "sem ID"}`
    : "Cadastro interno";

/** Splits "Venue · Rua X, 1 · Casa · Bairro · Cidade - SP · CEP" into title + address. */
export const placeParts = (operation: Operation) => {
  const ctx = operation.estoquenow_context;
  if (ctx?.venue || ctx?.address_street) {
    const street = [ctx.address_street, ctx.address_number].filter(Boolean).join(", ");
    const city = [ctx.address_neighborhood, [ctx.address_city, ctx.address_state].filter(Boolean).join(" - ")]
      .filter(Boolean)
      .join(" · ");
    return {
      venue: ctx.venue ?? null,
      address: [street, ctx.address_complement, city].filter(Boolean).join(" · ") || operation.destination,
    };
  }
  return { venue: null, address: operation.destination };
};
