"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CreateWorkflowButton } from "./create-workflow";
import { useSuspenseWorkflows } from "@/features/workflows/hooks/use-workflows";

export function WorkflowContainer() {
  const { trackingId } = useParams<{ trackingId: string }>();

  const { data, isPending } = useSuspenseWorkflows(trackingId);

  if (isPending) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-2 mb-8">
      {data.workflows.length > 0 ? (
        data.workflows.map((workflow) => (
          <Item key={workflow.id} variant="outline">
            <ItemMedia>
              <WorkflowIcon className="size-5" />
            </ItemMedia>
            <ItemContent>
              <Link href={`/tracking/${trackingId}/workflows/${workflow.id}`}>
                <ItemTitle className="hover:underline underline-offset-3">
                  {workflow.name}
                </ItemTitle>
              </Link>
              <ItemDescription>{workflow.description}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/tracking/${trackingId}/workflows/${workflow.id}`}>
                  Ver
                </Link>
              </Button>
            </ItemActions>
          </Item>
        ))
      ) : (
        <EmptyWorkflows />
      )}
    </div>
  );
}

function EmptyWorkflows() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhum workflow encontrado</EmptyTitle>
        <EmptyDescription>
          Crie um workflow para começar a monitorar o progresso do seu projeto.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateWorkflowButton />
      </EmptyContent>
    </Empty>
  );
}
