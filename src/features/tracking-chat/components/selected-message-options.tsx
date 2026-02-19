import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkedMessage, Message } from "../types";
import { CopyIcon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useMessageStore } from "../context/use-message";
import { differenceInMinutes } from "date-fns";
import { MessageStatus } from "@/generated/prisma/enums";

interface Props {
  message: Message;
  children: React.ReactNode;
  onSelectMessage: (message: MarkedMessage) => void;
  onDeleteMessage: () => void;
  onCopyMessage: () => void;
  onChange: (open: boolean) => void;
}

export function SelectedMessageOptions({
  message,
  children,
  onSelectMessage,
  onDeleteMessage,
  onCopyMessage,
  onChange,
}: Props) {
  const startEditing = useMessageStore((state) => state.startEditing);

  const canEdit =
    message.fromMe &&
    differenceInMinutes(new Date(), new Date(message.createdAt)) < 4 &&
    message.status !== MessageStatus.SENT;

  return (
    <ContextMenu modal={false} onOpenChange={onChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuItem
            className="flex w-full justify-between"
            onClick={() =>
              onSelectMessage({
                ...message,
                lead: message.conversation?.lead || { id: "", name: "" },
              })
            }
          >
            Responder <SendIcon className="size-4" />
          </ContextMenuItem>
          <ContextMenuItem
            className="flex w-full justify-between"
            onClick={onCopyMessage}
          >
            Copiar <CopyIcon className="size-4" />
          </ContextMenuItem>

          {message.fromMe && (
            <>
              {canEdit && (
                <ContextMenuItem
                  className="flex w-full justify-between"
                  onClick={() => startEditing(message)}
                >
                  Editar <PencilIcon className="size-4" />
                </ContextMenuItem>
              )}
              <ContextMenuItem
                className="flex w-full justify-between focus:bg-destructive/10 focus:text-destructive"
                onClick={onDeleteMessage}
                variant="destructive"
              >
                <span className="font-semibold">Deletar</span>
                <Trash2Icon className="size-4" />
              </ContextMenuItem>
            </>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function SelectedMessageDropdown({
  message,
  children,
  onSelectMessage,
  onDeleteMessage,
  onCopyMessage,
  onChange,
}: Props) {
  const startEditing = useMessageStore((state) => state.startEditing);

  const canEdit =
    message.fromMe &&
    differenceInMinutes(new Date(), new Date(message.createdAt)) < 4;

  return (
    <DropdownMenu onOpenChange={onChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="flex w-full justify-between"
            onClick={() =>
              onSelectMessage({
                ...message,
                lead: message.conversation?.lead || { id: "", name: "" },
              })
            }
          >
            Responder <SendIcon className="size-4" />
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex w-full justify-between"
            onClick={onCopyMessage}
          >
            Copiar <CopyIcon className="size-4" />
          </DropdownMenuItem>

          {message.fromMe && (
            <>
              {canEdit && (
                <DropdownMenuItem
                  className="flex w-full justify-between"
                  onClick={() => startEditing(message)}
                >
                  Editar <PencilIcon className="size-4" />
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="flex w-full justify-between focus:bg-destructive/10 focus:text-destructive"
                onClick={onDeleteMessage}
                variant="destructive"
              >
                <span className="font-semibold">Deletar</span>
                <Trash2Icon className="size-4" />
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
