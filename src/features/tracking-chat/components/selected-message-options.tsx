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
import { CopyIcon, SendIcon, Trash2Icon } from "lucide-react";

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
            <ContextMenuItem
              className="flex w-full justify-between"
              onClick={onDeleteMessage}
              variant="destructive"
            >
              <span className="font-semibold">Deletar</span>
              <Trash2Icon className="size-4" />
            </ContextMenuItem>
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
            <DropdownMenuItem
              className="flex w-full justify-between focus:bg-destructive/10 focus:text-destructive"
              onClick={onDeleteMessage}
              variant="destructive"
            >
              <span className="font-semibold">Deletar</span>
              <Trash2Icon className="size-4" />
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
