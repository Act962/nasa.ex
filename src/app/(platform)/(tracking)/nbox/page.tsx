import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { NBoxApp } from "@/features/nbox/components/nbox-app";

export default async function NBoxPage({ searchParams }: { searchParams: Promise<{ pasta?: string }> }) {
  const { pasta } = await searchParams;
  return (
    <SidebarInset className="overflow-hidden">
      <NBoxApp key={pasta ?? "root"} initialFolderId={pasta ?? null} />
    </SidebarInset>
  );
}
