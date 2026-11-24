import { TrackingChatShell } from "@/features/tracking-chat/components/tracking-chat-shell";
import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function TrackingChatLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nasachat");
  return <TrackingChatShell>{children}</TrackingChatShell>;
}
