/**
 * Blocos interativos do NASA Pages — Marquee, Tabs, Accordion, Counter.
 *
 * Cada componente é stateful (usa hooks) e renderiza UI dinâmica.
 * Compartilham as helpers de cor + tokens do `sections/types.ts`.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "../sections/types";

// ────────────────────────────────────────────────────────────────
// MARQUEE — carrossel infinito horizontal (texto ou imagens)
// ────────────────────────────────────────────────────────────────
export function MarqueeBlock({ element, tokens }: SectionRendererProps) {
  const items = (element.items as Array<{ id: string; label?: string; imageUrl?: string }> | undefined) ?? [
    { id: "1", label: "Item 1" },
    { id: "2", label: "Item 2" },
    { id: "3", label: "Item 3" },
    { id: "4", label: "Item 4" },
    { id: "5", label: "Item 5" },
  ];
  const speed = (element.speed as number) ?? 35;
  const gap = (element.gap as number) ?? 48;
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);

  // Duplica pra loop contínuo
  const loop = [...items, ...items];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        color: fg,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div
        className="nasa-pages-anim-marquee"
        style={{
          display: "flex",
          alignItems: "center",
          gap,
          whiteSpace: "nowrap",
          animationDuration: `${speed}s`,
        }}
      >
        {loop.map((item, i) => (
          <div key={i} style={{ flexShrink: 0, padding: "0 8px" }}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.label ?? ""}
                style={{
                  height: 40,
                  width: "auto",
                  objectFit: "contain",
                  opacity: 0.7,
                }}
              />
            ) : (
              <span style={{ fontSize: 14, opacity: 0.7 }}>{item.label}</span>
            )}
          </div>
        ))}
      </div>

      {/* Fades laterais */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: `linear-gradient(to right, ${bg}, transparent)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          background: `linear-gradient(to left, ${bg}, transparent)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TABS — abas trocáveis com conteúdo
// ────────────────────────────────────────────────────────────────
export function TabsBlock({ element, tokens }: SectionRendererProps) {
  const tabs = (element.tabs as Array<{ id: string; label: string; content: string }> | undefined) ?? [
    { id: "1", label: "Aba 1", content: "Conteúdo da primeira aba." },
    { id: "2", label: "Aba 2", content: "Conteúdo da segunda aba." },
    { id: "3", label: "Aba 3", content: "Conteúdo da terceira aba." },
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 24,
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Tab buttons */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `1px solid ${fg}15`,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${
                active === t.id ? primary : "transparent"
              }`,
              color: active === t.id ? primary : muted,
              fontWeight: active === t.id ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 200ms",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active content */}
      {activeTab && (
        <div
          style={{
            padding: 16,
            fontSize: 14,
            color: muted,
            lineHeight: 1.6,
          }}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ACCORDION — itens colapsáveis
// ────────────────────────────────────────────────────────────────
export function AccordionBlock({ element, tokens }: SectionRendererProps) {
  const items = (element.items as Array<{ id: string; title: string; content: string }> | undefined) ?? [
    { id: "1", title: "Item 1", content: "Detalhes do item 1." },
    { id: "2", title: "Item 2", content: "Detalhes do item 2." },
    { id: "3", title: "Item 3", content: "Detalhes do item 3." },
  ];
  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((item) => (
        <details
          key={item.id}
          style={{
            padding: 12,
            borderRadius: 10,
            background: `${fg}05`,
            border: `1px solid ${fg}15`,
          }}
        >
          <summary
            style={{
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              listStyle: "none",
            }}
          >
            {item.title}
            <span style={{ color: primary, fontSize: 16 }}>+</span>
          </summary>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: muted,
              lineHeight: 1.5,
              margin: 0,
              paddingTop: 8,
            }}
          >
            {item.content}
          </p>
        </details>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// COUNTER — número animado contando de 0 ao valor alvo
// ────────────────────────────────────────────────────────────────
export function CounterBlock({ element, tokens }: SectionRendererProps) {
  const target = (element.target as number) ?? 1000;
  const prefix = (element.prefix as string) ?? "";
  const suffix = (element.suffix as string) ?? "";
  const label = (element.label as string) ?? "Total de itens";
  const duration = (element.duration as number) ?? 1800;

  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Intersection observer pra começar quando entrar no viewport
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const step = (now: number) => {
              const elapsed = now - start;
              const progress = Math.min(1, elapsed / duration);
              // Ease out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              setCurrent(Math.round(eased * target));
              if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: primary,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {prefix}
        {current.toLocaleString("pt-BR")}
        {suffix}
      </div>
      <div style={{ fontSize: 13, color: muted }}>{label}</div>
    </div>
  );
}
