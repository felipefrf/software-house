export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white px-6 py-12">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-lg font-bold tracking-tight text-stone-900">
            Á<span className="text-[#0A2473]">p</span>ice
          </span>
          <p className="text-xs text-stone-400 mt-1">
            Software de elite. ITA &amp; MIT.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-stone-400">
          <a href="https://wa.me/5571982725910" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#075E54] transition-colors font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            WhatsApp
          </a>
        </div>
        <p className="text-xs text-stone-400">
          &copy; {new Date().getFullYear()} Ápice.
        </p>
      </div>
    </footer>
  );
}
