/**
 * Manifesto "porquê NASA", bloco curto entre Herói e Método.
 * Metáfora de estágios de foguete grudada na função real (troca entre
 * setores).
 *
 * Layout (desktop): texto à esquerda + simulação SVG animada à direita.
 * Layout (mobile): texto em cima, simulação embaixo.
 *
 * A simulação mostra um foguete subindo em loop com 3 estágios marcados,
 * chamas pulsando embaixo do estágio ativo, estrelas se movendo pra
 * reforçar a sensação de subida, e anéis de ignição que pulsam em cada
 * estágio em momentos diferentes — visualizando exatamente o que o
 * texto descreve: estágio empurra, se solta, próximo liga sozinho.
 */
export function ManifestoSection() {
  return (
    <section className="relative py-24 sm:py-32 px-4 overflow-hidden border-y border-white/5">
      {/* Glow de fundo sutil, laranja-foguete, baixa opacidade */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-orange-500/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
        {/* TEXTO */}
        <div className="text-center lg:text-left order-2 lg:order-1">
          <p className="text-xl sm:text-2xl md:text-3xl font-medium text-white/85 leading-snug tracking-tight">
            Todo foguete sobe por estágios. Um estágio empurra o foguete,{" "}
            <span className="text-white/95">se solta</span>, e o próximo{" "}
            <span className="text-white/95">liga sozinho</span> pra continuar
            a subida.{" "}
            <span className="text-orange-200/70">
              Se essa troca falha, a missão acaba ali.
            </span>{" "}
            Sua empresa funciona igual: cada setor entrega o trabalho pro
            próximo.
          </p>

          <p className="mt-8 text-lg sm:text-xl text-white/65 leading-relaxed">
            O NASA existe pra que{" "}
            <span className="text-nasa font-semibold">
              nenhuma dessas trocas falhe
            </span>,{" "}
            do primeiro contato até a entrega final.
          </p>
        </div>

        {/* SIMULAÇÃO SVG — lançamento por estágios */}
        <RocketStageSimulation />
      </div>
    </section>
  );
}

/**
 * Simulação visual: foguete em 3 estágios subindo em loop.
 * - Fundo: estrelas se movendo pra baixo (efeito parallax de subida)
 * - Foguete: vertical, com 3 estágios distintos, cápsula no topo
 * - Chamas: gradiente laranja-amarelo, scaleY animado
 * - Anéis de ignição: SVG circles que pulsam em cada estágio em
 *   tempos diferentes pra representar a sequência de separação
 *
 * Tudo via CSS keyframes inline (sem JS, sem deps externas).
 */
function RocketStageSimulation() {
  return (
    <div
      className="relative w-[260px] h-[440px] sm:w-[300px] sm:h-[500px] shrink-0 order-1 lg:order-2 mx-auto"
      aria-hidden="true"
    >
      {/* Estilos da animação, isolados nesta seção */}
      <style>{`
        @keyframes rocketBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes starsScroll {
          from { background-position: 0 0; }
          to   { background-position: 0 200px; }
        }
        @keyframes flameFlicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.95; }
          50%      { transform: scaleY(1.25) scaleX(0.85); opacity: 1; }
        }
        @keyframes flameFlickerSmall {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.8; }
          50%      { transform: scaleY(1.5) scaleX(0.7); opacity: 1; }
        }
        @keyframes ignitionRing {
          0%       { transform: scale(0.4); opacity: 0; }
          15%      { transform: scale(0.6); opacity: 1; }
          70%      { transform: scale(2); opacity: 0; }
          100%     { transform: scale(2); opacity: 0; }
        }
        @keyframes stageLabel {
          0%, 5%    { opacity: 0; transform: translateX(-6px); }
          10%, 25%  { opacity: 1; transform: translateX(0); }
          30%, 100% { opacity: 0; transform: translateX(-6px); }
        }
        /* Glow do trail abaixo do foguete */
        @keyframes trailFade {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* Frame do "céu" — gradiente noturno + estrelas em scroll */}
      <div className="absolute inset-0 rounded-3xl border border-white/10 overflow-hidden bg-gradient-to-b from-slate-950 via-violet-950/40 to-zinc-950 shadow-[0_0_80px_rgba(124,58,237,0.2)]">
        {/* Camada de estrelas (background-position animado) */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 10% 12%, white 1px, transparent 1px), radial-gradient(1.5px 1.5px at 25% 28%, white 1px, transparent 1px), radial-gradient(1px 1px at 50% 45%, white 1px, transparent 1px), radial-gradient(1px 1px at 70% 18%, white 1px, transparent 1px), radial-gradient(1.5px 1.5px at 85% 60%, white 1px, transparent 1px), radial-gradient(1px 1px at 35% 75%, white 1px, transparent 1px), radial-gradient(1px 1px at 60% 88%, white 1px, transparent 1px), radial-gradient(1px 1px at 15% 92%, white 1px, transparent 1px)",
            backgroundSize: "100% 200px",
            animation: "starsScroll 4s linear infinite",
          }}
        />

        {/* Gradiente de horizonte azulado pra baixo */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-blue-950/60 to-transparent" />

        {/* Labels dos 3 estágios à esquerda — aparecem em sequência
            em loop, cada uma em um momento diferente */}
        <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-around py-8 z-20 text-[10px] font-mono">
          {[
            {
              label: "ESTÁGIO 01",
              desc: "Ignição",
              delay: "0s",
              color: "text-orange-300",
            },
            {
              label: "ESTÁGIO 02",
              desc: "Separação",
              delay: "1.5s",
              color: "text-amber-300",
            },
            {
              label: "ESTÁGIO 03",
              desc: "Em órbita",
              delay: "3s",
              color: "text-violet-300",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`flex items-center gap-1.5 ${s.color}`}
              style={{
                animation: `stageLabel 4.5s ease-in-out ${s.delay} infinite`,
                opacity: 0,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <div>
                <div className="font-bold tracking-widest">{s.label}</div>
                <div className="opacity-60 text-[9px]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOGUETE — bob sutil pra simular vibração */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{
            top: "50%",
            marginTop: "-150px",
            animation: "rocketBob 2.4s ease-in-out infinite",
          }}
        >
          <svg
            width="100"
            height="300"
            viewBox="0 0 100 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Gradiente da fuselagem */}
              <linearGradient
                id="bodyGrad"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="50%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              {/* Gradiente da chama principal */}
              <radialGradient id="flameGrad" cx="0.5" cy="0" r="0.7">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#fb923c" />
                <stop offset="80%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              {/* Glow violeta da cápsula */}
              <radialGradient id="capsuleGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ===== ESTÁGIO 3 — cápsula no topo ===== */}
            {/* Cone da cápsula */}
            <path
              d="M 50 10 L 35 55 L 65 55 Z"
              fill="url(#bodyGrad)"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Glow violeta atrás da cápsula (órbita) */}
            <circle
              cx="50"
              cy="35"
              r="22"
              fill="url(#capsuleGlow)"
              style={{
                animation: "trailFade 2s ease-in-out infinite",
              }}
            />
            {/* Janela */}
            <circle cx="50" cy="38" r="4" fill="#1e293b" />
            <circle cx="50" cy="37" r="2.5" fill="#7dd3fc" opacity="0.8" />

            {/* Anel de ignição do estágio 3 — pulsa devagar */}
            <circle
              cx="50"
              cy="55"
              r="18"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="1.5"
              style={{
                transformOrigin: "50px 55px",
                animation: "ignitionRing 4.5s ease-out 3s infinite",
              }}
            />

            {/* ===== ESTÁGIO 2 — meio ===== */}
            {/* Divisão entre cápsula e estágio 2 */}
            <rect x="33" y="55" width="34" height="3" fill="#334155" />
            {/* Corpo estágio 2 */}
            <rect
              x="33"
              y="58"
              width="34"
              height="60"
              fill="url(#bodyGrad)"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Listras de detalhe */}
            <rect x="33" y="70" width="34" height="2" fill="#cbd5e1" />
            <rect x="33" y="100" width="34" height="2" fill="#cbd5e1" />
            {/* Logo violeta */}
            <rect
              x="42"
              y="80"
              width="16"
              height="10"
              fill="#7C3AED"
              rx="1"
            />
            <text
              x="50"
              y="88"
              textAnchor="middle"
              fontSize="6"
              fontWeight="900"
              fill="white"
              fontFamily="system-ui"
            >
              N.A.S.A
            </text>

            {/* Anel de ignição do estágio 2 */}
            <circle
              cx="50"
              cy="118"
              r="20"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.5"
              style={{
                transformOrigin: "50px 118px",
                animation: "ignitionRing 4.5s ease-out 1.5s infinite",
              }}
            />

            {/* ===== ESTÁGIO 1 — base ===== */}
            {/* Divisão entre estágios */}
            <rect x="33" y="118" width="34" height="3" fill="#334155" />
            {/* Corpo estágio 1 */}
            <rect
              x="33"
              y="121"
              width="34"
              height="80"
              fill="url(#bodyGrad)"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Listras */}
            <rect x="33" y="135" width="34" height="2" fill="#cbd5e1" />
            <rect x="33" y="180" width="34" height="2" fill="#cbd5e1" />
            {/* Número "01" no flank */}
            <text
              x="50"
              y="165"
              textAnchor="middle"
              fontSize="10"
              fontWeight="900"
              fill="#475569"
              fontFamily="system-ui"
            >
              01
            </text>

            {/* Anel de ignição do estágio 1 */}
            <circle
              cx="50"
              cy="201"
              r="22"
              fill="none"
              stroke="#f97316"
              strokeWidth="1.5"
              style={{
                transformOrigin: "50px 201px",
                animation: "ignitionRing 4.5s ease-out 0s infinite",
              }}
            />

            {/* Aletas (fins) */}
            <path
              d="M 33 201 L 20 220 L 33 215 Z"
              fill="#94a3b8"
              stroke="#475569"
              strokeWidth="0.5"
            />
            <path
              d="M 67 201 L 80 220 L 67 215 Z"
              fill="#94a3b8"
              stroke="#475569"
              strokeWidth="0.5"
            />

            {/* Tubeira (engine nozzle) */}
            <path
              d="M 40 201 L 36 218 L 64 218 L 60 201 Z"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="1"
            />

            {/* CHAMAS — duas camadas (interior + exterior) */}
            <g
              style={{
                transformOrigin: "50px 218px",
                animation: "flameFlicker 0.18s ease-in-out infinite",
              }}
            >
              {/* Chama exterior — maior, vermelho-laranja */}
              <ellipse
                cx="50"
                cy="245"
                rx="18"
                ry="30"
                fill="url(#flameGrad)"
                opacity="0.85"
              />
            </g>
            <g
              style={{
                transformOrigin: "50px 220px",
                animation: "flameFlickerSmall 0.12s ease-in-out infinite",
              }}
            >
              {/* Chama interior — menor, amarelo-branco */}
              <ellipse
                cx="50"
                cy="235"
                rx="10"
                ry="22"
                fill="#fef9c3"
                opacity="0.9"
              />
              <ellipse
                cx="50"
                cy="230"
                rx="5"
                ry="15"
                fill="#ffffff"
                opacity="0.7"
              />
            </g>

            {/* Faíscas — pequenos pontos saindo da chama */}
            {[
              { cx: 35, cy: 260, r: 1 },
              { cx: 65, cy: 268, r: 1.2 },
              { cx: 42, cy: 280, r: 0.8 },
              { cx: 58, cy: 285, r: 1 },
              { cx: 50, cy: 290, r: 0.6 },
            ].map((s, i) => (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill="#fde047"
                style={{
                  animation: `trailFade ${1 + i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </svg>
        </div>

        {/* Frame bottom — base do lançamento, gradiente preto */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black via-black/80 to-transparent" />

        {/* Glow de ignição na base */}
        <div
          className="absolute inset-x-8 bottom-0 h-8 bg-gradient-to-t from-orange-500/60 to-transparent blur-md"
          style={{ animation: "trailFade 0.5s ease-in-out infinite" }}
        />
      </div>

      {/* Caption pequeno embaixo do frame */}
      <p className="absolute -bottom-7 inset-x-0 text-center text-[10px] uppercase tracking-[0.25em] text-white/30 font-mono">
        Simulação de lançamento
      </p>
    </div>
  );
}
