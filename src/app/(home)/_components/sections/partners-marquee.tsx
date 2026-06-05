import Image from "next/image";

/**
 * Carrossel infinito de logos de parceiros NASA. Slide automático
 * (CSS `nasa-marquee`), mesma animação usada em IntegrationsMarquee.
 *
 * Proporção: todas as logos são renderizadas em uma "caixa" de altura
 * fixa (`h-12 sm:h-14`) com `object-contain`, assim cada logo mantém
 * sua proporção natural mas o tamanho visual percebido fica
 * uniforme. PNGs com fundo transparente ficam bem em tema escuro;
 * se algum vier com fundo branco, o tratamento `mix-blend-luminosity`
 * + opacidade pode ajudar, comentário inline mostra como ativar
 * caso precise.
 *
 * Para trocar/adicionar/remover marcas:
 *   1. coloque arquivo em /public/partners/partner-N.png
 *   2. adicione entrada em PARTNERS abaixo
 */

const PARTNERS = [
  { src: "/partners/partner-1.png", alt: "Parceiro NASA 1" },
  { src: "/partners/partner-2.png", alt: "Parceiro NASA 2" },
  { src: "/partners/partner-3.png", alt: "Parceiro NASA 3" },
  { src: "/partners/partner-4.png", alt: "Parceiro NASA 4" },
  { src: "/partners/partner-5.png", alt: "Parceiro NASA 5" },
  { src: "/partners/partner-6.png", alt: "Parceiro NASA 6" },
  { src: "/partners/partner-7.png", alt: "Parceiro NASA 7" },
  { src: "/partners/partner-8.png", alt: "Parceiro NASA 8" },
];

export function PartnersMarquee() {
  // Duplicamos a lista pra animação CSS conseguir loop contínuo
  // (mesmo truque do nasa-marquee em IntegrationsMarquee).
  const loop = [...PARTNERS, ...PARTNERS];

  return (
    <section className="py-24 sm:py-28 px-4 border-y border-white/5 overflow-hidden">
      <p className="text-center text-white/25 text-xs font-medium uppercase tracking-widest mb-12">
        Empresas que confiam no N.A.S.A
      </p>

      <div className="relative">
        {/* Trilha do marquee, gap aumentado proporcionalmente ao
            tamanho das logos pra manter respiro entre elas.
            `nasa-marquee-fast` = 25s/ciclo (mais rápido que o de
            integrações, que segue em 35s). */}
        <div className="flex nasa-marquee-fast items-center gap-20 sm:gap-28 whitespace-nowrap">
          {loop.map((p, i) => (
            <div
              key={i}
              /* Tamanho 5x do original (h-12/h-14 → h-60/h-72).
                 Proporção preservada via w-auto + object-contain. */
              className="shrink-0 flex items-center justify-center h-60 sm:h-72 w-auto"
            >
              <Image
                src={p.src}
                alt={p.alt}
                /* width/height aproximados pra layout shift mínimo —
                   o object-contain garante proporção real da imagem. */
                width={1000}
                height={288}
                className="h-full w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
                /* Se algum PNG vier com fundo branco e ficar feio no
                   tema escuro, descomente a linha abaixo:
                   style={{ filter: "brightness(0) invert(1)" }} */
                unoptimized
                priority={i < PARTNERS.length}
              />
            </div>
          ))}
        </div>

        {/* Fade nas laterais, esconde o "loop point". Aumentado pra
            esconder logos grandes mais suavemente. */}
        <div className="absolute left-0 top-0 bottom-0 w-48 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
}
