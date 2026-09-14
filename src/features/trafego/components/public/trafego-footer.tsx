import Link from "next/link";

const ORBITA_URL = "https://orbitahub.com.br";

export function TrafegoFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 pt-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link
            href="/trafego/termos"
            className="text-xs text-white/50 transition hover:text-white"
          >
            Termos de serviço
          </Link>
          <Link
            href="/trafego/privacidade"
            className="text-xs text-white/50 transition hover:text-white"
          >
            Política de privacidade
          </Link>
        </nav>

        <p className="text-xs text-white/35">
          Desenvolvido por{" "}
          <a
            href={ORBITA_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-white/60 underline-offset-4 transition hover:text-white hover:underline"
          >
            Órbita
          </a>
        </p>
      </div>
    </footer>
  );
}
