"use client";

import type { Conversation, Lead } from "@/generated/prisma/client";
import { LeadSource } from "@/generated/prisma/enums";
import { format, isToday, isYesterday } from "date-fns";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { getMessagePreview } from "./message-preview";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

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
  const qc = useQueryClient();

  // Toggle de favorito — anexa/destaca a tag canônica "Favoritas" do lead.
  // O backend (leads.toggleFavorite) trata create-on-demand da tag, dedup
  // de variantes ("VIP Stars" etc.) e logActivity. UI invalida a lista de
  // conversas pra refletir o estado novo (e respeitar filtro "Favoritas").
  const favoriteMutation = useMutation(
    orpc.leads.toggleFavorite.mutationOptions({
      onSuccess: (res) => {
        toast.success(
          res.isFavorite ? "Lead favoritado" : "Removido dos favoritos",
          { position: "bottom-right" },
        );
        qc.invalidateQueries({ queryKey: ["conversations.list"] });
        qc.invalidateQueries({ queryKey: orpc.leads.list.queryKey() });
      },
      onError: () => {
        toast.error("Não foi possível favoritar agora — tente novamente.", {
          position: "bottom-right",
        });
      },
    }),
  );

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
    // IMPORTANTE: limpa `pin=1` ao navegar entre LeadBoxes. Esse param só
    // deve ficar setado quando vier do ícone do canal no kanban (UX: pin-
    // to-top é exclusivo desse caminho). Sem essa limpeza, navegando de
    // uma conversa pra outra dentro de /tracking-chat herdaria o pin
    // anterior e subiria todas que o user abrisse.
    const cleanParams = new URLSearchParams(searchParams.toString());
    cleanParams.delete("pin");
    const qs = cleanParams.toString();
    const basePath = trackingId ? item.id : `/tracking-chat/${item.id}`;
    const target = qs ? `${basePath}?${qs}` : basePath;
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
          selected
            ? "bg-accent-foreground/10 shadow-sm"
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
              {/* Pra grupos, a foto está em `conversation.profilePicUrl`
                  (não em `lead.profile`). Pra contatos individuais,
                  geralmente ambos estão preenchidos. Faz fallback aqui
                  pra garantir que grupos mostrem a foto. */}
              <AvatarLead
                Lead={{
                  ...item.lead,
                  profile:
                    item.lead.profile ??
                    (item.profilePicUrl as string | null | undefined) ??
                    null,
                }}
              />
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
                    <p
                      className={cn(
                        "text-sm font-medium line-clamp-2 flex items-center gap-1.5",
                        // Leads arquivados aparecem em busca com nome em
                        // VERMELHO — visualmente distintos dos ativos
                        // pra usuário saber "esse aqui está arquivado".
                        item.lead.isArchived && "text-red-500",
                      )}
                    >
                      {/* Badge "Arquivado" — aparece quando o lead foi
                          arquivado. Em modo padrão ele nem aparece na
                          lista; mas no filtro "Arquivados" OU em busca
                          (search field) ele aparece — daí o badge. */}
                      {item.lead.isArchived && (
                        <span className="inline-flex items-center rounded bg-red-500/15 text-red-600 dark:text-red-300 text-[9px] px-1 py-0.5 font-semibold shrink-0">
                          Arquivado
                        </span>
                      )}
                      {/* Badge "Grupo" + ícone quando a conversa é
                          um grupo do WhatsApp. Schema: `Conversation.isGroup`
                          (já existia) + `groupSubject` + `groupParticipantsCount`
                          (novos campos opcionais). Visual sutil — não ofusca o
                          nome do lead/grupo. */}
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
                {/* Telefone removido — WhatsApp não mostra abaixo do
                    nome. Se precisar consultar, fica no header da
                    conversa + popover de detalhes do lead. */}
              </div>

              {lastMessage && (() => {
                // Preview unificado: cobre ligação (perdida ou normal),
                // mensagem apagada, foto/áudio/vídeo/figurinha/arquivo,
                // localização, contato e texto puro (com emojis).
                const preview = getMessagePreview(lastMessage);
                const Icon = preview.icon;
                return (
                  <div className="flex items-center gap-1">
                    {Icon && (
                      <Icon
                        className={cn(
                          "size-3 shrink-0",
                          preview.danger
                            ? "text-red-500"
                            : "text-muted-foreground",
                        )}
                      />
                    )}
                    <p
                      className={cn(
                        "text-xs font-light line-clamp-1",
                        preview.italic && "italic",
                        preview.danger
                          ? "text-red-500"
                          : hasSeen
                            ? "text-muted-foreground"
                            : "",
                      )}
                    >
                      {preview.label}
                    </p>
                  </div>
                );
              })()}
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
                FAVORITE no NASA é uma tag canônica "Favoritas" (slug
                `favoritas`) anexada ao lead. Mesma heurística do filtro
                `favoritesOnly` em `conversation/list.ts`. O toggle real
                chama `leads.toggleFavorite` (create-on-demand da tag +
                logActivity no backend). */}
            <FavoriteStar
              isFavorite={isFavoriteLead(item.lead.leadTags)}
              disabled={favoriteMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                favoriteMutation.mutate({ leadId: item.lead.id });
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
  disabled,
}: {
  isFavorite: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar conversa"}
      title={isFavorite ? "Favoritada" : "Favoritar"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
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
