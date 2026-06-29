"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { CheckIcon, MessageSquareIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useConversationListInfinite } from "../hooks/use-conversation";
import { useForwardMessage } from "../hooks/use-messages";
import {
  buildForwardPayload,
  isForwardable,
} from "../lib/forward-strategies/build-payload";
import { Message } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
  trackingId: string;
  token: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  trackingId,
  token,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const forward = useForwardMessage();

  const { items, isLoading, isFetchingNextPage, scrollRef, handleScroll } =
    useConversationListInfinite({ trackingId, search, enabled: open });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (c) =>
        c.lead.name?.toLowerCase().includes(q) ||
        c.lead.phone?.toLowerCase().includes(q),
    );
  }, [items, search]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIds.length) return;
    if (!isForwardable(message)) return;

    forward.mutate(
      {
        conversationIds: selectedIds,
        token,
        payload: buildForwardPayload(message),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedIds([]);
          setSearch("");
        },
      },
    );
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setSelectedIds([]);
      setSearch("");
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
          <DialogDescription>
            Selecione as conversas para onde deseja encaminhar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[300px] overflow-y-auto pr-1"
          >
            <div className="space-y-2">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              )}

              {!isLoading &&
                filtered.map((conv) => (
                  <button
                    type="button"
                    key={conv.id}
                    onClick={() => toggle(conv.id)}
                    className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      <MessageSquareIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium line-clamp-1">
                          {conv.lead.name}
                        </span>
                        {selectedIds.includes(conv.id) && (
                          <CheckIcon className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                      {conv.lead.phone && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lead.phone}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquareIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Nenhuma conversa encontrada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tente buscar por outro nome ou telefone
                  </p>
                </div>
              )}

              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <Spinner className="size-4" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              className="flex-1"
              type="submit"
              disabled={!selectedIds.length || forward.isPending}
            >
              {forward.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                `Encaminhar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
