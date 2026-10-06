"use client";

import {
  ArchiveIcon,
  BellIcon,
  CalendarIcon,
  FileIcon,
  FileSignatureIcon,
  FileTextIcon,
  ImageIcon,
  MapPinIcon,
  MicIcon,
  PlusIcon,
  ScrollTextIcon,
  SendIcon,
  StickerIcon,
  UserPlusIcon,
  SparklesIcon,
} from "lucide-react";
import { EmojiStickerPicker } from "./emoji-sticker-picker";
import { ComposerActionButton } from "./composer-action-button";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import {
  useMutationAudioMessage,
  useMutationContactMessage,
  useMutationLocationMessage,
  useMutationTextMessage,
  useMutationVideoMessage,
} from "../hooks/use-messages";
import { toast } from "sonner";
import { SendFile } from "./send-file";
import { useMessageStore } from "../context/use-message";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { ComposerAttachSheet, type ComposerAttachItem } from "./composer-attach-sheet";
import { CameraCaptureButton } from "./camera-capture-button";
import { QuickWorkflowDialog } from "@/features/workflows/components/quick-builder/quick-workflow-dialog";
import { SendAudio } from "./send-audio";
import { MarkedMessage } from "../types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { MessageSelected } from "./message-selected";
import { ComposeResponse } from "./compose-response";
import { TrackingChatCopilot } from "@/features/astro/components/embeds/tracking-chat-copilot";
import { ScriptsPanel } from "./scripts-panel";
import { AgendaPanel } from "./agenda-panel";
import { FormsPanel } from "./forms-panel";
import { NBoxPanel } from "./nbox-panel";
import { SendLocationDialog } from "./send-location-dialog";
import { ContactsPanel } from "./contacts-panel";
// "Forge" e "Orçamento" foram MESCLADOS num único painel "Propostas e
// Orçamentos" — o painel velho `BudgetPanel` ainda existe como código
// legado (poderá ser deletado em iteração futura), mas o footer usa só
// o novo painel mesclado.
import { ProposalsAndBudgetsPanel } from "./proposals-and-budgets";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useExtractBudget } from "../hooks/use-extract-budget";
import { formatCurrency } from "@/features/payment/lib/format";
import { useWhatsAppProviderSettings } from "@/features/tracking-settings/hooks/use-whatsapp-provider";
import { useCustomerWindow } from "../hooks/use-customer-window";
import { TemplatePicker } from "./template-picker";
import { FileBadgeIcon } from "lucide-react";

import { StarFriendsRedeemDialog } from "@/features/star-friends/components/star-friends-redeem-dialog";
import { useStarFriendsPermissions } from "@/features/star-friends/hooks/use-star-friends-permissions";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

interface FooterProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
    source?: string | null;
  };
  trackingId: string;
}

