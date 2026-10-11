import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { CreateWorkflowButton } from "./create-workflow";
import { WorkflowContainer } from "./workflow-container";
import { Suspense } from "react";
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";
import { QuickWorkflowButton } from "@/features/workflows/components/quick-builder/quick-workflow-button";
import { AstroFlowBar } from "@/features/automations-hub/components/astro-flow-bar";

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
    <div className="container mx-auto space-y-8 px-4">
      <div className="flex items-center justify-between">
        <div className="max-w-xl">
          <h1 className="text-lg md:text-xl font-semibold">Gatilhos Automáticos</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Gatilhos automáticos executam tarefas repetitivas sozinhos,
            para você se concentrar no que é mais importante.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AstroFlowBar trackingId={trackingId} />
          <QuickWorkflowButton trackingId={trackingId} />
          <CreateWorkflowButton />
        </div>
      </div>

      <HydrateClient client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <WorkflowContainer />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
