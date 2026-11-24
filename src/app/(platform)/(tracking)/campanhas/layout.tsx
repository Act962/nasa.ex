import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function CampanhasLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("campanhas");
  return children;
}
