"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadInfo } from "./lead-info";
import { LeadFull } from "@/types/lead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardListIcon,
  EditIcon,
  FileIcon,
  RouteIcon,
  StickyNoteIcon,
} from "lucide-react";
import { TabNotes } from "./notes";
import { LeadAttachmentsByFolder } from "./lead-files/lead-attachments-by-folder";
import { ObservationLead } from "./observations";
import { JourneyTimeline } from "./journey-timeline";
import { LeadFormResponses } from "./lead-form-responses";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";

interface LeadDatailsProps {
  initialData: LeadFull;
}

export function LeadDetails({ initialData }: LeadDatailsProps) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const leadId = initialData.lead.id;
  // Aceita `?tab=<value>` pra deep-link na tab desejada (ex: o ícone
  // branco de form no card do kanban leva pra `/contatos/<id>?tab=forms`).
  const tabFromUrl = searchParams?.get("tab") ?? null;

  // Real-time: assina o canal interno do lead pra que tags, status,
  // jornada e respostas de formulário atualizem sem F5. O servidor
  // dispara `update` no canal `lead-internal-<id>` em todo update via
  // `notifyInternalLeadChannel` (chamado em recordLeadEvent + leads/update).
  // Invalida as queries que cobrem a UI atual.
  useEffect(() => {
    if (!leadId) return;
    const channel = pusherClient.subscribe(`lead-internal-${leadId}`);
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: orpc.leads.get.queryKey({ input: { id: leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.leads.getJourney.queryKey({ input: { leadId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.leads.listFormResponses.queryKey({ input: { leadId } }),
      });
      // tags do lead — view list e dropdown lateral
      queryClient.invalidateQueries({ queryKey: orpc.leads.list.queryKey() });
    };
    channel.bind("update", handler);
    return () => {
      channel.unbind("update", handler);
      pusherClient.unsubscribe(`lead-internal-${leadId}`);
    };
  }, [leadId, queryClient]);
  const tabs = [
    {
      name: "Observações",
      value: "observations",
      icon: EditIcon,
      content: (
        <ObservationLead
          leadId={initialData.lead.id}
          trackingId={initialData.lead.trackingId}
          description={initialData.lead.description}
        />
      ),
    },
    {
      name: "Jornada",
      value: "journey",
      icon: RouteIcon,
      content: <JourneyTimeline leadId={initialData.lead.id} />,
    },
    {
      name: "Arquivos",
      value: "files",
      icon: FileIcon,
      content: <LeadAttachmentsByFolder leadId={initialData.lead.id} />,
    },
    {
      name: "Formulários",
      value: "forms",
      icon: ClipboardListIcon,
      content: (
        <LeadFormResponses
          leadId={initialData.lead.id}
          trackingId={initialData.lead.trackingId}
        />
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="sm:hidden m-4">Lead Info</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <LeadInfo initialData={initialData} className="w-full" />
        </SheetContent>
      </Sheet>

      <aside className="flex-1 px-8 overflow-hidden">
        <Tabs
          defaultValue={
            tabFromUrl && tabs.some((t) => t.value === tabFromUrl)
              ? tabFromUrl
              : tabs[0].value
          }
          className="flex flex-col h-full gap-4 w-full mt-8 pb-8"
        >
          <TabsList className="p-0 w-full bg-muted/20 shrink-0">
            {tabs.map(({ icon: Icon, name, value }) => (
              <TabsTrigger key={value} value={value} className="w-full">
                <Icon className="size-4" />
                {name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="flex-1 overflow-hidden"
            >
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </aside>
    </div>
  );
}
