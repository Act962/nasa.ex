import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function PatternsFeatureSection({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  void isLoggedIn;
  return (
    <section className="py-16 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <Link href="/patterns">
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-600/10 via-violet-600/5 to-transparent p-8 hover:border-violet-500/50 transition-all cursor-pointer group">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-1 mb-3">
                  <Sparkles className="size-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold">
                    Novidade
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
                  Padrões NASA
                </h3>
                <p className="text-white/50 text-sm sm:text-base max-w-xl">
                  Explore templates pré-configurados e exemplos prontos para
                  usar. Duplique padrões de Tracking, Workspace, Propostas e
                  Contratos para sua empresa.
                </p>
              </div>
              <div className="hidden sm:flex items-center justify-center">
                <div className="text-5xl">✨</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-violet-400 group-hover:text-violet-300 transition-colors">
              <span className="text-sm font-semibold">
                Ver padrões disponíveis
              </span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
