export function NewFooter() {
  return (
    <footer className="border-t border-white/5 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white text-sm font-black">
            N
          </div>
          <div>
            <p className="text-white/70 font-bold text-sm">nasa.ex</p>
            <p className="text-white/25 text-xs">
              Powered pelo Método N.A.S.A.®
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-white/25">
          <button className="hover:text-white/50 transition-colors">
            Políticas de Privacidade
          </button>
          <button className="hover:text-white/50 transition-colors">
            Termos & Condições
          </button>
          <span>© 2026 nasa.ex</span>
        </div>
      </div>
    </footer>
  );
}
