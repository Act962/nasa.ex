"use client";

const ICONS = [
  { slug: "facebook", top: "8%", left: "6%", size: 104, delay: "0s", duration: "19s" },
  { slug: "instagram", top: "22%", left: "84%", size: 124, delay: "-4s", duration: "23s" },
  { slug: "google", top: "56%", left: "3%", size: 96, delay: "-9s", duration: "21s" },
  { slug: "whatsapp", top: "70%", left: "88%", size: 112, delay: "-2s", duration: "25s" },
  { slug: "instagram", top: "88%", left: "16%", size: 84, delay: "-13s", duration: "27s" },
  { slug: "facebook", top: "44%", left: "92%", size: 80, delay: "-7s", duration: "20s" },
];

/**
 * Marca d'água de fundo: ícones das plataformas flutuando devagar.
 *
 * Fica atrás de tudo (`-z-10`), é `aria-hidden` e some no mobile — em tela
 * pequena o conteúdo já ocupa a largura toda e os ícones só competiriam com a
 * leitura. `prefers-reduced-motion` congela o movimento.
 */
export function SocialBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block"
    >
      {ICONS.map((icon, index) => (
        <span
          key={`${icon.slug}-${index}`}
          className="trafego-float absolute"
          style={{
            top: icon.top,
            left: icon.left,
            animationDelay: icon.delay,
            animationDuration: icon.duration,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/redes/${icon.slug}.png`}
            alt=""
            width={icon.size}
            height={icon.size}
            loading="lazy"
            className="opacity-[0.055] blur-[0.4px]"
            style={{ width: icon.size, height: icon.size }}
          />
        </span>
      ))}

      <style jsx>{`
        .trafego-float {
          animation-name: trafego-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        @keyframes trafego-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          33% {
            transform: translate3d(14px, -22px, 0) rotate(4deg);
          }
          66% {
            transform: translate3d(-10px, 16px, 0) rotate(-3deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .trafego-float {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
