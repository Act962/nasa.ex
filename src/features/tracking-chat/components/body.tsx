"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBox } from "./message-box";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { EmptyChat } from "./empty-chat";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDownIcon } from "lucide-react";
import { pusherClient } from "@/lib/pusher";
import {
  CreatedMessageProps,
  MessageBodyProps,
  Message,
  MessageStatus,
} from "../types";
import { authClient } from "@/lib/auth-client";
import { MarkedMessage } from "../types";
import { cn } from "@/lib/utils";

interface BodyProps {
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
}

export function Body({ messageSelected, onSelectMessage }: BodyProps) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const lastItemIdRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const session = authClient.useSession();

  const infinitiOptions = orpc.message.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      conversationId: conversationId,
      cursor: pageParam,
      limit: 10,
    }),
    queryKey: ["message.list", conversationId],
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => ({
      pages: [...data.pages]
        .map((p) => ({ ...p, items: [...p.items].reverse() }))
        .reverse(),
      pageParams: [...data.pageParams],
    }),
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    error,
  } = useInfiniteQuery({
    ...infinitiOptions,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => {
    return data?.pages.flatMap((p) => p.items) ?? [];
  }, [data]);

  useEffect(() => {
    if (!hasInitialScrolled && data?.pages.length) {
      const el = scrollRef.current;

      if (el) {
        bottomRef.current?.scrollIntoView({ block: "end" });
        el.scrollTop = el.scrollHeight;
        setHasInitialScrolled(true);
        setIsAtBottom(true);
      }
    }
  }, [hasInitialScrolled, data?.pages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollToBottomIfNeeded = () => {
      if (skipAutoScrollRef.current) return;
      if (isAtBottom || !hasInitialScrolled) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ block: "end" });
        });
      }
    };

    function onImageLoad(e: Event) {
      if (e.target instanceof HTMLImageElement) {
        scrollToBottomIfNeeded();
      }
    }

    el.addEventListener("load", onImageLoad, true);

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottomIfNeeded();
    });

    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(() => {
      scrollToBottomIfNeeded();
    });

    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("load", onImageLoad, true);
      mutationObserver.disconnect();
    };
  }, [isAtBottom, hasInitialScrolled]);

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= 80;

  const skipAutoScrollRef = useRef(false);

  useEffect(() => {
    const handleManualScroll = () => {
      skipAutoScrollRef.current = true;
      setIsAtBottom(false);
      setNewMessages(false);
      // Re-enable auto-scroll logic after enough time for the smooth scroll and animation to finish
      setTimeout(() => {
        skipAutoScrollRef.current = false;
      }, 3000);
    };

    window.addEventListener("manual-scroll-started", handleManualScroll);
    return () =>
      window.removeEventListener("manual-scroll-started", handleManualScroll);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;

    if (!el) return;

    if (el.scrollTop <= 80 && hasNextPage && !isFetching) {
      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;
      fetchNextPage().then(() => {
        const newScrollHeight = el.scrollHeight;

        el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
      });
    }

    if (!skipAutoScrollRef.current) {
      setIsAtBottom(isNearBottom(el));
    }
  };

  useEffect(() => {
    if (!items.length) return;

    const lastId = items[items.length - 1].id;
    const prevLastId = lastItemIdRef.current;

    const el = scrollRef.current;

    if (prevLastId && lastId !== prevLastId) {
      if (el && isNearBottom(el)) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });

        setNewMessages(false);
        setIsAtBottom(true);
      } else {
        setNewMessages(true);
      }
    }

    lastItemIdRef.current = lastId;
  }, [items]);

  const scrollToBottom = () => {
    const el = scrollRef.current;

    if (!el) return;

    bottomRef.current?.scrollIntoView({ block: "end" });

    setNewMessages(false);
    setIsAtBottom(true);
  };

  useEffect(() => {
    pusherClient.subscribe(conversationId);
    bottomRef.current?.scrollIntoView({ block: "end" });

    pusherClient.bind("message:created", (body: CreatedMessageProps) => {
      if (body.currentUserId === session.data?.user.id) return;
      queryClient.setQueryData(["message.list", conversationId], (old: any) => {
        if (!old) return old;

        const optimisticMessage: Message = {
          ...body,
          body: body.body,
          status: MessageStatus.SEEN,
          conversation: {
            lead: {
              name: body.conversation?.lead?.name || "",
              id: body.conversation?.lead?.id,
            },
          },
        };

        const exists = old.pages.some((page: any) =>
          page.items.some((msg: Message) => msg.id === optimisticMessage.id),
        );

        if (exists) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((msg: Message) =>
                msg.id === optimisticMessage.id ? optimisticMessage : msg,
              ),
            })),
          };
        }

        const firstPage = old.pages[0] ?? {
          items: [],
          nextCursor: undefined,
        };
        const updatedFirstPage = {
          ...firstPage,
          items: [optimisticMessage, ...firstPage.items],
        };
        return {
          ...old,
          pages: [updatedFirstPage, ...old.pages.slice(1)],
        };
      });
    });

    pusherClient.bind("message:new", (body: MessageBodyProps) => {
      queryClient.setQueryData(["message.list", conversationId], (old: any) => {
        if (!old) return old;

        const optimisticMessage: Message = {
          ...body,
          body: body.body,
          status: MessageStatus.SEEN,
          conversation: {
            lead: {
              name: body.conversation?.lead?.name || "",
              id: body.conversation?.lead?.id,
            },
          },
        };

        const exists = old.pages.some((page: any) =>
          page.items.some((msg: Message) => msg.id === optimisticMessage.id),
        );

        if (exists) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((msg: Message) =>
                msg.id === optimisticMessage.id ? optimisticMessage : msg,
              ),
            })),
          };
        }

        const firstPage = old.pages[0] ?? {
          items: [],
          nextCursor: undefined,
        };
        const updatedFirstPage = {
          ...firstPage,
          items: [optimisticMessage, ...firstPage.items],
        };
        return {
          ...old,
          pages: [updatedFirstPage, ...old.pages.slice(1)],
        };
      });
    });

    return () => {
      pusherClient.unsubscribe(conversationId);
      pusherClient.unbind("message:new");
      pusherClient.unbind("message:created");
      bottomRef.current?.scrollIntoView({ block: "end" });
    };
  }, [conversationId, queryClient]);

  const isEmpty = !error && !isLoading && items.length === 0;

  return (
    <>
      <div
        className="flex-1 min-h-0 overflow-y-auto scroll-cols-tracking relative"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {isEmpty ? (
          <div className="flex items-center justify-center h-full">
            <EmptyChat
              title="Nenhuma mensagem"
              description="inicie o chat enviando uma mensagem"
            />
          </div>
        ) : (
          items.map((message) => (
            <MessageBox
              key={message.id}
              message={{ ...message, status: message.status as MessageStatus }}
              onSelectMessage={onSelectMessage}
              messageSelected={messageSelected}
              conversationId={conversationId}
            />
          ))
        )}
        <div ref={bottomRef}></div>
      </div>
      {isFetchingNextPage && (
        <div className="pointer-events-none absolute top-17 left-0 right-0 z-20 flex items-center justify-center py-2">
          <div>
            <Spinner className="size-4" />
          </div>
        </div>
      )}
      {!isAtBottom && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={cn(
            "absolute bottom-20 right-5 z-20 rounded-full ",
            messageSelected && "bottom-40",
          )}
          onClick={scrollToBottom}
        >
          <ChevronDownIcon />
        </Button>
      )}
    </>
  );
}
