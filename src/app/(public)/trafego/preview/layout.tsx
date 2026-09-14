import { notFound } from "next/navigation";
import Link from "next/link";
import { TrafegoPreviewProvider } from "@/features/trafego/components/preview/preview-provider";

/**
 * Preview do painel do trafeGO — para trabalhar layout sem banco e sem login.
 *
 * Renderiza os componentes REAIS com o cache pré-populado, então o que aparece
 * é o componente de produção. Nenhuma ação grava nada.
 *
 * Bloqueado fora de desenvolvimento: em produção a rota simplesmente não existe.
 */
export default function TrafegoPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <TrafegoPreviewProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs backdrop-blur">
          <span className="font-semibold text-amber-600 dark:text-amber-300">
            PREVIEW
          </span>
          <span className="text-muted-foreground">
            dados fictícios · nada é salvo · só em desenvolvimento
          </span>
          <nav className="ml-auto flex items-center gap-3">
            <Link href="/trafego/preview/painel" className="hover:underline">
              Painel do cliente
            </Link>
            <Link href="/trafego/preview/admin" className="hover:underline">
              Painel da equipe
            </Link>
            <Link href="/trafego" className="text-muted-foreground hover:underline">
              Landing
            </Link>
          </nav>
        </div>

        {children}
      </div>
    </TrafegoPreviewProvider>
  );
}
