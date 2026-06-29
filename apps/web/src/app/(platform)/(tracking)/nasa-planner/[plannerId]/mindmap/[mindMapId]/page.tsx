import { SidebarInset } from "@/components/ui/sidebar";
import { NasaPlannerMindMapEditor } from "@/features/nasa-planner/components/mind-map-editor";

type Props = {
  params: Promise<{ plannerId: string; mindMapId: string }>;
};

export default async function MindMapPage({ params }: Props) {
  const { plannerId, mindMapId } = await params;
  return (
    <SidebarInset className="overflow-hidden h-screen">
      <NasaPlannerMindMapEditor plannerId={plannerId} mindMapId={mindMapId} />
    </SidebarInset>
  );
}
