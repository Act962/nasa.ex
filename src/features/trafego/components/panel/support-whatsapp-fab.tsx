"use client";

import { MessageCircle } from "lucide-react";
import { useTrafegoPublicConfig } from "@/features/trafego/hooks/use-trafego-plans";

/**
 * Atalho fixo para o WhatsApp da equipe, com o código do pedido já na
 * mensagem. No computador fica acima do orb do Astro; abaixo de lg vira uma
 * bolinha acima do menu de baixo (150px) para não cobrir os itens dele.
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
      className="fixed right-4 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 inline-flex size-12 items-center justify-center gap-2 rounded-full bg-brand-whatsapp text-sm font-semibold text-white shadow-lg transition hover:brightness-110 lg:right-6 lg:bottom-24 lg:size-auto lg:px-4 lg:py-3"
    >
      <MessageCircle className="size-5" />
      <span className="max-lg:sr-only">Falar com a equipe</span>
    </a>
  );
}
