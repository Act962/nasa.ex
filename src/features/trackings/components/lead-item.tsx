"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CalendarClock,
  CheckIcon,
  ClipboardList as ClipboardListIcon,
  Grip,
  Phone,
  PlusIcon,
  Tag,
  Sparkles,
  Clock,
  CheckCircle2,
  Timer,
  TimerOff,
} from "lucide-react";
import { formatTimeUntil } from "@/features/form/lib/extract-deadline";
import { WhatsappIcon } from "@/components/whatsapp";
import { Badge } from "@/components/ui/badge";
import { useQueryTagByLead } from "@/features/tracking-chat/hooks/use-leads-conversation";
import { Button } from "@/components/ui/button";
import { phoneMaskFull } from "@/utils/format-phone";
import dayjs from "dayjs";
import { memo, useMemo, useState, useEffect } from "react";
import { Lead } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";

import { useLeadStore } from "../contexts/use-lead";
import { useKanbanStore } from "../lib/kanban-store";
import { useKanbanAppearance } from "../hooks/use-kanban-appearance";
import { hexToRgba } from "@/utils/hex-to-rgba";
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
import { useTags } from "@/features/tags/hooks/use-tags";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { TagSheet } from "@/features/tags/components/tag-sheet";
import { SlaTimer } from "@/features/leads/components/sla-timer";
import { LeadFormsDialog } from "@/features/leads/components/lead-forms-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  WAITING: {
    label: "Aguardando atendimento",
    color: "#f59e0b",
    Icon: WhatsappIcon,
  },
  FINISHED: { label: "Finalizado", color: "#6b7280", Icon: CheckCircle2 },
} as const;

