"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ItaLogo, MitLogo } from "@/components/Logos";
import { TiltCard } from "@/components/TiltCard";
import { useCountUp } from "@/hooks/useCountUp";

function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

interface Olympiad {
  logo: string;
  name: string;
  short: string;
  year: number;
  result: string;
  position: string;
}

interface Brother {
  name: string;
  role: string;
  school: string;
  Logo: typeof ItaLogo;
  color: string;
  photo: string;
  linkedin: string;
  bio: string;
  highlights: string[];
  olympiads: Olympiad[];
}

const brothers: Brother[] = [
  {
    name: "Felipe",
    role: "Engenharia de Software & AI",
    school: "ITA",
    Logo: ItaLogo,
    color: "#0A2473",
    photo: "/foto-felipe.jpeg",
    linkedin: "https://www.linkedin.com/in/felipe-farias-ribeiro/",
    bio: "Constrói agentes de IA que negociam sozinhos, automatiza processos que antes consumiam horas de gente qualificada, e desenvolve sistemas que viram a espinha dorsal de operações inteiras. Foco em resultado: menos trabalho manual, mais inteligência.",
    highlights: [
      "Agentes de IA que fecham acordos sozinhos",
      "Automação que eliminou funções manuais inteiras",
      "Sistemas que processam dados de dezenas de fontes",
      "Portais que servem centenas de usuários",
    ],
    olympiads: [
      {
        logo: "/logo-iberofisica.png",
        name: "Iberoamericana de Física",
        short: "IberoFísica",
        year: 2020,
        result: "Ouro",
        position: "1º lugar geral",
      },
      {
        logo: "/logo-nbpho.png",
        name: "Nordic-Baltic Physics Olympiads",
        short: "NBPhO",
        year: 2020,
        result: "Prata",
        position: "16º lugar geral",
      },
    ],
  },
  {
    name: "Rafael",
    role: "Ciência da Computação & Visão Computacional",
    school: "MIT",
    Logo: MitLogo,
    color: "#A31F34",
    photo: "/foto-rafael.jpeg",
    linkedin: "https://www.linkedin.com/in/rafaelmribe/",
    bio: "Transforma imagens e dados brutos em inteligência competitiva. Constrói sistemas de visão computacional que enxergam o que nenhum humano consegue, e ferramentas de análise que mostram exatamente onde seu concorrente está ganhando.",
    highlights: [
      "Sistemas de visão computacional em produção",
      "Inteligência competitiva a partir de dados públicos",
      "Modelos de ML que geram vantagem real",
      "Análise de mercado em escala",
    ],
    olympiads: [
      {
        logo: "/logo-ipho.png",
        name: "International Physics Olympiad",
        short: "IPhO",
        year: 2022,
        result: "Bronze",
        position: "Medalhista",
      },
      {
        logo: "/logo-icho.png",
        name: "International Chemistry Olympiad",
        short: "IChO",
        year: 2022,
        result: "Bronze",
        position: "Medalhista",
      },
    ],
  },
];

function OlympiadCard({ olympiad, color }: { olympiad: Olympiad; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-stone-50/50 p-3">
      <div className="h-14 w-14 shrink-0 rounded-lg bg-white border border-stone-200/80 grid place-items-center p-1.5 overflow-hidden">
        <img
          src={olympiad.logo}
          alt={olympiad.name}
          className="h-full w-full object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-stone-800 leading-tight">
            {olympiad.name}
          </span>
          <span className="text-[10px] text-stone-400">· {olympiad.year}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            {olympiad.result}
          </span>
          <span className="text-xs text-stone-500">{olympiad.position}</span>
        </div>
      </div>
    </div>
  );
}

export function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="py-32 px-6 section-cool" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-semibold text-[#0A2473] uppercase tracking-widest">
            Quem está por trás
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a]">
            Dois irmãos, dos melhores centros de
            <br />
            <span className="bg-gradient-to-r from-[#0A2473] to-[#A31F34] bg-clip-text text-transparent">
              engenharia do mundo
            </span>
          </h2>
          <p className="mt-4 text-lg text-stone-500 max-w-2xl mx-auto">
            A gente não terceiriza código. Você fala direto com quem constrói.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {brothers.map((brother, i) => {
            const LogoComponent = brother.Logo;
            return (
              <motion.div
                key={brother.name}
                initial={{ opacity: 0, y: 32, x: i === 0 ? -20 : 20 }}
                animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
              >
                <TiltCard className="rounded-2xl border border-stone-200 bg-white p-8">
                  <div className="flex items-center gap-5 mb-6">
                    <img
                      src={brother.photo}
                      alt={brother.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md shrink-0"
                      style={{ borderColor: brother.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-stone-800">
                        {brother.name}
                      </h3>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {brother.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1.5">
                        <LogoComponent size={52} />
                      </div>
                    </div>
                  </div>

                  <p className="text-stone-500 text-sm leading-relaxed mb-6">
                    {brother.bio}
                  </p>

                  <div className="space-y-2.5 mb-6">
                    {brother.highlights.map((h) => (
                      <div
                        key={h}
                        className="flex items-center gap-2.5 text-sm text-stone-600"
                      >
                        <div
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: brother.color }}
                        />
                        {h}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-stone-200/80 pt-5">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                      Olimpíadas internacionais
                    </p>
                    <div className="space-y-2">
                      {brother.olympiads.map((o) => (
                        <OlympiadCard
                          key={o.short}
                          olympiad={o}
                          color={brother.color}
                        />
                      ))}
                    </div>
                  </div>

                  <a
                    href={brother.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-[#0A2473] transition-colors"
                  >
                    <LinkedInIcon size={14} />
                    LinkedIn
                  </a>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
