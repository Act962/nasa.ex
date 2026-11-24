import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function NasaRouteCriadorLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nasa-route");
  return children;
}
