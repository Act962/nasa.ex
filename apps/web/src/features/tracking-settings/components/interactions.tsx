"use client";

import { Activity } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { InteractionsNoFirstResponseTab } from "./interactions-no-first-response-tab";
import { InteractionsInConvTab } from "./interactions-in-conv-tab";

export function Interactions({ trackingId }: { trackingId: string }) {
  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="size-4 " />
            <h2 className="text-xl font-semibold">Interações</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Configure ações automáticas quando um lead ficar ocioso — ligar IA,
            enviar mensagem ou notificar o responsável.
          </p>
        </div>
      </div>

      <Tabs defaultValue="no-first-response" className="gap-6">
        <TabsList>
          <TabsTrigger value="no-first-response">Sem 1ª resposta</TabsTrigger>
          <TabsTrigger value="in-conv">Em conversa</TabsTrigger>
        </TabsList>

        <TabsContent value="no-first-response">
          <InteractionsNoFirstResponseTab trackingId={trackingId} />
        </TabsContent>

        <TabsContent value="in-conv">
          <InteractionsInConvTab trackingId={trackingId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
