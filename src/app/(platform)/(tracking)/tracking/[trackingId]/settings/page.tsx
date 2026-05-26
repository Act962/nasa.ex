import {
  SettingsTabs,
  type SettingsTab,
} from "@/features/tracking-settings/components/settings-tabs";
import { General } from "@/features/tracking-settings/components/general";
import { Participants } from "@/features/tracking-settings/components/participants";
import { Reasons } from "@/features/tracking-settings/components/reasons";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ChatSettings } from "@/features/tracking-settings/components/chat-settings";
import { ChatBotIa } from "@/features/tracking-settings/components/chatbot-ia";
import { FlowAttendiment } from "@/features/tracking-settings/components/flow-attendiment";
import { SoundNotification } from "@/features/tracking-settings/components/sound-notification";
import { TemplateSettings } from "@/features/tracking-settings/components/template-settings";
import { ToastProvider } from "@/contexts/toast-context";
import { TrackingDangerZone } from "@/features/tracking-settings/components/danger-zone";
import { Personalization } from "@/features/tracking-settings/components/personalization";
import { Interactions } from "@/features/tracking-settings/components/interactions";
import { TimeOfStatus } from "@/features/tracking-settings/components/time-of-status";

type SettingTrackingPage = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function Page({
  params,
  searchParams,
}: SettingTrackingPage) {
  const { trackingId } = await params;
  const { tab } = await searchParams;
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

  const tabs: SettingsTab[] = [
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
      name: "Fluxo de atendimento",
      value: "flow-attendance",
      content: <FlowAttendiment trackingId={trackingId} />,
    },
    {
      name: "Time de Status",
      value: "time-of-status",
      content: <TimeOfStatus trackingId={trackingId} />,
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
      value: "instance",
      content: <ChatSettings />,
    },
    {
      name: "ChatBot AI",
      value: "chatbot-ia",
      content: <ChatBotIa trackingId={trackingId} />,
    },
    {
      name: "Interações",
      value: "interactions",
      content: <Interactions trackingId={trackingId} />,
    },
    {
      name: "Notificação sonora",
      value: "sound-notification",
      content: (
        <HydrateClient client={queryClient}>
          <SoundNotification />
        </HydrateClient>
      ),
    },
    {
      name: "Padrões NASA",
      value: "templates",
      content: <TemplateSettings trackingId={trackingId} />,
    },
    {
      name: "Zona de Perigo",
      value: "danger-zone",
      content: <TrackingDangerZone trackingId={trackingId} />,
    },
    {
      name: "Personalização",
      value: "personalization",
      content: <Personalization trackingId={trackingId} />,
    },
  ];

  return (
    <ToastProvider>
      <div className="w-full">
        <SettingsTabs tabs={tabs} defaultTab={tab || "general"} />
      </div>
    </ToastProvider>
  );
}
