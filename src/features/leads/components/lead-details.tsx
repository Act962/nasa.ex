"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadInfo } from "./lead-info";
import { LeadFull } from "@/types/lead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileIcon, StickyNoteIcon } from "lucide-react";
import { TabNotes } from "./notes";
import { LeadFiles } from "./lead-files/lead-files";

interface LeadDatailsProps {
  initialData: LeadFull;
}

export function LeadDetails({ initialData }: LeadDatailsProps) {
  const tabs = [
    {
      name: "Notas",
      value: "notes",
      icon: StickyNoteIcon,
      content: (
        <TabNotes
          leadId={initialData.lead.id}
          trackingId={initialData.lead.trackingId}
        />
      ),
    },
    {
      name: "Arquivos",
      value: "files",
      icon: FileIcon,
      content: <LeadFiles leadId={initialData.lead.id} />,
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
          defaultValue={tabs[0].value}
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
