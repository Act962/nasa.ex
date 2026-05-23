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
  RocketIcon,
  UserIcon,
  Sparkles,
  MessageCircle,
  Clock,
  CheckCircle2,
  GitBranch,
} from "lucide-react";

import { ListTags } from "./list-tags";
import { Badge } from "@/components/ui/badge";
import { MessageTypeIcon, getMessageTypeName } from "./message-type-icon";
import { useMutationMarkReadMessage } from "../hooks/use-messages";
import { SelectTrackingPopover } from "@/features/leads/components/lead-info/select-tracking-field";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
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
        className={`w-full group relative flex items-center space-x-3 p-3 bg-accent-foreground/2 hover:bg-accent-foreground/5 cursor-pointer rounded-lg transition  ${selected ? "bg-accent-foreground/5" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 overflow-hidden">
            <AvatarLead Lead={item.lead} />
            <div className="focus:outline-none">
              <div className="flex flex-col mb-1 max-w-full truncate">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium line-clamp-2">
                      {item.lead.name}
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
                <RocketIcon
                  className="size-3"
                  style={{
                    color: colorsByTemperature[item.lead.temperature].color,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{colorsByTemperature[item.lead.temperature].label}</p>
              </TooltipContent>
            </Tooltip>
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
