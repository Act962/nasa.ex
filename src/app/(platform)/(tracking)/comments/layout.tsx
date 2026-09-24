import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";

/**
 * O padding mora em cada página, não aqui: o editor de automação é full-bleed
 * (canvas ocupa tudo) e não pode herdar respiro do layout.
 */
export default function CommentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarInset className="flex h-svh min-h-0 flex-col">
      <HeaderTracking />
      {children}
    </SidebarInset>
  );
}
