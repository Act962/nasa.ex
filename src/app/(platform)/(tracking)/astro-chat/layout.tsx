import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function AstroChatLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("astro-chat");
  return children;
}
