"use client";

import { LeadBox } from "./lead-box";
import { UserRoundPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryConversation } from "../hooks/use-conversation";

export function ConversationsList() {
  const isOpen = true;

  const { data, isLoading } = useQueryConversation("cmjmw5z3q0000t0vamxz21061");

  return (
    <aside
      className={`fixed inset-y-0 pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full left-12 ${isOpen ? "hidden" : "block w-full left-0"}`}
    >
      <div className="px-5">
        <div className="flex justify-between mb-4 pt-4">
          <div className="text-lg font-medium">Tracking Chat</div>
          <div className="cursor-pointer">
            <Button variant="ghost" size="sm">
              <UserRoundPlusIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex-col gap-2">
          {data?.items.map((item) => (
            <LeadBox
              key={item.id}
              item={item}
              lastMessageText="Last nessage ai"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
