"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CheckIcon,
  ClipboardList as ClipboardListIcon,
  Grip,
  Phone,
  PlusIcon,
  RocketIcon,
  Tag,
  Sparkles,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { Badge } from "@/components/ui/badge";
import { useQueryTagByLead } from "@/features/tracking-chat/hooks/use-leads-conversation";
import { Button } from "@/components/ui/button";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dayjs from "dayjs";
import { memo, useMemo, useState, useEffect } from "react";
import { Lead } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";

import { useLeadStore } from "../contexts/use-lead";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useQueryTags } from "@/features/tags/hooks/use-tags";
import { useParams, useRouter } from "next/navigation";
import {
  useAddTagsOptimistic,
  useRemoveTagOptimistic,
} from "../hooks/use-leads";
import { cn } from "@/lib/utils";
import { CheckIaLead } from "@/features/tracking-chat/components/check-ia-lead";
import { getContrastColor } from "@/utils/get-contrast-color";
import { Textarea } from "@/components/ui/textarea";
import { useView } from "../contexts/use-view";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { TagModal } from "@/features/trackings/components/modal/add-tag-sheet";
import { SlaTimer } from "@/features/leads/components/sla-timer";

const TEMP_COLOR = {
  COLD: "#3498db",
  WARM: "#f1c40f",
  HOT: "#e67e22",
  VERY_HOT: "#e74c3c",
} as const;

const TEMP_TEXT = {
  COLD: "Frio",
  WARM: "Quente",
  HOT: "Muito quente",
  VERY_HOT: "Extremamente quente",
} as const;

// Configuração de ícone de status do lead. O ícone "Em atendimento"
// (antigamente um MessageCircle) foi MESCLADO com o ícone de "Conversa"
// do detalhe do lead — agora o WhatsApp icon serve às duas funções:
//   1. Indicador visual do `statusFlow` (cor muda conforme estado).
//   2. Ação clicável: leva pro `/tracking-chat/<conversationId>` do lead.
// Os 4 estados continuam tendo seus respectivos labels/cores; o ícone
// principal (WhatsApp) é o mesmo, e os estados extremos (NEW/FINISHED)
// preservam ícones secundários quando úteis pra reconhecimento visual.
const STATUS_FLOW_CONFIG = {
  NEW: { label: "Novo lead", color: "#8b5cf6", Icon: Sparkles },
  ACTIVE: { label: "Em atendimento", color: "#22c55e", Icon: WhatsappIcon },
  WAITING: { label: "Aguardando atendimento", color: "#f59e0b", Icon: WhatsappIcon },
  FINISHED: { label: "Finalizado", color: "#6b7280", Icon: CheckCircle2 },
} as const;

