import { SidebarInset } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SidebarInset className="min-w-0 overflow-x-hidden">{children}</SidebarInset>;
}
