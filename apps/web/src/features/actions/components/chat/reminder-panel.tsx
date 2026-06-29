"use client";

import { BellIcon, XIcon, PlusIcon, ListIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ReminderCreateTab } from "@/features/tracking-chat/components/reminder-panel/reminder-create-tab";
import { ReminderListTab } from "@/features/tracking-chat/components/reminder-panel/reminder-list-tab";

interface ActionReminderPanelProps {
  onClose: () => void;
  actionId: string;
  actionTitle: string;
  defaultPhone?: string | null;
}

export function ActionReminderPanel({
  onClose,
  actionId,
  actionTitle,
  defaultPhone,
}: ActionReminderPanelProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 sm:max-w-md overflow-hidden flex flex-col gap-0 bg-background"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-5 py-3 border-b shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2">
            <BellIcon className="size-4 text-muted-foreground" />
            <DialogTitle className="text-sm font-semibold truncate">
              Lembrete — {actionTitle}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full flex flex-col">
          <div className="px-5 pt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-1.5">
                <PlusIcon className="size-3.5" />
                Criar
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-1.5">
                <ListIcon className="size-3.5" />
                Lembretes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="m-0 border-none outline-none">
            <ReminderCreateTab
              onClose={onClose}
              actionId={actionId}
              phone={defaultPhone ?? ""}
              phoneOptional
            />
          </TabsContent>

          <TabsContent value="list" className="m-0 border-none outline-none">
            <ReminderListTab actionId={actionId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
