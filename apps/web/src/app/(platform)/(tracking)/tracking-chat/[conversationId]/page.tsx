"use client";

import { Spinner } from "@/components/ui/spinner";
import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer-chat";
import { Header } from "@/features/tracking-chat/components/header-tracking-chat";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { redirect, useParams } from "next/navigation";
import { useState } from "react";

import { MarkedMessage } from "@/features/tracking-chat/types";
import { useUserChatPreferences } from "@/features/user-chat-preferences/hooks/use-user-chat-preferences";
import {
  getContrastingTextColor,
  getContrastingMutedTextColor,
} from "@/features/user-chat-preferences/lib/contrast";
import { useConstructUrl } from "@/hooks/use-construct-url";

export default function Page() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messageSelected, setMessageSelected] = useState<
    MarkedMessage | undefined
  >(undefined);
  const { data, isLoading } = useQuery(
    orpc.conversation.get.queryOptions({
      input: {
        conversationId,
      },
    }),
  );

  // Preferências visuais do USUÁRIO logado (não da org). Cada atendente
  // pode customizar fundo + cor das bolhas independentemente.
  const { data: chatPrefs } = useUserChatPreferences();
  const customBgImageKey =
    chatPrefs?.chatBackgroundType === "image" && chatPrefs.chatBackgroundValue
      ? chatPrefs.chatBackgroundValue
      : null;
  // useConstructUrl resolve a R2 key (ex: "chat-bgs/abc123.jpg") em URL
  // pública completa. Sem isso, `url(<chave-crua>)` no CSS não carrega.
  const customBgImage = useConstructUrl(customBgImageKey ?? "");
  const customBgColor =
    chatPrefs?.chatBackgroundType === "color" && chatPrefs.chatBackgroundValue
      ? chatPrefs.chatBackgroundValue
      : null;
  // Opacidade da imagem (0-100) — só usada quando bgType=image
  const customBgOpacity = chatPrefs?.chatBackgroundOpacity ?? 100;
  const ownColor = chatPrefs?.ownMessageBgColor ?? null;
  const theirColor = chatPrefs?.theirMessageBgColor ?? null;
  // Quando a cor da bolha é customizada, calculamos a cor de texto/timestamp
  // baseado na luminância — preto pra fundos claros, branco pra fundos
  // escuros. Resolve o problema de alternar Light/Dark sem trocar a cor
  // customizada: o texto ainda fica legível em ambos os modos.
  const ownText = getContrastingTextColor(ownColor);
  const ownMutedText = getContrastingMutedTextColor(ownColor);
  const theirText = getContrastingTextColor(theirColor);
  const theirMutedText = getContrastingMutedTextColor(theirColor);

  if (isLoading) {
    return (
      <div className=" h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    redirect("/tracking-chat");
  }

  return (
    <div
      className={cn(
        "h-full relative",
        // Defaults theme-aware (WhatsApp). Renderizam como var() fallback
        // em `message-box.tsx`, garantindo que quando o user NÃO customizou,
        // light/dark mode trocam as cores corretas automaticamente.
        "[--chat-own-bg-default:#d9fdd3] dark:[--chat-own-bg-default:#005c4b]",
        "[--chat-their-bg-default:#ffffff] dark:[--chat-their-bg-default:#202c33]",
        "[--chat-own-text-default:#18181b] dark:[--chat-own-text-default:#fafafa]",
        "[--chat-their-text-default:#18181b] dark:[--chat-their-text-default:#fafafa]",
        "[--chat-own-muted-default:rgba(63,63,70,0.7)] dark:[--chat-own-muted-default:rgba(228,228,231,0.7)]",
        "[--chat-their-muted-default:rgba(63,63,70,0.7)] dark:[--chat-their-muted-default:rgba(228,228,231,0.7)]",
      )}
      style={
        // Quando o user customiza, sobrepomos os defaults. O auto-contraste
        // (getContrastingTextColor) garante legibilidade independente de
        // qual cor escolheu e em qual tema o app está.
        {
          ...(ownColor && { ["--chat-own-bg" as any]: ownColor }),
          ...(theirColor && { ["--chat-their-bg" as any]: theirColor }),
          ...(ownText && { ["--chat-own-text" as any]: ownText }),
          ...(ownMutedText && { ["--chat-own-muted" as any]: ownMutedText }),
          ...(theirText && { ["--chat-their-text" as any]: theirText }),
          ...(theirMutedText && {
            ["--chat-their-muted" as any]: theirMutedText,
          }),
        } as React.CSSProperties
      }
    >
      {/* Layer 1: pattern WhatsApp Web (JPG q=70, ~178KB).
          bg-fixed mantém parado durante scroll.
          User pode override via Personalização → Aparência do Chat. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 pointer-events-none",
          // Default WhatsApp pattern só renderiza se user não customizou
          !customBgImageKey &&
            !customBgColor &&
            "bg-[url('/chat-bg/mobile.jpg')] md:bg-[url('/chat-bg/desktop.jpg')] bg-cover bg-center bg-fixed bg-[#dbe9f7] dark:bg-zinc-900",
        )}
        style={
          customBgImageKey
            ? {
                backgroundImage: `url(${customBgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundAttachment: "fixed",
                // Opacidade 0-1. Em 0 imagem some completamente; em 1
                // imagem opaca. Aplicado SOMENTE quando user customizou —
                // não interfere com o pattern default.
                opacity: customBgOpacity / 100,
              }
            : customBgColor
              ? { backgroundColor: customBgColor }
              : undefined
        }
      />
      {/* Layer 2: overlay translúcida que dilui o pattern.
          - Cor sólida custom → sem overlay (cor fica nítida)
          - Imagem custom → SEM overlay também (a opacidade da imagem já
            controla a mescla — overlay extra seria redundante e bagunçaria
            a visualização da transparência configurada pelo user)
          - Default → overlay padrão pra dar contraste com bolhas */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 pointer-events-none",
          customBgColor || customBgImageKey
            ? "bg-transparent"
            : "bg-background/60 dark:bg-background/40",
        )}
      />
      {/* Layer 3: conteúdo. */}
      <div className="relative h-full flex flex-col">
        <Header
          name={data.conversation.lead?.name || ""}
          profile={data.conversation.lead?.profile ?? undefined}
          phone={data.conversation.lead?.phone ?? undefined}
          leadId={data.conversation.lead.id}
          conversationId={conversationId}
          active={data.conversation.lead.isActive}
          trackingId={data.conversation.trackingId}
          statusFlow={data.conversation.lead.statusFlow}
          channel={data.conversation.channel}
          trackingName={(data.conversation as any).tracking?.name ?? null}
          statusName={(data.conversation.lead as any).status?.name ?? null}
        />
        <Body
          messageSelected={messageSelected}
          onSelectMessage={setMessageSelected}
          trackingId={data.conversation.trackingId}
          isGroup={data.conversation.isGroup}
        />
        <Footer
          messageSelected={messageSelected}
          closeMessageSelected={() => setMessageSelected(undefined)}
          trackingId={data.conversation.tracking.id}
          conversationId={conversationId}
          lead={data?.conversation.lead}
        />
      </div>
    </div>
  );
}