export const LeadItem = memo(({ data }: { data: Lead }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = useLeadStore((s) => s.selectedLeads.some((l) => l.id === data.id));
  const toggleLead = useLeadStore((s) => s.toggleLead);

  // Dialog "Formulários do lead" — estado **derivado do URL** (search
  // param `leadForms=<id>`). Isso integra o open/close com o history
  // do browser: quando o user clica num card e navega pra /formulario,
  // o `?leadForms=<id>` fica no histórico. Ao clicar "Voltar" na página
  // do formulário (`router.back()`), o browser volta pra esta URL e o
  // dialog reabre automaticamente.
  const formsDialogOpen = searchParams.get("leadForms") === data.id;
  const setFormsDialogOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set("leadForms", data.id);
    } else {
      params.delete("leadForms");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
  // Sort ativo dita qual data o card exibe (createdAt / updatedAt /
  // statusEnteredAt). Para sort=order (Personalizada), usa statusEnteredAt.
  const sortBy = useKanbanStore((s) => s.sortBy);
  // Cores customizadas do card no kanban (Configurações → Personalização).
  // Hook cacheia 5min e dedupa entre cards/colunas — sem custo de rede.
  const { data: appearance } = useKanbanAppearance(data.trackingId);
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
    // Bloqueia o click que o browser dispara no DragOverlay após o pointerup:
    // o activeDragLeadId ainda está setado neste momento (é limpo num setTimeout
    // em onDragEnd, que roda no próximo task JS — depois deste click).
    if (useKanbanStore.getState().activeDragLeadId) return;
    if ((e.target as HTMLElement).closest("a")) return;
    toggleLead(data);
  };

  return (
    <div
      ref={setNodeRef}
      data-lead-id={data.id}
      data-order={data.order}
      onClick={handleSelect}
      className={cn(
        // `bg-muted` é o default — sobrescrito por `kanbanCardBackgroundColor`
        // via style inline. Contorno: `border-primary/50` quando selecionado
        // sempre prevalece; senão usa cor configurada OU transparente.
        // isDragging=true → este card é o placeholder do dnd-kit (ghost),
        // forçamos border-transparent para o fantasma ficar limpo.
        "relative w-full min-w-0 max-w-full border-2 text-sm rounded-md shadow-sm group cursor-pointer transition-all overflow-hidden",
        !appearance?.kanbanCardBackgroundColor && "bg-muted",
        selected
          ? "border-primary/50"
          : isDragging
            ? "border-transparent"
            : !appearance?.kanbanCardBorderColor && "border-transparent hover:border-muted",
      )}
      style={{
        ...style,
        ...(appearance?.kanbanCardBackgroundColor && {
          backgroundColor:
            hexToRgba(
              appearance.kanbanCardBackgroundColor,
              appearance.kanbanCardBackgroundOpacity ?? 100,
            ) ?? appearance.kanbanCardBackgroundColor,
        }),
        ...(!isDragging && !selected && appearance?.kanbanCardBorderColor
          ? { borderColor: appearance.kanbanCardBorderColor }
          : {}),
      }}
    >
      {/* Bolinha de temperatura — substitui a barra lateral de 1px.
          ~30% do tamanho do avatar (size-4 = 16px → size-1.5 = 6px).
          Posicionada mais pra fora (em cima do contorno esquerdo), mas
          ainda com uma parte por cima da foto. Sem ring/halo — visual
          mais limpo. `pointer-events-none` pra não bloquear drag/click. */}
      <span
        aria-label={`Temperatura: ${TEMP_TEXT[data.temperature]}`}
        title={TEMP_TEXT[data.temperature]}
        className="pointer-events-none absolute z-10 size-1.5 rounded-full"
        style={{
          backgroundColor: TEMP_COLOR[data.temperature],
          top: "13px",
          left: "7px",
        }}
      />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {/* Container esquerdo: `min-w-0 flex-1` é essencial pra que o nome
            + pill de apelido respeitem o truncate e não empurrem a largura
            do card. Sem isso, flex-children "esticam" pelo conteúdo. */}
        <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
          <button
            className="shrink-0 touch-none flex lg:hidden lg:group-hover:flex active:cursor-grabbing cursor-grab"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()} // Evita selecionar ao clicar no grid de arrastar
          >
            <Grip className="size-4 " />
          </button>
          <Avatar
            className="shrink-0 size-4 hidden lg:block lg:group-hover:hidden touch-none"
            {...listeners}
            {...attributes}
          >
            <AvatarImage src={url} alt="photo user" />
            <AvatarFallback className="text-xs bg-foreground/10 ">
              {data.name.split(" ")[0][0]}
            </AvatarFallback>
          </Avatar>
          <div
            className="flex min-w-0 flex-1 items-center gap-1.5"
            title={
              data.nickname
                ? `${data.name || "Sem nome"} (${data.nickname})`
                : data.name || "Sem nome"
            }
          >
            {/* Nome: `min-w-0 flex-1 truncate` em vez de `max-w-32` fixo.
                Assim o nome cede espaço pra pill do apelido (e pros action
                buttons à direita) sem empurrar a largura do card. */}
            <span className="min-w-0 flex-1 truncate max-w-[9rem] text-xs font-medium">
              {data.name || "Sem nome"}
            </span>
            {data.nickname && (
              // Pill de apelido — mesmo visual do botão "+" de adicionar
              // tag (`variant="outline"` + rounded-full). `shrink-0` + cap
              // de 80px pra não engolir o nome inteiro quando o apelido é
              // grande.
              <span className="inline-flex h-4 shrink-0 max-w-[80px] items-center truncate rounded-full border border-input bg-background px-1.5 text-[10px] leading-none text-muted-foreground">
                {data.nickname}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity rounded-full"
            onClick={(e) => {
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
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {(() => {
            // A data exibida acompanha o sort ativo — assim o usuário sempre
            // vê o critério que está usando pra ordenar (sem precisar abrir
            // o lead). Quando sort = "order" (Personalizada), mostra
            // statusEnteredAt como default (padrão acordado).
            const sourceDate =
              sortBy === "createdAt"
                ? data.createdAt
                : sortBy === "updatedAt"
                  ? data.updatedAt ?? data.createdAt
                  : data.statusEnteredAt ?? data.createdAt;
            const label =
              sortBy === "createdAt"
                ? "Chegou em"
                : sortBy === "updatedAt"
                  ? "Última interação em"
                  : "Entrou nesta etapa em";
            const d = dayjs(sourceDate);
            // Ano atual → omite YYYY (compacto: "DD/MM - HH:mm").
            // Outro ano → mostra ano abreviado YY: "DD/MM/YY - HH:mm".
            const fmt =
              d.year() === dayjs().year()
                ? "DD/MM - HH:mm"
                : "DD/MM/YY - HH:mm";
            return (
              <span
                className="text-[10px] text-muted-foreground tabular-nums shrink-0"
                title={`${label} ${d.format("DD/MM/YYYY HH:mm")}`}
              >
                {d.format(fmt)}
              </span>
            );
          })()}
          {/* SLA da etapa só aparece quando NÃO há prazo de formulário
              ativo (`deadlineHint`). Form deadline tem prioridade —
              evita 2 contadores empilhados no rodapé do card disputando
              atenção. */}
          {data.slaDeadline && !data.deadlineHint && (
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
                // `pin=1` sinaliza pra `conversations-list.tsx` que essa
                // navegação veio do ícone de canal do kanban — única origem
                // que dá "subida pro topo" (UX request). Clicar num LeadBox
                // direto na lista NÃO adiciona esse param → ordem natural
                // permanece.
                const path = `/tracking-chat/${conversationId ?? ""}`;
                const params = new URLSearchParams();
                if (data.trackingId) params.set("trackingId", data.trackingId);
                params.set("pin", "1");
                router.push(`${path}?${params.toString()}`);
              };
              return (
                <button
                  type="button"
                  onClick={goToChat}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                  aria-label={`${label} — abrir conversa`}
                  title={`${label}${
                    conversationId
                      ? " — clique para abrir a conversa"
                      : " — clique para iniciar uma conversa"
                  }`}
                >
                  <Icon className="size-3" style={{ color }} />
                </button>
              );
            })()}

          {/* Ícone único de formulários do lead (não mais 1 por response).
              Cor reflete estado AGREGADO: vermelho (stale), laranja
              (aguarda assinatura), azul (em progresso), verde (completo),
              ou muted (igual à data) quando lead não tem nenhum form
              preenchido nem em andamento. */}
          <FormStatusIcon
            forms={data.forms ?? []}
            onOpenForms={() => setFormsDialogOpen(true)}
          />

          {/* Próximo agendamento (Agenda ou agenda do chat). Compact: só
              ícone azul; tooltip nativo do title mostra data + hora + nome
              da agenda. Não quebra largura do card — ocupa 12px (size-3),
              mesma proporção dos outros ícones do footer. */}
          {data.nextAppointment && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
              title={`${dayjs(data.nextAppointment.startsAt).format("DD/MM HH:mm")} — ${
                data.nextAppointment.agendaName
              }${
                data.nextAppointment.title
                  ? ` (${data.nextAppointment.title})`
                  : ""
              }`}
            >
              <CalendarClock className="size-3 shrink-0" />
              <span className="tabular-nums">
                {dayjs(data.nextAppointment.startsAt).format("DD/MM HH:mm")}
              </span>
            </span>
          )}

          {/* Prazo mais urgente entre todos os forms do lead.
              `data.deadlineHint` é computado server-side a partir do
              DatePicker marcado com `useAsDeadline=true`. Substitui o
              que iria pra "Observações" (decisão de design: campo
              separado, sem mexer em description). */}
          {data.deadlineHint && (
            <DeadlineBadge hint={data.deadlineHint} />
          )}
        </div>
        <span title={data.responsible?.name || "Sem responsável"}>
          <Avatar className="size-4">
            <AvatarImage
              src={data.responsible?.image || "/user-placeholder.png"}
              alt="photo user"
            />
            <AvatarFallback>
              {data.responsible?.name.split(" ")[0][0]}
            </AvatarFallback>
          </Avatar>
        </span>
      </div>

      {/* Dialog "Formulários do lead" — 95vw, grid 3 cols. Abre ao clicar
          em qualquer ícone de form do rodapé do card. */}
      <LeadFormsDialog
        leadId={data.id}
        leadName={data.name}
        open={formsDialogOpen}
        onOpenChange={setFormsDialogOpen}
      />
    </div>
  );
}, (prev, next) => {
  // Custom equality: skip render quando o conteúdo do lead é idêntico
  // por valor (não apenas por referência). Isso é crítico durante drag
  // cross-coluna: moveLeadToColumn cria { ...lead, statusId: novoCol }
  // que é nova ref mas com mesmo conteúdo visual após primeira move.
  // Sem isso, cada onDragOver dispara re-render do LeadItem, que cascateia
  // em ref churn dos Radix internos (Switch, Popover, etc.) → loop.
  if (prev.data === next.data) return true;
  return JSON.stringify(prev.data) === JSON.stringify(next.data);
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
type FormState = NonNullable<Lead["forms"]>[number]["state"];

/**
 * Ícone único de formulários do lead — mostra o estado AGREGADO de
 * todos os forms do lead num único ícone. Antes (legado) renderizávamos
 * 1 por response — virou poluído quando lead tinha vários forms.
 *
 * Cor por prioridade (mais "urgente" primeiro):
 *   1. **stale** (vermelho) — algum form esperando responsável >24h
 *   2. **waiting_client_signature** (laranja) — algum aguarda assinatura
 *   3. **in_progress** (azul) — algum em preenchimento
 *   4. **complete** (verde) — algum preenchido
 *   5. **muted** (text-muted-foreground, igual à data) — só `empty` ou
 *      sem forms. Tom neutro pra não competir com elementos com ação.
 *
 * Click em qualquer estado abre o dialog "Formulários do lead".
 */
function FormStatusIcon({
  forms,
  onOpenForms,
}: {
  forms: NonNullable<Lead["forms"]>;
  onOpenForms: () => void;
}) {
  // Conta por estado pra montar tooltip resumido.
  const counts = forms.reduce(
    (acc, f) => {
      acc[f.state] = (acc[f.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<FormState, number>,
  );

  // Prioridade do estado agregado. `null` = muted (cor do texto neutro).
  const aggregateState: FormState | "muted" = (() => {
    if (counts.stale) return "stale";
    if (counts.waiting_client_signature) return "waiting_client_signature";
    if (counts.in_progress) return "in_progress";
    if (counts.complete) return "complete";
    return "muted";
  })();

  // Tooltip — descreve sumário não-vazio
  const tooltip = (() => {
    if (forms.length === 0) return "Nenhum formulário vinculado";
    const parts: string[] = [];
    if (counts.complete) parts.push(`${counts.complete} preenchido${counts.complete > 1 ? "s" : ""}`);
    if (counts.in_progress) parts.push(`${counts.in_progress} em andamento`);
    if (counts.waiting_client_signature)
      parts.push(`${counts.waiting_client_signature} aguardando assinatura`);
    if (counts.stale) parts.push(`${counts.stale} aguardando responsável`);
    if (counts.empty && parts.length === 0)
      parts.push(`${counts.empty} ainda não iniciado${counts.empty > 1 ? "s" : ""}`);
    const total = `${forms.length} formulário${forms.length > 1 ? "s" : ""}`;
    return parts.length > 0 ? `${total} — ${parts.join(", ")}` : total;
  })();

  const STATE_COLORS: Record<Exclude<FormState | "muted", "empty" | "muted">, string> = {
    in_progress: "#3b82f6",
    waiting_client_signature: "#f59e0b",
    stale: "#ef4444",
    complete: "#10b981",
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpenForms();
  };

  const useMutedColor = aggregateState === "muted";

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer",
        // Muted = cor do texto neutro (mesma da data). Não inline color.
        useMutedColor && "text-muted-foreground",
      )}
      aria-label={`Formulários — ${tooltip}`}
      title={tooltip}
    >
      <ClipboardListIcon
        className="size-3"
        style={
          useMutedColor
            ? undefined
            : {
                color: STATE_COLORS[aggregateState as keyof typeof STATE_COLORS],
              }
        }
      />
    </button>
  );
}

/**
 * Badge compacto que mostra o tempo restante (ou ultrapassado) do prazo
 * mais urgente entre os formulários do lead. Substitui a ideia de
 * "escrever no campo Observações" — campo separado (`deadlineHint`)
 * é mais limpo e atualiza em tempo real via Pusher sem corromper o
 * texto editável pelo user.
 *
 * Layout idêntico ao `SlaTimer` (mesmo padding, mesma rounded, mesma
 * paleta 3 cores — green/yellow/red — Timer/TimerOff). Mantém a unidade
 * visual no rodapé do card: SLA da etapa e prazo do form usam o mesmo
 * estilo, mas só um deles aparece por vez (prazo do form prevalece via
 * condição em `slaDeadline && !deadlineHint`).
 */
function DeadlineBadge({
  hint,
}: {
  hint: NonNullable<Lead["deadlineHint"]>;
}) {
  // Tick a cada 30s — suficiente pra mostrar "Faltam Xd Yh" se atualizando.
  // Card do kanban tem muitos leads visíveis ao mesmo tempo; 1s por badge
  // ficaria pesado.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  const info = formatTimeUntil(new Date(hint.deadline), { compact: true });
  const full = formatTimeUntil(new Date(hint.deadline));
  if (!info) return null;

  // Mapeia o tier do `formatTimeUntil` (4 níveis) pras 3 cores do SLA:
  // expired → vermelho, urgent + warning → amarelo, safe → verde.
  // Mesmas classes Tailwind do `slaBadgeColor()` pra que SLA e prazo
  // tenham EXATAMENTE o mesmo visual no card.
  const isBreached = info.tier === "expired";
  const colorClass = isBreached
    ? "bg-red-500/15 text-red-700 border-red-500/30"
    : info.tier === "urgent" || info.tier === "warning"
      ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30"
      : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  const Icon = isBreached ? TimerOff : Timer;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          onPointerDown={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 rounded border px-1.5 text-[10px] py-0 ${colorClass}`}
        >
          <Icon className="w-3 h-3" />
          <span className="font-medium">{info.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs flex flex-col">
          <strong>{hint.formName}</strong>
          <span>{full?.label}</span>
          <span className="text-muted-foreground">
            Prazo: {new Date(hint.deadline).toLocaleString("pt-BR")}
          </span>
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
            <Badge
              key={tag.id}
              title={tag.name}
              className="px-1 py-0 text-[10px] h-4 font-normal max-w-[5.5rem] inline-block truncate"
              style={{
                backgroundColor: tag.color || "#000000",
                color: getContrastColor(tag.color || "#000000"),
              }}
            >
              {tag.name}
            </Badge>
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
  const { tags } = useTags({ trackingId: "ALL" });

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
      <TagSheet
        open={openCreateTagSheet}
        onOpenChange={setOpenCreateTagSheet}
        trackingId={trackingId}
      />
    </Popover>
  );
}
