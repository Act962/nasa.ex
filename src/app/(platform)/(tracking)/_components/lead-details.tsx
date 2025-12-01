"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadInfo } from "./lead-info";
import { LeadFull } from "@/types/lead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityIcon, Book, StickyNote } from "lucide-react";
import { RichtTextEditor } from "@/app/(platform)/(tracking)/_components/rich-text-editor/editor";
import { ContainerItemLead } from "./container-item-lead";

const tabs = [
  {
    name: "Atividades",
    value: "activities",
    icon: ActivityIcon,
    content: (
      <>
        Discover{" "}
        <span className="text-foreground font-semibold">fresh ideas</span>,
        trending topics, and hidden gems curated just for you. Start exploring
        and let your curiosity lead the way!
      </>
    ),
  },
  {
    name: "Notas",
    value: "notes",
    icon: StickyNote,
    content: (
      <>
        <RichtTextEditor />
      </>
    ),
  },
  {
    name: "Ações",
    value: "actions",
    icon: Book,

    content: (
      <>
        <span className="text-foreground font-semibold">Surprise!</span>{" "}
        Here&apos;s something unexpected—a fun fact, a quirky tip, or a daily
        challenge. Come back for a new surprise every day!
      </>
    ),
  },
];

interface LeadDatailsProps {
  initialData: LeadFull;
}

export function LeadDetails({ initialData }: LeadDatailsProps) {
  const tabs = [
    {
      name: "Atividades",
      value: "activities",
      icon: ActivityIcon,
      content: (
        <div className="w-full">
          <p className="text-sm">
            <span className="text-foreground font-semibold">Surprise!</span>{" "}
            Here&apos;s something unexpected—a fun fact, a quirky tip, or a
            daily challenge. Come back for a new surprise every day!
          </p>
        </div>
      ),
    },
    {
      name: "Notas",
      value: "notes",
      icon: StickyNote,
      content: (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-semibold">Adicione um nova nota</h2>
          <RichtTextEditor />
          <div className="flex flex-col gap-5">
            <ContainerItemLead
              type="Activity"
              children={<>Uma atividade random</>}
            />
            <ContainerItemLead
              type="Meeting"
              children={<>Uma Reunião random</>}
            />
            <ContainerItemLead type="Note" children={<>Uma nota random</>} />
            <ContainerItemLead type="Task" children={<>Uma Task random</>} />
          </div>
        </div>
      ),
    },
    {
      name: "Ações",
      value: "actions",
      icon: Book,

      content: (
        <div className="w-full">
          <p className="text-sm">
            <span className="text-foreground font-semibold">Surprise!</span>{" "}
            Here&apos;s something unexpected—a fun fact, a quirky tip, or a
            daily challenge. Come back for a new surprise every day!
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="sm:hidden">Lead Info</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <LeadInfo initialData={initialData} className=" w-full" />
        </SheetContent>
      </Sheet>

      <aside className="flex flex-col h-full px-8">
        <Tabs defaultValue={tabs[0].value} className="gap-4 w-full mt-8">
          <TabsList className="p-0 w-full bg-muted/20">
            {tabs.map(({ icon: Icon, name, value }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="w-full"
                //
              >
                <Icon className="size-4" />
                {name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </aside>
    </div>
  );
}
