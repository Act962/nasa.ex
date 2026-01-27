"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBox } from "./message-box";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";

export function Body() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const lastItemIdRef = useRef<string | undefined>(undefined);

  const infinitiOptions = orpc.message.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      conversationId: conversationId,
      cursor: pageParam,
      limit: 10,
    }),
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
        el.scrollTop = el.scrollHeight;
        setHasInitialScrolled(true);

        setIsAtBottom(true);
      }
    }
  }, [hasInitialScrolled, data?.pages.length]);

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= 80;

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

    setIsAtBottom(isNearBottom(el));
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

    el.scrollTop = el.scrollHeight;

    setNewMessages(false);
    setIsAtBottom(true);
  };

  return (
    <>
      <div
        className="flex-1 min-h-0 overflow-y-auto scroll-cols-tracking"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {items.map((message) => (
          <MessageBox key={message.id} data={message} />
        ))}
      </div>
      {newMessages && !isAtBottom ? (
        <Button
          type="button"
          className="absolute bottom-20 right-8 rounded-full"
          onClick={scrollToBottom}
        >
          New Messages
        </Button>
      ) : null}
    </>
  );
}
