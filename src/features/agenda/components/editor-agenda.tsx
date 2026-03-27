"use client";

import { useQueryState } from "nuqs";
import { useSuspenseAgenda } from "../hooks/use-agenda";
import { HeaderAgenda } from "./header";
import { Tabs, TabsTrigger, TabsList, TabsContent } from "@/components/ui/tabs";
import { ArrowRightIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Availability } from "./availability";
import { General } from "./general";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Workflow } from "./workflow";

interface EditorAgendaProps {
  agendaId: string;
}

const tags = [
  {
    label: "Geral",
    value: "general",
  },
  {
    label: "Disponibilidade",
    value: "availability",
  },
  {
    label: "Fluxo de trabalho",
    value: "workflow",
  },
];

export function EditorAgenda({ agendaId }: EditorAgendaProps) {
  const { data } = useSuspenseAgenda(agendaId);
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "general",
  });

  return (
    <div className="w-full h-full">
      <HeaderAgenda agendaId={agendaId} />
      <div className="h-full w-full px-5 flex gap-5 py-4">
        <Tabs
          defaultValue={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="w-full flex flex-col md:flex-row items-start h-full"
        >
          <TabsList className="sticky top-0 flex flex-col h-full bg-transparent w-full md:w-1/6">
            {tags.map((tag) => (
              <TabsTrigger
                key={tag.value}
                value={tag.value}
                className="justify-between w-full"
              >
                {tag.label}
                {tab === tag.value && <ArrowRightIcon />}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="w-full">
            <TabsContent value="general">
              <General defaultValues={data.agenda} />
            </TabsContent>
            <TabsContent value="availability">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                }
              >
                <Availability
                  agendaId={agendaId}
                  availabilities={data.agenda.availabilities}
                  slotDuration={data.agenda.slotDuration}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="workflow">
              <Workflow defaultValues={data.agenda} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
