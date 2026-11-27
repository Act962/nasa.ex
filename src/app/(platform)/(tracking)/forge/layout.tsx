import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function ForgeLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("forge");
  return children;
}
