import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function NboxLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nbox");
  return children;
}
