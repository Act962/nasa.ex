"use client";

import {
  ArchiveIcon,
  BellIcon,
  CalendarIcon,
  FileIcon,
  FileSignatureIcon,
  FileTextIcon,
  GlobeIcon,
  LayoutListIcon,
  ImageIcon,
  MapPinIcon,
  MicIcon,
  PlusIcon,
  ScrollTextIcon,
  SendIcon,
  StickerIcon,
  UserPlusIcon,
} from "lucide-react";
import { EmojiStickerPicker } from "./emoji-sticker-picker";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useMutationAudioMessage,
  useMutationContactMessage,
  useMutationLocationMessage,
  useMutationTextMessage,
} from "../hooks/use-messages";
import { toast } from "sonner";
import { SendFile } from "./send-file";
import { useMessageStore } from "../context/use-message";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Uploader } from "@/components/file-uploader/uploader";
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
import { ButtonsPanel } from "./buttons-panel";
import { ReminderPanel } from "./reminder-panel";
import { SendLocationDialog } from "./send-location-dialog";
import { ContactsPanel } from "./contacts-panel";
import { WebSearchDialog } from "./web-search-dialog";
// "Forge" e "Orçamento" foram MESCLADOS num único painel "Propostas e
// Orçamentos" — o painel velho `BudgetPanel` ainda existe como código
// legado (poderá ser deletado em iteração futura), mas o footer usa só
// o novo painel mesclado.
import { ProposalsAndBudgetsPanel } from "./proposals-and-budgets";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useExtractBudget } from "../hooks/use-extract-budget";
import { formatCurrency } from "@/features/payment/lib/format";

