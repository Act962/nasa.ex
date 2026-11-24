import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function AgendasLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("spacetime");
  return children;
}
