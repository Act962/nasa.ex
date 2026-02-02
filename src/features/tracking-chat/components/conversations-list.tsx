"use client";

import { LeadBox } from "./lead-box";
import { RocketIcon, UserPlusIcon, UserRoundPlusIcon } from "lucide-react";
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
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTracking } from "@/features/tracking-settings/hooks/use-tracking";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { EmptyChat } from "./empty-chat";
import Link from "next/link";

export function ConversationsList() {
  const isOpen = true;
  const [open, setOpen] = useState(false);
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const [selectedTracking, setSelectedTracking] = useState<string>("");

  useEffect(() => {
    if (!isLoadingTrackings && trackings.length > 0 && !selectedTracking) {
      setSelectedTracking(trackings[0].id);
    }
  }, [trackings, isLoadingTrackings, selectedTracking]);
  const { data, isLoading } = useQueryConversation(selectedTracking);

  if (isLoading || isLoadingTrackings) {
    return (
      <aside
        className={`fixed inset-y-0 pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full left-12 ${isOpen ? "hidden" : "block w-full left-0"}`}
      >
        <div className="px-5">
          <div className="flex justify-between mb-4 pt-4">
            <div className="text-lg font-medium">Tracking Chat</div>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-16 mt-1" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  const currentTracking = trackings.find((t) => t.id === selectedTracking);
  const whatsappInstance = currentTracking?.whatsappInstances?.[0];
  const noInstance = !whatsappInstance;
  const instanceDisconnected =
    whatsappInstance?.status === WhatsAppInstanceStatus.DISCONNECTED;

  return (
    <>
      <aside
        className={`fixed inset-y-0 pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full left-12 ${isOpen ? "hidden" : "block w-full left-0"}`}
      >
        <div className="px-5">
          <div className="flex justify-between mb-4 pt-4">
            <div className="text-lg font-medium">Tracking Chat</div>
            {!noInstance && !instanceDisconnected && (
              <div className="cursor-pointer">
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  <UserRoundPlusIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Select
              onValueChange={(value) => setSelectedTracking(value)}
              value={selectedTracking}
              disabled={isLoadingTrackings}
              defaultValue={trackings[0]?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {trackings.map((tracking) => (
                    <SelectItem key={tracking.id} value={tracking.id}>
                      {tracking.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {noInstance || instanceDisconnected ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia>
                    <RocketIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {noInstance
                      ? "Nenhuma instância encontrada"
                      : "Instância desconectada"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {noInstance
                      ? "Configure uma instância para iniciar"
                      : "Conecte a instância para iniciar"}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="default" asChild>
                    <Link
                      href={`/tracking/${selectedTracking}/settings?tab=instance`}
                    >
                      Configurar Instância
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                {data?.items.length === 0 && (
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
                {data?.items.map((item) => (
                  <LeadBox
                    key={item.id}
                    item={item}
                    lastMessageText={item.lastMessage.body}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </aside>
      <CreateChatDialog isOpen={open} onOpenChange={setOpen} />
    </>
  );
}
