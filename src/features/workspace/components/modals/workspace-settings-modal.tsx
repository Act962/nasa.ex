"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Columns, Users, AlertTriangle, TagIcon, ZapIcon } from "lucide-react";
import { useWorkspace } from "@/features/workspace/hooks/use-workspace";
import { useQueryState } from "nuqs";
import { ToastProvider } from "@/contexts/toast-context";
import { GeneralTab } from "./tabs/general-tab";
import { ColumnsTab } from "./tabs/columns-tab";
import { MembersTab } from "./tabs/members-tab";
import { LabelsTab } from "./tabs/labels-tab";
import { AutomationsTab } from "./tabs/automations-tab";
import { DangerZoneTab } from "./tabs/danger-zone-tab";
import { TemplatesTab } from "./tabs/templates-tab";

interface Props {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceSettingsModal({ workspaceId, open, onOpenChange }: Props) {
  const { data: workspaceData, isLoading } = useWorkspace(workspaceId);
  const [view, setView] = useQueryState("workspace_settings", { defaultValue: "general" });

  if (isLoading || !workspaceData?.workspace) return null;
  const workspace = workspaceData.workspace;

  return (
    <ToastProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[80%] max-h-[90vh] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="text-xl font-semibold">Configurações</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={view} onValueChange={setView} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-8 mt-4 flex-wrap h-auto">
                <TabsTrigger value="general"><Settings className="size-4 mr-2" />Geral</TabsTrigger>
                <TabsTrigger value="columns"><Columns className="size-4 mr-2" />Colunas</TabsTrigger>
                <TabsTrigger value="members"><Users className="size-4 mr-2" />Participantes</TabsTrigger>
                <TabsTrigger value="labels"><TagIcon className="size-4 mr-2" />Etiquetas</TabsTrigger>
                <TabsTrigger value="automations"><ZapIcon className="size-4 mr-2" />Automações</TabsTrigger>
                <TabsTrigger value="templates">✨ Padrões</TabsTrigger>
                <TabsTrigger value="danger"><AlertTriangle className="size-4 mr-2" />Zona de Perigo</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-8">
                <TabsContent value="general" className="mt-0 focus-visible:outline-none">
                  <GeneralTab workspace={workspace} />
                </TabsContent>
                <TabsContent value="columns" className="mt-0 focus-visible:outline-none">
                  <ColumnsTab workspaceId={workspaceId} />
                </TabsContent>
                <TabsContent value="members" className="mt-0 focus-visible:outline-none">
                  <MembersTab workspaceId={workspaceId} />
                </TabsContent>
                <TabsContent value="labels" className="mt-0 focus-visible:outline-none">
                  <LabelsTab workspaceId={workspaceId} />
                </TabsContent>
                <TabsContent value="automations" className="mt-0 focus-visible:outline-none">
                  <AutomationsTab workspaceId={workspaceId} />
                </TabsContent>
                <TabsContent value="templates" className="mt-0 focus-visible:outline-none">
                  <TemplatesTab workspace={workspace} workspaceId={workspaceId} />
                </TabsContent>
                <TabsContent value="danger" className="mt-0 focus-visible:outline-none">
                  <DangerZoneTab workspace={workspace} onDeleted={() => onOpenChange(false)} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </ToastProvider>
  );
}
