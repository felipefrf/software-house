"use client";

import { motion } from "framer-motion";
import type { ProjectVisualKey } from "@/data/projects";

interface Props {
  visual: ProjectVisualKey;
  accent: string;
}

/**
 * Visuals abstratos e estilizados (SVG/CSS) por projeto.
 * Sem dependência de imagens externas — on-brand e leve.
 */
export function ProjectVisual({ visual, accent }: Props) {
  return (
    <div
      className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-stone-200/80 bg-gradient-to-br from-stone-50 to-white"
      style={{ perspective: 1000 }}
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${accent}, transparent 60%)`,
        }}
      />
      <BrowserChrome accent={accent} />
      <div className="absolute inset-0 pt-8">
        {visual === "payroll" && <PayrollVisual accent={accent} />}
        {visual === "whatsapp" && <WhatsAppVisual accent={accent} />}
        {visual === "credit" && <FlowVisual accent={accent} kind="credit" />}
        {visual === "legal" && <FlowVisual accent={accent} kind="legal" />}
        {visual === "scraper" && <ScraperVisual accent={accent} />}
        {visual === "sec" && <SecVisual accent={accent} />}
      </div>
    </div>
  );
}

function BrowserChrome({ accent }: { accent: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 h-8 flex items-center gap-1.5 px-3 bg-white/80 backdrop-blur border-b border-stone-200/80 z-10">
      <span className="h-2 w-2 rounded-full bg-stone-300" />
      <span className="h-2 w-2 rounded-full bg-stone-300" />
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: accent, opacity: 0.6 }}
      />
    </div>
  );
}

/* ---------- Portal de Folha de Pagamento ---------- */
function PayrollVisual({ accent }: { accent: string }) {
  const rows = [
    ["Ana Souza", "Desenvolvedora", "R$ 12.480"],
    ["Bruno Lima", "Analista", "R$ 8.230"],
    ["Carla Dias", "Gerente", "R$ 18.900"],
    ["Diego Reis", "Designer", "R$ 9.540"],
  ];
  return (
    <div className="h-full flex">
      <div className="w-1/4 border-r border-stone-200/70 bg-white/60 p-2 space-y-1.5">
        {["Dashboard", "Funcionários", "Holerites", "Impostos", "Compliance"].map(
          (s, i) => (
            <div
              key={s}
              className="text-[8px] px-1.5 py-1 rounded text-stone-500"
              style={i === 1 ? { backgroundColor: `${accent}14`, color: accent } : {}}
            >
              {s}
            </div>
          )
        )}
      </div>
      <div className="flex-1 p-2.5 space-y-2">
        <div className="flex gap-1.5">
          {["Ativos", "Admissões", "Folha"].map((c, i) => (
            <div key={c} className="flex-1 rounded-md bg-white border border-stone-200/70 p-1.5">
              <div className="text-[7px] text-stone-400">{c}</div>
              <div className="text-[10px] font-bold" style={{ color: accent }}>
                {["284", "12", "R$ 1.2M"][i]}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md bg-white border border-stone-200/70 overflow-hidden">
          <div className="grid grid-cols-3 text-[7px] text-stone-400 px-2 py-1 border-b border-stone-200/70 bg-stone-50/60">
            <span>Nome</span><span>Cargo</span><span>Líquido</span>
          </div>
          {rows.map((r, i) => (
            <motion.div
              key={r[0]}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="grid grid-cols-3 text-[8px] px-2 py-1.5 border-b border-stone-100 last:border-0 text-stone-600"
            >
              <span>{r[0]}</span><span className="text-stone-400">{r[1]}</span>
              <span className="font-medium">{r[2]}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- WhatsApp: agente renegociando + Pix ---------- */
function WhatsAppVisual({ accent }: { accent: string }) {
  return (
    <div className="h-full bg-[#0b141a] p-2.5 flex flex-col gap-1.5 overflow-hidden">
      <div className="flex items-center gap-1.5 text-white/90">
        <div
          className="h-5 w-5 rounded-full grid place-items-center text-[8px] font-bold"
          style={{ backgroundColor: accent }}
        >
          Á
        </div>
        <div className="flex-1">
          <div className="text-[8px] font-medium leading-tight">Agente Ápice</div>
          <div className="text-[6px] text-emerald-400">online</div>
        </div>
      </div>
      <Bubble side="in" delay={0.1}>
        Olá, vi que você tem uma fatura em aberto de R$ 1.840.
      </Bubble>
      <Bubble side="in" delay={0.3}>
        Posso oferecer um plano: 3x sem juros. Topa?
      </Bubble>
      <Bubble side="out" delay={0.5} accent={accent}>
        3x fica difícil. Tem como 6x?
      </Bubble>
      <Bubble side="in" delay={0.7}>
        Fechado: 6x de R$ 306,67. Vou gerar a 1ª parcela.
      </Bubble>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.95, duration: 0.4 }}
        className="self-start max-w-[80%] rounded-lg rounded-tl-none bg-[#003b2b] p-2"
      >
        <div className="text-[6px] text-emerald-300/80 mb-0.5">PIX COBRANÇA</div>
        <div className="font-mono text-[7px] text-emerald-100 break-all leading-tight">
          00020126360014BR.GOV.BCB.PIX0114+55119...
        </div>
        <div className="text-[7px] text-white font-semibold mt-1">R$ 306,67</div>
      </motion.div>
    </div>
  );
}

function Bubble({
  children,
  side,
  delay,
  accent,
}: {
  children: React.ReactNode;
  side: "in" | "out";
  delay: number;
  accent?: string;
}) {
  const isIn = side === "in";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.35 }}
      className={`self-${isIn ? "start" : "end"} max-w-[82%] rounded-lg px-2 py-1 text-[7.5px] leading-tight ${
        isIn
          ? "bg-[#1f2c33] text-white/90 rounded-tl-none"
          : "text-white rounded-tr-none"
      }`}
      style={!isIn ? { backgroundColor: accent } : undefined}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Decision tree / workflow (crédito e jurídico) ---------- */
function FlowVisual({
  accent,
  kind,
}: {
  accent: string;
  kind: "credit" | "legal";
}) {
  const nodes =
    kind === "credit"
      ? [
          { label: "Solicitação", sub: "form + docs" },
          { label: "Coleta", sub: "4 provedores" },
          { label: "Scoring", sub: "modelo IA" },
          { label: "Decisão", sub: "aprova / nega" },
        ]
      : [
          { label: "Email", sub: "intimações" },
          { label: "IA lê", sub: "OCR + NLP" },
          { label: "Classifica", sub: "tipo + urgência" },
          { label: "Encaminha", sub: "advogado certo" },
        ];

  return (
    <div className="h-full flex items-center justify-center p-3">
      <div className="w-full flex items-center justify-between gap-1">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-1 flex-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 * i, duration: 0.4 }}
              className="flex-1 rounded-lg bg-white border border-stone-200/80 px-1.5 py-2 text-center shadow-sm"
              style={i === nodes.length - 1 ? { borderColor: accent } : {}}
            >
              <div
                className="h-1.5 w-1.5 rounded-full mx-auto mb-1"
                style={{ backgroundColor: accent }}
              />
              <div className="text-[8px] font-semibold text-stone-700 leading-tight">
                {n.label}
              </div>
              <div className="text-[6px] text-stone-400 mt-0.5">{n.sub}</div>
            </motion.div>
            {i < nodes.length - 1 && (
              <motion.svg
                width="14"
                height="10"
                viewBox="0 0 14 10"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 * i + 0.25 }}
              >
                <motion.path
                  d="M0 5 H10"
                  stroke={accent}
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 * i + 0.25, duration: 0.5 }}
                />
                <path d="M9 2 L12 5 L9 8" fill="none" stroke={accent} strokeWidth="1.2" />
              </motion.svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Web scraping + LLM ---------- */
function ScraperVisual({ accent }: { accent: string }) {
  const sites = ["A", "B", "C", "D"];
  return (
    <div className="h-full p-3 flex flex-col gap-2">
      <div className="flex gap-1.5 justify-center">
        {sites.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, y: -6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i, duration: 0.35 }}
            className="w-9 h-7 rounded bg-white border border-stone-200/80 grid place-items-center text-[7px] text-stone-400 font-mono shadow-sm"
          >
            {s}.com
          </motion.div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="rounded-md px-2 py-1 text-[7px] font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          SCRAPER
        </motion.div>
        <motion.div
          className="h-3 w-px"
          style={{ background: `linear-gradient(${accent}, #5c1a8b)` }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.4 }}
        />
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="rounded-md px-2 py-1 text-[7px] font-medium text-white bg-[#5c1a8b]"
        >
          LLM ANALYZE
        </motion.div>
        <motion.div
          className="h-3 w-px bg-stone-300"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, duration: 0.4 }}
        />
      </div>
      <div className="flex gap-1 justify-center">
        {["Design", "Copy", "Conversão", "Preço"].map((t, i) => (
          <motion.span
            key={t}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 + 0.08 * i }}
            className="text-[6px] px-1.5 py-0.5 rounded-full border text-stone-500"
            style={{ borderColor: `${accent}40` }}
          >
            {t}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/* ---------- SEC 10-K -> planilha ---------- */
function SecVisual({ accent }: { accent: string }) {
  return (
    <div className="h-full p-3 flex items-center gap-2">
      <div className="flex flex-col gap-1 w-1/3">
        {[1, 2, 3].map((d, i) => (
          <motion.div
            key={d}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 * i }}
            className="rounded bg-white border border-stone-200/80 px-1.5 py-1.5 shadow-sm"
          >
            <div className="text-[6px] text-stone-400">10-K</div>
            <div className="text-[7px] font-semibold text-stone-600">Filing {d}</div>
            <div className="mt-1 space-y-0.5">
              <div className="h-0.5 w-full bg-stone-100 rounded" />
              <div className="h-0.5 w-2/3 bg-stone-100 rounded" />
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="rounded-md px-1.5 py-1 text-[7px] font-medium text-white"
        style={{ backgroundColor: accent }}
      >
        NLP
      </motion.div>
      <div className="flex-1 rounded-md bg-white border border-stone-200/80 overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 text-[6px] text-stone-400 px-1.5 py-1 border-b border-stone-200/70 bg-stone-50/60">
          <span>Métrica</span><span>Valor</span>
        </div>
        {[
          ["Receita", "R$ 4.2B"],
          ["Risco", "Médio"],
          ["EBITDA", "18%"],
          ["Dívida", "R$ 980M"],
        ].map((r, i) => (
          <motion.div
            key={r[0]}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + 0.08 * i }}
            className="grid grid-cols-2 text-[7px] px-1.5 py-1 border-b border-stone-100 last:border-0 text-stone-600"
          >
            <span className="text-stone-400">{r[0]}</span>
            <span className="font-medium">{r[1]}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
