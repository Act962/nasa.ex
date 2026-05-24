"use client";

import type { Conversation, Lead } from "@/generated/prisma/client";
import { LeadSource } from "@/generated/prisma/enums";
import { format, isToday, isYesterday } from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { withSearchParams } from "../utils/url";
import { MouseEvent, useCallback, useState } from "react";
import { AvatarLead } from "./avatar-lead";
import { colorsByTemperature, LeadSourceColors } from "../utils/card-lead";
import {
  ArrowUpRightIcon,
  CalendarIcon,
  ClipboardListIcon,
  GlobeIcon,
  UserIcon,
  Sparkles,
  MessageCircle,
  Clock,
  CheckCircle2,
  GitBranch,
  Star,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ListTags } from "./list-tags";
import { Badge } from "@/components/ui/badge";
import { MessageTypeIcon, getMessageTypeName } from "./message-type-icon";
import { useMutationMarkReadMessage } from "../hooks/use-messages";
import { SelectTrackingPopover } from "@/features/leads/components/lead-info/select-tracking-field";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WhatsappIcon } from "@/components/whatsapp";
import type { LucideIcon } from "lucide-react";

const STATUS_FLOW_CONFIG: Record<
  string,
  { label: string; color: string; Icon: LucideIcon }
> = {
  NEW: { label: "Novo lead", color: "#8b5cf6", Icon: Sparkles },
  ACTIVE: { label: "Em atendimento", color: "#22c55e", Icon: MessageCircle },
  WAITING: { label: "Aguardando atendimento", color: "#f59e0b", Icon: Clock },
  FINISHED: { label: "Finalizado", color: "#6b7280", Icon: CheckCircle2 },
};
import { Instance } from "../types";
import { phoneMaskFull } from "@/utils/format-phone";

interface LeadBoxConversation extends Conversation {
  lead: Lead & {
    leadTags?: {
      tag: {
        id: string;
        name: string;
        color: string | null;
        slug: string;
      };
    }[];
  };
  lastMessage?: any;
}

interface UserBloxProps {
  item: LeadBoxConversation;
  lastMessage: {
    body: string | null;
    createdAt: Date | undefined;
    mimetype?: string | null;
    fileName?: string | null;
  } | null;
  instance?: Instance | null;
  unreadCount?: number;
}

