"use client";

import { client, orpc } from "@/lib/orpc";
import { eventIteratorToStream } from "@orpc/client";
import { useChat } from "@ai-sdk/react";
import { v4 as uuidv4 } from "uuid";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const MUTATING_TOOLS = [
  "createAction",
  "updateAction",
  "closeAction",
  "moveActionToColumn",
  "addResponsibleToAction",
];

export function useWorkspaceAi(workspaceId?: string, columnId?: string) {
  const queryClient = useQueryClient();
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
    clearError,
  } = useChat({
    id: "workspace-chat",
    transport: {
      async sendMessages(options) {
        return eventIteratorToStream(
          await client.ia.workspace.chat(
            {
              messages: options.messages,
              initialWorkspaceId: workspaceId,
              initialColumnId: columnId,
            },
            {
              signal: options.abortSignal,
            },
          ),
        );
      },
      reconnectToStream() {
        throw new Error("Unsupported");
      },
    },
    // onFinish: ({ messages: finishedMessages }) => {
    //   const wId = workspaceIdRef.current;
    //   if (!wId) return;

    //   const columnIds = new Set<string>();

    //   for (const m of finishedMessages) {
    //     for (const part of m.parts) {
    //       console.log(part);
    //       if (
    //         part.type === "tool-invocation" &&
    //         "toolName" in part &&
    //         MUTATING_TOOLS.includes(part.toolName as string) &&
    //         "state" in part &&
    //         part.state === "output-available" &&
    //         "output" in part
    //       ) {
    //         const output = part.output as Record<string, unknown> | undefined;
    //         if (
    //           output?.success === true &&
    //           typeof output.columnId === "string"
    //         ) {
    //           columnIds.add(output.columnId);
    //         }
    //       }
    //     }
    //   }

    //   if (columnIds.size > 0) {
    //     columnIds.forEach((columnId) => {
    //       console.log("invalidateQueries", columnId);
    //       queryClient.invalidateQueries({
    //         queryKey: ["action.listByColumn", columnId],
    //       });
    //     });

    //     queryClient.invalidateQueries(
    //       orpc.workspace.getColumnsByWorkspace.queryOptions({
    //         input: { workspaceId: wId },
    //       }),
    //     );

    //     queryClient.invalidateQueries(
    //       orpc.action.listByWorkspace.queryOptions({
    //         input: { workspaceId: wId },
    //       }),
    //     );
    //   }
    // },
  });

  const sendMessageWithData = (
    prompt: string,
    data: { workspaceId: string; columnId: string },
  ) => {
    if (!prompt.trim()) return;

    sendMessage(
      {
        id: uuidv4(),
        role: "user",
        parts: [{ text: prompt, type: "text" }],
      },
      {
        body: data, // passa workspaceId e columnId via body
      },
    );
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading: status === "streaming" || status === "submitted",
    error,
    status,
    stop,
    clearError,
    sendMessage: sendMessageWithData,
    clearMessages,
  };
}
