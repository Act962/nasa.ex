import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { General } from "./tabs/general";
import { Participants } from "./tabs/participants";
import { Reasons } from "./tabs/reasons";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ChatSettings } from "@/features/tracking/components/chat-settings";

type SettingTrackingPage = {
  params: Promise<{ trackingId: string }>;
};

export default async function Page({ params }: SettingTrackingPage) {
  const { trackingId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: { trackingId: trackingId },
    }),
  );

  await queryClient.prefetchQuery(
    orpc.tracking.get.queryOptions({
      input: { trackingId },
    }),
  );

  const tabs = [
    {
      name: "Geral",
      value: "general",
      content: (
        <HydrateClient client={queryClient}>
          <General />
        </HydrateClient>
      ),
    },
    {
      name: "Participantes",
      value: "participants",
      content: (
        <HydrateClient client={queryClient}>
          <Participants />
        </HydrateClient>
      ),
    },
    {
      name: "Motivos de ganho",
      value: "reasons_win",
      content: <Reasons type="WIN" trackingId={trackingId} />,
    },
    {
      name: "Motivos de perda",
      value: "reasons_loss",
      content: <Reasons type="LOSS" trackingId={trackingId} />,
    },
    {
      name: "Integrações",
      value: "integrations",
      content: (
        <HydrateClient client={queryClient}>
          <ChatSettings />
        </HydrateClient>
      ),
    },
  ];

  return (
    <div className="w-full">
      <Tabs
        defaultValue="general"
        orientation="horizontal"
        className="flex-col sm:flex-row gap-6"
      >
        <TabsList className="bg-background h-full flex-row sm:flex-col rounded-none p-0 w-full sm:w-1/4 border-b sm:border-b-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full w-auto sm:w-full justify-start rounded-none border-0 border-b-2 sm:border-l-2 sm:border-b-0 border-transparent data-[state=active]:shadow-none sm:py-3 whitespace-nowrap px-4 first:pl-0 sm:first:pl-4"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="px-4 w-full py-4">
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
