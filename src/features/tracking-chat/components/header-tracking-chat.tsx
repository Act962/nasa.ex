"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConstructUrl } from "@/hooks/use-construct-url";
import {
  ArchiveIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  LandmarkIcon,
  PhoneIcon,
  RefreshCwIcon,
  SparklesIcon,
  VideoIcon,
  XIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { dialPhone } from "../utils/dial-phone";
import Link from "next/link";
import { SummerizeConversation } from "./summerize-conversation";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { withSearchParams } from "../utils/url";
import { CheckIaLead } from "./check-ia-lead";
import { AttendanceStateBadge } from "./attendance-state-badge";
import {
  IS_LEAD_AI_PAUSE_ENABLED,
  isLeadAiPaused,
} from "@/features/tracking-chat-ai/lib/lead-ai-pause";
import { StatusFlow } from "@/generated/prisma/enums";
import { useMutationRodizio } from "../hooks/use-rodizio";
import { SyncMessagesButton } from "./sync-messages-button";
import { InChatStatusBadge } from "./in-chat-status-badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { HeatRing } from "@/features/leads/components/lead-audit/heat-ring";
import { useLeadDetailsStore } from "./lead-sidebar/use-lead-details-store";
import type { HeatLevel } from "@/features/leads/components/lead-audit/lead-heat";
import { SeiLeadProcessDialog } from "@/features/sei/components/lead-process-dialog";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { cn } from "@/lib/utils";
import { useResizeObserver } from "usehooks-ts";

// Abaixo disso (lateral do lead aberta, tablet, celular) os botões da barra vão para o menu "⋮".
const MIN_HEADER_WIDTH_FOR_INLINE_ACTIONS_PX = 448;
// Selo de atendimento ou botão da IA, quando aparecem na barra.
const AI_CONTROL_WIDTH_PX = 224;

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
  leadId: string;
  conversationId: string;
  active: boolean;
  trackingId: string;
  statusFlow: StatusFlow;
  /** Estado de atendimento automático (spec 0113): mostra o estado no lugar do botão da IA. */
  isAttendanceManaged?: boolean;
  /** Nome do tracking (ex: "2. Orçamento") — exibido como breadcrumb no
   *  header, ao lado do nome do lead. */
  trackingName?: string | null;
  /** Nome do status atual do lead (ex: "Aguardando Análise"). */
  statusName?: string | null;
  /** Temperatura do lead para o anel da foto (mesmo da lista de conversas). */
  heat?: { score: number; level: HeatLevel } | null;
}

