"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";
import { SimpleDialog } from "@/features/workspace-executions/components/_shared/simple-dialog";

type Values = { userId?: string };
type Data = { action?: Values };

export const WsActionParticipantAddedNode = memo(
  (props: NodeProps<Node<Data>>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const handleSubmit = (v: Values) =>
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id
            ? { ...n, data: { ...(n.data as any), action: v } }
            : n,
        ),
      );

    return (
      <>
        <SimpleDialog<Values>
          open={open}
          onOpenChange={setOpen}
          title="Participante adicionado"
          description="Dispara quando um participante é adicionado. Deixe em branco para qualquer usuário."
          fields={[{ kind: "member", name: "userId", label: "Participante", optional: true }]}
          defaultValues={props.data?.action}
          onSubmit={handleSubmit}
        />
        <WsBaseTriggerNode
          {...props}
          icon={UserPlusIcon}
          name="Participante adicionado"
          description={
            props.data?.action?.userId ? "Participante definido" : "Qualquer usuário"
          }
          onSettings={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
        />
      </>
    );
  },
);
WsActionParticipantAddedNode.displayName = "WsActionParticipantAddedNode";
