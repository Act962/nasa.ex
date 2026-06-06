"use client";

/**
 * Elemento Marketing — singleton com táticas de conversão integradas.
 *
 * Cada feature é OPCIONAL via toggle:
 *
 *  1. **Social-proof toasts** — pop-ups discretos "X acabou de entrar -
 *     Cidade-UF" em intervalos variados. Aumenta percepção de
 *     popularidade da oferta.
 *
 *  2. **Discount countdown bar** — barra no topo ou rodapé com
 *     contagem regressiva pra desconto/oferta. Cria urgência.
 *
 *  3. **Visitors online counter** — badge "X pessoas online agora"
 *     que oscila naturalmente. Social proof passivo.
 *
 *  4. **Sticky CTA bar** — barra fixa no rodapé com CTA principal,
 *     acompanha o scroll. Mantém conversão sempre 1 clique de distância.
 *
 *  5. **Scarcity badge** — "Apenas X vagas restantes" flutuante.
 *     FOMO clássico.
 *
 *  6. **Auto-open chat** (helper) — coordena com o ChatButton: dispara
 *     evento custom que o chat escuta pra abrir após X segundos.
 *
 * Tudo renderizado via `createPortal(document.body)` pra escapar do
 * fluxo do layout. No editor (canvas), mostra uma "carta visual" de
 * preview com os widgets ativos listados.
 *
 * `readonly` controla: no editor (`readonly=false`), renderiza o card
 * visual placeholder. No público (`readonly=true`), aciona os widgets
 * reais via portal.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Megaphone, Timer, Users, MousePointerClick, AlertTriangle,
  MessageCircle, Bell, X, CreditCard,
} from "lucide-react";
import type { ElementBase } from "../../types";
import {
  randomIntervalMs,
  randomPerson,
  renderToastMessage,
  type MarketingPerson,
} from "../../lib/marketing-data";
import { useUserLocation } from "../../lib/use-user-location";
import { usePageRenderContext } from "../public/page-context";

type ToastPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";
type BarPosition = "top" | "bottom";

interface MarketingProps {
  element: ElementBase;
  readonly?: boolean;
}

export function MarketingElement({ element, readonly }: MarketingProps) {
  /* ─── Editor preview (card visual) ────────────────────────────── */
  if (!readonly) {
    return <MarketingEditorPlaceholder element={element} />;
  }

  /* ─── Public runtime (widgets reais) ──────────────────────────── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  // Lê configs do JSON do element com defaults sensatos
  const toastsEnabled = (element.toastsEnabled as boolean | undefined) ?? true;
  const purchaseToastsEnabled =
    (element.purchaseToastsEnabled as boolean | undefined) ?? false;
  const discountBarEnabled =
    (element.discountBarEnabled as boolean | undefined) ?? true;
  const visitorsOnlineEnabled =
    (element.visitorsOnlineEnabled as boolean | undefined) ?? false;
  const stickyCtaEnabled =
    (element.stickyCtaEnabled as boolean | undefined) ?? false;
  const scarcityEnabled =
    (element.scarcityEnabled as boolean | undefined) ?? false;
  const autoOpenChat = (element.autoOpenChat as boolean | undefined) ?? false;
  const autoOpenChatDelaySec =
    (element.autoOpenChatDelaySec as number | undefined) ?? 2;

  return createPortal(
    <>
      {toastsEnabled && <SocialProofToasts element={element} />}
      {purchaseToastsEnabled && <PurchaseToasts element={element} />}
      {discountBarEnabled && <DiscountCountdownBar element={element} />}
      {visitorsOnlineEnabled && <VisitorsOnlineBadge element={element} />}
      {stickyCtaEnabled && <StickyCtaBar element={element} />}
      {scarcityEnabled && <ScarcityBadge element={element} />}
      {autoOpenChat && <AutoOpenChatTrigger delaySec={autoOpenChatDelaySec} />}
    </>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Editor placeholder                                                */
/* ─────────────────────────────────────────────────────────────────── */

