import { SidebarInset } from "@/components/ui/sidebar";
import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function FormLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("cosmic");
  return <SidebarInset className="min-w-0 overflow-x-hidden">{children}</SidebarInset>;
}
