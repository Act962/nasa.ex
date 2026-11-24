import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function TrafegoLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("trafego");
  return children;
}
