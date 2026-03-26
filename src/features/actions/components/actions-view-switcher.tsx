"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { DataKanban } from "./data-kanban";
import { useState } from "react";
import { CreateActionModal } from "./create-action-modal";

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
        className="flex-1 w-full border rounded-md"
        defaultValue={view}
        onValueChange={setView}
      >
        <div className="h-full flex flex-col overflow-auto p-4">
          <div className="flex flex-col gap-y-2 lg:flex-row justify-between items-center">
            <TabsList className="w-full lg:w-auto ">
              <TabsTrigger value="list" className="h-8 w-full lg:w-auto ">
                Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="h-8 w-full lg:w-auto">
                Kanban
              </TabsTrigger>
              <TabsTrigger value="calendar" className="h-8 w-full lg:w-auto">
                Calendário
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
          <Separator className="my-4" />
          {/* Add filters */}
          Filtros
          <Separator className="my-4" />
          <>
            <TabsContent value="list" className="mt-0">
              Data table
            </TabsContent>

            <TabsContent value="kanban" className="mt-0">
              <DataKanban workspaceId={workspaceId} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-0">
              Calendário
            </TabsContent>
          </>
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
