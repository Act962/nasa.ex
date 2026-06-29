/**
 * Lista de mensagens do chat — bolhas alinhadas à esquerda (atendente) ou
 * à direita (visitante). Recebe o `bottomRef` do hook pra ancorar o
 * auto-scroll ao fim. Componente puramente visual.
 */

import type { RefObject } from "react";
import type { Msg } from "./types";

export function ChatMessages({
  messages,
  bottomRef,
}: {
  messages: Msg[];
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.fromAgent ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              message.fromAgent
                ? "bg-zinc-100 text-zinc-900"
                : "bg-indigo-500 text-white"
            }`}
          >
            {message.body}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
