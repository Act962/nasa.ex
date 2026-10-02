"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConversationChannelCircles } from "./conversation-filters";
import type { ChannelFilter } from "../utils/channel-filter";

interface ChatChannelsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string | null;
  selectedChannel: ChannelFilter;
  onChannelChange: (channel: ChannelFilter) => void;
}

/** Aba dos canais no celular, aberta pelo item "Canais" do dock: os mesmos círculos do desktop. */
export function ChatChannelsSheet({
  open,
  onOpenChange,
  trackingId,
  selectedChannel,
  onChannelChange,
}: ChatChannelsSheetProps) {
  const selectChannel = (channel: ChannelFilter) => {
    onChannelChange(channel);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Canais</SheetTitle>
          <SheetDescription>Escolha de qual canal ver as conversas.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <ConversationChannelCircles
            trackingId={trackingId}
            selectedChannel={selectedChannel}
            onChannelChange={selectChannel}
            className="gap-3"
          />
          {selectedChannel !== "ALL" && (
            <Button variant="outline" onClick={() => selectChannel("ALL")}>
              Ver todos os canais
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