export function Header({
  name,
  profile,
  phone,
  leadId,
  conversationId,
  active: initialActive,
  isAttendanceManaged = false,
  trackingId,
  statusFlow,
  trackingName,
  statusName,
  heat,
}: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Dentro do tracking a barra dele (NavTracking) já tem o botão de tela cheia.
  const isInsideTrackingNav = usePathname().startsWith("/tracking/");
  const profileUrl = useConstructUrl(profile || "");
  const mutation = useMutationRodizio(conversationId);
  const qc = useQueryClient();
  const [syncOpen, setSyncOpen] = useState(false);
  // Estado controlado do Resumo: o item "Resumo" do dropdown "..." abre o Popover.
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Aberto com o menu ainda montado, o painel perde o foco para ele e fecha na hora:
  // o item só marca o pedido, e o painel abre quando o menu termina de fechar.
  const shouldOpenSummaryRef = useRef(false);
  const [seiOpen, setSeiOpen] = useState(false);
  const updateLead = useMutationLeadUpdate(leadId, trackingId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Esc tira o foco do input; o blur precisa saber que é para descartar, não salvar.
  const shouldDiscardNameRef = useRef(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const { width: headerWidth } = useResizeObserver({
    ref: headerRef as React.RefObject<HTMLDivElement>,
  });
  const hasAiControl = isAttendanceManaged || IS_LEAD_AI_PAUSE_ENABLED;
  const minWidthForInlineActions =
    MIN_HEADER_WIDTH_FOR_INLINE_ACTIONS_PX +
    (hasAiControl ? AI_CONTROL_WIDTH_PX : 0);
  const isCompactHeader =
    headerWidth !== undefined && headerWidth < minWidthForInlineActions;

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const handleSaveName = () => {
    const trimmedName = draftName.trim();
    if (shouldDiscardNameRef.current || !trimmedName || trimmedName === name) {
      shouldDiscardNameRef.current = false;
      setDraftName(name);
      setIsEditingName(false);
      return;
    }
    updateLead.mutate(
      { id: leadId, name: trimmedName },
      {
        onSuccess: () => {
          setDraftName(trimmedName);
          setIsEditingName(false);
        },
        onError: () => {
          setDraftName(name);
          setIsEditingName(false);
        },
      },
    );
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") shouldDiscardNameRef.current = true;
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const backHref = withSearchParams(`/tracking-chat`, searchParams);
  const openLeadDetails = useLeadDetailsStore((state) => state.requestOpen);
  // Com a lateral do lead aberta, a tela cheia mora no topo dela.
  const isLeadDetailsCollapsed = useLeadDetailsStore((state) => state.isDesktopCollapsed);

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
        const w = window.open(
          consultorCallPath,
          "_blank",
          "noopener,noreferrer",
        );
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
      appOrigin:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
  };
  const videoCallPending = videoCall.isPending;

  // Arquivar lead = sai da lista padrão do /tracking-chat. Só visível
  // depois no filtro "Arquivados" da sidebar. Reversível via `Desarquivar`
  // no menu de /contatos.
  const setArchived = useMutation(
    orpc.leads.setArchived.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Lead arquivado — visível agora só no filtro 'Arquivados'.",
        );
        // Invalida `conversations.list` pra a sidebar refletir o lead
        // sumindo da lista padrão. Sem isso, o cache do TanStack Query
        // continua mostrando a conversa arquivada até a próxima refetch.
        qc.invalidateQueries({ queryKey: ["conversations.list"] });
        // Também invalida leads.list pra atualizar /contatos com o badge
        qc.invalidateQueries({
          queryKey: orpc.leads.list.queryKey(),
        });
        // Volta pra lista de conversas (sai da conversa arquivada)
        router.push(backHref);
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Falha ao arquivar o lead"),
    }),
  );

  const handleArchiveLead = () => {
    setArchived.mutate({ leadId, isArchived: true });
  };

  return (
    // Header com fundo opaco do tema (bg-background) — independente de
    // qualquer customização do chat por baixo, garante contraste correto
    // do texto em Claro/Escuro. text-foreground força a cor seguir o tema.
    <div
      ref={headerRef}
      className="bg-background text-foreground w-full flex gap-3 sm:px-4 py-3 px-4 lg:px-6 justify-between items-center"
    >
      <div className="flex gap-2 items-center min-w-0">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="shrink-0 lg:hidden"
        >
          <Link href={backHref} aria-label="Voltar para as conversas">
            <ArrowLeftIcon className="size-5" />
          </Link>
        </Button>
        <button
          type="button"
          onClick={openLeadDetails}
          aria-label="Abrir detalhes do lead"
          className="relative shrink-0 rounded-full"
        >
          <HeatRing size={44} variant="color" heat={heat ?? null}>
            <Avatar className="size-full">
              <AvatarImage src={profileUrl} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </HeatRing>
        </button>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                disabled={updateLead.isPending}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleNameKeyDown}
                aria-label="Nome do lead"
                className="h-7 w-64 max-w-full px-2 font-medium"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                title="Clique para editar o nome"
                className="text-foreground hover:underline underline-offset-3 truncate font-medium text-left cursor-text"
              >
                {draftName || "Sem nome"}
              </button>
            )}
            <InChatStatusBadge trackingId={trackingId} />
          </div>
          {/* Breadcrumb tracking > status — substitui o telefone que
              ficava aqui. WhatsApp não mostra telefone abaixo do nome;
              em troca colocamos o caminho do lead no funil (visível e
              acionável: leva pro tracking dele). */}
          {(trackingName || statusName) && (
            <Link
              href={withSearchParams(`/tracking/${trackingId}`, searchParams)}
              className="text-xs font-light text-foreground/50 hover:text-foreground/70 transition-colors flex items-center gap-1 truncate"
              title={`Ir pro tracking "${trackingName ?? ""}"`}
            >
              {trackingName && (
                <span className="truncate max-w-[140px]">{trackingName}</span>
              )}
              {trackingName && statusName && (
                <ChevronRightIcon className="size-3 shrink-0 opacity-60" />
              )}
              {statusName && (
                <span className="truncate max-w-[160px]">{statusName}</span>
              )}
            </Link>
          )}
        </div>
      </div>
      {/* No header estreito o "⋮" sai enquanto o nome é editado, para o campo ter largura. */}
      <div
        className={cn(
          "flex items-center gap-2 lg:gap-4",
          isEditingName && isCompactHeader && "hidden",
        )}
      >
        {/* Os ícones de ligação (telefone + vídeo) saíram da barra
            principal e foram pro dropdown "..." abaixo — alinhado à UX
            mais clean do WhatsApp Web, e libera espaço pra ações
            primárias (Finalizar, IA). O Resumo também mora no "...". */}

        {/* Header largo: botões soltos. Ficam montados (só escondidos) porque o
            item "Sincronizar mensagens" do menu abre o diálogo do SyncMessagesButton. */}
        <div
          className={cn(
            "items-center gap-4",
            isCompactHeader ? "hidden" : "flex",
          )}
        >
          <SyncMessagesButton
            conversationId={conversationId}
            open={syncOpen}
            onOpenChange={setSyncOpen}
          />
          {isAttendanceManaged ? (
            <AttendanceStateBadge
              statusFlow={statusFlow}
              isAiAnswering={!isLeadAiPaused({ isActive: initialActive })}
            />
          ) : (
            <CheckIaLead
              size={"default"}
              active={initialActive}
              leadId={leadId}
              trackingId={trackingId}
            />
          )}
          <Button
            onClick={handleFinishLead}
            variant={statusFlow === "FINISHED" ? "default" : "outline"}
            disabled={statusFlow === "FINISHED" || mutation.isPending}
          >
            Finalizar <CheckIcon className="size-4" />
          </Button>
        </div>

        {/* Painel do Resumo, aberto pelo item "Resumo" do menu "...".
            Fica montado ao lado do "..." para o painel abrir ali. */}
        <SummerizeConversation
          conversationId={conversationId}
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
        />

        {/* Always visible: DropdownMenu — substitui o XIcon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="Mais opções">
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-48"
            onCloseAutoFocus={(event) => {
              if (!shouldOpenSummaryRef.current) return;
              shouldOpenSummaryRef.current = false;
              event.preventDefault();
              setSummaryOpen(true);
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                shouldOpenSummaryRef.current = true;
              }}
            >
              <SparklesIcon className="size-4" />
              Resumo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Ações de ligação — telefone (tel: link nativo do SO) +
                vídeo (LiveKit). Antes ficavam como ícones na barra,
                agora dentro do dropdown pra a UI ficar mais limpa
                (igual ao WhatsApp Web). */}
            {phone && (
              <DropdownMenuItem onClick={() => dialPhone(phone)}>
                <PhoneIcon className="size-4" />
                Ligar (áudio)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleVideoCall}
              disabled={videoCallPending}
            >
              <VideoIcon className="size-4" />
              Chamada de vídeo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSyncOpen(true)}>
              <RefreshCwIcon className="size-4" />
              Sincronizar mensagens
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSeiOpen(true)}>
              <LandmarkIcon className="size-4" />
              Processos SEI
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleArchiveLead}
              disabled={setArchived.isPending}
              className="text-warning focus:text-warning"
            >
              <ArchiveIcon className="size-4" />
              Arquivar contato
            </DropdownMenuItem>

            {/* Header estreito: ações que saíram da barra */}
            {isCompactHeader && (
              <>
                <DropdownMenuSeparator />
                {(isAttendanceManaged || IS_LEAD_AI_PAUSE_ENABLED) && (
                  <DropdownMenuItem
                    className="flex items-center justify-between gap-2"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span className="flex items-center gap-2">
                      <BotIcon className="size-4" />
                      {isAttendanceManaged ? "Atendimento" : "IA do lead"}
                    </span>
                    {isAttendanceManaged ? (
                      <AttendanceStateBadge
                        statusFlow={statusFlow}
                        isAiAnswering={
                          !isLeadAiPaused({ isActive: initialActive })
                        }
                      />
                    ) : (
                      <CheckIaLead
                        size="sm"
                        active={initialActive}
                        leadId={leadId}
                        trackingId={trackingId}
                      />
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleFinishLead}
                  disabled={statusFlow === "FINISHED" || mutation.isPending}
                >
                  <CheckIcon className="size-4" />
                  Finalizar atendimento
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onCloseChat}>
              <XIcon className="size-4" />
              Fechar conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SeiLeadProcessDialog
          leadId={leadId}
          open={seiOpen}
          onOpenChange={setSeiOpen}
        />
        {!isInsideTrackingNav && isLeadDetailsCollapsed && <FullscreenControls />}
      </div>
    </div>
  );
}
