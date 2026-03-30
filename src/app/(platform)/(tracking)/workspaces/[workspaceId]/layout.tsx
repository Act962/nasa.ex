import { SidebarInset } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SidebarInset className="h-screen">{children}</SidebarInset>;
}
