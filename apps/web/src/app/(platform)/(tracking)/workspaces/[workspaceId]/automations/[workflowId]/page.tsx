import { Suspense } from "react";
import {
  WorkspaceEditor,
  WorkspaceEditorLoading,
} from "@/features/workspace-editor/components/editor";
import { WsEditorHeader } from "@/features/workspace-editor/components/editor-header";
import { prefetchWorkspaceWorkflow } from "@/features/workspace-editor/server/prefetch";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";

interface Props {
  params: Promise<{ workflowId: string; workspaceId: string }>;
}

export default async function WorkspaceWorkflowPage({ params }: Props) {
  const { workflowId } = await params;
  const queryClient = getQueryClient();
  await prefetchWorkspaceWorkflow(queryClient, workflowId);

  return (
    <HydrateClient client={queryClient}>
      <Suspense fallback={<WorkspaceEditorLoading />}>
        <WsEditorHeader workflowId={workflowId} />
        <main className="flex-1">
          <WorkspaceEditor workflowId={workflowId} />
        </main>
      </Suspense>
    </HydrateClient>
  );
}
