"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState, useMemo } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { TagIcon } from "lucide-react";
import { TagDialog, TagFormValues, isPlaceholderTagId } from "./dialog";
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

  // Detecta:
  //  - placeholders não resolvidos (presets agent-mode com `<<...>>`)
  //  - tags arquivadas (Tags V2 soft-delete)
  //  - IDs órfãos (tag hard-deletada antes da v2)
  // Cada caso vira warning visual no card pra o user entender que
  // precisa abrir o nó e ajustar antes do workflow rodar.
  const { tags: allTags } = useTags({
    trackingId: "ALL",
    includeArchived: true,
  });
  const { placeholderRefs, archivedRefs, orphanRefs } = useMemo(() => {
    const ids = nodeData.action?.tagsIds ?? [];
    const placeholders = ids.filter(isPlaceholderTagId);
    const real = ids.filter((id) => !isPlaceholderTagId(id));
    const archived = allTags.filter(
      (t) => real.includes(t.id) && t.isArchived,
    );
    const orphan = real.filter((id) => !allTags.find((t) => t.id === id));
    return {
      placeholderRefs: placeholders,
      archivedRefs: archived,
      orphanRefs: orphan,
    };
  }, [nodeData.action?.tagsIds, allTags]);

  // Prioridade da mensagem: placeholders > órfãos > arquivadas > default.
  // Placeholder é mais grave porque ID inexistente quebraria FK antes
  // do fix do executor — agora skipa, mas user ainda precisa resolver
  // pra workflow fazer algo útil.
  const description =
    placeholderRefs.length > 0
      ? `⚠️ ${placeholderRefs.length} placeholder(s) não resolvido(s) — clique e edite`
      : orphanRefs.length > 0
      ? `⚠️ ${orphanRefs.length} tag(s) inválida(s) — clique e remova`
      : archivedRefs.length > 0
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
