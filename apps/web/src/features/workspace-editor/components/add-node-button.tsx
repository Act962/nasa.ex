"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { memo, useState } from "react";
import { WsNodeSelector } from "@/features/workspace-executions/components/node-selector";

export const WsAddNodeButton = memo(() => {
  const [open, setOpen] = useState(false);
  return (
    <WsNodeSelector open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
        className="bg-background"
      >
        <PlusIcon />
      </Button>
    </WsNodeSelector>
  );
});
WsAddNodeButton.displayName = "WsAddNodeButton";
