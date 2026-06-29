"use client";

import { TagIcon } from "lucide-react";
import { makeExecutionNode } from "../_shared/make-node";
import { WS_ADD_TAG_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { fetchWsAddTagToken } from "../../lib/realtime-tokens";

export const WsAddTagActionNode = makeExecutionNode<{ tagId: string }>({
  name: "Adicionar etiqueta",
  description: "Adicione uma etiqueta à ação",
  icon: TagIcon,
  channelName: WS_ADD_TAG_CHANNEL_NAME,
  refreshToken: fetchWsAddTagToken as any,
  dialogTitle: "Adicionar etiqueta",
  fields: [{ kind: "tag", name: "tagId", label: "Etiqueta" }],
  describe: (v) => (v?.tagId ? "Etiqueta definida" : undefined),
});
