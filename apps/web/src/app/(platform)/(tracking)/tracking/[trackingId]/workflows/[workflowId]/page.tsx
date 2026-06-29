import { Editor, EditorLoading } from "@/features/editor/components/editor";
import { EditorHeader } from "@/features/editor/components/editor-header";
import { prefetchWorkflow } from "@/features/workflows/server/prefetch";
import { orpc } from "@/lib/orpc";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { Suspense } from "react";

interface Props {
  params: Promise<{
    workflowId: string;
  }>;
}

export default async function WorkflowPage({ params }: Props) {
  const { workflowId } = await params;
  const queryClient = getQueryClient();

  await prefetchWorkflow(queryClient, workflowId);

  return (
    <HydrateClient client={queryClient}>
      <Suspense fallback={<EditorLoading />}>
        <EditorHeader workflowId={workflowId} />
        <main className="flex-1">
          <Editor workflowId={workflowId} />
        </main>
      </Suspense>
    </HydrateClient>
  );
}
