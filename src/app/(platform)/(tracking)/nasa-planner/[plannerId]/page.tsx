import { SidebarInset } from "@/components/ui/sidebar";
import { NasaPlannerApp } from "@/features/nasa-planner/components/nasa-planner-app";

type Props = {
  params: Promise<{ plannerId: string }>;
};

export default async function NasaPlannerDetailPage({ params }: Props) {
  const { plannerId } = await params;
  return (
    <SidebarInset className="overflow-hidden">
      <NasaPlannerApp plannerId={plannerId} />
    </SidebarInset>
  );
}
