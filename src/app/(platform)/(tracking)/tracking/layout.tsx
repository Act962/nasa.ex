import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function TrackingLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("tracking");
  return children;
}
