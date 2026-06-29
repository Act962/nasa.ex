"use client";

import { Node, NodeProps } from "@xyflow/react";
import { memo } from "react";
import { ArchiveIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "@/features/tracking-executions/hook/use-node-status";
import { WS_ARCHIVE_ACTION_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsArchiveActionToken } from "../../lib/realtime-tokens";

export const WsArchiveActionNode = memo((props: NodeProps<Node>) => {
  const status = useNodeStatus({
    nodeId: props.id,
    channel: WS_ARCHIVE_ACTION_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchWsArchiveActionToken as any,
  });
  return (
    <WsBaseExecutionNode
      {...props}
      icon={ArchiveIcon}
      name="Arquivar ação"
      description="Arquiva a ação atual"
      status={status}
    />
  );
});
WsArchiveActionNode.displayName = "WsArchiveActionNode";
