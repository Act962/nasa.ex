import Image from "next/image";

export function NewFooter() {
  return (
    <footer className="border-t border-white/5 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Bloco da marca, logo NASA + tagline.
            Logo 600×200 PNG renderizada com h-12 (48px) e w-auto
            pra preservar a proporção 3:1. Variante dark/light por
            tema. */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo-dark.png"
            alt="N.A.S.A"
            width={600}
            height={200}
            className="hidden dark:block h-12 w-auto"
          />
          <Image
            src="/logo.png"
            alt="N.A.S.A"
            width={600}
            height={200}
            className="dark:hidden h-12 w-auto"
          />
          <span className="text-white/25 text-xs hidden md:inline">
            Powered pelo Método N.A.S.A.®
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-white/25">
          <button className="hover:text-white/50 transition-colors">
            Políticas de Privacidade
          </button>
          <button className="hover:text-white/50 transition-colors">
            Termos & Condições
          </button>
          <span>© 2026 N.A.S.A</span>
        </div>
      </div>
    </footer>
  );
}
