import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { CreateWorkflowButton } from "./create-workflow";
import { WorkflowContainer } from "./workflow-container";
import { Suspense } from "react";
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";

interface WorkflowPageProps {
  params: Promise<{
    trackingId: string;
  }>;
}

export default async function WorkflowsPage({ params }: WorkflowPageProps) {
  const { trackingId } = await params;
  const queryClient = getQueryClient();

  await prefetchWorkflows(queryClient, {
    trackingId,
  });

  return (
    <div className="container mx-auto mt-16 space-y-8">
      <div className="flex items-center justify-between">
        <div className="max-w-xl">
          <h1 className="text-lg md:text-xl font-semibold">Automações</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            A automação é um processo que automatiza tarefas repetitivas,
            permitindo que você se concentre em tarefas mais importantes.
          </p>
        </div>

        <CreateWorkflowButton />
      </div>

      <HydrateClient client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <WorkflowContainer />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
