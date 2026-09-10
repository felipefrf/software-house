"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Send, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

const WHATSAPP_NUMBER = "5571982725910";

export function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name"),
      email: data.get("email"),
      company: data.get("company"),
      message: data.get("message"),
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Vim pelo site da Ápice, gostaria de conversar sobre um projeto."
  )}`;

  return (
    <section id="contact" className="py-32 px-6 section-warm" ref={ref}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-sm font-semibold text-[#0A2473] uppercase tracking-widest">
            Contato
          </span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a]">
            Bora conversar
          </h2>
          <p className="mt-4 text-lg text-stone-500 max-w-2xl mx-auto">
            Conte sobre o seu desafio. A gente responde em menos de 24h.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          {/* WhatsApp — canal principal */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group block h-full rounded-2xl p-8 text-white relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-[#25D366]/20 hover:-translate-y-1"
              style={{
                background: "linear-gradient(145deg, #128C7E 0%, #075E54 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background:
                    "radial-gradient(circle at 80% 20%, #25D366 0%, transparent 50%)",
                }}
              />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 backdrop-blur mb-6">
                  <WhatsAppGlyph size={32} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">
                  Jeito mais rápido
                </p>
                <h3 className="text-3xl font-bold mb-2">WhatsApp</h3>
                <p className="text-white/70 text-sm leading-relaxed mb-6">
                  Chama direto. A gente responde rápido e troca ideia sobre o
                  seu projeto sem formalidade.
                </p>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#075E54] transition-transform group-hover:translate-x-1">
                  Abrir conversa
                  <ArrowRight size={16} />
                </span>
              </div>
            </a>
          </motion.div>

          {/* Formulário */}
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            onSubmit={handleSubmit}
            className="lg:col-span-3 rounded-2xl border border-stone-200 bg-white p-8"
          >
            <p className="text-sm font-semibold text-stone-700 mb-1">
              Prefere escrever?
            </p>
            <p className="text-xs text-stone-400 mb-6">
              Preencha o formulário e recebemos por email.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-stone-600 mb-1.5">Nome</label>
                <input type="text" id="name" name="name" required className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0A2473]/40 focus:ring-2 focus:ring-[#0A2473]/10 focus:bg-white transition-all" placeholder="Seu nome" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-stone-600 mb-1.5">Email</label>
                <input type="email" id="email" name="email" required className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0A2473]/40 focus:ring-2 focus:ring-[#0A2473]/10 focus:bg-white transition-all" placeholder="seu@email.com" />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="company" className="block text-sm font-medium text-stone-600 mb-1.5">Empresa</label>
              <input type="text" id="company" name="company" className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0A2473]/40 focus:ring-2 focus:ring-[#0A2473]/10 focus:bg-white transition-all" placeholder="Nome da sua empresa" />
            </div>
            <div className="mb-6">
              <label htmlFor="message" className="block text-sm font-medium text-stone-600 mb-1.5">Como podemos ajudar?</label>
              <textarea id="message" name="message" rows={4} required className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#0A2473]/40 focus:ring-2 focus:ring-[#0A2473]/10 focus:bg-white transition-all resize-none" placeholder="Descreva seu projeto ou desafio..." />
            </div>
            <button
              type="submit"
              disabled={status === "sending" || status === "sent"}
              className="group inline-flex items-center gap-2 rounded-xl bg-[#0A2473] px-6 py-3 font-semibold text-white transition-all hover:bg-[#0d2f8a] hover:shadow-lg hover:shadow-[#0A2473]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "sending" && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando...
                </>
              )}
              {status === "sent" && (
                <>
                  <CheckCircle2 size={16} />
                  Mensagem enviada!
                </>
              )}
              {status === "idle" && (
                <>
                  <Send size={16} className="transition-transform group-hover:translate-x-1" />
                  Enviar mensagem
                </>
              )}
              {status === "error" && (
                <>
                  <Send size={16} />
                  Tentar novamente
                </>
              )}
            </button>
            {status === "error" && (
              <p className="mt-3 text-sm text-red-500">
                Erro ao enviar. Tente pelo WhatsApp.
              </p>
            )}
            {status === "sent" && (
              <p className="mt-3 text-sm text-emerald-600">
                Recebemos sua mensagem! Respondemos em até 24h.
              </p>
            )}
          </motion.form>
        </div>
      </div>
    </section>
  );
}

function WhatsAppGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}
