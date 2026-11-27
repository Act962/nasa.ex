import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("integrations");
  return children;
}
