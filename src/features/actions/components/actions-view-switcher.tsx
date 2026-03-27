"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Columns3Icon, ListIcon, PlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";

import { useState } from "react";
import { CreateActionModal } from "./create-action-modal";
import { DataKanban } from "./data-kanban";
import { DataTable } from "./data-table";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
}

export function ActionsViewSwitcher({ workspaceId }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useQueryState("action-view", {
    defaultValue: "list",
  });

  return (
    <>
      <Tabs
        className="flex-1 w-full h-full"
        defaultValue={view || "list"}
        onValueChange={setView}
      >
        <div className="h-full flex flex-col ">
          <div className="sticky top-0 z-50 bg-background  flex flex-col gap-y-2 lg:flex-row justify-between items-center py-2 px-4 border-b">
            <TabsList className="w-full lg:w-auto ">
              <TabsTrigger value="list" className="h-8 w-full lg:w-auto">
                <ListIcon className="size-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="h-8 w-full lg:w-auto">
                <Columns3Icon className="size-4" />
                Kanban
              </TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              className="w-full lg:w-auto"
              onClick={() => setOpen(true)}
            >
              <PlusIcon className="size-4" />
              Nova ação
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <div className={cn("h-full", view !== "list" && "hidden")}>
              <DataTable workspaceId={workspaceId} />
            </div>

            <div className={cn("h-full", view !== "kanban" && "hidden")}>
              <DataKanban workspaceId={workspaceId} />
            </div>

            <div className={cn("h-full", view !== "calendar" && "hidden")}>
              <div className="h-full">Calendário</div>
            </div>
          </div>
        </div>
      </Tabs>
      <CreateActionModal
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
      />
    </>
  );
}
