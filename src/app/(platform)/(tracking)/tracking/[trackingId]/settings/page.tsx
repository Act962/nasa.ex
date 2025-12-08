import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { General } from "./tabs/general";
import { Participants } from "./tabs/participants";
import { Reasons } from "./tabs/reasons";

type SettingTrackingPage = {
  params: Promise<{ trackingId: string }>;
};

const tabs = [
  {
    name: "Geral",
    value: "general",
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
    name: "Participantes",
    value: "participants",
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
    name: "Motivos de ganho",
    value: "reasons_win",
    content: (
      <>
        All your <span className="text-foreground font-semibold">reasons</span>{" "}
        are saved here. Revisit articles, collections, and moments you love, any
        time you want a little inspiration.
      </>
    ),
  },
  {
    name: "Motivos de perda",
    value: "reasons_loss",
    content: (
      <>
        <span className="text-foreground font-semibold">Motivos de perda!</span>{" "}
        Here&apos;s something unexpected—a fun fact, a quirky tip, or a daily
        challenge. Come back for a new surprise every day!
      </>
    ),
  },
];

export default async function Page({ params }: SettingTrackingPage) {
  const { trackingId } = await params;

  const tabs = [
    {
      name: "Geral",
      value: "general",
      content: <General />,
    },
    {
      name: "Participantes",
      value: "participants",
      content: <Participants />,
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
  ];

  return (
    <div className="w-full px-4">
      <Tabs
        defaultValue="general"
        orientation="vertical"
        className="flex-row gap-6"
      >
        <TabsList className="bg-background h-full flex-col rounded-none p-0 w-1/4">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full w-full justify-start rounded-none border-0 border-l-2 border-transparent data-[state=active]:shadow-none py-3"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
