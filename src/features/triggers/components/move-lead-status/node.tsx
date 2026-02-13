"use client";

import { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { MoveHorizontalIcon } from "lucide-react";
import { MoveLeadStatusTriggerDialog } from "./dialog";

export const MoveLeadStatusTriggerNode = memo((props: NodeProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const nodeStatus = "initial";

  const handleOpenSettings = () => setDialogOpen(true);

  return (
    <>
      <MoveLeadStatusTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <BaseTriggerNode
        {...props}
        icon={MoveHorizontalIcon}
        name="Mover Lead para Status"
        description="Quando um lead é movido para o status configurado"
        status={nodeStatus}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});
