"use client";

/**
 * Botões flutuantes fixos no canto da página: WhatsApp e "voltar ao topo".
 * Renderizam via portal no <body> para escapar de qualquer `transform` dos blocos.
 */
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowUp } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { digitsOf } from "../../lib/phone-br";
import type { ElementBase } from "../../types";

const BACK_TO_TOP_SCROLL_THRESHOLD_PX = 480;
const BRAZIL_COUNTRY_CODE = "55";
const MAX_LOCAL_PHONE_DIGITS = 11;
const WHATSAPP_GREEN = "#25D366";

function subscribeToScroll(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}
const subscribeToNothing = () => () => {};
const readHasScrolledDown = () => window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD_PX;
const readTrue = () => true;
const readFalse = () => false;

export function buildWhatsAppUrl(rawPhone: string, message: string): string | null {
  const phoneDigits = digitsOf(rawPhone);
  if (phoneDigits.length < 10) return null;
  const internationalDigits =
    phoneDigits.length <= MAX_LOCAL_PHONE_DIGITS ? `${BRAZIL_COUNTRY_CODE}${phoneDigits}` : phoneDigits;
  const messageQuery = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${internationalDigits}${messageQuery}`;
}

export function FloatingButtons({ element }: { element: ElementBase }) {
  const isWhatsAppEnabled = (element.whatsappEnabled as boolean | undefined) ?? true;
  const whatsappPhone = (element.whatsappPhone as string | undefined) ?? "";
  const whatsappMessage = (element.whatsappMessage as string | undefined) ?? "";
  const isBackToTopEnabled = (element.backToTopEnabled as boolean | undefined) ?? true;
  const isOnLeft = (element.side as string | undefined) === "left";
  const bottomOffsetPx = (element.bottomOffset as number | undefined) ?? 20;
  const backToTopBackground = (element.bgColor as string | undefined) ?? "#111827";
  const backToTopForeground = (element.fgColor as string | undefined) ?? "#ffffff";

  // No servidor não há <body> para o portal nem rolagem para ler.
  const isMounted = useSyncExternalStore(subscribeToNothing, readTrue, readFalse);
  const hasScrolledDown = useSyncExternalStore(subscribeToScroll, readHasScrolledDown, readFalse);

  if (!isMounted) return null;

  const whatsappUrl = isWhatsAppEnabled ? buildWhatsAppUrl(whatsappPhone, whatsappMessage) : null;

  return createPortal(
    <div
      className="flex flex-col items-center gap-3"
      style={{
        position: "fixed",
        bottom: bottomOffsetPx,
        zIndex: 9990,
        ...(isOnLeft ? { left: 20 } : { right: 20 }),
      }}
    >
      {isBackToTopEnabled && hasScrolledDown && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="grid size-11 place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ background: backToTopBackground, color: backToTopForeground }}
        >
          <ArrowUp className="size-5" />
        </button>
      )}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar pelo WhatsApp"
          className="grid size-14 place-items-center rounded-full text-white shadow-xl transition-transform hover:scale-105"
          style={{ background: WHATSAPP_GREEN }}
        >
          <WhatsappIcon className="size-7" />
        </a>
      )}
    </div>,
    document.body,
  );
}
