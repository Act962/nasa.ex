import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("workspaces");
  return children;
}
