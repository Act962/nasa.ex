"use client";

/**
 * Chat Button — botão flutuante no canto inferior direito que abre um
 * popover de in-chat. Este arquivo é apenas a casca de composição: toda a
 * máquina de estados/efeitos vive em `useChatButton` e cada pedaço visual
 * (FAB, header, lista de mensagens, rodapé de entrada) é um componente
 * próprio. Renderiza via portal pro `<body>` pra escapar do canvas com
 * transform. Para o fluxo completo (auto-greet, captura scripted, handoff
 * pro atendente, polling), ver `use-chat-button.ts`.
 */

import { createPortal } from "react-dom";
import type { ElementBase } from "../../../types";
import { useChatButton } from "./use-chat-button";
import { ChatFab } from "./chat-fab";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatComposer } from "./chat-composer";

export function ChatButton({ element }: { element: ElementBase }) {
  const chat = useChatButton(element);

  if (!chat.mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <ChatFab
        open={chat.open}
        hasUnread={chat.hasUnread}
        label={chat.label}
        bg={chat.bg}
        fg={chat.fg}
        onToggle={() => chat.setOpen((value) => !value)}
      />

      {chat.open && (
        <div
          className="bg-white text-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-3"
          style={{
            position: "fixed",
            bottom: "92px",
            right: "20px",
            top: "auto",
            left: "auto",
            zIndex: 9998,
            width: "min(calc(100vw - 40px), 28rem)",
            height: "min(calc(100dvh - 130px), 32rem)",
          }}
        >
          <ChatHeader
            name={chat.headerName}
            image={chat.headerImage}
            subtitle={chat.headerSubtitle}
            bg={chat.bg}
            fg={chat.fg}
          />

          <ChatMessages messages={chat.messages} bottomRef={chat.bottomRef} />

          {chat.error && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
              {chat.error}
            </div>
          )}

          <ChatComposer
            phase={chat.phase}
            input={chat.input}
            setInput={chat.setInput}
            name={chat.name}
            setName={chat.setName}
            phone={chat.phone}
            setPhone={chat.setPhone}
            sending={chat.sending}
            bg={chat.bg}
            fg={chat.fg}
            onIdentify={chat.identify}
            onSend={chat.send}
            onStartCapture={chat.startCapture}
            onAdvanceToPhone={chat.advanceToPhone}
          />
        </div>
      )}
    </>,
    document.body,
  );
}
