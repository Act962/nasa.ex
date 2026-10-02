"use client";

import { useEffect, useRef } from "react";

/** Céu da Início: estrelas piscando em duas camadas, asteroides cruzando e paralaxe pelo giroscópio ou mouse. */

interface SceneStar {
  leftPercent: number;
  topPercent: number;
  sizePx: number;
  opacity: number;
  twinkleSeconds: number;
  delaySeconds: number;
}

interface SceneAsteroid {
  topPercent: number;
  sizePx: number;
  durationSeconds: number;
  delaySeconds: number;
  angleDeg: number;
}

// Gerador determinístico: servidor e cliente desenham o mesmo céu (sem divergência de hidratação).
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildStars(count: number, seed: number, maxSizePx: number): SceneStar[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    leftPercent: random() * 100,
    topPercent: random() * 100,
    sizePx: 0.6 + random() * maxSizePx,
    opacity: 0.35 + random() * 0.6,
    twinkleSeconds: 2.5 + random() * 4,
    delaySeconds: random() * 6,
  }));
}

const FAR_STARS = buildStars(90, 7, 1.2);
const NEAR_STARS = buildStars(28, 21, 2.2);
// O voo ocupa ~6% do ciclo (globals.css): cruza a tela em ~1s, quase imperceptível.
const ASTEROIDS: SceneAsteroid[] = [
  { topPercent: 12, sizePx: 3, durationSeconds: 14, delaySeconds: 2, angleDeg: 18 },
  { topPercent: 38, sizePx: 2, durationSeconds: 19, delaySeconds: 7, angleDeg: 12 },
  { topPercent: 64, sizePx: 3, durationSeconds: 23, delaySeconds: 13, angleDeg: 22 },
];

const FAR_PARALLAX_PX = 10;
const NEAR_PARALLAX_PX = 26;
const PARALLAX_EASING = 0.08;
const TILT_RANGE_DEG = 30;

type IosOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function SpaceScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let animationFrame = 0;

    const animate = () => {
      current.x += (target.x - current.x) * PARALLAX_EASING;
      current.y += (target.y - current.y) * PARALLAX_EASING;
      scene.style.setProperty("--parallax-x", current.x.toFixed(3));
      scene.style.setProperty("--parallax-y", current.y.toFixed(3));
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const handlePointerMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const handleOrientation = (event: DeviceOrientationEvent) => {
      target.x = clamp((event.gamma ?? 0) / TILT_RANGE_DEG);
      target.y = clamp(((event.beta ?? 0) - 45) / TILT_RANGE_DEG);
    };

    // iOS só libera o giroscópio depois de um toque e com permissão.
    const OrientationEvent = window.DeviceOrientationEvent as IosOrientationEvent | undefined;
    const requestOrientationOnce = () => {
      OrientationEvent?.requestPermission?.()
        .then((permission) => {
          if (permission === "granted") window.addEventListener("deviceorientation", handleOrientation);
        })
        .catch(() => undefined);
    };

    window.addEventListener("pointermove", handlePointerMove);
    if (OrientationEvent?.requestPermission) {
      window.addEventListener("touchend", requestOrientationOnce, { once: true });
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("touchend", requestOrientationOnce);
    };
  }, []);

  return (
    <div ref={sceneRef} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute top-1/4 left-1/2 h-[400px] w-[640px] -translate-x-1/2 rounded-full bg-info/10 blur-[130px]" />
      <div className="absolute bottom-1/3 left-1/4 h-[320px] w-[320px] rounded-full bg-info/7 blur-[100px]" />

      <div
        className="absolute -inset-8"
        style={{
          transform: `translate3d(calc(var(--parallax-x, 0) * ${FAR_PARALLAX_PX}px), calc(var(--parallax-y, 0) * ${FAR_PARALLAX_PX}px), 0)`,
        }}
      >
        {FAR_STARS.map((star, starIndex) => (
          <span
            key={starIndex}
            className="space-star absolute rounded-full bg-white"
            style={{
              left: `${star.leftPercent}%`,
              top: `${star.topPercent}%`,
              width: star.sizePx,
              height: star.sizePx,
              ["--star-opacity" as string]: star.opacity,
              animationDuration: `${star.twinkleSeconds}s`,
              animationDelay: `${star.delaySeconds}s`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute -inset-12"
        style={{
          transform: `translate3d(calc(var(--parallax-x, 0) * ${NEAR_PARALLAX_PX}px), calc(var(--parallax-y, 0) * ${NEAR_PARALLAX_PX}px), 0)`,
        }}
      >
        {NEAR_STARS.map((star, starIndex) => (
          <span
            key={starIndex}
            className="space-star absolute rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            style={{
              left: `${star.leftPercent}%`,
              top: `${star.topPercent}%`,
              width: star.sizePx,
              height: star.sizePx,
              ["--star-opacity" as string]: star.opacity,
              animationDuration: `${star.twinkleSeconds}s`,
              animationDelay: `${star.delaySeconds}s`,
            }}
          />
        ))}
      </div>

      {ASTEROIDS.map((asteroid, asteroidIndex) => (
        <span
          key={asteroidIndex}
          className="space-asteroid absolute left-0"
          style={{
            top: `${asteroid.topPercent}%`,
            ["--asteroid-angle" as string]: `${asteroid.angleDeg}deg`,
            animationDuration: `${asteroid.durationSeconds}s`,
            animationDelay: `${asteroid.delaySeconds}s`,
          }}
        >
          <span
            className="block rounded-[40%_60%_55%_45%] bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            style={{ width: asteroid.sizePx, height: asteroid.sizePx * 0.8 }}
          />
        </span>
      ))}
    </div>
  );
}
