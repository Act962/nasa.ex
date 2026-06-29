"use client";

import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { PlaceholderNode } from "@/components/react-flow/placeholder-node";
import { WorkflowNode } from "@/components/workflow-node";
import { WsNodeSelector } from "./node-selector";

export const WsInitialNode = memo((props: NodeProps) => {
  const [open, setOpen] = useState(false);
  return (
    <WsNodeSelector open={open} onOpenChange={setOpen}>
      <WorkflowNode
        name="Início"
        description="Clique para começar"
        showToolbar={false}
      >
        <PlaceholderNode {...props} onClick={() => setOpen(true)}>
          <div className="cursor-pointer flex items-center justify-center">
            <PlusIcon className="size-4" />
          </div>
        </PlaceholderNode>
      </WorkflowNode>
    </WsNodeSelector>
  );
});
WsInitialNode.displayName = "WsInitialNode";
