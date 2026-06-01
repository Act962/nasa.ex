"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useMemo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { TagsIcon } from "lucide-react";
import { LeadTaggedTriggerDialog, LeadTaggedTriggerFormValues } from "./dialog";
import { useTags } from "@/features/tags/hooks/use-tags";

type LeadTaggedTriggerNodeData = {
  action?: LeadTaggedTriggerFormValues;
};

type LeadTaggedTriggerNodeType = Node<LeadTaggedTriggerNodeData>;

export const LeadTaggedTriggerNode = memo(
  (props: NodeProps<LeadTaggedTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = "initial";

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: LeadTaggedTriggerFormValues) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === props.id) {
            return {
              ...node,
              data: {
                ...node.data,
                action: values,
              },
            };
          }

          return node;
        }),
      );
    };

    const nodeData = props.data;

    // Detecta tags arquivadas referenciadas nas condições do trigger.
    // Trigger LEAD_TAGGED nunca vai disparar pra tag arquivada (ninguém
    // anexa). Warning visual avisa o user pra editar.
    const { tags: allTags } = useTags({
      trackingId: "ALL",
      includeArchived: true,
    });
    const archivedRefs = useMemo(() => {
      const ids = (nodeData.action?.conditions ?? [])
        .flatMap((c: { tagIds?: string[] }) => c.tagIds ?? []);
      if (ids.length === 0) return [];
      return allTags.filter((t) => ids.includes(t.id) && t.isArchived);
    }, [nodeData.action?.conditions, allTags]);

    const description =
      archivedRefs.length > 0
        ? `⚠️ ${archivedRefs.length} tag(s) arquivada(s) — trigger não dispara`
        : "Quando uma Tag for inserida no lead";

    return (
      <>
        <LeadTaggedTriggerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
        <BaseTriggerNode
          {...props}
          icon={TagsIcon}
          name="Uma Tag for inserida"
          description={description}
          status={nodeStatus}
          onSettings={handleOpenSettings}
          onDoubleClick={handleOpenSettings}
        />
      </>
    );
  },
);
