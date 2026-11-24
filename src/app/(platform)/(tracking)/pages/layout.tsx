import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nasa-pages");
  return children;
}