interface FooterProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
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
  const { data: activeOrg } = authClient.useActiveOrganization();

  useEffect(() => {
    if (instance.instance) {
      setInstanceData({
        token: instance.instance.apiKey,
        baseUrl: instance.instance.baseUrl,
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
  const [showButtons, setShowButtons] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showContact, setShowContact] = useState(false);
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
  const [webSearchOpen, setWebSearchOpen] = useState(false);
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

  const handleSubmitAudio = (blob: Blob) => {
    const nameAudio = `audio-${Date.now()}-${blob.size}`;
    if (!instance.instance) return toast.error("Instância não encontrada");

    mutationAudio.mutate({
      blob: blob,
      leadPhone: lead.phone!,
      token: instance.instance.apiKey,
      nameAudio: nameAudio,
      mimetype: blob.type,
      conversationId,
      replyId: messageSelected?.messageId || undefined,
      id: messageSelected?.id,
    });
    closeMessageSelected();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!instance.instance) return toast.error("Instância não encontrada");

    const messageBody = `*${session?.user.name}*\n${message}`;

    if (message.trim().length > 0) {
      mutation.mutate({
        body: messageBody,
        leadPhone: lead.phone!,
        token: instance.instance.apiKey,
        conversationId: conversationId,
        replyId: messageSelected?.messageId,
        replyIdInternal: messageSelected?.id,
        id: messageSelected?.id,
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
      token: instance.instance.apiKey,
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
      token: instance.instance.apiKey,
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

  return (
    <>
      <form
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

        <div className="w-full h-full flex items-center gap-2 lg:gap-4 relative">
          {showButtons && (
            <ButtonsPanel
              onClose={() => setShowButtons(false)}
              conversationId={conversationId}
              trackingId={trackingId}
              lead={lead}
            />
          )}
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
              whatsappToken={instance.instance.apiKey}
              onInsertMessage={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowBudget(false);
                setBudgetInitialAttach(null);
              }}
              initialAttach={budgetInitialAttach}
            />
          )}
          {showReminder && (
            <ReminderPanel
              onClose={() => setShowReminder(false)}
              conversationId={conversationId}
              leadId={lead.id}
              trackingId={trackingId}
              lead={lead}
              phone={lead.phone}
            />
          )}
          {!showAudioRecorder ? (
            <InputGroup
              className={cn(
                "border-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 bg-white dark:bg-zinc-800 rounded-2xl px-2 shadow-md",
                message.includes("\n") || message.length > 60
                  ? "items-end pb-1.5"
                  : "items-center",
              )}
            >
              {!isDisabled ? (
                <>
                  <InputGroupAddon>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <PlusIcon className="cursor-pointer size-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-fit h-fit p-0">
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowButtons((v) => !v);
                            setShowNBox(false);
                            setShowForms(false);
                            setShowAgenda(false);
                            setShowScripts(false);
                            setShowReminder(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <LayoutListIcon className="size-4" />
                          <p className="text-sm">Botões</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowNBox((v) => !v);
                            setShowButtons(false);
                            setShowForms(false);
                            setShowAgenda(false);
                            setShowScripts(false);
                            setShowReminder(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <ArchiveIcon className="size-4" />
                          <p className="text-sm">N-Box</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowForms((v) => !v);
                            setShowNBox(false);
                            setShowButtons(false);
                            setShowAgenda(false);
                            setShowScripts(false);
                            setShowReminder(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <FileTextIcon className="size-4" />
                          <p className="text-sm">Formulários</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowAgenda((v) => !v);
                            setShowScripts(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setShowReminder(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <CalendarIcon className="size-4" />
                          <p className="text-sm">Agenda</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowScripts((v) => !v);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setShowReminder(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <ScrollTextIcon className="size-4" />
                          <p className="text-sm">Scripts</p>
                        </div>
                        {/* "Forge" mesclado em "Propostas e Orçamentos" —
                            item de menu removido. */}
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowBudget((v) => !v);
                            setShowReminder(false);
                            setShowScripts(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setShowContact(false);
                            setOpen(false);
                          }}
                        >
                          <FileSignatureIcon className="size-4 text-emerald-500" />
                          <p className="text-sm">Propostas e Orçamentos</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowReminder((v) => !v);
                            setShowBudget(false);
                            setShowScripts(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setOpen(false);
                          }}
                        >
                          <BellIcon className="size-4" />
                          <p className="text-sm">Lembrete</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={handleSendLocation}
                        >
                          <MapPinIcon className="size-4" />
                          <p className="text-sm">Localização</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setWebSearchOpen(true);
                            setShowReminder(false);
                            setShowScripts(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setShowContact(false);
                            setShowBudget(false);
                            setOpen(false);
                          }}
                        >
                          <GlobeIcon className="size-4" />
                          <p className="text-sm">Pesquisar na Web</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowContact((v) => !v);
                            setShowReminder(false);
                            setShowScripts(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setShowButtons(false);
                            setOpen(false);
                          }}
                        >
                          <UserPlusIcon className="size-4" />
                          <p className="text-sm">Contato</p>
                        </div>
                        <div className="relative w-full h-full cursor-pointer overflow-hidden">
                          <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4">
                            <FileIcon className="size-4" />
                            <p className="text-sm">Arquivo</p>
                            <div className="absolute top-0 left-0 w-full h-full opacity-0">
                              {isLoading ? (
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Spinner className="size-3" />
                                </div>
                              ) : (
                                <Uploader
                                  onUpload={(file, name) =>
                                    handleFileChange(file, "pdf", name)
                                  }
                                  onUploadStart={() => setIsLoading(true)}
                                  value={selectedImage}
                                  fileTypeAccepted="outros"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="relative w-full h-full cursor-pointer overflow-hidden">
                          <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 ">
                            <ImageIcon className="size-4" />
                            <p className="text-sm">Imagem</p>
                            <div className="absolute top-0 left-0 w-full h-full opacity-0">
                              {isLoading ? (
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Spinner className="size-3" />
                                </div>
                              ) : (
                                <Uploader
                                  onUpload={(file) =>
                                    handleFileChange(file, "image")
                                  }
                                  onUploadStart={() => setIsLoading(true)}
                                  value={selectedImage}
                                  fileTypeAccepted="image"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </InputGroupAddon>

                  <InputGroupAddon>
                    {/* Picker combinado de Emojis + Figurinhas (tabs).
                        Substitui o popover antigo que só tinha emoji.
                        Stickers usam `UserSticker` (org-scoped, R2)
                        e enviam via uazapi com type:"sticker".
                        Trigger é um <button> de verdade — `PopoverTrigger
                        asChild` precisa de elemento que aceite ref, e o
                        SVG do lucide não forwarda ref consistente. */}
                    <EmojiStickerPicker
                      trigger={
                        <button
                          type="button"
                          className="cursor-pointer inline-flex items-center justify-center text-foreground hover:text-foreground/80 transition-colors"
                          aria-label="Emojis e figurinhas"
                          title="Emojis e figurinhas"
                        >
                          <StickerIcon className="size-4" />
                        </button>
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
                          token: instance.instance.apiKey,
                          mediaUrl: url,
                          mimetype,
                          quotedMessageId: messageSelected?.messageId,
                          id: messageSelected?.id,
                        });
                        closeMessageSelected();
                      }}
                    />
                  </InputGroupAddon>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() =>
                      route.push(`/tracking/${trackingId}/settings`)
                    }
                  >
                    Conectar instância
                  </Button>
                </>
              )}

              <InputGroupTextarea
                ref={inputRef as any}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isDisabled ? "" : "Digite sua mensagem"}
                disabled={isDisabled}
                className="resize-none min-h-0 py-2.5 text-sm max-h-50"
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

              {/* <InputGroupAddon align="inline-end">
                <ComposeResponse
                  conversationId={conversationId}
                  onResponse={(text) => setMessage(text)}
                />
              </InputGroupAddon> */}

              <InputGroupAddon align="inline-end">
                <TrackingChatCopilot
                  conversationId={conversationId}
                  leadId={lead.id}
                  trackingId={trackingId}
                  onApplyDraft={(text) => setMessage(text)}
                />
              </InputGroupAddon>

              <InputGroupAddon align="inline-end">
                {message.trim().length > 0 ? (
                  <Button
                    type="submit"
                    size="icon"
                    className="rounded-full "
                    disabled={isDisabled}
                  >
                    <SendIcon className="size-4 " />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    disabled={isDisabled}
                    onClick={() => setShowAudioRecorder(true)}
                  >
                    <MicIcon className="size-4" />
                  </Button>
                )}
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
      {activeOrg?.id && (
        <WebSearchDialog
          open={webSearchOpen}
          onOpenChange={setWebSearchOpen}
          organizationId={activeOrg.id}
          onUseResult={(text, mode) => {
            if (mode === "replace") {
              setMessage(text);
            } else {
              setMessage((prev) => (prev ? prev + "\n\n" + text : text));
            }
            // Foca o input pra operador editar antes de enviar
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      )}
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
          token={instance.instance?.apiKey}
          fileType={selectedFileType}
          fileName={fileName}
          messageSelected={messageSelected}
        />
      )}
    </>
  );
}
