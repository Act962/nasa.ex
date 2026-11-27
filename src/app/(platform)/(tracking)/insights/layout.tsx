import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("insights");
  return children;
}
