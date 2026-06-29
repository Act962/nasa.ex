"use client";

import { UserPlusIcon, XIcon, SendIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMemo, useState } from "react";
import { useConversationListInfinite } from "../hooks/use-conversation";

interface ContactsPanelProps {
  onClose: () => void;
  trackingId: string;
  excludeConversationId?: string;
  onSelect: (contact: { name: string; phone: string }) => void;
}

export function ContactsPanel({
  onClose,
  trackingId,
  excludeConversationId,
  onSelect,
}: ContactsPanelProps) {
  const [search, setSearch] = useState("");
  const { items, isLoading, isFetchingNextPage, scrollRef, handleScroll } =
    useConversationListInfinite({ trackingId, search });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (c) =>
        c.id !== excludeConversationId &&
        !!c.lead.phone &&
        (c.lead.name?.toLowerCase().includes(q) ||
          c.lead.phone?.toLowerCase().includes(q)),
    );
  }, [items, search, excludeConversationId]);

  const handleSend = (name: string, phone: string) => {
    onSelect({ name, phone });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      <div
        className="
          fixed z-50
          w-[90vw] max-w-md
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
        style={{ maxHeight: "80vh" }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <UserPlusIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Enviar contato</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-5" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
              <UserPlusIcon className="size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">Nenhum contato encontrado</p>
              <p className="text-xs text-muted-foreground">
                Tente buscar por outro nome ou telefone.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((conv) => (
                <li
                  key={conv.id}
                  className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        {conv.lead.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.lead.name}
                      </p>
                      {conv.lead.phone && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lead.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2.5 gap-1.5 shrink-0"
                    onClick={() =>
                      handleSend(conv.lead.name, conv.lead.phone as string)
                    }
                  >
                    <SendIcon className="size-3" />
                    Enviar
                  </Button>
                </li>
              ))}
              {isFetchingNextPage && (
                <li className="flex justify-center py-4">
                  <Spinner className="size-4" />
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
