"use client";

import { ImageIcon, SendIcon } from "lucide-react";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import {
  InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Message } from "./message-box";
import { toast } from "sonner";

interface FooterProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export type MessagePage = {
  items: Message[];
  nextCursor?: string;
};
export type InfiniteMessages = InfiniteData<MessagePage>;
export function Footer({ conversationId, lead }: FooterProps) {
  const trackingId = "cmjmw5z3q0000t0vamxz21061";

  const instance = useQueryInstances(trackingId);

  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.message.create.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });
        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;

        const optimisticMessage: Message = {
          id: tempId,
          body: data.body,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: null,
          conversation: {
            lead: {
              id: lead.id,
              name: lead.name,
            },
          },
        };
        queryClient.setQueryData(
          ["message.list", conversationId],
          (old: any) => {
            if (!old) {
              return {
                pages: [
                  {
                    items: [optimisticMessage],
                    nextCursor: undefined,
                  },
                ],
                pageParams: [undefined],
              } satisfies InfiniteMessages;
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
          },
        );
        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _varibalies, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => {
            if (!old) return old;

            const updatePages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((message) =>
                message.id === context?.tempId
                  ? {
                      ...data.message,
                    }
                  : message,
              ),
            }));
            return { ...old, pages: updatePages };
          },
        );
      },
      onError(_err, _varibalies, context) {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        return toast.error("Erro ao enviar mensagem");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!instance.instance) return;
    mutation.mutate({
      body: e.currentTarget.message.value,
      leadPhone: lead.phone!,
      token: instance.instance.apiKey,
      conversationId: conversationId,
    });
    e.currentTarget.reset();
  };

  return (
    <div className="py-4 px-4 bg-accent-foreground/10 border-t flex items-center gap-2 lg:gap-4 w-full">
      <ImageIcon className="" />
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 lg:gap-4 w-full"
      >
        <MessageInput
          autoComplete="off"
          name="message"
          placeholder="Digite sua mensagem..."
        />
        <Button type="submit" className="rounded-full">
          <SendIcon size={18} />
        </Button>
      </form>
    </div>
  );
}
