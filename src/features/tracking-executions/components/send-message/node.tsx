"use client";

import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { ClipboardListIcon, SendIcon, ShieldCheckIcon } from "lucide-react";
import { CONSENT_TYPE, FORM_CHAT_TYPE, conversationStepTypeOf, stepPayloadOf, type ConsentPayload, type FormChatPayload } from "@/features/workflows/lib/conversation-steps";
import { ConsentDialog } from "../conversation-steps/consent-dialog";
import { FormChatDialog } from "../conversation-steps/form-chat-dialog";
import { SendMessageDialog, SendMessageFormValues } from "./dialog";
import { useNodeStatus } from "../../hook/use-node-status";
import { SEND_MESSAGE_CHANNEL_NAME } from "@/inngest/channels/send-message";
import { fetchSendMessageRealtimeToken } from "./actions";

type SendMessageNodeData = {
  action?: SendMessageFormValues;
};

type SendMessageNodeType = Node<SendMessageNodeData>;

export const SendMessageNode = memo((props: NodeProps<SendMessageNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: SEND_MESSAGE_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchSendMessageRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: SendMessageFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              action: values,
            },
          };
        }

        return node;
      }),
    );
  };

  const nodeData = props.data;
  const description = nodeData?.action
    ? `${nodeData.action.payload.type}`
    : "Envia uma mensagem ao lead";

  // Passos de conversa (spec 0099) são variações deste quadro, cada uma com a sua janela.
  const stepType = conversationStepTypeOf(nodeData);
  const stepPayload = stepPayloadOf(nodeData);
  const saveStepPayload = (payload: ConsentPayload | FormChatPayload) =>
    setNodes((nodes) => nodes.map((node) => (node.id === props.id ? { ...node, data: { ...node.data, action: { ...(node.data.action as object), payload } } } : node)));
  const stepName = stepType === CONSENT_TYPE ? "Pedir aceite" : stepType === FORM_CHAT_TYPE ? "Preencher formulário" : "Enviar Mensagem";
  const StepIcon = stepType === CONSENT_TYPE ? ShieldCheckIcon : stepType === FORM_CHAT_TYPE ? ClipboardListIcon : SendIcon;

  return (
    <>
      {stepType === CONSENT_TYPE ? (
        <ConsentDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultPayload={stepPayload as Partial<ConsentPayload>} onSubmit={saveStepPayload} />
      ) : stepType === FORM_CHAT_TYPE ? (
        <FormChatDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultPayload={stepPayload as Partial<FormChatPayload>} onSubmit={saveStepPayload} />
      ) : (
        <SendMessageDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={nodeData.action}
        />
      )}
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon={StepIcon}
        name={stepName}
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

SendMessageNode.displayName = "SendMessageNode";
