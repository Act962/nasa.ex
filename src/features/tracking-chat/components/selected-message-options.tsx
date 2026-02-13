import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { MarkedMessage, Message } from "../types";
import { SendIcon, Trash2Icon } from "lucide-react";

interface Props {
  message: Message;
  children: React.ReactNode;
  onSelectMessage: (message: MarkedMessage) => void;
  onDeleteMessage: () => void;
}

export function SelectedMessageOptions({
  message,
  children,
  onSelectMessage,
  onDeleteMessage,
}: Props) {
  return (
    <ContextMenu>
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
          {message.fromMe && (
            <ContextMenuItem
              className="flex w-full justify-between hover:bg-red-500/10"
              onClick={onDeleteMessage}
            >
              <span className="text-red-500 font-semibold">Deletar</span>
              <Trash2Icon className="size-4" />
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
