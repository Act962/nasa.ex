"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState, ComponentType } from "react";
import { LucideIcon } from "lucide-react";
import { WsBaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "@/features/tracking-executions/hook/use-node-status";
import { SimpleDialog } from "./simple-dialog";
import type { Realtime } from "@inngest/realtime";

interface MakeNodeConfig<T extends Record<string, any>> {
  name: string;
  description: string;
  icon: LucideIcon;
  channelName: string;
  refreshToken: () => Promise<Realtime.Subscribe.Token>;
  dialogTitle: string;
  dialogDescription?: string;
  fields: Parameters<typeof SimpleDialog<T>>[0]["fields"];
  describe?: (values?: T) => string | undefined;
}

export function makeExecutionNode<T extends Record<string, any>>(
  config: MakeNodeConfig<T>,
): ComponentType<NodeProps<Node<{ action?: T }>>> {
  const Component = memo((props: NodeProps<Node<{ action?: T }>>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const status = useNodeStatus({
      nodeId: props.id,
      channel: config.channelName,
      topic: "status",
      refreshToken: config.refreshToken,
    });

    const handleSubmit = (v: T) =>
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id
            ? { ...n, data: { ...(n.data as any), action: v } }
            : n,
        ),
      );

    const description =
      config.describe?.(props.data?.action) ?? config.description;

    return (
      <>
        <SimpleDialog<T>
          open={open}
          onOpenChange={setOpen}
          title={config.dialogTitle}
          description={config.dialogDescription}
          fields={config.fields}
          defaultValues={props.data?.action as Partial<T>}
          onSubmit={handleSubmit}
        />
        <WsBaseExecutionNode
          {...props}
          icon={config.icon}
          name={config.name}
          description={description}
          status={status}
          onSettings={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
        />
      </>
    );
  });
  Component.displayName = `WsNode(${config.name})`;
  return Component;
}
