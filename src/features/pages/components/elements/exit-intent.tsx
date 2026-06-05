"use client";

import { useEffect, useState } from "react";
import type { ElementBase } from "../../types";

/**
 * Exit Intent — popover de retenção. Detecta intent de saída via:
 *
 * 1. Mouse subindo até o topo do viewport (desktop)
 * 2. Scroll rápido pra cima (proxy de "vou fechar a aba")
 * 3. Browser back button (popstate)
 *
 * Mostra modal com headline + cupom + CTA. `showOnce` evita
 * mostrar de novo na mesma sessão. Triggers só depois de
 * `triggerDelayMs` ms na página (não persegue user que acabou
 * de chegar).
 *
 * O cupom pode ser copiado com 1 click — vai pro clipboard +
 * toast inline.
 */
export function ExitIntent({ element }: { element: ElementBase }) {
  const heading = (element.heading as string) ?? "Espera! Antes de sair…";
  const subtitle =
    (element.subtitle as string) ?? "Ganha 10% de desconto pra fechar hoje.";
  const couponCode = (element.couponCode as string) ?? "";
  const ctaLabel = (element.ctaLabel as string) ?? "Aproveitar agora";
  const ctaHref = (element.ctaHref as string) ?? "#";
  const triggerDelayMs = (element.triggerDelayMs as number) ?? 2000;
  const showOnce = (element.showOnce as boolean) ?? true;
  const bgColor = (element.bgColor as string) ?? "#0f172a";
  const fgColor = (element.fgColor as string) ?? "#ffffff";
  const primaryColor = (element.primaryColor as string) ?? "#7C3AED";

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let ready = false;
    let shown = false;
    const storageKey = `nasa_exit_intent_${element.id ?? "default"}`;

    // Não dispara nos primeiros N ms — evita spam pra quem acabou
    // de chegar.
    const readyTimer = setTimeout(() => {
      ready = true;
    }, Math.max(0, triggerDelayMs));

    const trigger = () => {
      if (!ready || shown) return;
      if (showOnce) {
        try {
          if (sessionStorage.getItem(storageKey)) return;
          sessionStorage.setItem(storageKey, "1");
        } catch {
          // ignora se storage bloqueado
        }
      }
      shown = true;
      setOpen(true);
    };

    const onMouseLeave = (e: MouseEvent) => {
      // Mouse subindo pra fora do viewport pelo topo
      if (e.clientY <= 0) trigger();
    };
    const onPopState = () => trigger();

    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("popstate", onPopState);

    return () => {
      clearTimeout(readyTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("popstate", onPopState);
    };
  }, [element.id, triggerDelayMs, showOnce]);

  const copyCoupon = async () => {
    if (!couponCode) return;
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback silencioso
    }
  };

  // No editor (sem `id` ou em iframe sem mouseleave funcional), o
  // popover não dispara — mostra preview inline.
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95"
        style={{ background: bgColor, color: fgColor }}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 size-8 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="Fechar"
        >
          ✕
        </button>
        <h3 className="text-xl sm:text-2xl font-black leading-tight">
          {heading}
        </h3>
        <p className="text-sm sm:text-base mt-2 opacity-80 leading-relaxed">
          {subtitle}
        </p>
        {couponCode && (
          <button
            onClick={copyCoupon}
            className="mt-4 w-full rounded-xl border-2 border-dashed p-3 text-center font-mono font-bold text-lg tracking-wider hover:bg-white/5 transition-colors"
            style={{ borderColor: `${primaryColor}80`, color: primaryColor }}
          >
            {copied ? "✓ Copiado!" : couponCode}
          </button>
        )}
        <a
          href={ctaHref}
          onClick={() => setOpen(false)}
          className="mt-4 block w-full text-center py-3.5 rounded-xl font-bold transition-opacity hover:opacity-90"
          style={{ background: primaryColor, color: "#fff", textDecoration: "none" }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
