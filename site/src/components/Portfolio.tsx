"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { projects } from "@/data/projects";
import { TiltCard } from "@/components/TiltCard";
import { ProjectVisual } from "@/components/ProjectVisual";
import { useCountUp } from "@/hooks/useCountUp";

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.08 * i, ease: "easeOut" as const },
  }),
};

function MetricBadge({
  value,
  suffix,
  prefix,
  decimals,
  label,
  accent,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  accent: string;
}) {
  const { ref, display } = useCountUp<HTMLSpanElement>(value, { decimals });
  return (
    <div className="flex items-baseline gap-2">
      <span
        ref={ref}
        className="text-2xl font-bold tracking-tight"
        style={{ color: accent }}
      >
        {prefix}
        {display}
        {suffix}
      </span>
      <span className="text-xs text-stone-500 leading-tight">{label}</span>
    </div>
  );
}

export function Portfolio() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="portfolio" className="py-32 px-6 bg-white" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-semibold text-[#0A2473] uppercase tracking-widest">
            Portfólio
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a]">
            Problemas reais que a gente resolveu
          </h2>
          <p className="mt-4 text-lg text-stone-500 max-w-2xl mx-auto">
            Cada projeto nasceu de uma dor real. E a gente resolveu.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => {
            const Icon = project.icon;
            return (
              <motion.div
                key={project.title}
                custom={i}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                variants={cardVariants}
              >
                <TiltCard className="group rounded-2xl border border-stone-200 bg-white overflow-hidden flex flex-col h-full transition-colors hover:border-stone-300">
                  <div className="relative overflow-hidden">
                    <div className="transition-transform duration-500 group-hover:scale-[1.03]">
                      <ProjectVisual
                        visual={project.visual}
                        accent={project.accent}
                      />
                    </div>
                    <div className="absolute top-2 right-2 z-10">
                      <div
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/90 backdrop-blur border border-stone-200/60 shadow-sm"
                        style={{ color: project.accent }}
                      >
                        <Icon size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <span
                      className="text-xs font-medium uppercase tracking-wider mb-1"
                      style={{ color: project.accent }}
                    >
                      {project.subtitle}
                    </span>
                    <h3 className="text-lg font-semibold mb-2 text-stone-800">
                      {project.title}
                    </h3>
                    <p className="text-sm text-stone-500 leading-relaxed mb-4 flex-1">
                      {project.description}
                    </p>

                    <div
                      className="rounded-lg border px-3 py-2.5 mb-4"
                      style={{
                        borderColor: `${project.accent}22`,
                        backgroundColor: `${project.accent}08`,
                      }}
                    >
                      <MetricBadge
                        value={project.metric.value}
                        suffix={project.metric.suffix}
                        prefix={project.metric.prefix}
                        decimals={project.metric.decimals}
                        label={project.metric.label}
                        accent={project.accent}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 mt-auto">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
