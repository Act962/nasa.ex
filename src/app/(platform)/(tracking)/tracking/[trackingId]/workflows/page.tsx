import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { CreateWorkflowButton } from "./create-workflow";
import { WorkflowContainer } from "./workflow-container";
import { Suspense } from "react";
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";
import { AiLeadButton } from "@/features/trackings/components/modal/ai-lead-button";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";

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
          <h1 className="text-lg md:text-xl font-semibold">Automações</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            A automação é um processo que automatiza tarefas repetitivas,
            permitindo que você se concentre em tarefas mais importantes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AiLeadButton trackingId={trackingId}>
            <Button variant="outline" size="sm">
              <SparklesIcon className="size-4 text-purple-500" />
              <span className="hidden sm:inline bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                Agente de Automações
              </span>
            </Button>
          </AiLeadButton>
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
