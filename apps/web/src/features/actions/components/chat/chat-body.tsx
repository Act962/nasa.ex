"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, MessageSquareIcon } from "lucide-react";
import { pusherClient } from "@/lib/pusher";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import "dayjs/locale/pt-br";

import { ChatMessage } from "./chat-message";
import { EditMessageDialog } from "./edit-message-dialog";
import {
  useListActionChatMessages,
  useMutationActionChatDeleteMessage,
  useMutationActionChatEditMessage,
  useMutationActionChatMarkRead,
} from "../../hooks/use-action-chat";
import {
  ActionChatMessage,
  ActionChatMessageGroup,
  MarkedActionChatMessage,
} from "./types";

dayjs.extend(calendar);
dayjs.locale("pt-br");

interface Props {
  actionId: string;
  currentUserId: string;
  onSelectMessage: (m: MarkedActionChatMessage) => void;
}

export function ChatBody({
  actionId,
  currentUserId,
  onSelectMessage,
}: Props) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
  } = useListActionChatMessages(actionId);

  const editMutation = useMutationActionChatEditMessage({ actionId });
  const deleteMutation = useMutationActionChatDeleteMessage({ actionId });
  const markReadMutation = useMutationActionChatMarkRead({ actionId });

  const items = useMemo<ActionChatMessageGroup[]>(() => {
    if (!data) return [];
    const flatMsgs: ActionChatMessage[] = [];
    for (const page of [...data.pages].reverse()) {
      for (const group of [...page.items].reverse()) {
        for (const m of [...group.messages].reverse()) {
          flatMsgs.push(m);
        }
      }
    }
    const grouped: Record<string, ActionChatMessage[]> = {};
    for (const m of flatMsgs) {
      const key = dayjs(m.createdAt).format("YYYY-MM-DD");
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(m);
    }
    return Object.entries(grouped).map(([date, messages]) => ({
      date,
      messages,
    }));
  }, [data]);

  useEffect(() => {
    if (!hasInitialScrolled && data?.pages.length) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
          setHasInitialScrolled(true);
        }
      });
    }
  }, [hasInitialScrolled, data?.pages.length]);

  useEffect(() => {
    if (!actionId) return;
    markReadMutation.mutate({ actionId });
  }, [actionId]);

  useEffect(() => {
    if (!actionId) return;

    const channelName = `action-chat-${actionId}`;
    pusherClient.subscribe(channelName);

    const onCreated = (payload: any) => {
      if (payload.currentUserId === currentUserId) return;
      queryClient.setQueryData(["action.chat.list", actionId], (old: any) => {
        if (!old) return old;
        const today = dayjs(payload.createdAt).format("YYYY-MM-DD");
        const exists = old.pages.some((page: any) =>
          page.items.some((g: any) =>
            g.messages.some((m: any) => m.id === payload.id),
          ),
        );
        if (exists) return old;
        const firstPage = old.pages[0] ?? {
          items: [],
          nextCursor: undefined,
        };
        const firstGroup = firstPage.items[0];
        if (firstGroup && firstGroup.date === today) {
          return {
            ...old,
            pages: [
              {
                ...firstPage,
                items: [
                  {
                    ...firstGroup,
                    messages: [payload, ...firstGroup.messages],
                  },
                  ...firstPage.items.slice(1),
                ],
              },
              ...old.pages.slice(1),
            ],
          };
        }
        return {
          ...old,
          pages: [
            {
              ...firstPage,
              items: [{ date: today, messages: [payload] }, ...firstPage.items],
            },
            ...old.pages.slice(1),
          ],
        };
      });

      // Auto mark as read if user is at bottom
      if (isAtBottom) {
        markReadMutation.mutate({ actionId });
      }
    };

    const onEdited = (payload: any) => {
      queryClient.setQueryData(["action.chat.list", actionId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((g: any) => ({
              ...g,
              messages: g.messages.map((m: ActionChatMessage) =>
                m.id === payload.id ? payload : m,
              ),
            })),
          })),
        };
      });
    };

    const onDeleted = (payload: any) => {
      queryClient.setQueryData(["action.chat.list", actionId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((g: any) => ({
              ...g,
              messages: g.messages.map((m: ActionChatMessage) =>
                m.id === payload.messageId
                  ? { ...m, isDeleted: true, body: null, mediaUrl: null }
                  : m,
              ),
            })),
          })),
        };
      });
    };

    pusherClient.bind("message:created", onCreated);
    pusherClient.bind("message:edited", onEdited);
    pusherClient.bind("message:deleted", onDeleted);

    return () => {
      pusherClient.unbind("message:created", onCreated);
      pusherClient.unbind("message:edited", onEdited);
      pusherClient.unbind("message:deleted", onDeleted);
      pusherClient.unsubscribe(channelName);
    };
  }, [actionId, currentUserId, queryClient, isAtBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollTop <= 60 && hasNextPage && !isFetching && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight + prevTop;
        });
      });
    }

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
    setIsAtBottom(nearBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setIsAtBottom(true);
  };

  const isEmpty = !isLoading && items.length === 0;

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative max-h-[420px] min-h-[220px] overflow-y-auto rounded-md border border-border/60 bg-muted/30 flex flex-col"
      >
        {isFetchingNextPage && (
          <div className="sticky top-0 z-20 flex items-center justify-center py-1 bg-background/80 backdrop-blur">
            <Spinner className="size-3" />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 py-10">
            <Spinner className="size-5" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center flex-1 py-10 text-center px-6">
            <MessageSquareIcon className="size-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Comece a conversa com os participantes deste evento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 py-2">
            {items.map((group, gi) => (
              <div key={`${group.date}-${gi}`} className="flex flex-col">
                <div className="flex justify-center my-2 sticky top-0 z-10">
                  <span className="bg-foreground/10 text-foreground text-[9px] font-medium px-2 py-0.5 rounded-md uppercase">
                    {dayjs(group.date).calendar(null, {
                      sameDay: "[Hoje]",
                      lastDay: "[Ontem]",
                      lastWeek: "dddd",
                      sameElse: "DD [de] MMM",
                    })}
                  </span>
                </div>
                {group.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    onSelectMessage={onSelectMessage}
                    onDelete={(id) => deleteMutation.mutate({ messageId: id })}
                    onEdit={(id, body) => setEditingMessage({ id, body })}
                  />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {!isAtBottom && items.length > 0 && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-3 z-20 rounded-full shadow"
            onClick={scrollToBottom}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        )}
      </div>

      {editingMessage && (
        <EditMessageDialog
          isOpen={!!editingMessage}
          onOpenChange={(open) => {
            if (!open) setEditingMessage(null);
          }}
          initialBody={editingMessage.body}
          onSave={(text: string) => {
            editMutation.mutate({
              messageId: editingMessage.id,
              body: text,
            });
            setEditingMessage(null);
          }}
        />
      )}
    </>
  );
}
