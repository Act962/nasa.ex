import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function SpaceStationLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("space-station");
  return children;
}
