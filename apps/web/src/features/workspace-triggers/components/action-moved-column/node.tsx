"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { MoveHorizontalIcon } from "lucide-react";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";
import { SimpleDialog } from "@/features/workspace-executions/components/_shared/simple-dialog";

type Values = { columnId: string };
type Data = { action?: Values };

export const WsActionMovedColumnNode = memo((props: NodeProps<Node<Data>>) => {
  const [open, setOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const handleSubmit = (v: Values) =>
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === props.id ? { ...n, data: { ...(n.data as any), action: v } } : n,
      ),
    );

  return (
    <>
      <SimpleDialog<Values>
        open={open}
        onOpenChange={setOpen}
        title="Ação movida para coluna"
        description="Dispara somente quando uma ação é movida para a coluna selecionada."
        fields={[
          { kind: "column", name: "columnId", label: "Coluna" },
        ]}
        defaultValues={props.data?.action}
        onSubmit={handleSubmit}
      />
      <WsBaseTriggerNode
        {...props}
        icon={MoveHorizontalIcon}
        name="Ação movida"
        description={
          props.data?.action?.columnId
            ? "Coluna definida"
            : "Selecione a coluna"
        }
        onSettings={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
      />
    </>
  );
});
WsActionMovedColumnNode.displayName = "WsActionMovedColumnNode";