function MarketingEditorPlaceholder({ element }: { element: ElementBase }) {
  const features: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }>; enabled: boolean }> = [
    { key: "toasts", label: "Toasts de leads", icon: Bell, enabled: (element.toastsEnabled as boolean | undefined) ?? true },
    { key: "purchase", label: "Toasts de compra", icon: CreditCard, enabled: (element.purchaseToastsEnabled as boolean | undefined) ?? false },
    { key: "discount", label: "Cronômetro de desconto", icon: Timer, enabled: (element.discountBarEnabled as boolean | undefined) ?? true },
    { key: "visitors", label: "Visitantes online", icon: Users, enabled: (element.visitorsOnlineEnabled as boolean | undefined) ?? false },
    { key: "sticky", label: "Barra CTA fixa", icon: MousePointerClick, enabled: (element.stickyCtaEnabled as boolean | undefined) ?? false },
    { key: "scarcity", label: "Estoque escasso", icon: AlertTriangle, enabled: (element.scarcityEnabled as boolean | undefined) ?? false },
    { key: "autochat", label: "Auto-abrir chat", icon: MessageCircle, enabled: (element.autoOpenChat as boolean | undefined) ?? false },
  ];
  const activeCount = features.filter((f) => f.enabled).length;
  return (
    <div
      className="w-full h-full rounded-xl border-2 border-dashed bg-gradient-to-br from-purple-50 to-indigo-50 flex flex-col p-3 overflow-hidden"
      style={{ borderColor: "rgba(139, 92, 246, 0.4)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="size-7 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <Megaphone className="size-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-purple-900 leading-tight">
            Marketing toolkit
          </p>
          <p className="text-[10px] text-purple-700/70 leading-tight">
            {activeCount} de {features.length} táticas ativas — só visível no público
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 flex-1 content-start">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.key}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] border ${
                feature.enabled
                  ? "bg-white border-purple-200 text-purple-900"
                  : "bg-purple-50/40 border-purple-100 text-purple-400 line-through opacity-60"
              }`}
            >
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{feature.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  1. Social-proof toasts                                            */
/* ─────────────────────────────────────────────────────────────────── */

function SocialProofToasts({ element }: { element: ElementBase }) {
  const message =
    (element.toastMessage as string) ??
    "{name} acabou de entrar - {city}-{state}";
  const minSec = (element.toastIntervalMinSec as number | undefined) ?? 5;
  const maxSec = (element.toastIntervalMaxSec as number | undefined) ?? 25;
  const position =
    (element.toastPosition as ToastPosition | undefined) ?? "bottom-left";
  const customPeople = (element.toastPeople as MarketingPerson[] | undefined) ?? [];
  const malePercent = (element.toastMalePercent as number | undefined) ?? 50;
  const localCityPercent =
    (element.toastLocalCityPercent as number | undefined) ?? 0;

  // Lista efetiva: usa pessoas custom do user se houver (mais autêntico
  // pra nicho), senão combina nomes/cidades random respeitando os
  // percentuais de gênero/cidade-local.
  const useCustom = customPeople.length > 0;

  // Detecta cidade do usuário via IP só se for relevante (% > 0). Sem
  // isso, evita fazer fetch desnecessário pra um recurso desligado.
  const userLocation = useUserLocation(localCityPercent > 0);

  const [toast, setToast] = useState<{ id: number; person: MarketingPerson } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const showNext = () => {
      if (cancelled) return;
      const person = useCustom
        ? customPeople[Math.floor(Math.random() * customPeople.length)]
        : randomPerson({ malePercent, localCityPercent, userLocation });
      setToast({ id: Date.now(), person });
      // Auto-some após 4s
      setTimeout(() => {
        if (!cancelled) setToast(null);
      }, 4000);
      // Agenda próximo
      timerRef.current = setTimeout(showNext, randomIntervalMs(minSec, maxSec));
    };

    // Primeiro toast com delay curto pra parecer natural
    timerRef.current = setTimeout(showNext, 4000);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [minSec, maxSec, useCustom, customPeople, malePercent, localCityPercent, userLocation]);

  if (!toast) return null;

  const posStyle: React.CSSProperties =
    position === "bottom-left"
      ? { bottom: 20, left: 20 }
      : position === "bottom-right"
        ? { bottom: 20, right: 20 }
        : position === "top-left"
          ? { top: 20, left: 20 }
          : { top: 20, right: 20 };

  return (
    <div
      key={toast.id}
      style={{
        position: "fixed",
        ...posStyle,
        zIndex: 9990,
        maxWidth: "min(360px, calc(100vw - 40px))",
        background: "white",
        color: "#0f172a",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation:
          "nasa-toast-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      <style>{`
        @keyframes nasa-toast-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          color: "#fff",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {toast.person.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
          {renderToastMessage(message, toast.person)}
        </p>
        <p style={{ fontSize: 11, opacity: 0.6, margin: 0, marginTop: 2 }}>
          agora mesmo
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  2. Discount countdown bar                                         */
/* ─────────────────────────────────────────────────────────────────── */

function DiscountCountdownBar({ element }: { element: ElementBase }) {
  const text =
    (element.discountBarText as string) ??
    "Você conseguiu 10% de desconto, adquirindo qualquer produto em";
  const durationSec =
    (element.discountBarDurationSec as number | undefined) ?? 300;
  const position =
    (element.discountBarPosition as BarPosition | undefined) ?? "top";
  const bg = (element.discountBarBg as string | undefined) ?? "#7C3AED";
  const fg = (element.discountBarFg as string | undefined) ?? "#ffffff";
  const ctaLabel = (element.discountBarCtaLabel as string | undefined) ?? "";
  const ctaHref = (element.discountBarCtaHref as string | undefined) ?? "";

  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (closed) return null;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const time = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        [position === "top" ? "top" : "bottom"]: 0,
        zIndex: 9995,
        background: bg,
        color: fg,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 13,
        fontWeight: 500,
        boxShadow:
          position === "top"
            ? "0 2px 8px rgba(0,0,0,0.1)"
            : "0 -2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <span>
        🎁 {text}{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums", marginLeft: 4 }}>
          {time}
        </strong>
      </span>
      {ctaLabel && (
        <a
          href={ctaHref || "#"}
          style={{
            background: "rgba(255,255,255,0.2)",
            color: fg,
            padding: "4px 12px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          {ctaLabel}
        </a>
      )}
      <button
        onClick={() => setClosed(true)}
        aria-label="Fechar"
        style={{
          background: "transparent",
          border: 0,
          color: fg,
          opacity: 0.7,
          cursor: "pointer",
          padding: 4,
          display: "flex",
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  3. Visitors online counter                                        */
/* ─────────────────────────────────────────────────────────────────── */

function VisitorsOnlineBadge({ element }: { element: ElementBase }) {
  const min = (element.visitorsOnlineMin as number | undefined) ?? 30;
  const max = (element.visitorsOnlineMax as number | undefined) ?? 80;
  const position =
    (element.visitorsOnlinePosition as ToastPosition | undefined) ??
    "bottom-right";

  const [count, setCount] = useState(() =>
    Math.floor(min + Math.random() * (max - min)),
  );

  useEffect(() => {
    const id = setInterval(
      () => {
        // Pequena variação ±2 a cada 8s pra parecer "vivo"
        const delta = Math.floor(Math.random() * 5) - 2;
        setCount((c) => Math.max(min, Math.min(max, c + delta)));
      },
      8000,
    );
    return () => clearInterval(id);
  }, [min, max]);

  const posStyle: React.CSSProperties =
    position === "bottom-right"
      ? { bottom: 20, right: 20 }
      : position === "bottom-left"
        ? { bottom: 20, left: 20 }
        : position === "top-right"
          ? { top: 20, right: 20 }
          : { top: 20, left: 20 };

  return (
    <div
      style={{
        position: "fixed",
        ...posStyle,
        zIndex: 9989,
        background: "rgba(15, 23, 42, 0.92)",
        color: "white",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 6,
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#10b981",
          boxShadow: "0 0 0 0 rgba(16,185,129,0.8)",
          animation: "nasa-pulse-dot 2s ease-out infinite",
        }}
      />
      <style>{`
        @keyframes nasa-pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
          70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
      `}</style>
      <span>{count} pessoas online agora</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  4. Sticky CTA bar (rodapé)                                        */
/* ─────────────────────────────────────────────────────────────────── */

function StickyCtaBar({ element }: { element: ElementBase }) {
  const text =
    (element.stickyCtaText as string) ?? "Garanta sua vaga com 10% off";
  const ctaLabel =
    (element.stickyCtaLabel as string) ?? "Quero garantir";
  const ctaHref = (element.stickyCtaHref as string) ?? "#";
  const bg = (element.stickyCtaBg as string) ?? "#10b981";
  const fg = (element.stickyCtaFg as string) ?? "#ffffff";

  // Mostra só depois de 30% de scroll — não bombardeia logo na entrada
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const ratio = doc.scrollTop / Math.max(1, doc.scrollHeight - window.innerHeight);
      setVisible(ratio > 0.25);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9988,
        background: bg,
        color: fg,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
        animation: "nasa-toast-in 0.4s ease-out both",
      }}
    >
      <span>{text}</span>
      <a
        href={ctaHref}
        style={{
          background: "rgba(255,255,255,0.95)",
          color: bg,
          padding: "6px 14px",
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        {ctaLabel} →
      </a>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  5. Scarcity badge                                                 */
/* ─────────────────────────────────────────────────────────────────── */

function ScarcityBadge({ element }: { element: ElementBase }) {
  const text = (element.scarcityText as string) ?? "Apenas 12 vagas restantes";
  const position =
    (element.scarcityPosition as ToastPosition | undefined) ?? "top-right";

  const posStyle: React.CSSProperties =
    position === "top-right"
      ? { top: 76, right: 20 }
      : position === "top-left"
        ? { top: 76, left: 20 }
        : position === "bottom-right"
          ? { bottom: 80, right: 20 }
          : { bottom: 80, left: 20 };

  return (
    <div
      style={{
        position: "fixed",
        ...posStyle,
        zIndex: 9987,
        background: "linear-gradient(135deg, #ef4444, #f97316)",
        color: "white",
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 6,
        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
      }}
    >
      <span style={{ fontSize: 14 }}>🔥</span>
      <span>{text}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  6. Purchase toasts (auto-detecta planos da page-pricing)          */
/* ─────────────────────────────────────────────────────────────────── */

function PurchaseToasts({ element }: { element: ElementBase }) {
  const ctx = usePageRenderContext();
  // Planos: prioridade pros planos AUTO-DETECTADOS da section-pricing
  // da page. Fallback pra lista override do user (se quiser controlar
  // manualmente). Se ambos vazios, não renderiza nada (toggle só faz
  // sentido com produtos pra exibir).
  const customPlans =
    (element.purchasePlans as string[] | undefined)?.filter(Boolean) ?? [];
  const detectedPlans = ctx.availablePlans ?? [];
  const plans = customPlans.length > 0 ? customPlans : detectedPlans;

  const message =
    (element.purchaseToastMessage as string) ??
    "{name} acabou de adquirir {plan}";
  const minSec =
    (element.purchaseToastIntervalMinSec as number | undefined) ?? 15;
  const maxSec =
    (element.purchaseToastIntervalMaxSec as number | undefined) ?? 60;
  const position =
    (element.purchaseToastPosition as ToastPosition | undefined) ??
    "bottom-right";
  const customPeople =
    (element.toastPeople as MarketingPerson[] | undefined) ?? [];
  // Os percentuais são COMPARTILHADOS entre o social-proof e o purchase
  // — mais consistente pro user (uma config só).
  const malePercent = (element.toastMalePercent as number | undefined) ?? 50;
  const localCityPercent =
    (element.toastLocalCityPercent as number | undefined) ?? 0;
  const userLocation = useUserLocation(localCityPercent > 0);

  const [toast, setToast] = useState<{ id: number; text: string; initial: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (plans.length === 0) return; // nada a anunciar
    let cancelled = false;

    const showNext = () => {
      if (cancelled) return;
      const person =
        customPeople.length > 0
          ? customPeople[Math.floor(Math.random() * customPeople.length)]
          : randomPerson({ malePercent, localCityPercent, userLocation });
      const plan = plans[Math.floor(Math.random() * plans.length)];
      const text = message
        .replace(/\{name\}/g, person.name)
        .replace(/\{plan\}/g, plan)
        .replace(/\{city\}/g, person.city)
        .replace(/\{state\}/g, person.state);
      setToast({
        id: Date.now(),
        text,
        initial: person.name.charAt(0).toUpperCase(),
      });
      setTimeout(() => {
        if (!cancelled) setToast(null);
      }, 4500);
      timerRef.current = setTimeout(showNext, randomIntervalMs(minSec, maxSec));
    };

    // Primeiro toast com offset maior que o social proof normal — pra
    // não disparar simultâneo com os outros toasts (UX limpa).
    timerRef.current = setTimeout(showNext, 8000);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plans, message, minSec, maxSec, customPeople, malePercent, localCityPercent, userLocation]);

  if (!toast) return null;

  const posStyle: React.CSSProperties =
    position === "bottom-left"
      ? { bottom: 20, left: 20 }
      : position === "bottom-right"
        ? { bottom: 20, right: 20 }
        : position === "top-left"
          ? { top: 20, left: 20 }
          : { top: 20, right: 20 };

  return (
    <div
      key={toast.id}
      style={{
        position: "fixed",
        ...posStyle,
        zIndex: 9991, // 1 acima do social proof pra não sobrepor exato
        maxWidth: "min(360px, calc(100vw - 40px))",
        background: "white",
        color: "#0f172a",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation:
          "nasa-toast-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        borderLeft: "3px solid #10b981",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          color: "#fff",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        💳
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
          <span style={{ display: "inline-block", marginRight: 4, fontWeight: 800 }}>
            {toast.initial}
          </span>
          {toast.text}
        </p>
        <p style={{ fontSize: 11, opacity: 0.6, margin: 0, marginTop: 2 }}>
          compra confirmada
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  7. Auto-open chat trigger                                         */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Dispara um custom event que o `ChatButton` pode escutar pra
 * forçar abertura. Como o ChatButton já tem seu próprio auto-greet
 * por padrão, este trigger só RE-FORÇA o open caso o user tenha
 * desligado o greet manualmente.
 */
function AutoOpenChatTrigger({ delaySec }: { delaySec: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("nasa:chat:auto-open"));
    }, delaySec * 1000);
    return () => clearTimeout(timer);
  }, [delaySec]);
  return null;
}
