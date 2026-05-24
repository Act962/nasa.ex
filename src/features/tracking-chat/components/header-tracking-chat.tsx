"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  ArrowLeftIcon,
  BotIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  RefreshCwIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { dialPhone } from "../utils/dial-phone";
import Link from "next/link";
import { SummerizeConversation } from "./summerize-conversation";
import { useRouter, useSearchParams } from "next/navigation";
import { withSearchParams } from "../utils/url";
import { CheckIaLead } from "./check-ia-lead";
import { MessageChannel, StatusFlow } from "@/generated/prisma/enums";
import { useMutationRodizio } from "../hooks/use-rodizio";
import { SyncMessagesButton } from "./sync-messages-button";
import { FacebookIcon, InstagramIcon } from "./icons";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
  leadId: string;
  conversationId: string;
  active: boolean;
  trackingId: string;
  statusFlow: StatusFlow;
  channel?: MessageChannel;
}

function ChannelBadge({ channel }: { channel: MessageChannel }) {
  if (channel === MessageChannel.INSTAGRAM) {
    return (
      <span
        title="Instagram DM"
        className="flex items-center justify-center size-6 rounded-full bg-linear-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shrink-0"
      >
        <InstagramIcon className="size-3.5" />
      </span>
    );
  }
  if (channel === MessageChannel.FACEBOOK) {
    return (
      <span
        title="Facebook Messenger"
        className="flex items-center justify-center size-6 rounded-full bg-[#0082FB] text-white shrink-0"
      >
        <FacebookIcon className="size-3.5" />
      </span>
    );
  }
  return null;
}

export function Header({
  name,
  profile,
  phone,
  leadId,
  conversationId,
  active: initialActive,
  trackingId,
  statusFlow,
  channel,
}: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileUrl = useConstructUrl(profile || "");
  const mutation = useMutationRodizio(conversationId);
  const [syncOpen, setSyncOpen] = useState(false);

  const backHref = withSearchParams(`/tracking-chat`, searchParams);

  const onCloseChat = () => {
    router.push(backHref);
  };

  const handleFinishLead = () => {
    mutation.mutate({
      leadId,
      trackingId,
    });
  };

  // Inicia uma chamada LiveKit (vídeo, padrão). O backend mint o token
  // do consultor + envia o link pro lead via WhatsApp automaticamente.
  // Aqui abrimos uma nova aba pro consultor entrar na sala — mantém o
  // chat aberto na aba original pra acompanhar mensagens enquanto fala.
  const videoCall = useMutation(
    orpc.livekit.createLeadMeeting.mutationOptions({
      onSuccess: (data: any) => {
        const consultorCallPath = `/call/${encodeURIComponent(data.roomName)}?t=${encodeURIComponent(data.consultorToken)}&n=${encodeURIComponent("Você")}&mode=video`;
        // Tenta abrir nova aba; em mobile, alguns browsers bloqueiam — fallback
        // pra mesma aba via location.assign após confirmação.
        const w = window.open(consultorCallPath, "_blank", "noopener,noreferrer");
        if (!w) {
          window.location.assign(consultorCallPath);
        }
        toast.success(
          data.notifiedViaWhatsApp
            ? "Link da chamada enviado pro lead via WhatsApp ✓"
            : "Sala criada — envie o link manualmente pro lead",
        );
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Falha ao iniciar chamada de vídeo");
      },
    }),
  );

  const handleVideoCall = () => {
    videoCall.mutate({
      conversationId,
      mode: "video",
      notifyLead: true,
      appOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    });
  };
  const videoCallPending = videoCall.isPending;

  return (
    <div className="bg-accent-foreground/10 w-full flex border-b sm:px-4 py-3 px-4 lg:px-6 justify-between items-center shadow-sm">
      <div className="flex gap-3 items-center">
        <Button variant="ghost" size="sm" className="lg:hidden block">
          <Link href={backHref}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="relative">
          <Avatar>
            <AvatarImage src={profileUrl} />
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {channel && channel !== MessageChannel.WHATSAPP && (
            <span className="absolute -bottom-1 -right-1">
              <ChannelBadge channel={channel} />
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <Link
            href={`/contatos/${leadId}`}
            className="hover:underline underline-offset-3"
          >
            {name || "Sem nome"}
          </Link>
          {phone && (
            <div className="text-xs font-light text-foreground/40">
              {phoneMaskFull(phone)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Sempre visíveis (mobile + desktop): ligar áudio (tel:) e vídeo
            (LiveKit). Phone abre o app de telefone do SO; video gera
            URL pública /call/[room] e envia pro lead via WhatsApp,
            depois abre nova aba pro consultor entrar na sala. */}
        {phone && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => dialPhone(phone)}
            title={`Ligar pra ${phone}`}
            aria-label="Ligar pro lead"
          >
            <PhoneIcon className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleVideoCall}
          disabled={videoCallPending}
          title="Iniciar chamada de vídeo"
          aria-label="Iniciar chamada de vídeo"
        >
          <VideoIcon className="size-4" />
        </Button>

        {/* Desktop only: standalone buttons */}
        <div className="hidden lg:flex items-center gap-4">
          <SyncMessagesButton
            conversationId={conversationId}
            open={syncOpen}
            onOpenChange={setSyncOpen}
          />
          <CheckIaLead
            size={"default"}
            active={initialActive}
            leadId={leadId}
            trackingId={trackingId}
          />
          <Button
            onClick={handleFinishLead}
            variant={statusFlow === "FINISHED" ? "default" : "outline"}
            disabled={statusFlow === "FINISHED" || mutation.isPending}
          >
            Finalizar <CheckIcon className="size-4" />
          </Button>
        </div>

        {/* Always visible: SummerizeConversation (Popover — não pode ir no dropdown) */}
        <SummerizeConversation conversationId={conversationId} />

        {/* Always visible: DropdownMenu — substitui o XIcon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="Mais opções">
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => setSyncOpen(true)}>
              <RefreshCwIcon className="size-4" />
              Sincronizar mensagens
            </DropdownMenuItem>

            {/* Mobile/tablet-only actions */}
            <div className="lg:hidden">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center justify-between gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex items-center gap-2">
                  <BotIcon className="size-4" />
                  IA do lead
                </span>
                <CheckIaLead
                  size="sm"
                  active={initialActive}
                  leadId={leadId}
                  trackingId={trackingId}
                />
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleFinishLead}
                disabled={statusFlow === "FINISHED" || mutation.isPending}
              >
                <CheckIcon className="size-4" />
                Finalizar atendimento
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onCloseChat}>
              <XIcon className="size-4" />
              Fechar conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
