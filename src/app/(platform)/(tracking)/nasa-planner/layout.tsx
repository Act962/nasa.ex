import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function NasaPlannerLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nasa-planner");
  return children;
}
