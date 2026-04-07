"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LayoutElement {
  id: string;
  type: "name" | "title" | "message" | "hide" | "link" | "image";
  label: string;
  x: number;
  y: number;
  visible: boolean;
  fontSize?: number;
  color?: string;
  imageUrl?: string;
  imageSize?: number;
  boxWidth?: number;
  boxHeight?: number;
  href?: string;
  hrefTarget?: string;
  isHide?: boolean;
}

interface PopupTemplateData {
  name: string;
  title: string;
  message: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  enableConfetti: boolean;
  enableSound: boolean;
  dismissDuration: number;
  customJson?: {
    svgPattern?: string;
    mascotUrl?: string;
    mascotX?: number;
    mascotY?: number;
    mascotSize?: number;
    layoutElements?: LayoutElement[];
    patternUrlOverrides?: Record<string, string>;
    customPatterns?: { id: string; url: string; label: string }[];
    prizeValue?: string;
    popupFunction?: string;
    clickUrl?: string;
    clickUrlTarget?: string;
  };
}

export interface AchievementData {
  type: "level_up" | "achievement";
  title: string;
  message: string;
  badgeNumber?: number;
  badgeUrl?: string;
  planetEmoji?: string;
  template?: PopupTemplateData;
  vars?: {
    nome_usuario?: string;
    quantidade_stars?: string;
    nome_plano?: string;
    quantidade_space_points?: string;
    nova_conquista?: string;
    meu_ranking?: string;
  };
}

interface AchievementPopupProps {
  data: AchievementData | null;
  onDismiss: () => void;
}

const DEFAULT_SVG_PATTERNS: Record<string, string> = {
  padrao: "/popup-patterns/padrao.svg",
};

function interpolateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function resolvePatternUrl(customJson: PopupTemplateData["customJson"]): string | null {
  if (!customJson?.svgPattern) return null;
  const id = customJson.svgPattern;
  if (customJson.patternUrlOverrides?.[id]) return customJson.patternUrlOverrides[id];
  const custom = customJson.customPatterns?.find((p) => p.id === id);
  if (custom) return custom.url;
  return DEFAULT_SVG_PATTERNS[id] ?? null;
}

function Particle({ delay, color }: { delay: number; color: string }) {
  const style = {
    "--delay": `${delay}s`,
    "--color": color,
    left: `${Math.random() * 100}%`,
    animationDelay: `${delay}s`,
  } as React.CSSProperties;
  return (
    <div
      className="absolute top-0 w-1.5 h-1.5 rounded-full animate-[confetti-fall_1.8s_ease-in_forwards]"
      style={{ ...style, background: color }}
    />
  );
}

const CONFETTI_COLORS = [
  "#7a1fe7",
  "#a855f7",
  "#ec4899",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
];

