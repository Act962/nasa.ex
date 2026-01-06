"use client";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import { WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function WorkflowContainer() {
  const { trackingId } = useParams<{ trackingId: string }>();

  const { data, isPending } = useSuspenseQuery(
    orpc.workflow.list.queryOptions({
      input: {
        trackingId,
      },
    })
  );

  if (isPending) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-2">
      {data.workflows.map((workflow) => (
        <Item key={workflow.id} variant="outline">
          <ItemMedia>
            <WorkflowIcon className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{workflow.name}</ItemTitle>
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
      ))}
    </div>
  );
}
