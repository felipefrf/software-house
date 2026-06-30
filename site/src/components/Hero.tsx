"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/MagneticButton";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#f0ece6] via-[#f7f4f0] to-[#faf9f7]" />
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] bg-[#0A2473]/[0.03] rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[#A31F34]/[0.03] rounded-full blur-[100px] animate-float-slow" />
        <div className="absolute top-[45%] right-[25%] w-[300px] h-[300px] bg-[#5c1a8b]/[0.02] rounded-full blur-[80px] animate-float" />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        className="text-center max-w-4xl z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0A2473]/15 bg-[#0A2473]/[0.04] px-4 py-1.5 text-sm font-medium text-[#0A2473]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0A2473] opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0A2473]" />
            </span>
            Aceitando projetos
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none text-[#1a1a1a]"
        >
          Seu negócio roda
          <br />
          melhor com{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-[#0A2473] via-[#5c1a8b] to-[#A31F34] bg-clip-text text-transparent animate-gradient">
              software
            </span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed"
        >
          Somos dois irmãos engenheiros, formados no{" "}
          <strong className="text-[#0A2473]">ITA</strong> e no{" "}
          <strong className="text-[#A31F34]">MIT</strong>. A gente entende o seu
          desafio, desenha a solução e constrói software que faz diferença de
          verdade no seu dia a dia.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <MagneticButton
            href="#portfolio"
            className="group inline-flex items-center gap-2 rounded-xl bg-[#0A2473] px-8 py-4 font-semibold text-white transition-all hover:shadow-xl hover:shadow-[#0A2473]/20"
          >
            Ver portfólio
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </MagneticButton>
          <MagneticButton
            href="#contact"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 hover:shadow-md"
          >
            Falar com a gente
          </MagneticButton>
        </motion.div>
      </motion.div>
    </section>
  );
}
