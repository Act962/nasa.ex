"use client";

import { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";

export const WsActionCompletedNode = memo((props: NodeProps) => (
  <WsBaseTriggerNode
    {...props}
    icon={CheckCircle2Icon}
    name="Ação concluída"
    description="Quando uma ação é marcada como concluída"
  />
));
WsActionCompletedNode.displayName = "WsActionCompletedNode";