export function AchievementPopup({ data, onDismiss }: AchievementPopupProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) { setVisible(false); setExiting(false); return; }
    setVisible(true);
    setExiting(false);

    const duration = data.template?.dismissDuration ?? 5000;

    if (data.template?.enableSound !== false) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.15 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.35);
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.4);
        });
      } catch { /* silently skip */ }
    }

    timerRef.current = setTimeout(() => handleDismiss(), duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => { setVisible(false); onDismiss(); }, 400);
  };

  if (!data || !visible) return null;

  const particles = Array.from({ length: 24 }, (_, i) => ({
    delay: i * 0.06,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  const tpl = data.template;
  const patternUrl = tpl ? resolvePatternUrl(tpl.customJson) : null;
  const layoutElements = tpl?.customJson?.layoutElements ?? [];
  const mascotUrl  = tpl?.customJson?.mascotUrl ?? null;
  const mascotX    = (tpl?.customJson?.mascotX    as number | undefined) ?? 15;
  const mascotY    = (tpl?.customJson?.mascotY    as number | undefined) ?? 80;
  const mascotSize = (tpl?.customJson?.mascotSize as number | undefined) ?? 28;
  const clickUrl       = tpl?.customJson?.clickUrl ?? null;
  const clickUrlTarget = tpl?.customJson?.clickUrlTarget ?? "_blank";
  const hasTemplate = !!tpl && (!!patternUrl || layoutElements.length > 0);

  const handlePopupClick = () => {
    if (clickUrl) {
      if (clickUrlTarget === "_self") {
        window.location.href = clickUrl;
      } else {
        window.open(clickUrl, "_blank", "noopener,noreferrer");
      }
      handleDismiss();
    } else {
      handleDismiss();
    }
  };

  const handleElementClick = (el: LayoutElement) => (e: React.MouseEvent) => {
    e.stopPropagation();
    // "hide" type element always closes popup
    if (el.type === "hide" || el.isHide) {
      handleDismiss();
      return;
    }
    // Elements with href navigate
    if (el.href) {
      if ((el.hrefTarget ?? "_blank") === "_self") {
        window.location.href = el.href;
      } else {
        window.open(el.href, "_blank", "noopener,noreferrer");
      }
      handleDismiss();
      return;
    }
    // "link" type without href just dismisses
    if (el.type === "link") {
      handleDismiss();
    }
  };

  const sysVars: Record<string, string> = {
    nome_usuario: data.vars?.nome_usuario ?? "",
    quantidade_stars: data.vars?.quantidade_stars ?? "",
    nome_plano: data.vars?.nome_plano ?? "",
    quantidade_space_points: data.vars?.quantidade_space_points ?? "",
    nova_conquista: data.vars?.nova_conquista ?? data.title,
    meu_ranking: data.vars?.meu_ranking ?? "",
  };

  const interp = (text: string) => interpolateVars(text, sysVars);

  // Map element values
  const elementValue = (el: LayoutElement): string => {
    if (el.type === "name") return interp(tpl?.name ?? "");
    if (el.type === "title") return interp(data.title || tpl?.title || "");
    if (el.type === "message") return interp(data.message || tpl?.message || "");
    if (el.type === "hide") return "Fechar";
    if (el.type === "link") return "Ver mais";
    return "";
  };

  const keyframes = `
    @keyframes confetti-fall {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(220px) rotate(720deg); opacity: 0; }
    }
    @keyframes popup-in {
      0%   { transform: scale(0.6) translateY(40px); opacity: 0; }
      70%  { transform: scale(1.05) translateY(-4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes popup-out {
      0%   { transform: scale(1) translateY(0); opacity: 1; }
      100% { transform: scale(0.85) translateY(20px); opacity: 0; }
    }
    @keyframes astro-float {
      0%, 100% { transform: translateY(0px) rotate(-3deg); }
      50%  { transform: translateY(-8px) rotate(3deg); }
    }
  `;

  const animStyle = exiting
    ? { animation: "popup-out 0.4s ease-in forwards" }
    : { animation: "popup-in 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" };

  const content = (
    <>
      <style>{keyframes}</style>
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-auto"
        style={{ zIndex: 10001 }}
        onClick={handlePopupClick}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {hasTemplate ? (
          /* ── Template rendering ── */
          <div
            className="relative z-10 pointer-events-auto cursor-pointer"
            style={{
              width: "min(768px, 92vw)",
              aspectRatio: "768/391",
              borderRadius: "1rem",
              overflow: "hidden",
              ...animStyle,
            }}
            onClick={(e) => { e.stopPropagation(); handlePopupClick(); }}
          >
            {/* SVG background */}
            {patternUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={patternUrl}
                alt="padrão"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Confetti */}
            {tpl?.enableConfetti !== false && (
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none">
                {particles.map((p, i) => <Particle key={i} delay={p.delay} color={p.color} />)}
              </div>
            )}

            {/* Mascot */}
            {mascotUrl && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${mascotX}%`,
                  top: `${mascotY}%`,
                  width: `${mascotSize}%`,
                  transform: "translate(-50%, -50%)",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mascotUrl} alt="mascote" className="w-full h-auto object-contain" />
              </div>
            )}

            {/* Layout elements */}
            {layoutElements.filter((el) => el.visible).map((el) => {
              const isClickable = el.isHide || !!el.href || el.type === "hide" || el.type === "link";
              if (el.type === "image" && el.imageUrl) {
                return (
                  <div
                    key={el.id}
                    className={`absolute select-none ${isClickable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.imageSize ?? 20}%`,
                      transform: "translate(-50%, -50%)",
                      filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
                    }}
                    onClick={isClickable ? handleElementClick(el) : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={el.imageUrl} alt={el.label} className="w-full h-auto object-contain" />
                  </div>
                );
              }
              // "hide" element renders as a circular ✕ button
              if (el.type === "hide") {
                const sz = `${(el.fontSize ?? 22) * 2.6}px`;
                return (
                  <button
                    key={el.id}
                    className="absolute pointer-events-auto select-none cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: sz,
                      height: sz,
                      borderRadius: "50%",
                      background: `${tpl?.accentColor ?? "#a855f7"}33`,
                      border: `2px solid ${el.color ?? tpl?.accentColor ?? "#a855f7"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: el.color ?? "#ffffff",
                      fontSize: `${el.fontSize ?? 22}px`,
                      boxSizing: "border-box",
                      flexShrink: 0,
                      padding: 0,
                    }}
                    onClick={handleElementClick(el)}
                  >
                    ✕
                  </button>
                );
              }
              // "link" element renders as a visual link button
              if (el.type === "link") {
                return (
                  <button
                    key={el.id}
                    className="absolute pointer-events-auto select-none cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: el.boxWidth ? `${el.boxWidth}%` : undefined,
                      fontSize: `${el.fontSize ?? 14}px`,
                      color: el.color ?? "#ffffff",
                      fontFamily: "var(--font-bungee), sans-serif",
                      background: "rgba(139,92,246,0.2)",
                      border: "1.5px solid rgba(139,92,246,0.6)",
                      borderRadius: "8px",
                      padding: "4px 14px",
                      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                      whiteSpace: "nowrap",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                    onClick={handleElementClick(el)}
                  >
                    {el.href ? "↗ Ver mais" : "Ver mais"}
                  </button>
                );
              }
              return (
                <div
                  key={el.id}
                  className={`absolute select-none ${isClickable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: el.boxWidth ? `${el.boxWidth}%` : undefined,
                    minHeight: el.boxHeight ? `${el.boxHeight}%` : undefined,
                    fontSize: `${el.fontSize ?? 14}px`,
                    color: el.color ?? tpl?.textColor ?? "#ffffff",
                    fontFamily: "var(--font-bungee), sans-serif",
                    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                    whiteSpace: el.boxWidth ? "normal" : "nowrap",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    padding: "2px 6px",
                  }}
                  onClick={isClickable ? handleElementClick(el) : undefined}
                >
                  {isClickable ? (
                    <span className="underline opacity-80 hover:opacity-100">
                      {elementValue(el)}
                    </span>
                  ) : (
                    elementValue(el)
                  )}
                </div>
              );
            })}

            {/* Prize value */}
            {tpl?.customJson?.prizeValue && (
              <div
                className="absolute bottom-[8%] left-1/2 pointer-events-none select-none"
                style={{
                  transform: "translateX(-50%)",
                  fontFamily: "var(--font-bungee), sans-serif",
                  fontSize: "clamp(14px, 3vw, 28px)",
                  color: tpl.accentColor ?? "#a855f7",
                  textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                }}
              >
                {tpl.customJson.prizeValue}
              </div>
            )}
          </div>
        ) : (
          /* ── Legacy rendering ── */
          <div
            className={cn(
              "relative z-10 w-80 flex flex-col items-center rounded-3xl border border-[#7a1fe7]/50 overflow-hidden pointer-events-auto",
              "bg-gradient-to-b from-[#1a0a3d] via-[#0d0720] to-[#050510]",
            )}
            style={{
              ...animStyle,
              boxShadow: "0 0 40px rgba(122,31,231,0.5), 0 0 80px rgba(122,31,231,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-48 overflow-hidden pointer-events-none">
              {particles.map((p, i) => <Particle key={i} delay={p.delay} color={p.color} />)}
            </div>
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: 1, height: 1,
                    left: `${((i * 1_234_567) % 9_973) / 9_973 * 100}%`,
                    top: `${((i * 7_654_321) % 9_973) / 9_973 * 100}%`,
                    opacity: 0.2 + (i % 5) * 0.08,
                  }}
                />
              ))}
            </div>
            <div className="relative z-10 mt-6 mb-1" style={{ animation: "astro-float 3s ease-in-out infinite" }}>
              <Image src="/icon-astro.svg" alt="Astro" width={80} height={80} className="drop-shadow-[0_0_16px_rgba(122,31,231,0.8)]" />
            </div>
            {data.badgeNumber && (
              <div className="relative z-10 -mt-4 mb-1">
                <div className="relative w-20 h-20">
                  <Image
                    src={data.badgeUrl ?? `/space-point/badges/${data.badgeNumber}.svg`}
                    alt="Badge" fill
                    className="object-contain drop-shadow-[0_0_20px_rgba(122,31,231,0.9)]"
                  />
                </div>
              </div>
            )}
            <div className="relative z-10 text-center px-6 pb-6 pt-2">
              <p className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest mb-1">
                {data.type === "level_up" ? "🎉 Novo nível!" : "🏅 Conquista!"}
              </p>
              <p className="text-xl font-extrabold text-white leading-tight mb-2">{data.title}</p>
              <p className="text-sm text-[#c4b5fd] leading-relaxed">{data.message}</p>
              <button
                onClick={handleDismiss}
                className="mt-4 w-full bg-gradient-to-r from-[#7a1fe7] to-[#a855f7] text-white text-sm font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Incrível! 🚀
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(content, document.body);
}
