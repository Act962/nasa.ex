"use client";

import { BaseExecutionNode } from "@/features/tracking-executions/components/base-execution-node";
import { Landmark } from "lucide-react";
import type { Node, NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { SeiActionDialog } from "./dialog";
import type { SeiActionData } from "./executor";

type SeiActionNodeType = Node<SeiActionData>;

export const SeiActionNode = memo((props: NodeProps<SeiActionNodeType>) => {
  const [open, setOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const save = (values: SeiActionData) => {
    setNodes((nodes) => nodes.map((node) =>
      node.id === props.id ? { ...node, data: { ...node.data, ...values } } : node,
    ));
  };

  return (
    <>
      <SeiActionDialog
        open={open}
        onOpenChange={setOpen}
        defaultValues={props.data}
        onSubmit={save}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={Landmark}
        name="Consultar processo SEI"
        description={props.data.protocolo || "Processo vinculado ao lead"}
        onSettings={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
      />
    </>
  );
});

SeiActionNode.displayName = "SeiActionNode";
