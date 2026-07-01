"use client";
import { MessageTypeIcon, getMessageTypeName } from "./message-type-icon";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { MarkedMessage, MessageStatus, Message } from "../types";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";
import { LocationMessageBox } from "./location-message-box";
import { ContactMessageBox } from "./contact-message-box";
import { PendingMediaNotice } from "./pending-media-notice";
import { CallMessageBox, parseCallPayload } from "./call-message-box";
import {
  BanIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  LucideIcon,
} from "lucide-react";
import { QuotedMessage } from "./quoted-message";
import {
  SelectedMessageOptions,
  SelectedMessageDropdown,
} from "./selected-message-options";
import { MessageReactionPicker } from "./message-reaction-picker";
import { useMutationDeleteMessage } from "../hooks/use-messages";

import { useMessageStore } from "../context/use-message";
import { toast } from "sonner";
import { useState } from "react";
import { ImageViewerDialog } from "./image-viewer-dialog";
import { BodyMessage } from "./body-message";
import { ForwardMessageDialog } from "./forward-message-dialog";
import { isForwardable } from "../lib/forward-strategies/build-payload";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useRouter } from "next/navigation";

export function MessageBox({
  message,
  onSelectMessage,
  onSaveToNBox,
  conversationId,
  trackingId,
  isGroup,
}: {
  message: Message;
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
  onSaveToNBox?: (message: Message) => void;
  conversationId: string;
  trackingId?: string;
  /** True = renderiza nome+cor por participante no topo de mensagens
   *  recebidas (estilo WhatsApp em grupos). */
  isGroup?: boolean;
}) {
  const isOwn = message.fromMe;
  const token = useMessageStore((state) => state.token);
  const deleteMessage = useMutationDeleteMessage({
    conversationId,
  });

  const [open, setOpen] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  const IconStatus = IconsStatus[message.status as MessageStatus];

  const isLocation =
    message.latitude != null &&
    message.longitude != null &&
    Number.isFinite(message.latitude) &&
    Number.isFinite(message.longitude);

  const isContact = message.mediaType === "contact";

  // Mensagens apagadas (status DELETED) — renderizam "Mensagem apagada"
  // em itálico no lugar do conteúdo original (texto + mídia limpa pelo
  // webhook ou pelo soft delete da própria procedure).
  const isDeleted = message.status === MessageStatus.DELETED;

  // Mensagens de chamada (LiveKit ou WhatsApp call log). Usam `mediaType`
  // = "voice_call" | "video_call" + body em JSON com { type, status,
  // durationSec }. Veja `call-message-box.tsx`. NÃO trata como call quando
  // a mensagem foi apagada (body já foi nulo no soft delete).
  const callPayload = isDeleted
    ? null
    : parseCallPayload(message.body, message.mediaType);
  const isCall = !!callPayload;

  const isPendingMedia =
    !isLocation &&
    !isContact &&
    !message.mediaUrl &&
    !!message.mediaType &&
    ["image", "audio", "video", "document", "sticker"].includes(
      message.mediaType,
    );

  const isFile =
    message.mimetype?.startsWith("application/") ||
    message.mimetype?.startsWith("text/") ||
    message.mimetype?.startsWith("image/") ||
    message.mimetype?.startsWith("video/") ||
    isLocation ||
    isContact ||
    isPendingMedia;

  const router = useRouter();

  const onDeleteMessage = () => {
    if (!token) return;
    deleteMessage.mutate({
      messageId: message.id,
      token: token,
      id: message.messageId,
    });
  };

  async function copyMessage() {
    await navigator.clipboard.writeText(message.body || "");
    toast.success("Mensagem copiada");
  }

  // ── Ações novas (alinhadas ao menu do WhatsApp + extras NASA) ─────────
  //
  // Reagir/Fixar/Favoritar-mensagem ainda dependem de schema novo
  // (`MessageReaction`, `Message.isPinned`, `Message.isFavorited`). Por
  // ora exibem toast "Em breve" — UI já entregue, backend nas próximas
  // sprints. Mantém a UX consistente com o WhatsApp sem bloquear o ship.
  const handleReact = (emoji: string) => {
    toast.info(`Reagiu com ${emoji} — em breve sincroniza no WhatsApp`, {
      position: "bottom-right",
    });
  };

  const handlePinMessage = () => {
    toast.info("Fixar mensagem — em breve", { position: "bottom-right" });
  };

  const handleFavoriteMessage = () => {
    toast.info("Favoritar mensagem — em breve", { position: "bottom-right" });
  };

  // Ações de grupo (Responder em particular / Conversar com X / Adicionar
  // Novo Lead) — todas chamam o MESMO endpoint que cria/abre o Lead +
  // Conversation privada com o participante. O `intent` muda só o log
  // server-side e o destino do redirect (já que pra "add as lead" a
  // gente leva pra /contatos/[id]).
  const startFromGroup = useMutation(
    orpc.conversation.startFromGroupParticipant.mutationOptions({
      onError: () => {
        toast.error("Não consegui abrir a conversa — tente novamente.", {
          position: "bottom-right",
        });
      },
    }),
  );

  const triggerGroupAction = (
    intent: "reply_private" | "chat_with" | "add_as_lead",
  ) => {
    if (!message.senderId) {
      toast.error("Remetente não identificado nessa mensagem.", {
        position: "bottom-right",
      });
      return;
    }
    startFromGroup.mutate(
      {
        sourceConversationId: conversationId,
        senderId: message.senderId,
        senderName: message.senderName ?? null,
        intent,
      },
      {
        onSuccess: (res) => {
          if (intent === "add_as_lead") {
            toast.success(
              res.leadCreated
                ? "Lead criado a partir do participante"
                : "Esse participante já era um lead — abrindo cadastro",
            );
            router.push(`/contatos/${res.leadId}`);
          } else {
            toast.success(
              res.conversationCreated
                ? "Conversa privada criada"
                : "Conversa privada aberta",
            );
            router.push(`/tracking-chat/${res.conversationId}`);
          }
        },
      },
    );
  };

  return (
    <>
      {trackingId && token && (
        <ForwardMessageDialog
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          message={message}
          trackingId={trackingId}
          token={token}
        />
      )}
      <SelectedMessageOptions
        message={message}
        onSelectMessage={onSelectMessage}
        onDeleteMessage={onDeleteMessage}
        onCopyMessage={copyMessage}
        onSaveToNBox={onSaveToNBox ? () => onSaveToNBox(message) : undefined}
        onForwardMessage={
          trackingId && isForwardable(message)
            ? () => setForwardOpen(true)
            : undefined
        }
        onReactMessage={() => {
          // Picker tem own popover lateral — aqui mostra dica de UX.
          toast.info("Use o botão 😊 ao lado da mensagem pra reagir rápido.", {
            position: "bottom-right",
          });
        }}
        onPinMessage={handlePinMessage}
        onFavoriteMessage={handleFavoriteMessage}
        onReplyPrivately={
          isGroup && !isOwn && message.senderId
            ? () => triggerGroupAction("reply_private")
            : undefined
        }
        onChatWithSender={
          isGroup && !isOwn && message.senderId
            ? () => triggerGroupAction("chat_with")
            : undefined
        }
        onAddSenderAsLead={
          isGroup && !isOwn && message.senderId
            ? () => triggerGroupAction("add_as_lead")
            : undefined
        }
        isGroup={isGroup}
        onChange={setOpen}
        disabled={showImageViewer}
      >
        <div
          id={`message-${message.id}`}
          className={cn(
            "group flex gap-2 p-4 transition-colors duration-500",
            isOwn && "justify-end",
          )}
        >
          <div
            className={cn("flex relative flex-col gap-2", isOwn && "items-end")}
          >
            <div
              className={cn(
                "flex items-center gap-3",
                isOwn && "flex-row-reverse",
              )}
            >
              <div
                className={cn(
                  // Bolha estilo WhatsApp Web — cores oficiais + rabinho.
                  //
                  // Background e cor de texto vêm 100% de CSS vars
                  // injetadas pelo wrapper `[conversationId]/page.tsx`:
                  //  - `--chat-own-bg-default` / `--chat-their-bg-default`
                  //    são theme-aware (light=verde/branco, dark=verde-escuro/cinza)
                  //  - Quando user customiza em Personalização, `--chat-own-bg`
                  //    e `--chat-own-text` (auto-contraste WCAG) sobrepõem
                  //
                  // Resultado: ao trocar Claro/Escuro, default segue tema;
                  // quando custom, texto se adapta à luminância da bolha.
                  "relative text-sm w-fit max-w-[min(85vw,520px)] space-y-1 rounded-lg px-2 py-1 shadow-sm",
                  isOwn ? "rounded-tr-none" : "rounded-tl-none",
                  // Mídia (foto/file/etc): sem fundo de bolha + sem rabinho
                  isFile &&
                    "bg-transparent dark:bg-transparent shadow-none px-0 py-0",
                )}
                style={
                  isFile
                    ? undefined
                    : {
                        background: isOwn
                          ? "var(--chat-own-bg, var(--chat-own-bg-default, #d9fdd3))"
                          : "var(--chat-their-bg, var(--chat-their-bg-default, #ffffff))",
                        color: isOwn
                          ? "var(--chat-own-text, var(--chat-own-text-default, #18181b))"
                          : "var(--chat-their-text, var(--chat-their-text-default, #18181b))",
                      }
                }
              >
                {/* Rabinho da bolha (triângulo via border CSS).
                    - fromMe → topo-direito apontando pra direita
                    - recebida → topo-esquerdo apontando pra esquerda
                    Escondido em mídia (`isFile`) — visualmente o card de
                    mídia já delimita sozinho. */}
                {!isFile && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 w-0 h-0 pointer-events-none",
                      isOwn
                        ? "right-[-8px] border-r-[8px] border-r-transparent"
                        : "left-[-8px] border-l-[8px] border-l-transparent",
                    )}
                    style={{
                      borderTopWidth: 8,
                      borderTopColor: isOwn
                        ? "var(--chat-own-bg, var(--chat-own-bg-default, #d9fdd3))"
                        : "var(--chat-their-bg, var(--chat-their-bg-default, #ffffff))",
                    }}
                  />
                )}
                {/* Sender name em mensagens RECEBIDAS de GRUPOS — estilo
                    WhatsApp Web. Cor única por participante (hash do
                    senderId/senderName) pra ficar fácil distinguir quem
                    falou. NÃO mostra em mensagens próprias nem em chats
                    individuais. */}
                {isGroup && !isOwn && message.senderName && !isDeleted && (
                  <p
                    className="text-[11px] font-semibold pt-1 pb-0.5"
                    style={{
                      color: groupSenderColor(message.senderName),
                    }}
                  >
                    {message.senderName}
                  </p>
                )}
                {message.quotedMessage && !isDeleted && (
                  <QuotedMessage message={message} />
                )}
                {isDeleted && (
                  // Mensagem apagada — italic, cor secundária theme-aware
                  // via CSS var (mesma lógica do timestamp).
                  <div
                    className="flex items-center gap-1.5 italic px-1.5 py-1"
                    style={{
                      color: isOwn
                        ? "var(--chat-own-muted, var(--chat-own-muted-default, rgba(63,63,70,0.7)))"
                        : "var(--chat-their-muted, var(--chat-their-muted-default, rgba(63,63,70,0.7)))",
                    }}
                  >
                    <BanIcon className="size-3.5 shrink-0" />
                    <span className="text-sm">Mensagem apagada</span>
                  </div>
                )}
                {/* Quando a mensagem foi apagada, NÃO renderiza nenhum
                    conteúdo original (mídia/texto/contato/etc). Webhook +
                    soft delete já limparam os campos, mas mantemos guard
                    explícito pra evitar regressão se um campo escapar. */}
                {!isDeleted && (
                  <div className="relative w-fit py-1">
                    {isCall && callPayload && (
                      <CallMessageBox payload={callPayload} fromMe={isOwn} />
                    )}
                    {isLocation && (
                      <LocationMessageBox
                        latitude={message.latitude as number}
                        longitude={message.longitude as number}
                        name={message.body}
                      />
                    )}
                    {isContact && (
                      <ContactMessageBox
                        name={message.body}
                        phone={message.fileName}
                        trackingId={trackingId}
                        token={token ?? undefined}
                      />
                    )}
                    {isPendingMedia && (
                      <PendingMediaNotice mediaType={message.mediaType!} />
                    )}
                    {!isLocation &&
                      message.mediaUrl &&
                      message.mimetype?.startsWith("image") && (
                        <>
                          <Image
                            alt="Image"
                            src={useConstructUrl(message.mediaUrl)}
                            className="object-contain cursor-pointer max-h-50 hover:opacity-90 transition-opacity"
                            width={288}
                            height={288}
                            onClick={() => setShowImageViewer(true)}
                          />
                          <ImageViewerDialog
                            open={showImageViewer}
                            onOpenChange={setShowImageViewer}
                            message={message}
                            onReply={() =>
                              onSelectMessage({
                                body: message.body,
                                id: message.id,
                                messageId: message.messageId,
                                fromMe: message.fromMe,
                                senderName: message.senderName,
                                quotedMessageId: message.quotedMessageId,
                                mediaUrl: message.mediaUrl,
                                mimetype: message.mimetype,
                                fileName: message.fileName,
                                lead: {
                                  id: message.conversation?.lead?.id || "",
                                  name: message.conversation?.lead?.name || "",
                                },
                              })
                            }
                          />
                        </>
                      )}
                    {message.mediaUrl &&
                      (message.mimetype?.startsWith("application/") ||
                        message.mimetype?.startsWith("text/")) && (
                        <FileMessageBox
                          mediaUrl={message.mediaUrl}
                          mimetype={message.mimetype}
                          fileName={message.fileName}
                        />
                      )}
                    {message.mediaUrl &&
                      message.mimetype?.startsWith("audio") && (
                        <AudioMessageBox
                          mediaUrl={message.mediaUrl}
                          mimetype={message.mimetype}
                        />
                      )}
                    {!isLocation && !isContact && !isCall && message.body && (
                      <BodyMessage message={message} />
                    )}
                  </div>
                )}

                {/* Timestamp + status DENTRO da bolha (estilo WhatsApp).
                    Cor secundária vem de CSS var `--chat-*-muted` injetada
                    pelo wrapper — theme-aware no default, auto-contraste
                    quando user customizou cor da bolha. Mantém legibilidade
                    em qualquer combinação. */}
                <div
                  className="flex items-center gap-1 text-[10px] -mt-0.5 justify-end"
                  style={{
                    color: isOwn
                      ? "var(--chat-own-muted, var(--chat-own-muted-default, rgba(63,63,70,0.7)))"
                      : "var(--chat-their-muted, var(--chat-their-muted-default, rgba(63,63,70,0.7)))",
                  }}
                >
                  {(() => {
                    const d = message.createdAt
                      ? new Date(message.createdAt)
                      : null;
                    return d && !isNaN(d.getTime()) ? format(d, "p") : "";
                  })()}
                  {isOwn && !isDeleted && IconStatus && (
                    <IconStatus
                      className={cn("size-3.5")}
                      style={{
                        color:
                          message.status === MessageStatus.SEEN
                            ? "#53bdeb" // azul WhatsApp pra "visualizado"
                            : message.status === MessageStatus.FAILED
                              ? "#ef4444" // vermelho pra falha de entrega
                              : isOwn
                                ? "var(--chat-own-muted, var(--chat-own-muted-default, rgba(63,63,70,0.7)))"
                                : "var(--chat-their-muted, var(--chat-their-muted-default, rgba(63,63,70,0.7)))",
                      }}
                    />
                  )}
                </div>
              </div>
              <div
                className={cn("flex flex-row", !isOwn && "flex-row-reverse")}
              >
                {/* Botão de reação rápida (😊) — substitui o antigo botão
                    de encaminhar (`RedoIcon`) que ficava aqui. Encaminhar
                    agora vive dentro do menu "..." (junto com as outras
                    ações). Picker mostra 6 emojis padrão + "+" pra picker
                    completo. NÃO aparece em mensagens apagadas. */}
                {!isDeleted && <MessageReactionPicker onReact={handleReact} />}
                <SelectedMessageDropdown
                  message={message}
                  onSelectMessage={onSelectMessage}
                  onDeleteMessage={onDeleteMessage}
                  onCopyMessage={copyMessage}
                  onForwardMessage={
                    trackingId && isForwardable(message)
                      ? () => setForwardOpen(true)
                      : undefined
                  }
                  onReactMessage={() => {
                    toast.info(
                      "Use o botão 😊 ao lado da mensagem pra reagir rápido.",
                      { position: "bottom-right" },
                    );
                  }}
                  onPinMessage={handlePinMessage}
                  onFavoriteMessage={handleFavoriteMessage}
                  onReplyPrivately={
                    isGroup && !isOwn && message.senderId
                      ? () => triggerGroupAction("reply_private")
                      : undefined
                  }
                  onChatWithSender={
                    isGroup && !isOwn && message.senderId
                      ? () => triggerGroupAction("chat_with")
                      : undefined
                  }
                  onAddSenderAsLead={
                    isGroup && !isOwn && message.senderId
                      ? () => triggerGroupAction("add_as_lead")
                      : undefined
                  }
                  isGroup={isGroup}
                  onChange={setOpen}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${open ? "opacity-100" : ""}`}
                  >
                    <EllipsisVerticalIcon className="size-3" />
                  </Button>
                </SelectedMessageDropdown>
              </div>
            </div>
            {/* Timestamp + status agora vivem DENTRO da bolha (logo acima,
                no canto inferior direito) — estilo WhatsApp Web. Antes
                ficava aqui fora; removido pra evitar duplicação. */}
          </div>
        </div>
      </SelectedMessageOptions>
    </>
  );
}

// Partial porque `MessageStatus.DELETED` não tem ícone aqui — a UI
// de mensagem apagada renderiza "🚫 Mensagem apagada" no lugar do
// conteúdo + esconde os checks (vide `isDeleted` em MessageBox).
const IconsStatus: Partial<Record<MessageStatus, LucideIcon>> = {
  [MessageStatus.PENDING]: CheckIcon, // 1 check  — indo
  [MessageStatus.SENT]: CheckCheckIcon, // 2 checks — enviada
  [MessageStatus.DELIVERED]: CheckCheckIcon, // 2 checks — entregue (cinza)
  [MessageStatus.SEEN]: CheckCheckIcon, // 2 checks — visualizada (azul)
  [MessageStatus.FAILED]: CircleAlertIcon, // erro de entrega (vermelho)
};

/**
 * Paleta de cores estilo WhatsApp Web pra distinguir participantes de
 * grupo. ~20 cores cuidadosamente escolhidas pra contraste em fundo
 * claro/escuro e pra serem visualmente distintas entre si.
 */
const GROUP_SENDER_COLORS = [
  "#E17076", // vermelho coral
  "#7BC862", // verde
  "#65AADD", // azul claro
  "#A695E7", // lilás
  "#EE7AAE", // rosa
  "#6EC9CB", // turquesa
  "#FAA774", // laranja
  "#B49DC8", // lavanda
  "#5DA0A8", // azul petróleo
  "#D88D72", // terracota
  "#9B89B3", // roxo suave
  "#54AB9C", // verde água
  "#E6A23C", // amarelo mostarda
  "#67B7DC", // azul céu
  "#C586C0", // magenta suave
  "#75B79E", // verde sálvia
  "#E58497", // rosa antigo
  "#8AB4F8", // azul Google
  "#F28B82", // vermelho suave
  "#B69BC7", // ametista
];

/**
 * Hash determinístico de string -> índice da paleta. Mesmo
 * senderId/senderName sempre devolve a mesma cor.
 */
function groupSenderColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // convert to 32bit int
  }
  const idx = Math.abs(hash) % GROUP_SENDER_COLORS.length;
  return GROUP_SENDER_COLORS[idx];
}
