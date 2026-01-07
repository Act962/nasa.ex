import { Editor } from "@/features/editor/components/editor";
import { orpc } from "@/lib/orpc";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";

interface Props {
  params: Promise<{
    workflowId: string;
  }>;
}

export default async function WorkflowPage({ params }: Props) {
  const { workflowId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    })
  );

  return (
    <HydrateClient client={queryClient}>
      <Editor workflowId={workflowId} />
    </HydrateClient>
  );
}
