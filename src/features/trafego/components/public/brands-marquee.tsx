"use client";

const BRANDS = [
  { slug: "coca-cola", name: "Coca-Cola" },
  { slug: "jbs", name: "JBS" },
  { slug: "bombril", name: "Bombril" },
  { slug: "sebrae", name: "Sebrae" },
  { slug: "riclan", name: "Riclan" },
  { slug: "popkins", name: "Popkins" },
  { slug: "r-carvalho", name: "R Carvalho" },
  { slug: "kobber", name: "Kobber" },
  { slug: "zanlorenzi", name: "Zanlorenzi" },
  { slug: "7-cidades", name: "Portal 7 Cidades" },
  { slug: "jmf", name: "JMF" },
  { slug: "kids-zone", name: "Kids Zone" },
];

/**
 * Faixa de marcas em rolagem contínua. A lista é renderizada duas vezes e a
 * animação desloca exatamente 50% — assim o ponto de emenda cai onde a segunda
 * cópia começa e o loop fica imperceptível.
 *
 * `prefers-reduced-motion` congela a animação: a faixa vira estática.
 */
export function BrandsMarquee() {
  return (
    <section className="mt-7" aria-labelledby="marcas-titulo">
      <h2
        id="marcas-titulo"
        className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/35"
      >
        Marcas que confiam no nosso trabalho
      </h2>

      <div className="relative mt-3 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-zinc-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-zinc-950 to-transparent" />

        <ul className="trafego-marquee flex w-max items-center gap-8 sm:gap-10">
          {[...BRANDS, ...BRANDS].map((brand, index) => (
            <li
              key={`${brand.slug}-${index}`}
              className="shrink-0"
              aria-hidden={index >= BRANDS.length}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/marcas/${brand.slug}.png`}
                alt={index < BRANDS.length ? brand.name : ""}
                loading="eager"
                decoding="async"
                className="h-5 w-auto max-w-[110px] object-contain opacity-45 transition-opacity duration-300 hover:opacity-90 sm:h-6 sm:max-w-[140px] md:h-7 md:max-w-[165px]"
              />
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        .trafego-marquee {
          --marquee-gap: 1rem;
          animation: trafego-scroll 64s linear infinite;
        }
        @media (min-width: 640px) {
          .trafego-marquee {
            --marquee-gap: 1.5rem;
          }
        }
        .trafego-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes trafego-scroll {
          from {
            transform: translateX(0);
          }
          to {
            /* metade da faixa = uma cópia completa da lista, com o gap final */
            transform: translateX(calc(-50% - var(--marquee-gap, 1.5rem)));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .trafego-marquee {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
