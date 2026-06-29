"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { services } from "@/data/services";
import { TiltCard } from "@/components/TiltCard";

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.1 * i, ease: "easeOut" as const },
  }),
};

export function Services() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="services" className="py-32 px-6 section-warm" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-semibold text-[#0A2473] uppercase tracking-widest">
            O que fazemos
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a]">
            Da automação ao sistema completo
          </h2>
          <p className="mt-4 text-lg text-stone-500 max-w-2xl mx-auto">
            Se tem um processo que pode ser melhor, a gente descobre como.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.title}
                custom={i}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                variants={cardVariants}
              >
                <TiltCard className="rounded-2xl border border-stone-200 bg-white p-6 h-full">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A2473]/[0.06] text-[#0A2473] mb-5">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-stone-800">
                    {service.title}
                  </h3>
                  <p className="text-stone-500 text-sm leading-relaxed mb-4">
                    {service.description}
                  </p>
                  <ul className="space-y-2">
                    {service.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-xs text-stone-400"
                      >
                        <div className="h-1 w-1 rounded-full bg-[#0A2473]/40" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
