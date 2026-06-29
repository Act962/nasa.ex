import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkedMessage, Message } from "../types";
import {
  ArchiveIcon,
  CopyIcon,
  ForwardIcon,
  MessageCircleIcon,
  MessageSquareReplyIcon,
  PencilIcon,
  PinIcon,
  SendIcon,
  SmileIcon,
  StarIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useMessageStore } from "../context/use-message";
import { differenceInMinutes } from "date-fns";
import { MessageStatus } from "@/generated/prisma/enums";

interface Props {
  message: Message;
  children: React.ReactNode;
  onSelectMessage: (message: MarkedMessage) => void;
  onDeleteMessage: () => void;
  onCopyMessage: () => void;
  onSaveToNBox?: () => void;
  onForwardMessage?: () => void;
  /** Reagir à mensagem (abre picker de emojis). */
  onReactMessage?: () => void;
  /** Fixar mensagem no topo da conversa. */
  onPinMessage?: () => void;
  /** Favoritar essa mensagem específica (não confundir com favoritar lead). */
  onFavoriteMessage?: () => void;
  /** Em grupo: responder ao participante em chat privado. */
  onReplyPrivately?: () => void;
  /** Em grupo: abrir conversa privada com o participante remetente. */
  onChatWithSender?: () => void;
  /** Em grupo: criar Lead novo a partir do participante remetente. */
  onAddSenderAsLead?: () => void;
  /**
   * True quando a conversa é grupo. Habilita ações "em particular"
   * (responder em particular, conversar com X, adicionar como lead).
   * Essas ações só aparecem em mensagens RECEBIDAS de grupos.
   */
  isGroup?: boolean;
  onChange: (open: boolean) => void;
  disabled?: boolean;
}

/**
 * Lista de items renderizados em AMBOS os menus (context + dropdown).
 * Extraído pra função pura pra evitar duplicação e manter ordem
 * idêntica entre right-click (ContextMenu) e dropdown "..." (visíveis
 * no card de mensagem).
 *
 * Ordem (espelha o menu do WhatsApp + extras NASA):
 *  1. Responder
 *  2. Responder em particular  (só grupo + !fromMe)
 *  3. Conversar com [Nome]     (só grupo + !fromMe)
 *  4. Copiar
 *  5. Reagir
 *  6. Encaminhar
 *  7. Fixar
 *  8. Favoritar
 *  9. Adicionar Novo Lead      (só grupo + !fromMe)
 *  10. Salvar N-Box            (NASA específico, mantido)
 *  11. (separador)
 *  12. Editar                  (só fromMe + dentro de janela editável)
 *  13. Apagar                  (só fromMe)
 */
function useMenuItems(props: Props) {
  const {
    message,
    onSelectMessage,
    onCopyMessage,
    onForwardMessage,
    onSaveToNBox,
    onReactMessage,
    onPinMessage,
    onFavoriteMessage,
    onReplyPrivately,
    onChatWithSender,
    onAddSenderAsLead,
    onDeleteMessage,
    isGroup,
  } = props;

  const startEditing = useMessageStore((state) => state.startEditing);
  const canEdit =
    message.fromMe &&
    differenceInMinutes(new Date(), new Date(message.createdAt)) < 4 &&
    message.status !== MessageStatus.SENT;

  // Ações "em particular" só fazem sentido em grupos pra mensagens RECEBIDAS
  // (responder/conversar/adicionar lead a partir de OUTRO participante).
  const showGroupActions = isGroup && !message.fromMe && !!message.senderName;
  const senderLabel = message.senderName ?? "remetente";

  return {
    canEdit,
    showGroupActions,
    senderLabel,
    items: {
      reply: {
        label: "Responder",
        icon: SendIcon,
        onClick: () =>
          onSelectMessage({
            ...message,
            lead: message.conversation?.lead || { id: "", name: "" },
          }),
      },
      replyPrivate: showGroupActions && onReplyPrivately
        ? {
            label: "Responder em particular",
            icon: MessageSquareReplyIcon,
            onClick: onReplyPrivately,
          }
        : null,
      chatWith: showGroupActions && onChatWithSender
        ? {
            label: `Conversar com ${senderLabel}`,
            icon: MessageCircleIcon,
            onClick: onChatWithSender,
          }
        : null,
      copy: {
        label: "Copiar",
        icon: CopyIcon,
        onClick: onCopyMessage,
      },
      react: onReactMessage
        ? { label: "Reagir", icon: SmileIcon, onClick: onReactMessage }
        : null,
      forward: onForwardMessage
        ? { label: "Encaminhar", icon: ForwardIcon, onClick: onForwardMessage }
        : null,
      pin: onPinMessage
        ? { label: "Fixar", icon: PinIcon, onClick: onPinMessage }
        : null,
      favorite: onFavoriteMessage
        ? { label: "Favoritar", icon: StarIcon, onClick: onFavoriteMessage }
        : null,
      addLead: showGroupActions && onAddSenderAsLead
        ? {
            label: "Adicionar Novo Lead",
            icon: UserPlusIcon,
            onClick: onAddSenderAsLead,
          }
        : null,
      saveToNBox: onSaveToNBox
        ? { label: "Salvar N-Box", icon: ArchiveIcon, onClick: onSaveToNBox }
        : null,
      edit: canEdit
        ? {
            label: "Editar",
            icon: PencilIcon,
            onClick: () => startEditing(message),
          }
        : null,
      delete: message.fromMe
        ? {
            label: "Apagar",
            icon: Trash2Icon,
            onClick: onDeleteMessage,
            destructive: true,
          }
        : null,
    },
  };
}

type MenuItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  destructive?: boolean;
};

export function SelectedMessageOptions(props: Props) {
  const { children, onChange, disabled } = props;
  const { items } = useMenuItems(props);

  // Ordem do menu (espelha imagem do WhatsApp + extras NASA).
  const primary = [
    items.reply,
    items.replyPrivate,
    items.chatWith,
    items.copy,
    items.react,
    items.forward,
    items.pin,
    items.favorite,
    items.addLead,
    items.saveToNBox,
  ].filter(Boolean) as MenuItem[];

  const secondary = [items.edit, items.delete].filter(Boolean) as MenuItem[];

  return (
    <ContextMenu modal={false} onOpenChange={onChange}>
      <ContextMenuTrigger disabled={disabled} asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          {primary.map((item) => (
            <ContextMenuItem
              key={item.label}
              className="flex w-full justify-between"
              onClick={item.onClick}
            >
              {item.label} <item.icon className="size-4" />
            </ContextMenuItem>
          ))}
          {secondary.length > 0 && <ContextMenuSeparator />}
          {secondary.map((item) => (
            <ContextMenuItem
              key={item.label}
              className={
                item.destructive
                  ? "flex w-full justify-between focus:bg-destructive/10 focus:text-destructive"
                  : "flex w-full justify-between"
              }
              onClick={item.onClick}
              variant={item.destructive ? "destructive" : undefined}
            >
              <span className={item.destructive ? "font-semibold" : undefined}>
                {item.label}
              </span>
              <item.icon className="size-4" />
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function SelectedMessageDropdown(props: Props) {
  const { children, onChange } = props;
  const { items } = useMenuItems(props);

  const primary = [
    items.reply,
    items.replyPrivate,
    items.chatWith,
    items.copy,
    items.react,
    items.forward,
    items.pin,
    items.favorite,
    items.addLead,
    items.saveToNBox,
  ].filter(Boolean) as MenuItem[];

  const secondary = [items.edit, items.delete].filter(Boolean) as MenuItem[];

  return (
    <DropdownMenu onOpenChange={onChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {primary.map((item) => (
            <DropdownMenuItem
              key={item.label}
              className="flex w-full justify-between"
              onClick={item.onClick}
            >
              {item.label} <item.icon className="size-4" />
            </DropdownMenuItem>
          ))}
          {secondary.length > 0 && <DropdownMenuSeparator />}
          {secondary.map((item) => (
            <DropdownMenuItem
              key={item.label}
              className={
                item.destructive
                  ? "flex w-full justify-between focus:bg-destructive/10 focus:text-destructive"
                  : "flex w-full justify-between"
              }
              onClick={item.onClick}
              variant={item.destructive ? "destructive" : undefined}
            >
              <span className={item.destructive ? "font-semibold" : undefined}>
                {item.label}
              </span>
              <item.icon className="size-4" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
