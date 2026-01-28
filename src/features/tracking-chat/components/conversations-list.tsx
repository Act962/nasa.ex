"use client";

import { LeadBox } from "./lead-box";
import { UserPlusIcon, UserRoundPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryConversation } from "../hooks/use-conversation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateChatDialog } from "./create-chat-dialog";
import { useState } from "react";

export function ConversationsList() {
  const isOpen = true;
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQueryConversation("cmjmw5z3q0000t0vamxz21061");

  return (
    <>
      <aside
        className={`fixed inset-y-0 pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full left-12 ${isOpen ? "hidden" : "block w-full left-0"}`}
      >
        <div className="px-5">
          <div className="flex justify-between mb-4 pt-4">
            <div className="text-lg font-medium">Tracking Chat</div>
            <div className="cursor-pointer">
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                <UserRoundPlusIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {isLoading &&
              Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-16 mt-1" />
              ))}
            {!isLoading && data?.items.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserPlusIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sem conversas</EmptyTitle>
                  <EmptyDescription>
                    Nenhuma conversa encontrada
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="default" onClick={() => setOpen(true)}>
                    Adicionar conversa
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            {!isLoading &&
              data?.items.map((item) => (
                <LeadBox
                  key={item.id}
                  item={item}
                  lastMessageText="Last nessage ai"
                />
              ))}
          </div>
        </div>
      </aside>
      <CreateChatDialog isOpen={open} onOpenChange={setOpen} />
    </>
  );
}
