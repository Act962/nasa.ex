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

    // Detecta nos tagIds das conditions:
    //  - placeholders agent-mode (`<<TAG_*>>`) — trigger nunca dispara
    //  - tags arquivadas — trigger não dispara (lead novo não recebe)
    //  - IDs órfãos (hard-deletados antes da v2)
    const { tags: allTags } = useTags({
      trackingId: "ALL",
      includeArchived: true,
    });
    const { placeholderRefs, archivedRefs, orphanRefs } = useMemo(() => {
      const ids = (nodeData.action?.conditions ?? []).flatMap(
        (c: { tagIds?: string[] }) => c.tagIds ?? [],
      );
      const placeholders = ids.filter((id) => /^<<.+>>$/.test(id));
      const real = ids.filter((id) => !/^<<.+>>$/.test(id));
      const archived = allTags.filter(
        (t) => real.includes(t.id) && t.isArchived,
      );
      const orphan = real.filter((id) => !allTags.find((t) => t.id === id));
      return {
        placeholderRefs: placeholders,
        archivedRefs: archived,
        orphanRefs: orphan,
      };
    }, [nodeData.action?.conditions, allTags]);

    const description =
      placeholderRefs.length > 0
        ? `⚠️ ${placeholderRefs.length} placeholder(s) — trigger não dispara`
        : orphanRefs.length > 0
        ? `⚠️ ${orphanRefs.length} tag(s) inválida(s) — clique pra remover`
        : archivedRefs.length > 0
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
