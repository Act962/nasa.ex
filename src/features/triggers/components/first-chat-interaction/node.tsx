"use client";

import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { MessageSquareIcon } from "lucide-react";
import { FirstChatInteractionTriggerDialog } from "./dialog";

export const FirstChatInteractionTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  return (
    <>
      <FirstChatInteractionTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <BaseTriggerNode
        {...props}
        icon={MessageSquareIcon}
        name="Primeira Interação no Chat"
        description="Quando o usuário envia a primeira mensagem ao lead"
        status={nodeStatus}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

FirstChatInteractionTriggerNode.displayName = "FirstChatInteractionTriggerNode";