export function Footer({
  conversationId,
  lead,
  trackingId,
  messageSelected,
  closeMessageSelected,
}: FooterProps & {
  messageSelected: MarkedMessage | undefined;
  closeMessageSelected: () => void;
}) {
  const setInstanceData = useMessageStore((state) => state.setInstance);
  const instance = useQueryInstances(trackingId);
  const route = useRouter();
  const { data: session } = authClient.useSession();

  // ── Provider + janela de 24h (Fase 9) ──────────────────────────────
  // Templates HSM e o gating de janela só valem pra trackings META_CLOUD.
  const providerSettings = useWhatsAppProviderSettings(trackingId);
  const isMeta = providerSettings.data?.provider === "META_CLOUD";
  const customerWindow = useCustomerWindow(conversationId, { enabled: isMeta });
  const outsideWindow =
    isMeta &&
    customerWindow.data?.applicable === true &&
    customerWindow.data.withinWindow === false;
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    if (instance.instance) {
      setInstanceData({
        instanceId: instance.instance.id,
        status: instance.instance.status,
      });
    }
  }, [instance.instance, setInstanceData]);

  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );
  const [selectedFileType, setSelectedFileType] = useState<"image" | "pdf">(
    "image",
  );
  const [sendImage, setSendImage] = useState(false);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [showScripts, setShowScripts] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const [showNBox, setShowNBox] = useState(false);
  const [isLeadTriggersOpen, setIsLeadTriggersOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showStarFriends, setShowStarFriends] = useState(false);
  const starFriendsPermissions = useStarFriendsPermissions();
  const [showBudget, setShowBudget] = useState(false);
  // Dados de pré-preenchimento do BudgetPanel quando vem de um upload
  // regular que a IA detectou como proposta/OS (Phase 3 do fluxo). Reseta
  // ao fechar o BudgetPanel.
  const [budgetInitialAttach, setBudgetInitialAttach] = useState<{
    key: string;
    name: string;
    mime: string;
    valueCents: number | null;
    description: string;
    confidence: "high" | "medium" | "low";
  } | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const extractBudget = useExtractBudget();
  const [pendingLocation, setPendingLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messageSelected) {
      inputRef.current?.focus();
    }
  }, [messageSelected]);

  const mutation = useMutationTextMessage({
    conversationId,
    lead,
    messageSelected,
  });
  const mutationVideo = useMutationVideoMessage({ conversationId, lead });
  const mutationAudio = useMutationAudioMessage({
    conversationId,
    lead,
    quotedMessageId: messageSelected?.messageId,
    messageSelected,
  });
  const mutationLocation = useMutationLocationMessage({
    conversationId,
    lead,
    messageSelected,
  });
  const mutationContact = useMutationContactMessage({
    conversationId,
    lead,
    messageSelected,
  });

  // Envio de figurinha — chama o endpoint dedicado (sendMedia type:"sticker").
  // Não passa pelo dialog SendFile porque sticker não tem caption nem
  // confirmação (UX do WhatsApp: clica e manda).
  const stickerQc = useQueryClient();
  const mutationSticker = useMutation(
    orpc.message.createWithSticker.mutationOptions({
      onSuccess: () => {
        stickerQc.invalidateQueries({
          queryKey: ["message.list", conversationId],
        });
      },
      onError: () => {
        toast.error("Falha ao enviar figurinha");
      },
    }),
  );

  const isDisabled = !instance.instance;
  // Pedido do catálogo NERP: sem WhatsApp, o texto vai pela página do pedido (o servidor decide o canal).
  const canReplyInPortal = lead.source === "NERP_CATALOG";
  const isTextDisabled = isDisabled && !canReplyInPortal;

  const handleSubmitAudio = async (blob: Blob) => {
    if (!instance.instance) return toast.error("Instância não encontrada");

    let audioBlob = blob;
    let mimetype = blob.type;
    let extension = "";

    // A Meta Cloud não aceita WebM (formato do gravador). Remuxa pra OGG/Opus
    // na hora de enviar (sem re-encode). A Uazapi transcodifica sozinha, então
    // mantém o WebM original — zero regressão.
    if (isMeta) {
      const toastId = toast.loading("Preparando áudio...");
      try {
        // Import dinâmico: a mediabunny só é baixada no caminho Meta —
        // quem usa Uazapi não carrega esse chunk.
        const { convertWebmToOggOpus } = await import(
          "../lib/audio/webm-to-ogg"
        );
        audioBlob = await convertWebmToOggOpus(blob);
        mimetype = "audio/ogg";
        extension = ".ogg";
      } catch (error) {
        console.error("[footer-chat] audio conversion failed", error);
        toast.error("Falha ao preparar o áudio para a API Oficial.");
        return;
      } finally {
        toast.dismiss(toastId);
      }
    }

    const nameAudio = `audio-${Date.now()}-${audioBlob.size}${extension}`;

    mutationAudio.mutate({
      blob: audioBlob,
      leadPhone: lead.phone!,
      nameAudio: nameAudio,
      mimetype: mimetype,
      isVoice: isMeta,
      conversationId,
      replyId: messageSelected?.messageId || undefined,
      id: messageSelected?.id,
    });
    closeMessageSelected();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTextDisabled) return toast.error("Instância não encontrada");

    const messageBody = `*${session?.user.name}*\n${message}`;

    if (message.trim().length > 0) {
      mutation.mutate({
        body: messageBody,
        // Sem `!`: visitante do ASTRO CHAT não tem telefone, e o servidor
        // aceita a falta dele quando a conversa é In-Chat (spec 0072).
        leadPhone: lead.phone,
        conversationId: conversationId,
        replyId: messageSelected?.messageId,
        replyIdInternal: messageSelected?.id,
        id: messageSelected?.id,
      }, {
        onSuccess: () => emitTourResult({ kind: GUIDE_RESULT_KINDS.chatMessageSent }),
      });

      setMessage("");
      closeMessageSelected();
    }
  };

  const handleSendLocation = () => {
    if (!instance.instance) return toast.error("Instância não encontrada");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return toast.error("Geolocalização não suportada neste dispositivo");
    }
    setOpen(false);
    setPendingLocation(null);
    setLocationDialogOpen(true);
    toast.loading("Obtendo localização...", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        setPendingLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        toast.dismiss("geo");
        toast.error("Não foi possível obter localização: " + err.message);
        setLocationDialogOpen(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleConfirmSendLocation = () => {
    if (!instance.instance) return toast.error("Instância não encontrada");
    if (!pendingLocation) return;
    mutationLocation.mutate({
      conversationId,
      leadPhone: lead.phone!,
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      replyId: messageSelected?.messageId,
      id: messageSelected?.id,
    });
    closeMessageSelected();
    setLocationDialogOpen(false);
    setPendingLocation(null);
  };

  const handleSendContact = ({
    name,
    phone,
  }: {
    name: string;
    phone: string;
  }) => {
    if (!instance.instance) return toast.error("Instância não encontrada");
    if (!lead.phone) return toast.error("Lead sem telefone");
    mutationContact.mutate({
      conversationId,
      leadPhone: lead.phone,
      contactName: name,
      contactPhone: phone,
      replyId: messageSelected?.messageId,
      id: messageSelected?.id,
    });
    closeMessageSelected();
  };

  const handleFileChange = (
    file: string,
    fileType: "image" | "pdf",
    name?: string,
  ) => {
    if (!file) return;

    setSelectedImage(file);
    setSelectedFileType(fileType);
    setSendImage(true);
    setOpen(false);
    setIsLoading(false);
    setFileName(name);

    // Detecção de orçamento via IA — só roda pra PDFs (formato mais
    // comum de O.S./proposta/orçamento). Não bloqueia o SendFile dialog:
    // se a IA identificar proposta, mostramos um toast com ação rápida
    // pra abrir o BudgetPanel pré-preenchido, evitando o atalho que
    // mata as métricas.
    if (fileType === "pdf") {
      extractBudget.mutate(
        { fileKey: file },
        {
          onSuccess: (data) => {
            if (data.isProposalLike && data.valueCents !== null) {
              toast.warning("Detectei um orçamento/proposta neste arquivo", {
                description: `Valor identificado: ${formatCurrency(data.valueCents)}. Registre em "Propostas e Orçamentos" pra capturar métricas de venda.`,
                duration: 15000,
                action: {
                  label: "Registrar agora",
                  onClick: () => {
                    setBudgetInitialAttach({
                      key: file,
                      name: name ?? "orcamento.pdf",
                      mime: "application/pdf",
                      valueCents: data.valueCents,
                      description: data.description,
                      confidence: data.confidence,
                    });
                    // Fecha o SendFile e abre o BudgetPanel pré-preenchido.
                    setSendImage(false);
                    setShowBudget(true);
                  },
                },
              });
            }
          },
          // Erro de IA é silencioso — não atrapalha o fluxo normal de
          // envio de arquivo. Log no console.
          onError: (err) => {
            console.warn("[footer-chat] extractBudget failed", err);
          },
        },
      );
    }
  };

  type ComposerPanel = "nbox" | "forms" | "agenda" | "scripts" | "contact" | "budget";
  const panelSetters: Record<ComposerPanel, (isOpen: boolean) => void> = {
    nbox: setShowNBox,
    forms: setShowForms,
    agenda: setShowAgenda,
    scripts: setShowScripts,
    contact: setShowContact,
    budget: setShowBudget,
  };
  // Um painel por vez acima da caixa de mensagem.
  const showOnlyPanel = (panel: ComposerPanel) => {
    for (const [panelName, setPanelOpen] of Object.entries(panelSetters)) {
      setPanelOpen(panelName === panel);
    }
  };

  const attachItems: ComposerAttachItem[] = [
    {
      key: "photos",
      label: "Fotos",
      icon: <ImageIcon />,
      iconClassName: "text-info",
      upload: { fileTypeAccepted: "image", onUpload: (file) => handleFileChange(file, "image") },
    },
    {
      key: "document",
      label: "Documento",
      icon: <FileIcon />,
      iconClassName: "text-info",
      upload: { fileTypeAccepted: "outros", onUpload: (file, name) => handleFileChange(file, "pdf", name) },
    },
    { key: "location", label: "Localização", icon: <MapPinIcon />, iconClassName: "text-success", onSelect: handleSendLocation },
    { key: "contact", label: "Contato", icon: <UserPlusIcon />, iconClassName: "text-muted-foreground", onSelect: () => showOnlyPanel("contact") },
    { key: "forms", label: "Formulários", icon: <FileTextIcon />, iconClassName: "text-chart-3", onSelect: () => showOnlyPanel("forms") },
    { key: "agenda", label: "Agenda", icon: <CalendarIcon />, iconClassName: "text-destructive", onSelect: () => showOnlyPanel("agenda") },
    { key: "scripts", label: "Scripts", icon: <ScrollTextIcon />, iconClassName: "text-warning", onSelect: () => showOnlyPanel("scripts") },
    { key: "budget", label: "Propostas", icon: <FileSignatureIcon />, iconClassName: "text-success", onSelect: () => showOnlyPanel("budget") },
    { key: "nbox", label: "N-Box", icon: <ArchiveIcon />, iconClassName: "text-temp-hot", onSelect: () => showOnlyPanel("nbox") },
    { key: "lead-triggers", label: "Gatilhos do lead", icon: <BellIcon />, iconClassName: "text-warning", onSelect: () => setIsLeadTriggersOpen(true) },
    ...(starFriendsPermissions.canRedeemAndCredit
      ? [{ key: "star-friends", label: "Star Friends", icon: <SparklesIcon />, iconClassName: "text-warning", onSelect: () => setShowStarFriends(true) }]
      : []),
    ...(isMeta
      ? [{ key: "template", label: "Template", icon: <FileBadgeIcon />, iconClassName: "text-info", onSelect: () => setShowTemplatePicker(true) }]
      : []),
  ];

  return (
    <>
      <form
        // Sem instância o formulário continua na tela, mas sem campo de texto:
        // o guia de responder não pode apontar para ele (spec 0048, CB-1).
        data-guide={isTextDisabled ? undefined : GUIDE_ANCHORS.chatComposer.id}
        // Footer SEM fundo — herda transparência do chat, deixa o pattern
        // de background (WhatsApp) ou a cor customizada do user aparecer.
        // Input com fundo SÓLIDO: branco no tema Claro, cinza-escuro
        // (zinc-800) no Escuro. Sem transparência, sem blur — mantém
        // contraste constante sobre qualquer fundo customizado do chat.
        className="py-3 px-4 flex flex-col items-center gap-2 w-full"
        onSubmit={handleSubmit}
      >
        {messageSelected && (
          <MessageSelected
            messageSelected={messageSelected}
            closeMessageSelected={closeMessageSelected}
          />
        )}

        {/* Banner de janela de 24h (Fase 9) — só META_CLOUD fora da janela.
            Texto livre é bloqueado abaixo; aqui oferecemos o caminho válido
            (template aprovado). */}
        {outsideWindow && (
          <div className="w-full flex items-center justify-between gap-3 rounded-xl bg-warning/10 dark:bg-warning/15 border border-warning/30 dark:border-warning/40 px-3 py-2">
            <p className="text-xs text-warning">
              Fora da janela de 24h da Meta. Envie um template aprovado pra
              reabrir a conversa.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowTemplatePicker(true)}
            >
              <FileBadgeIcon className="size-4" />
              Enviar template
            </Button>
          </div>
        )}

        <div className="w-full h-full flex items-center gap-2 lg:gap-4 relative">
          {showNBox && (
            <NBoxPanel
              onClose={() => setShowNBox(false)}
              onSendItem={(text, name) => {
                handleFileChange(text, "pdf", name);
                setShowNBox(false);
              }}
            />
          )}
          {showForms && (
            <FormsPanel
              onClose={() => setShowForms(false)}
              onSendLink={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowForms(false);
              }}
            />
          )}
          {/* ScriptsPanel mantém API atual (open/onOpenChange) — ver scripts-panel.tsx.
              ForgePanel foi mesclado em "Propostas e Orçamentos" — JSX removido. */}
          <ScriptsPanel
            open={showScripts}
            onOpenChange={setShowScripts}
            trackingId={trackingId}
            onSelectScript={(content) => {
              setMessage((prev) => prev + content);
              setShowScripts(false);
            }}
            onSendVideoScript={({ mediaUrl, mimetype, fileName, caption }) => {
              if (!lead.phone) {
                toast.error("Lead sem telefone");
                return;
              }
              mutationVideo.mutate({
                conversationId,
                leadPhone: lead.phone,
                mediaUrl,
                mimetype,
                fileName,
                body: caption,
              });
              setShowScripts(false);
            }}
            leadName={lead.name}
            leadPhone={lead.phone ?? undefined}
          />
          {showAgenda && (
            <AgendaPanel
              onClose={() => setShowAgenda(false)}
              lead={lead}
              onInsertLink={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowAgenda(false);
              }}
            />
          )}
          {showContact && (
            <ContactsPanel
              onClose={() => setShowContact(false)}
              trackingId={trackingId}
              excludeConversationId={conversationId}
              onSelect={handleSendContact}
            />
          )}
          {showBudget && instance.instance && lead.phone && (
            <ProposalsAndBudgetsPanel
              onClose={() => {
                setShowBudget(false);
                // Limpa pré-preenchimento ao fechar — próxima abertura
                // do "+" começa do zero.
                setBudgetInitialAttach(null);
              }}
              conversationId={conversationId}
              trackingId={trackingId}
              leadId={lead.id}
              leadName={lead.name}
              leadPhone={lead.phone}
              onInsertMessage={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowBudget(false);
                setBudgetInitialAttach(null);
              }}
              initialAttach={budgetInitialAttach}
            />
          )}
          {!showAudioRecorder ? (
            <InputGroup
              className={cn(
                "h-auto flex-col items-stretch gap-0 rounded-[28px] border-0 bg-card/75 px-2 pt-1 pb-2 shadow-md backdrop-blur-md dark:bg-card/75",
                "has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0",
              )}
            >
              {isDisabled && (
                <div className="px-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => route.push(`/tracking/${trackingId}/settings`)}
                  >
                    Conectar instância
                  </Button>
                </div>
              )}

              <InputGroupTextarea
                ref={inputRef as any}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  outsideWindow
                    ? "Fora da janela de 24h — envie um template"
                    : isTextDisabled
                      ? ""
                      : isDisabled
                        ? "Responder pela página do pedido"
                        : "Mensagem"
                }
                disabled={isTextDisabled || outsideWindow}
                className="min-h-12 max-h-50 resize-none px-3 py-3 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim().length > 0) {
                      const form = e.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    }
                  }
                }}
              />

              <InputGroupAddon align="block-end" className="justify-between gap-1 px-1 pb-0">
                <TrackingChatCopilot
                  conversationId={conversationId}
                  leadId={lead.id}
                  trackingId={trackingId}
                  onApplyDraft={(text) => setMessage(text)}
                />

                <div className="flex items-center gap-0.5">
                  {!isDisabled && (
                    <>
                      <ComposerActionButton label="Anexar" onClick={() => setOpen(true)}>
                        <PlusIcon />
                      </ComposerActionButton>
                      {/* Stickers usam `UserSticker` (org-scoped, R2) e enviam
                          via uazapi com type:"sticker". O trigger precisa ser um
                          <button> real — `PopoverTrigger asChild` exige elemento
                          que aceite ref. */}
                      <EmojiStickerPicker
                        trigger={
                          <ComposerActionButton label="Emojis e figurinhas">
                            <StickerIcon />
                          </ComposerActionButton>
                        }
                        onEmoji={(emoji) => setMessage((prev) => prev + emoji)}
                        onSticker={({ url, mimetype }) => {
                          if (!instance.instance) {
                            toast.error("Instância não encontrada");
                            return;
                          }
                          if (!lead.phone) {
                            toast.error("Lead sem telefone");
                            return;
                          }
                          mutationSticker.mutate({
                            conversationId,
                            leadPhone: lead.phone,
                            mediaUrl: url,
                            mimetype,
                            quotedMessageId: messageSelected?.messageId,
                            id: messageSelected?.id,
                          });
                          closeMessageSelected();
                        }}
                      />
                      <CameraCaptureButton
                        isUploading={isLoading}
                        onUploadStart={() => setIsLoading(true)}
                        onUploadEnd={() => setIsLoading(false)}
                        onCaptured={(fileKey) => handleFileChange(fileKey, "image")}
                      />
                    </>
                  )}

                  {message.trim().length > 0 ? (
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Enviar mensagem"
                      className="size-10 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
                      disabled={isTextDisabled || outsideWindow}
                    >
                      <SendIcon className="size-4" />
                    </Button>
                  ) : (
                    <ComposerActionButton
                      label="Gravar áudio"
                      className="size-10 bg-muted text-foreground"
                      disabled={isDisabled || outsideWindow}
                      onClick={() => setShowAudioRecorder(true)}
                    >
                      <MicIcon />
                    </ComposerActionButton>
                  )}
                </div>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <SendAudio
              onCancel={() => setShowAudioRecorder(false)}
              onSend={(blob) => {
                handleSubmitAudio(blob);
                setShowAudioRecorder(false);
              }}
            />
          )}
        </div>
      </form>
      <SendLocationDialog
        open={locationDialogOpen}
        onOpenChange={(o) => {
          setLocationDialogOpen(o);
          if (!o) setPendingLocation(null);
        }}
        latitude={pendingLocation?.latitude ?? null}
        longitude={pendingLocation?.longitude ?? null}
        onConfirm={handleConfirmSendLocation}
        isSending={mutationLocation.isPending}
      />
      <ComposerAttachSheet
        open={open}
        onOpenChange={setOpen}
        items={attachItems}
        isUploading={isLoading}
        onUploadStart={() => setIsLoading(true)}
      />
      <QuickWorkflowDialog
        isOpen={isLeadTriggersOpen}
        onOpenChange={setIsLeadTriggersOpen}
        trackingId={trackingId}
        leadId={lead.id}
        leadName={lead.name}
      />
      <StarFriendsRedeemDialog
        leadId={lead.id}
        open={showStarFriends}
        onOpenChange={setShowStarFriends}
        onInsertMessage={(text) => setMessage((previous) => (previous ? `${previous}\n${text}` : text))}
      />
      <TemplatePicker
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        trackingId={trackingId}
        conversationId={conversationId}
        leadPhone={lead.phone}
        onSent={closeMessageSelected}
      />
      {sendImage && instance.instance && (
        <SendFile
          conversationId={conversationId}
          lead={lead}
          file={selectedImage!}
          onClose={() => {
            setSendImage(false);
            setSelectedImage(undefined);
            closeMessageSelected();
          }}
          leadPhone={lead.phone!}
          fileType={selectedFileType}
          fileName={fileName}
          messageSelected={messageSelected}
        />
      )}
    </>
  );
}
