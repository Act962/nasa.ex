import { SidebarInset } from "@/components/ui/sidebar";
import { NasaCommandCenter } from "@/features/nasa-command/components/nasa-command-center";

export default function PlatformHomePage() {
  return (
    <SidebarInset className="overflow-hidden">
      <NasaCommandCenter />
    </SidebarInset>
  );
}
