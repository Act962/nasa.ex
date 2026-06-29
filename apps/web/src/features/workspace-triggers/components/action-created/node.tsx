"use client";

import { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { PlusCircleIcon } from "lucide-react";
import { WsBaseTriggerNode } from "@/features/workspace-triggers/components/base-trigger-node";

export const WsActionCreatedNode = memo((props: NodeProps) => (
  <WsBaseTriggerNode
    {...props}
    icon={PlusCircleIcon}
    name="Ação criada"
    description="Quando uma nova ação é criada no workspace"
  />
));
WsActionCreatedNode.displayName = "WsActionCreatedNode";
