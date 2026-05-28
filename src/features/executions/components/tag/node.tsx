"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState, useMemo } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { TagIcon } from "lucide-react";
import { TagDialog, TagFormValues } from "./dialog";
import { useNodeStatus } from "../../hook/use-node-status";
import { TAG_CHANNEL_NAME } from "@/inngest/channels/tag";
import { fetchTagRealtimeToken } from "./actions";
import { useTags } from "@/features/tags/hooks/use-tags";

type TagNodeData = {
  action?: TagFormValues;
};

type TagNodeType = Node<TagNodeData>;

export const TagNode = memo((props: NodeProps<TagNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: TAG_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchTagRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: TagFormValues) => {
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

  // Detecta se o node referencia tags arquivadas (Tags V2 soft-delete).
  // Quando sim, mostra warning visual no card pra alertar o user.
  // Inclui arquivadas no fetch pra resolver as referências históricas.
  const { tags: allTags } = useTags({
    trackingId: "ALL",
    includeArchived: true,
  });
  const archivedRefs = useMemo(() => {
    const ids = nodeData.action?.tagsIds ?? [];
    if (ids.length === 0) return [];
    return allTags.filter((t) => ids.includes(t.id) && t.isArchived);
  }, [nodeData.action?.tagsIds, allTags]);

  const description =
    archivedRefs.length > 0
      ? `⚠️ ${archivedRefs.length} tag(s) arquivada(s) — serão skipadas`
      : "Adiciona/remove uma tag";

  return (
    <>
      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData.action}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={TagIcon}
        name="Tag"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TagNode.displayName = "TagNode";
