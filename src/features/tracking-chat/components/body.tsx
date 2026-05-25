"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBox } from "./message-box";
import { useParams } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { EmptyChat } from "./empty-chat";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDownIcon } from "lucide-react";
import { pusherClient } from "@/lib/pusher";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import "dayjs/locale/pt-br";

dayjs.extend(calendar);
dayjs.locale("pt-br");

import {
  CreatedMessageProps,
  MessageBodyProps,
  Message,
  MessageStatus,
} from "../types";
import { authClient } from "@/lib/auth-client";
import { MarkedMessage } from "../types";
import { cn } from "@/lib/utils";
import { EditMessage } from "./edit-message";
import { SaveToNBoxPanel } from "./save-to-nbox-panel";

import { useMessageStore } from "../context/use-message";
import { useMutationEditMessage } from "../hooks/use-messages";

interface BodyProps {
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
  conversationId?: string;
  trackingId?: string;
  /** True quando a conversa é um grupo do WhatsApp — ativa renderização
   *  de nome+cor por participante nas mensagens recebidas (estilo WhatsApp). */
  isGroup?: boolean;
}

export function Body({ messageSelected, onSelectMessage, conversationId: conversationIdProp, trackingId, isGroup }: BodyProps) {
  const params = useParams<{ conversationId: string }>();
  const conversationId = conversationIdProp ?? params.conversationId;
  const [saveToNBoxMessage, setSaveToNBoxMessage] = useState<Message | null>(null);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const lastItemIdRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const fetchGuardRef = useRef(false);

  const infinitiOptions = orpc.message.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      conversationId: conversationId,
      cursor: pageParam,
      limit: 30,
    }),
    queryKey: ["message.list", conversationId],
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => ({
      pages: [...data.pages]
        .map((p) => ({
          ...p,
          items: [...p.items]
            .map((group) => ({
              ...group,
              messages: [...group.messages].reverse(),
            }))
            .reverse(),
        }))
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
    const flattened = data?.pages.flatMap((p) => p.items) ?? [];
    const merged: { date: string; messages: Message[] }[] = [];
    flattened.forEach((group) => {
      const last = merged[merged.length - 1];
      if (last && last.date === group.date) {
        last.messages = [...last.messages, ...group.messages];
      } else {
        merged.push({ ...group });
      }
    });
    return merged;
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

    if (
      el.scrollTop <= 80 &&
      hasNextPage &&
      !isFetching &&
      !isFetchingNextPage &&
      !fetchGuardRef.current
    ) {
      fetchGuardRef.current = true;
      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      fetchNextPage().then((result) => {
        if (result.isError) {
          fetchGuardRef.current = false;
          return;
        }

        requestAnimationFrame(() => {
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          fetchGuardRef.current = false;
        });
      });
    }

    if (!skipAutoScrollRef.current) {
      setIsAtBottom(isNearBottom(el));
    }
  };

  useEffect(() => {
    if (!items.length) return;

    const lastId =
      items[items.length - 1].messages[
        items[items.length - 1].messages.length - 1
      ].id;
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

    const updateCacheWithNewMessage = (body: MessageBodyProps) => {
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
          page.items.some((group: any) =>
            group.messages.some(
              (msg: Message) => msg.id === optimisticMessage.id,
            ),
          ),
        );

        if (exists) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((group: any) => ({
                ...group,
                messages: group.messages.map((msg: Message) =>
                  msg.id === optimisticMessage.id ? optimisticMessage : msg,
                ),
              })),
            })),
          };
        }

        const today = dayjs().format("YYYY-MM-DD");
        const firstPage = old.pages[0];
        const firstGroup = firstPage?.items[0];

        if (firstGroup && firstGroup.date === today) {
          return {
            ...old,
            pages: old.pages.map((page: any, i: number) => {
              if (i === 0) {
                return {
                  ...page,
                  items: page.items.map((group: any, j: number) => {
                    if (j === 0) {
                      return {
                        ...group,
                        messages: [optimisticMessage, ...group.messages],
                      };
                    }
                    return group;
                  }),
                };
              }
              return page;
            }),
          };
        }

        const newGroup = { date: today, messages: [optimisticMessage] };
        return {
          ...old,
          pages: old.pages.map((page: any, i: number) => {
            if (i === 0) {
              return {
                ...page,
                items: [newGroup, ...page.items],
              };
            }
            return page;
          }),
        };
      });
    };

    const messageCreatedHandler = (body: CreatedMessageProps) => {
      if (
        body.currentUserId === session.data?.user.id ||
        body.conversation?.id !== conversationId
      )
        return;
      updateCacheWithNewMessage(body);
    };

    const messageNewHandler = (body: MessageBodyProps) => {
      if (body.conversation?.id !== conversationId) return;
      updateCacheWithNewMessage(body);
    };

    // Atualização in-place de uma mensagem específica (ex: revoke do
    // WhatsApp → status DELETED, soft delete do atendente, etc.).
    // Patch direto no cache do React Query pra evitar refetch da
    // página inteira.
    const messageUpdatedHandler = (payload: {
      messageId: string;
      conversationId: string;
      status?: string;
    }) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData(
        ["message.list", conversationId],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((group: any) => ({
                ...group,
                messages: group.messages.map((msg: Message) =>
                  msg.id === payload.messageId
                    ? {
                        ...msg,
                        // DELETED limpa todos os campos visuais — o
                        // backend já fez isso, mas garante consistência
                        // se a notificação chegar antes da resposta.
                        status: (payload.status ?? msg.status) as MessageStatus,
                        ...(payload.status === "DELETED" && {
                          body: null,
                          mediaUrl: null,
                          mediaType: null,
                          mimetype: null,
                          fileName: null,
                        }),
                      }
                    : msg,
                ),
              })),
            })),
          };
        },
      );
    };

    pusherClient.bind("message:created", messageCreatedHandler);
    pusherClient.bind("message:new", messageNewHandler);
    pusherClient.bind("message:updated", messageUpdatedHandler);

    return () => {
      pusherClient.unsubscribe(conversationId);
      pusherClient.unbind("message:new", messageNewHandler);
      pusherClient.unbind("message:created", messageCreatedHandler);
      pusherClient.unbind("message:updated", messageUpdatedHandler);
      bottomRef.current?.scrollIntoView({ block: "end" });
    };
  }, [conversationId, queryClient, session.data?.user.id]);

  const { isEditing, messageToEdit, setIsEditing, cancelEditing, token } =
    useMessageStore();

  const mutationEdit = useMutationEditMessage({ conversationId });

  const remoteJid = data?.pages[0].remoteJid;

  // useEffect(() => {
  //   if (conversationId && remoteJid && token) {
  //     markRead.mutate({
  //       conversationId,
  //       remoteJid,
  //       token,
  //     });
  //   }
  // }, [conversationId, remoteJid, token, items]);

  const isEmpty = !error && !isLoading && items.length === 0;

  function handleEditMessage(text: string, messageId: string) {
    if (!token) return;
    mutationEdit.mutate({
      id: messageId,
      text,
      token,
    });
    setIsEditing(false);
  }

  return (
    <>
      {messageToEdit && (
        <EditMessage
          isOpen={isEditing}
          onOpenChange={setIsEditing}
          initialMessage={messageToEdit}
          onSave={handleEditMessage}
        />
      )}
      <div
        // Background NASA estilo WhatsApp Web — JPG comprimido (q=70).
        // Desktop horizontal + mobile vertical. ~178KB cada (vs 1.3MB do
        // PNG original). `bg-fixed` mantém o pattern parado durante scroll
        // e cacheado entre conversas (1 request por sessão).
        className={cn(
          "flex-1 min-h-0 overflow-y-auto scroll-cols-tracking relative",
          "bg-[url('/chat-bg/mobile.jpg')] md:bg-[url('/chat-bg/desktop.jpg')]",
          "bg-cover bg-center bg-fixed",
          // Fallback caso a imagem não carregue
          "bg-[#dbe9f7] dark:bg-zinc-900",
        )}
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
          <div className="flex flex-col gap-2 p-4">
            {items.map((group, groupIndex) => (
              <div key={group.date + groupIndex} className="flex flex-col">
                <div className="flex justify-center my-4 sticky top-2 z-10">
                  <span className="bg-foreground/10 text-foreground text-[9px] font-medium px-2 py-1 rounded-md shadow-sm uppercase">
                    {dayjs(group.date).calendar(null, {
                      sameDay: "[Hoje]",
                      lastDay: "[Ontem]",
                      lastWeek: "dddd",
                      sameElse: "DD [de] MMMM [de] YYYY",
                    })}
                  </span>
                </div>
                {group.messages.map((message) => (
                  <MessageBox
                    key={message.id}
                    message={{
                      ...message,
                      status: message.status as MessageStatus,
                    }}
                    onSelectMessage={onSelectMessage}
                    onSaveToNBox={(msg) => setSaveToNBoxMessage(msg)}
                    messageSelected={messageSelected}
                    conversationId={conversationId}
                    trackingId={trackingId}
                    isGroup={isGroup}
                  />
                ))}
              </div>
            ))}
          </div>
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

      {saveToNBoxMessage && (
        <SaveToNBoxPanel
          message={{
            body: saveToNBoxMessage.body,
            mediaUrl: saveToNBoxMessage.mediaUrl,
            mimetype: saveToNBoxMessage.mimetype,
            fileName: saveToNBoxMessage.fileName,
          }}
          onClose={() => setSaveToNBoxMessage(null)}
        />
      )}
    </>
  );
}
