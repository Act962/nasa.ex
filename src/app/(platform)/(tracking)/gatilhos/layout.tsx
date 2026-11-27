import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function GatilhosLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("gatilhos");
  return children;
}
