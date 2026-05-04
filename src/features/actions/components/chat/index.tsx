"use client";

import { useState } from "react";
import { MessageCircleIcon } from "lucide-react";

import { ChatBody } from "./chat-body";
import { ChatFooter } from "./chat-footer";
import { MarkedActionChatMessage } from "./types";

interface Props {
  actionId: string;
  actionTitle: string;
  currentUserId: string;
}

export function ChatSection({ actionId, actionTitle, currentUserId }: Props) {
  const [messageSelected, setMessageSelected] = useState<
    MarkedActionChatMessage | undefined
  >(undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircleIcon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Chat</h3>
        <span className="text-xs text-muted-foreground">
          — discussão entre participantes
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <ChatBody
          actionId={actionId}
          currentUserId={currentUserId}
          onSelectMessage={setMessageSelected}
        />
        <ChatFooter
          actionId={actionId}
          actionTitle={actionTitle}
          messageSelected={messageSelected}
          closeMessageSelected={() => setMessageSelected(undefined)}
        />
      </div>
    </div>
  );
}
