import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function LinnkerLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("linnker");
  return children;
}
