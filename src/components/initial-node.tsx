"use client";

import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { PlaceholderNode } from "./react-flow/placeholder-node";
import { PlusIcon } from "lucide-react";
import { WorkflowNode } from "./workflow-node";
import { NodeSelector } from "./node-selector";
import { useAtomValue } from "jotai";
import { editorReadOnlyAtom } from "@/features/editor/store/atoms";

export const InitialNode = memo((props: NodeProps) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const isReadOnly = useAtomValue(editorReadOnlyAtom);

  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <WorkflowNode
        name="Início"
        description="Clique para começar"
        showToolbar={false}
      >
        <PlaceholderNode {...props} onClick={() => !isReadOnly && setSelectorOpen(true)}>
          <div className="cursor-pointer flex items-center justify-center">
            <PlusIcon className="size-4" />
          </div>
        </PlaceholderNode>
      </WorkflowNode>
    </NodeSelector>
  );
});

InitialNode.displayName = "InitialNode";