export function LeadBox({
  item,
  lastMessage,
  instance,
  unreadCount,
}: UserBloxProps) {
  const router = useRouter();
  const { conversationId, trackingId } = useParams<{
    conversationId: string;
    trackingId?: string;
  }>();
  const searchParams = useSearchParams();
  const markRead = useMutationMarkReadMessage();
  // Popover de mover fluxo/tracking + status (alinhado ao "Detalhes do Lead").
  // O `useMutationLeadUpdate` já invalida `conversations.list[trackingId]`,
  // então o card some/aparece da lista automaticamente quando o fluxo muda.
  const [flowPopoverOpen, setFlowPopoverOpen] = useState(false);
  const updateLead = useMutationLeadUpdate(item.lead.id, item.lead.trackingId);

  const handleChangeFlow = (newTrackingId: string, newStatusId: string) => {
    updateLead.mutate(
      {
        id: item.lead.id,
        trackingId: newTrackingId,
        statusId: newStatusId,
      },
      {
        onSuccess: () => {
          setFlowPopoverOpen(false);
        },
      },
    );
  };

  const handleClick = useCallback(() => {
    const target = trackingId
      ? withSearchParams(item.id, searchParams)
      : withSearchParams(`/tracking-chat/${item.id}`, searchParams);
    router.push(target);
    if (unreadCount && unreadCount > 0 && instance?.token) {
      markRead.mutate({
        conversationId: item.id,
        remoteJid: item.remoteJid,
        token: instance.token,
      });
    }
  }, [router, item, unreadCount, instance, markRead, searchParams, trackingId]);

  const selected = item.id === conversationId;
  const hasSeen = !unreadCount || unreadCount === 0;

  const messageBody = lastMessage?.body?.split("*")[2] || lastMessage?.body;

  const goToLead = (e: any) => {
    e.stopPropagation();
    router.replace(`/contatos/${item.lead.id}`);
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={cn(
          // Card base — sempre aplica
          "w-full group relative flex items-center space-x-3 p-3 cursor-pointer rounded-lg transition",
          // Estado "selected" (conversa aberta no momento) reforçado:
          // background mais sólido + ring violeta sutil + sombra discreta.
          // O `pin-to-top` em `conversations-list.tsx` já garante que o card
          // selecionado vai pra primeira posição da lista.
          selected
            ? "bg-accent-foreground/10 ring-1 ring-violet-500/40 shadow-sm"
            : "bg-accent-foreground/2 hover:bg-accent-foreground/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Avatar com bolinha de temperatura sobreposta — mesmo
                pattern visual do card do kanban em /tracking. A
                bolinha fica no canto superior-esquerdo do avatar
                (z-10 pra ficar acima da foto + ring branco discreto
                pra contrastar com fotos escuras). Tooltip preserva
                acessibilidade. */}
            <div className="relative shrink-0">
              <AvatarLead Lead={item.lead} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-label={`Temperatura: ${colorsByTemperature[item.lead.temperature].label}`}
                    className="pointer-events-none absolute top-0.5 left-0.5 z-10 size-2 rounded-full ring-1 ring-background"
                    style={{
                      backgroundColor:
                        colorsByTemperature[item.lead.temperature].color,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{colorsByTemperature[item.lead.temperature].label}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="focus:outline-none">
              <div className="flex flex-col mb-1 max-w-full truncate">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium line-clamp-2 flex items-center gap-1.5">
                      {/* Badge "Grupo" + ícone quando a conversa é
                          um grupo do WhatsApp. Schema: `Conversation.isGroup`
                          (já existia) + `groupSubject` + `groupParticipantsCount`
                          (novos campos opcionais). Visual sutil — não ofusca o
                          nome do lead/grupo. */}
                      {/* NOTA: `groupSubject` e `groupParticipantsCount`
                          são fields novos no schema (precisam migrate +
                          `prisma generate` antes de typar). Cast pra
                          `any` enquanto isso — sem run-time cost. */}
                      {item.isGroup && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] px-1 py-0.5 font-semibold shrink-0"
                          title={
                            (item as any).groupParticipantsCount
                              ? `Grupo com ${(item as any).groupParticipantsCount} participantes`
                              : "Grupo do WhatsApp"
                          }
                        >
                          <UsersIcon className="size-2.5" /> Grupo
                        </span>
                      )}
                      {item.isGroup && (item as any).groupSubject
                        ? (item as any).groupSubject
                        : item.lead.name}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.lead.name}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-[10px] font-light text-muted-foreground line-clamp-1">
                  {phoneMaskFull(item.lead.phone)}
                </p>
              </div>

              {lastMessage && (
                <div className="flex items-center gap-1">
                  <div>
                    <MessageTypeIcon
                      mimetype={lastMessage.mimetype}
                      className="size-3 text-muted-foreground"
                    />
                  </div>
                  <p
                    className={`text-xs font-light line-clamp-1 ${
                      hasSeen ? "text-muted-foreground" : ""
                    }`}
                  >
                    {lastMessage.mimetype
                      ? getMessageTypeName(lastMessage.mimetype)
                      : messageBody}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-1">
            <ListTags
              tags={item.lead.leadTags}
              leadId={item.lead.id}
              trackingId={item.trackingId}
            />
          </div>
        </div>
        <div className="flex flex-col items-end justify-between h-full min-w-15 py-1">
          <div className="flex items-center gap-1">
            {/* Estrela de favoritar — visual igual ao pin do WhatsApp.
                FAVORITE no NASA hoje é uma tag com nome contendo "favorit"
                ou "star" (vide `conversation/list.ts` filtro
                `favoritesOnly`). O toggle real precisa achar/criar a tag
                e attach/detach do lead — vai numa sprint dedicada. Aqui
                é placeholder visual + toast "Em breve". */}
            <FavoriteStar
              isFavorite={isFavoriteLead(item.lead.leadTags)}
              onClick={(e) => {
                e.stopPropagation();
                toast.info(
                  "Em breve — favoritar conversa por aqui (use a tag 'Favoritas' por enquanto)",
                  { position: "bottom-right" },
                );
              }}
            />
            <p className="text-[10px] font-light">
              <FormatTime date={lastMessage?.createdAt || item.createdAt} />
            </p>
            <ArrowUpRightIcon
              onClick={goToLead}
              className="size-4 text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-x-1.5 h-full overflow-hidden">
            {unreadCount && unreadCount >= 1 ? (
              <Badge
                variant={"secondary"}
                className="text-[9px] h-5 bg-green-500 hover:bg-green-600 text-white border-none"
              >
                {unreadCount}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-x-2">
            {item.lead.statusFlow &&
              STATUS_FLOW_CONFIG[item.lead.statusFlow] &&
              (() => {
                const { label, color, Icon } =
                  STATUS_FLOW_CONFIG[item.lead.statusFlow];
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon className="size-3" style={{ color }} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <LeadSourceIcon
                    source={item.lead.source}
                    className="size-3 mr-1"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{LeadSourceColors[item.lead.source].label}</p>
              </TooltipContent>
            </Tooltip>
            {/* Trocar fluxo/tracking — abre o mesmo popover usado em
                "Detalhes do Lead". stopPropagation evita que o clique no
                ícone também acione o `handleClick` do card (que navega
                pra conversa). O `pointerdown` também é interceptado pra
                cobrir o disparo do Popover do Radix.
                NÃO uso `<Tooltip>` aqui porque o `PopoverTrigger asChild`
                já precisa do botão como child direto — wrapping em
                Tooltip quebra o anchor. `title` HTML nativo cobre o
                hint sem entrar em conflito. */}
            <SelectTrackingPopover
              currentTrackingId={item.lead.trackingId}
              currentStatusId={item.lead.statusId}
              onSubmit={handleChangeFlow}
              isLoading={updateLead.isPending}
              open={flowPopoverOpen}
              onOpenChange={setFlowPopoverOpen}
            >
              <button
                type="button"
                title="Trocar fluxo / tracking"
                aria-label="Trocar fluxo / tracking"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setFlowPopoverOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <GitBranch className="size-3" />
              </button>
            </SelectTrackingPopover>
          </div>
        </div>
      </div>
    </>
  );
}

function FormatTime({ date }: { date: Date }) {
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  return format(date, "dd/MM/yy");
}

/**
 * Heurística pra detectar se um lead já tem a tag "Favoritas". Bate com
 * a mesma lógica do filtro `favoritesOnly` em `conversation/list.ts` —
 * nome ou slug da tag contendo "favorit" ou "star" (case-insensitive).
 * Se o usuário cadastrou uma tag com outro nome (ex: "VIP"), não conta.
 */
function isFavoriteLead(
  leadTags?: { tag: { name: string; slug: string } }[] | null,
): boolean {
  if (!leadTags?.length) return false;
  return leadTags.some(({ tag }) => {
    const n = tag.name?.toLowerCase() ?? "";
    const s = tag.slug?.toLowerCase() ?? "";
    return /favorit|star/.test(n) || /favorit|star/.test(s);
  });
}

/**
 * Botão estrela posicionado ao lado da data — mesmo lugar do "pin" no
 * WhatsApp. Visual: estrela cheia amarela quando favoritada, contorno
 * cinza quando não. Click atual mostra toast "Em breve" — toggle real
 * vem em sprint dedicada (depende de adicionar mutation pra criar/anexar
 * tag "Favoritas" sob demanda).
 */
function FavoriteStar({
  isFavorite,
  onClick,
}: {
  isFavorite: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar conversa"}
      title={isFavorite ? "Favoritada" : "Favoritar"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="text-muted-foreground hover:text-amber-400 transition-colors"
    >
      <Star
        className={
          isFavorite
            ? "size-3.5 fill-amber-400 text-amber-400"
            : "size-3.5"
        }
      />
    </button>
  );
}

interface LeadSourceIconProps {
  source: LeadSource;
  className?: string;
}

export function LeadSourceIcon({
  source,
  className = "size-3",
}: LeadSourceIconProps) {
  switch (source) {
    case LeadSource.WHATSAPP:
      return <WhatsappIcon className={`${className} text-green-500`} />;
    case LeadSource.FORM:
      return <ClipboardListIcon className={`${className} text-blue-500`} />;
    case LeadSource.AGENDA:
      return <CalendarIcon className={`${className} text-orange-500`} />;
    case LeadSource.DEFAULT:
      return <UserIcon className={`${className} text-gray-400`} />;
    case LeadSource.OTHER:
      return <GlobeIcon className={`${className} text-purple-500`} />;
    default:
      return <UserIcon className={`${className} text-gray-400`} />;
  }
}