export const LeadItem = memo(({ data }: { data: Lead }) => {
  const router = useRouter();
  const { toggleLead, isSelected } = useLeadStore();
  const selected = isSelected(data.id);
  const [description, setDescription] = useState(data.description);

  const debouncedDescription = useDebouncedValue(description, 1000);
  const mutation = useMutationLeadUpdate(data.id, data.trackingId);

  useEffect(() => {
    setDescription(data.description);
  }, [data.description]);

  useEffect(() => {
    if (
      debouncedDescription !== undefined &&
      debouncedDescription !== data.description
    ) {
      mutation.mutate({
        id: data.id,
        description: debouncedDescription || undefined,
      });
    }
  }, [debouncedDescription, data.id, data.description]);

  const { viewMode } = useView();

  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id: data.id,
    data: {
      type: "Lead",
      lead: data,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const url = useConstructUrl(data.profile || "");

  const handleSelect = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    toggleLead(data);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-lead-id={data.id}
      data-order={data.order}
      onClick={handleSelect}
      className={`border-2 text-sm bg-muted rounded-md shadow-sm group cursor-pointer transition-all overflow-hidden ${
        selected ? "border-primary/50" : "border-transparent hover:border-muted"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex flex-row items-center gap-2">
          <button
            className="touch-none group-hover:flex active:cursor-grabbing cursor-grab hidden"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()} // Evita selecionar ao clicar no grid de arrastar
          >
            <Grip className="size-4 " />
          </button>
          <Avatar
            className="size-4 group-hover:hidden touch-none"
            {...listeners}
            {...attributes}
          >
            <AvatarImage src={url} alt="photo user" />
            <AvatarFallback className="text-xs bg-foreground/10 ">
              {data.name.split(" ")[0][0]}
            </AvatarFallback>
          </Avatar>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-40 truncate">
                <span className="font-medium text-xs truncate">
                  {data.name || "Sem nome"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{data.name || "Sem nome"}</TooltipContent>
          </Tooltip>
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="rounded-full hover:opacity-80 transition-opacity"
            onClick={() => {
              router.push(`/contatos/${data.id}`);
            }}
            aria-label="Abrir detalhes do lead"
          >
            <ArrowUpRight className="size-3.5" />
          </button>
          <CheckIaLead
            size={"xs"}
            active={data.isActive}
            leadId={data.id}
            trackingId={data.trackingId}
          />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col px-4 gap-1 text-xs text-muted-foreground py-2">
        {/* E-mail removido do card por solicitação — fica visível apenas
            no painel "Detalhes do lead" pra deixar o card mais enxuto. */}
        <LeadItemContainer>
          <Phone className="size-3" />
          {phoneMaskFull(data.phone) || "(00) 00000-0000"}
        </LeadItemContainer>
        <LeadItemContainer className="items-baseline">
          <Tag className="size-3" />
          <ListLeadTags leadId={data.id} tags={data.leadTags} />
        </LeadItemContainer>
        {(data.description || description) && viewMode === "modern" && (
          <LeadItemContainer
            className="mt-2"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Textarea
              value={description || ""}
              onChange={(e) => setDescription(e.target.value)}
              className="h-auto text-xs! min-h-[40px] max-h-[60px] resize-none bg-transparent border-transparent! focus:border-transparent! focus:ring-transparent!"
              placeholder="Descrição..."
            />
          </LeadItemContainer>
        )}
      </div>
      <Separator />
      <div
        className="flex items-center justify-between bg-secondary px-3 py-2"
        {...listeners}
        {...attributes}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {dayjs(data.createdAt).format("DD/MM/YYYY HH:mm")}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <RocketIcon
                className="size-3"
                style={{ color: TEMP_COLOR[data.temperature] }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{TEMP_TEXT[data.temperature]}</p>
            </TooltipContent>
          </Tooltip>
          {data.slaDeadline && (
            <SlaTimer
              compact
              enteredAt={data.statusEnteredAt ?? data.createdAt}
              deadline={data.slaDeadline}
            />
          )}
          {data.statusFlow &&
            STATUS_FLOW_CONFIG[data.statusFlow] &&
            (() => {
              const { label, color, Icon } =
                STATUS_FLOW_CONFIG[data.statusFlow];
              const conversationId = data.conversation?.id;
              // Click direciona pro chat — substituiu o ícone "Em
              // atendimento" e mesclou a função do ícone de "Conversa"
              // do detalhe do lead.
              const goToChat = (e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                const path = `/tracking-chat/${conversationId ?? ""}`;
                router.push(
                  data.trackingId
                    ? `${path}?trackingId=${data.trackingId}`
                    : path,
                );
              };
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={goToChat}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      aria-label={`${label} — abrir conversa`}
                    >
                      <Icon className="size-3" style={{ color }} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {label}
                      {conversationId
                        ? " — clique para abrir a conversa"
                        : " — clique para iniciar uma conversa"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })()}

          {/* Ícones de formulário (1 por response) — cor reflete o estado:
              branco=iniciado, azul=em progresso, laranja=aguardando assinatura
              cliente, vermelho=stale ou aguardando responsável, verde=completo. */}
          {(data.forms ?? []).map((f) => (
            <FormStatusIcon key={f.responseId} form={f} leadId={data.id} />
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="size-4">
              <AvatarImage
                src={data.responsible?.image || "/user-placeholder.png"}
                alt="photo user"
              />
              <AvatarFallback>
                {data.responsible?.name.split(" ")[0][0]}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {data.responsible?.name || "Sem responsável"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

LeadItem.displayName = "LeadItem";

/**
 * Ícone de status do formulário no card do lead. Click direciona:
 *   - estado "empty" (branco) → tab Formulários do detalhe do lead.
 *   - demais estados → página de edição da resposta (`/formulario/<slug>/<id>`).
 *
 * O fetch dos dados (state, name, slug) já vem do `get-many` server-side,
 * então o render é puro e barato.
 */
function FormStatusIcon({
  form,
  leadId,
}: {
  form: NonNullable<Lead["forms"]>[number];
  leadId: string;
}) {
  const router = useRouter();
  const STATE_COLORS: Record<typeof form.state, string> = {
    empty: "#ffffff",
    in_progress: "#3b82f6",
    waiting_client_signature: "#f59e0b",
    stale: "#ef4444",
    complete: "#10b981",
  };
  const STATE_LABELS: Record<typeof form.state, string> = {
    empty: "Iniciado — sem respostas",
    in_progress: "Em preenchimento",
    waiting_client_signature: "Aguardando assinatura do cliente",
    stale: "Aguardando responsável (>24h ou assinatura)",
    complete: "Preenchido",
  };
  const color = STATE_COLORS[form.state];
  const stateLabel = STATE_LABELS[form.state];

  const goToForm = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (form.state === "empty") {
      // Branco → tab Formulários no detalhe do lead.
      router.push(`/contatos/${leadId}?tab=forms`);
    } else {
      // Demais estados → página de edição da resposta.
      router.push(`/formulario/${form.slug}/${form.responseId}`);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={goToForm}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
          aria-label={`Formulário "${form.formName}" — ${stateLabel}`}
        >
          {/* Ícone de prancheta colorido conforme o estado. Borda discreta
              pra branco ficar visível sobre fundo claro. */}
          <ClipboardListIcon
            className="size-3"
            style={{
              color,
              // Stroke escuro pra branco não desaparecer em fundo claro.
              filter:
                form.state === "empty"
                  ? "drop-shadow(0 0 0.5px rgba(0,0,0,0.6))"
                  : undefined,
            }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs flex flex-col">
          <strong>{form.formName}</strong>
          <span className="text-muted-foreground">{stateLabel}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LeadItemContainerProps extends React.ComponentProps<"div"> {}

function LeadItemContainer({ className, ...props }: LeadItemContainerProps) {
  return (
    <div
      className={cn(
        "flex flex-row gap-2 items-center min-w-0 truncate max-w-full",
        className,
      )}
      {...props}
    />
  );
}

function ListLeadTags({ leadId, tags }: { leadId: string; tags: any[] }) {
  const { tags: leadTags } = useQueryTagByLead(
    leadId,
    useMemo(() => tags.map((t) => t.tag), [tags]),
  );

  return (
    <div className="flex flex-wrap gap-1 w-full">
      {leadTags && leadTags.length > 0 && (
        <>
          {leadTags.slice(0, 8).map((tag) => (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <Badge
                  className="px-1 py-0 text-[10px] h-4 font-normal max-w-50 inline-block truncate"
                  style={{
                    backgroundColor: tag.color || "#000000",
                    color: getContrastColor(tag.color || "#000000"),
                  }}
                >
                  {tag.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{tag.name}</TooltipContent>
            </Tooltip>
          ))}
          {leadTags.length > 8 && (
            <Badge
              variant="outline"
              className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
            >
              +{leadTags.length - 8}
            </Badge>
          )}
        </>
      )}
      <AddTagsButton
        leadId={leadId}
        existingTagIds={leadTags?.map((lt) => lt.id) || []}
      />
    </div>
  );
}

function AddTagsButton({
  leadId,
  existingTagIds,
}: {
  leadId: string;
  existingTagIds: string[];
}) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [open, setOpen] = useState(false);
  const [openCreateTagSheet, setOpenCreateTagSheet] = useState(false);
  const { tags } = useQueryTags({ trackingId: "ALL" });

  const handleOpen = () => {
    setOpen(!open);
  };

  const addTags = useAddTagsOptimistic({ leadId, trackingId });
  const removeTags = useRemoveTagOptimistic({ leadId });

  const onSelectTag = (tagId: string) => {
    if (existingTagIds.includes(tagId)) {
      removeTags.mutate({ leadId, tagIds: [tagId] });
      return;
    }

    addTags.mutate(
      {
        leadId,
        tagIds: [tagId],
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  };

  const handleOpenCreateTagSheet = () => {
    setOpen(false);
    setOpenCreateTagSheet(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className="size-4 rounded-full focus-visible:ring-0"
          variant="outline"
        >
          <PlusIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Adicionar tags..." />
          <CommandList>
            <CommandEmpty>
              <span className="text-sm text-muted-foreground">
                Nenhuma tag encontrada
              </span>
            </CommandEmpty>
            <CommandGroup>
              {tags?.map((tag) => {
                const isTagSelected = existingTagIds.includes(tag.id);

                return (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.name}-${tag.id}`}
                    onSelect={() => onSelectTag(tag.id)}
                    className="cursor-pointer"
                  >
                    <Tag
                      className="mr-2 size-3.5"
                      style={{ color: tag.color || "", fill: tag.color || "" }}
                    />
                    <span>{tag.name}</span>
                    {isTagSelected && <CheckIcon className="ml-auto size-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={handleOpenCreateTagSheet}
                className="cursor-pointer"
              >
                <PlusIcon className="size-3.5" />
                <span>Criar nova tag</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      <TagModal
        open={openCreateTagSheet}
        onOpenChange={setOpenCreateTagSheet}
        trackingId={trackingId}
      />
    </Popover>
  );
}
