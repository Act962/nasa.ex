import { SidebarInset } from "@/components/ui/sidebar";
import { NasaPostApp } from "@/features/nasa-post/components/nasa-post-app";

export default function NasaPostPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <NasaPostApp />
    </SidebarInset>
  );
}
