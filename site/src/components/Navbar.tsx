"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Serviços", href: "#services" },
  { label: "Portfólio", href: "#portfolio" },
  { label: "Sobre", href: "#about" },
  { label: "Contato", href: "#contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.85]);
  const shadowOpacity = useTransform(scrollY, [0, 80], [0, 0.06]);
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 1]);

  return (
    <motion.header
      style={{
        backgroundColor: useTransform(
          bgOpacity,
          (v) => `rgba(250, 249, 247, ${v})`
        ),
        boxShadow: useTransform(
          shadowOpacity,
          (v) => `0 1px 3px rgba(0,0,0,${v})`
        ),
        borderColor: useTransform(
          borderOpacity,
          (v) => `rgba(232, 228, 223, ${v})`
        ),
        backdropFilter: useTransform(
          scrollY,
          [0, 80],
          ["blur(0px)", "blur(12px)"]
        ),
      }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-transparent"
    >
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#1a1a1a]">
            Á<span className="text-[#0A2473]">p</span>ice
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative px-4 py-2 text-sm text-stone-500 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="ml-4 inline-flex items-center gap-2 rounded-lg bg-[#0A2473] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#0d2f8a] hover:shadow-lg hover:shadow-[#0A2473]/15"
          >
            Começar projeto
          </a>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-stone-500 hover:text-stone-900"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-stone-200 bg-[#faf9f7]/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 text-stone-500 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-100"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A2473] px-4 py-2.5 text-sm font-medium text-white"
          >
            Começar projeto
          </a>
        </motion.div>
      )}
    </motion.header>
  );
}
