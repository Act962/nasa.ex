"use client";

import { BotIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ChatBotIaGeneralTab } from "./chatbot-ia-general-tab";
import { ChatBotIaButtonsTab } from "./chatbot-ia-buttons-tab";
import { ChatBotIaModelTab } from "./chatbot-ia-model-tab";
import { ChatBotIaUsageTab } from "./chatbot-ia-usage-tab";

export function ChatBotIa({ trackingId }: { trackingId: string }) {
  const [iaTab, setIaTab] = useQueryState(
    "iaTab",
    parseAsString.withDefault("general"),
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BotIcon className="size-4 " />
            <h2 className="text-xl font-semibold">Chatbot IA</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Personalize seu agente de IA para respoder de acordo com seu negócio
          </p>
        </div>
      </div>

      <Tabs value={iaTab} onValueChange={setIaTab} className="gap-6">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="buttons">Botões</TabsTrigger>
          <TabsTrigger value="model">Modelo</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <ChatBotIaGeneralTab trackingId={trackingId} />
        </TabsContent>

        <TabsContent value="buttons">
          <ChatBotIaButtonsTab trackingId={trackingId} />
        </TabsContent>

        <TabsContent value="model">
          <ChatBotIaModelTab trackingId={trackingId} />
        </TabsContent>

        <TabsContent value="usage">
          <ChatBotIaUsageTab trackingId={trackingId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
