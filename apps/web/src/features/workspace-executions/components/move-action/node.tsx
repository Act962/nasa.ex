"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import { makeExecutionNode } from "../_shared/make-node";
import { WS_MOVE_ACTION_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsMoveActionToken } from "../../lib/realtime-tokens";

type Values = { workspaceId?: string; columnId: string };

export const WsMoveActionNode = makeExecutionNode<Values>({
  name: "Mover ação",
  description: "Mova para outro workspace/coluna",
  icon: ArrowLeftRightIcon,
  channelName: WS_MOVE_ACTION_CHANNEL_NAME,
  refreshToken: fetchWsMoveActionToken as any,
  dialogTitle: "Mover ação",
  fields: [
    { kind: "workspace", name: "workspaceId", label: "Workspace destino", optional: true },
    { kind: "column", name: "columnId", label: "Coluna destino", workspaceIdFrom: "workspaceId" },
  ],
  describe: (v) => (v?.columnId ? "Coluna definida" : undefined),
});
