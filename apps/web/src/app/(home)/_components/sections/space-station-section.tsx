import { PlayCircle, Sparkles } from "lucide-react";

/**
 * Space Station, seção predominantemente visual (briefing § 3.8).
 * Sem CTA, sem features list. Uma frase, um vídeo/GIF curto do
 * Space Station em movimento, e silêncio.
 *
 * [TODO]: substituir o placeholder pelo vídeo real do Space Station
 * quando o Wey gravar. O briefing pede mídia curta, pode ser MP4,
 * GIF ou Lottie. Por hora deixo um poster + indicador de "carregando".
 */
export function SpaceStationSection() {
  return (
    <section className="relative py-28 px-4 overflow-hidden border-t border-white/5">
      {/* Background glow azul-petróleo, evocando profundidade de espaço */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] rounded-full bg-cyan-500/[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-cyan-500/12 border border-cyan-500/25 rounded-full px-5 py-2">
            <Sparkles className="size-3.5 text-cyan-300" />
            <span className="text-cyan-200 text-sm font-medium">
              Space Station
            </span>
          </div>
        </div>

        {/* Título + uma linha. Nada além disso. */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white text-center mb-5 leading-[1.05]">
          Sua empresa inteira,{" "}
          <span className="text-nasa">à vista.</span>
        </h2>
        <p className="text-white/55 text-lg sm:text-xl text-center max-w-3xl mx-auto mb-14 leading-relaxed">
          Caminhe até qualquer setor e veja quem está em atendimento, quem está
          livre e onde o trabalho está acontecendo agora. Sua operação deixou de
          estar escondida em sete abas.
        </p>

        {/* Placeholder de vídeo, substituir por <video>/<lottie>
            quando estiver pronto. Aspect ratio 16:9, bordas escuras
            com glow sutil pra integrar ao tema. */}
        <div className="relative max-w-5xl mx-auto">
          <div className="relative aspect-video rounded-3xl border border-white/10 overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 nasa-glass shadow-[0_0_120px_rgba(34,211,238,0.15)]">
            {/* Faixa de gradiente superior, efeito "tela de monitor" */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            {/* Estrelas decorativas, bem sutis */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-50"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 25% 30%, white 1px, transparent 1px), radial-gradient(1px 1px at 70% 45%, white 1px, transparent 1px), radial-gradient(1px 1px at 40% 70%, white 1px, transparent 1px), radial-gradient(1px 1px at 85% 80%, white 1px, transparent 1px), radial-gradient(1px 1px at 15% 85%, white 1px, transparent 1px)",
              }}
            />

            {/* Botão de play central, visual de poster */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-2xl nasa-glow" />
                <div className="relative w-24 h-24 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center backdrop-blur-sm">
                  <PlayCircle
                    className="size-14 text-cyan-200"
                    strokeWidth={1.2}
                  />
                </div>
              </div>
              <p className="text-white/40 text-xs font-mono uppercase tracking-[0.2em]">
                [TODO: vídeo do Space Station]
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
