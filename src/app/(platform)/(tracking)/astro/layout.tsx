import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function AstroLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("astro");
  return children;
}
