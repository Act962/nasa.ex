import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function FlowastroLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("flowastro");
  return children;
}
