"use client";

const techs = [
  "Next.js",
  "React",
  "TypeScript",
  "Python",
  "PostgreSQL",
  "Node.js",
  "OpenAI",
  "LangChain",
  "WhatsApp API",
  "Pandas",
  "PyTorch",
  "FastAPI",
  "Google Sheets",
  "Web Scraping",
  "OCR",
  "NLP",
  "Visão Computacional",
  "ETL",
];

export function TechMarquee() {
  const items = [...techs, ...techs];
  return (
    <section
      aria-hidden
      className="border-y border-stone-200/70 bg-white/60 py-6 overflow-hidden"
    >
      <div className="flex gap-10 marquee-track whitespace-nowrap">
        {items.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-3 text-sm font-medium text-stone-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#0A2473] to-[#A31F34]" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
