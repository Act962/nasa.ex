import { FlowEditor } from "@/features/attendance-flows/components/editor/flow-editor";

interface FlowAstroEditorPageProps {
  params: Promise<{ workflowId: string }>;
}

export default async function FlowAstroEditorPage({ params }: FlowAstroEditorPageProps) {
  const { workflowId } = await params;
  return (
    <div className="h-[calc(100dvh-1rem)] min-h-[600px] w-full min-w-0 flex-1 overflow-hidden">
      <FlowEditor workflowId={workflowId} />
    </div>
  );
}
