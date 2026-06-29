/**
 * Rodapé de entrada do chat — renderiza o campo correto conforme a phase
 * do fluxo scripted: "welcome" (mensagem livre que dispara a captura),
 * "name", "phone" (com máscara BR) e "chatting" (envio normal). Componente
 * visual; toda a lógica vive no hook `useChatButton`.
 */

import { digitsOf, maskBR } from "../../../lib/phone-br";
import type { Phase } from "./types";

export function ChatComposer({
  phase,
  input,
  setInput,
  name,
  setName,
  phone,
  setPhone,
  sending,
  bg,
  fg,
  onIdentify,
  onSend,
  onStartCapture,
  onAdvanceToPhone,
}: {
  phase: Phase;
  input: string;
  setInput: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  sending: boolean;
  bg: string;
  fg: string;
  onIdentify: () => void;
  onSend: () => void;
  onStartCapture: () => void;
  onAdvanceToPhone: () => void;
}) {
  if (phase === "welcome") {
    return (
      <div className="border-t p-3 flex gap-2 bg-muted/30">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem…"
          className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onStartCapture();
            }
          }}
          autoFocus
        />
        <button
          onClick={onStartCapture}
          disabled={!input.trim()}
          className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: bg, color: fg }}
        >
          ▶
        </button>
      </div>
    );
  }

  if (phase === "name") {
    return (
      <div className="border-t p-3 flex gap-2 bg-muted/30">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome…"
          className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white placeholder:text-black/80!"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name) onAdvanceToPhone();
          }}
          autoFocus
        />
        <button
          onClick={() => name && onAdvanceToPhone()}
          disabled={!name}
          className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: bg, color: fg }}
        >
          Próximo
        </button>
      </div>
    );
  }

  if (phase === "phone") {
    return (
      <div className="border-t p-3 flex gap-2 bg-muted/30">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(maskBR(e.target.value))}
          placeholder="(11) 99999-9999"
          maxLength={15}
          className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white placeholder:text-black/80! font-mono tracking-wide"
          onKeyDown={(e) => {
            if (e.key === "Enter") onIdentify();
          }}
          autoFocus
        />
        <button
          onClick={onIdentify}
          disabled={sending || digitsOf(phone).length < 11}
          className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: bg, color: fg }}
        >
          {sending ? "…" : "Enviar"}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t p-3 flex gap-2 bg-muted/30">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Digite sua mensagem…"
        className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={sending}
      />
      <button
        onClick={onSend}
        disabled={sending || !input.trim()}
        className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
        style={{ background: bg, color: fg }}
      >
        ▶
      </button>
    </div>
  );
}
