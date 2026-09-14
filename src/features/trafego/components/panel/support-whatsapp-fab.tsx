"use client";

import { MessageCircle } from "lucide-react";
import { useTrafegoPublicConfig } from "@/features/trafego/hooks/use-trafego-plans";

/**
 * Atalho fixo para o WhatsApp da equipe, com o código do pedido já na
 * mensagem. Fica acima do orb do Astro (que ocupa o canto inferior direito
 * no layout da plataforma) para os dois não se sobreporem.
 */
export function SupportWhatsappFab({ orderCode }: { orderCode: string }) {
  const { data: config } = useTrafegoPublicConfig();
  const number = config?.supportWhatsapp?.replace(/\D/g, "");
  if (!number) return null;

  const message = encodeURIComponent(
    `Olá! Sou cliente trafeGO, pedido ${orderCode}. Tenho uma dúvida sobre a campanha.`,
  );

  return (
    <a
      href={`https://wa.me/${number}?text=${message}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com a equipe no WhatsApp"
      className="fixed bottom-24 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 md:right-6"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline">Falar com a equipe</span>
    </a>
  );
}
