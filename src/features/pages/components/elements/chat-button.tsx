"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ElementBase } from "../../types";
import { usePageRenderContext } from "../public/page-context";

/**
 * Chat Button — botão flutuante no canto inferior direito que
 * abre popover de in-chat. Lead vai pro tracking configurado.
 *
 * Fluxo:
 * 1. Cliente abre popover, vê mensagem de boas-vindas do agente
 * 2. Se não tem cookie de identificação, agente pede nome + número
 * 3. Após identify, mensagens fluem via /api/in-chat/[orgSlug]/messages
 *
 * Requer `orgSlug` (slug da Organization, não da page) — passado
 * via `element.orgSlug` ou inferido do `window.location` se a page
 * está hospedada em subdomínio da org. O `trackingId` é opcional
 * (org com 1 tracking funciona sem; com vários, escolhe esse).
 *
 * Como o agente IA responde via webhook/polling, o frontend
 * polleia `GET /messages?cursor=` a cada 3s enquanto o popover
 * está aberto.
 */

type Phase = "welcome" | "name" | "phone" | "chatting";
type Msg = { id: string; body: string; fromAgent: boolean; createdAt: number };

export function ChatButton({ element }: { element: ElementBase }) {
  const label = (element.label as string) ?? "Falar com a gente";
  const welcome =
    (element.welcomeMessage as string) ?? "Olá! 👋 Como posso ajudar?";
  const trackingId = (element.trackingId as string) ?? "";
  // Slug da org: prioridade pro Context (server-side resolved, never
  // stale) e fallback pro element.orgSlug salvo no layout. Se o
  // element foi publicado antes do user trocar de slug da org, o
  // context sobrescreve com o atual.
  const ctx = usePageRenderContext();
  const orgSlug =
    ctx.organizationSlug || (element.orgSlug as string) || "";
  const agentName = (element.agentName as string) ?? "Atendente";
  const bg = (element.bgColor as string) ?? "#6366f1";
  const fg = (element.fgColor as string) ?? "#ffffff";

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Quando popover abre, mostra mensagem de boas-vindas. Se já tem
  // cookie de identificação (sessão anterior), pula direto pro
  // chatting e carrega histórico.
  useEffect(() => {
    if (!open) return;
    setMessages([
      {
        id: "welcome",
        body: welcome,
        fromAgent: true,
        createdAt: Date.now(),
      },
    ]);
    // Tenta carregar mensagens — se 401, é a primeira vez (precisa identify)
    if (orgSlug) {
      fetch(`/api/in-chat/${orgSlug}/messages`, {
        credentials: "same-origin",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.messages?.length) {
            setMessages(
              data.messages.map(
                (m: { id: string; body: string; fromAgent: boolean; createdAt: string }) => ({
                  id: m.id,
                  body: m.body,
                  fromAgent: m.fromAgent,
                  createdAt: new Date(m.createdAt).getTime(),
                }),
              ),
            );
            setPhase("chatting");
            cursorRef.current = data.messages.at(-1)?.id ?? null;
          } else {
            setTimeout(() => setPhase("name"), 800);
          }
        })
        .catch(() => setTimeout(() => setPhase("name"), 800));
    } else {
      setError("Chat não configurado — orgSlug ausente");
    }
  }, [open, welcome, orgSlug]);

  // Polling enquanto chatting
  useEffect(() => {
    if (phase !== "chatting" || !open || !orgSlug) return;
    pollRef.current = setInterval(async () => {
      try {
        const url = cursorRef.current
          ? `/api/in-chat/${orgSlug}/messages?cursor=${encodeURIComponent(cursorRef.current)}`
          : `/api/in-chat/${orgSlug}/messages`;
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) return;
        const data = await r.json();
        if (data?.messages?.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const news = data.messages
              .filter((m: { id: string }) => !ids.has(m.id))
              .map(
                (m: { id: string; body: string; fromAgent: boolean; createdAt: string }) => ({
                  id: m.id,
                  body: m.body,
                  fromAgent: m.fromAgent,
                  createdAt: new Date(m.createdAt).getTime(),
                }),
              );
            if (news.length === 0) return prev;
            cursorRef.current = news.at(-1).id;
            return [...prev, ...news];
          });
        }
      } catch {
        // ignora erros transientes
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, open, orgSlug]);

  // Scroll pro fim quando mensagens mudam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mapa de erros do endpoint pra mensagens user-friendly.
  // Endpoint pode retornar status 200 com `error: needs_name` quando
  // phone é novo + sem nome — não é uma falha de rede, mas o
  // `r.ok` retorna true. Por isso check explícito do body.
  const errorMessages: Record<string, string> = {
    invalid_body: "Erro inesperado. Recarregue a página.",
    invalid_input: "Verifique nome e número.",
    phone_too_short: "Número muito curto. Tente com DDD.",
    not_found:
      "Organização não encontrada. Avise o site que o chat está mal configurado.",
    no_tracking_available:
      "Sem atendimento disponível agora. Tente novamente em breve.",
    invalid_tracking: "Tracking inválido. Avise o site.",
    create_lead_failed: "Não consegui te cadastrar. Tente de novo.",
    needs_name: "Como podemos te chamar?",
  };

  const identify = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.replace(/[^\d]/g, "");
    if (!trimmedName || !trimmedPhone) {
      setError("Preencha nome e número.");
      return;
    }
    if (trimmedPhone.length < 8) {
      setError("Número muito curto. Use o formato DDD + número.");
      return;
    }
    if (!orgSlug) {
      setError("Chat não configurado pelo dono do site.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      // Endpoint espera SÓ { phone, name?, trackingId? } — campos extras
      // são strippados pelo Zod, mas mandar limpo evita ambiguidade.
      const r = await fetch(`/api/in-chat/${orgSlug}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          trackingId: trackingId || undefined,
        }),
      });
      const json = await r.json().catch(() => ({}));
      // Endpoint pode retornar 200 com `error: needs_name` (caso phone
      // novo + sem nome). Tratamos AMBOS r.ok=false E json.error.
      if (!r.ok || json.error) {
        const code = json.error ?? `HTTP ${r.status}`;
        throw new Error(errorMessages[code] ?? code);
      }
      setPhase("chatting");
      setMessages((prev) => [
        ...prev,
        {
          id: `confirm-${Date.now()}`,
          body: `Beleza ${trimmedName.split(" ")[0]}! Pode mandar sua dúvida 👇`,
          fromAgent: true,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao identificar");
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    setSending(true);
    setInput("");
    // Optimistic
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, body, fromAgent: false, createdAt: Date.now() },
    ]);
    try {
      const r = await fetch(`/api/in-chat/${orgSlug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch {
      // Rollback
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Falha ao enviar — tente de novo");
    } finally {
      setSending(false);
    }
  };

  // Portal pro <body> — sem ele, o `position: fixed` do botão é
  // resolvido relativo ao wrapper do LandingFlow (que tem
  // position: relative + width fixos), botão sai do viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Botão flutuante — usa style inline pra position pra escapar
          de classes Tailwind que possam vazar do canvas (`top`/`left`
          residual dos wrappers do builder). */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          top: "auto",
          left: "auto",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          background: bg,
          color: fg,
        }}
        aria-label={label}
      >
        {open ? (
          <span className="text-2xl">✕</span>
        ) : (
          <svg className="size-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
        )}
      </button>

      {/* Popover */}
      {open && (
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
          <div
            className="px-4 py-3 flex items-center gap-2 border-b"
            style={{ background: bg, color: fg }}
          >
            <div className="size-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {agentName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{agentName}</p>
              <p className="text-xs opacity-80">
                {phase === "chatting" ? "Online" : "Pronto pra atender"}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.fromAgent ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.fromAgent
                      ? "bg-zinc-100 text-zinc-900"
                      : "bg-indigo-500 text-white"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
              {error}
            </div>
          )}

          {phase === "name" && (
            <div className="border-t p-3 flex gap-2 bg-muted/30">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome…"
                className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name) setPhase("phone");
                }}
                autoFocus
              />
              <button
                onClick={() => name && setPhase("phone")}
                disabled={!name}
                className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: bg, color: fg }}
              >
                Próximo
              </button>
            </div>
          )}

          {phase === "phone" && (
            <div className="border-t p-3 flex gap-2 bg-muted/30">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="WhatsApp (DDD + número)"
                className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") identify();
                }}
                autoFocus
              />
              <button
                onClick={identify}
                disabled={sending || !phone}
                className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: bg, color: fg }}
              >
                {sending ? "…" : "Começar"}
              </button>
            </div>
          )}

          {phase === "chatting" && (
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
                    send();
                  }
                }}
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: bg, color: fg }}
              >
                ▶
              </button>
            </div>
          )}

          {phase === "welcome" && (
            <div className="border-t p-3 text-center text-xs text-muted-foreground bg-muted/30">
              Carregando…
            </div>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
