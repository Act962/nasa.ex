import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";

export default function CommentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">{children}</div>
    </SidebarInset>
  );
}
