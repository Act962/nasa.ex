"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ElementBase } from "../../types";
import { usePageRenderContext } from "../public/page-context";
import { maskBR, digitsOf, isValidBRWhatsApp } from "../../lib/phone-br";

/**
 * Chat Button — botão flutuante no canto inferior direito que abre
 * popover de in-chat.
 *
 * Fluxo "graceful fallback" (funciona INDEPENDENTE de IA configurada):
 *
 *  1. **Auto-greet** ao carregar a page (1x por sessão de 24h):
 *     - Popover abre sozinho com "Oi. Se precisar de ajuda, estou aqui"
 *     - 3 segundos depois fecha
 *     - Bolinha vermelha aparece no botão sinalizando conversa em aberto
 *
 *  2. **Reabrir + digitar antes de identificar**:
 *     - User clica no botão (red dot some, popover abre)
 *     - Se ainda não tem cookie: mostra mensagem do user + resposta
 *       scriptada "Certo, me confirma seu telefone e nome, por favor"
 *     - Pede nome → telefone via forms (igual antes)
 *
 *  3. **Após identify bem-sucedido**:
 *     - Mensagem scriptada: "Olá <nome>, estou direcionando sua dúvida
 *       para um outro atendente, só um momento."
 *     - Vai pra phase=chatting → atendente humano vê no tracking-chat
 *       e responde via Pusher real-time
 *
 *  4. **Atendente recebe notificação sonora** no tracking-chat (Body
 *     toca beep ao receber mensagem viaInChat inbound).
 *
 * Como funciona SEM IA configurada: mensagens entram no banco com
 * `viaInChat=true`. Pipeline tenta acionar IA mas se `globalAiActive
 * = false`, é skip silencioso. Atendente humano segue normal pelo
 * tracking-chat. Polling do widget pega resposta dele em ≤3s.
 */

type Phase = "welcome" | "name" | "phone" | "chatting";
type Msg = {
  id: string;
  body: string;
  fromAgent: boolean;
  createdAt: number;
  /** Nome do atendente (apenas pra `fromAgent=true`). */
  senderName?: string | null;
  /** Avatar do atendente (User.image). */
  senderImage?: string | null;
};

interface OrgInfo {
  name: string;
  logo: string | null;
  niche: string | null;
}

const GREET_STORAGE_KEY = "nasa_chatbot_greeted_at";
const GREET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const AUTO_CLOSE_DELAY_MS = 3000;

/**
 * Verifica se devemos disparar o auto-greet — vale se nunca foi mostrado
 * OU se já passou o cooldown (24h). Evita bombardear o cliente em cada
 * page reload da sessão.
 */
function shouldAutoGreet(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lastGreetedAt = Number(
      window.localStorage.getItem(GREET_STORAGE_KEY) ?? 0,
    );
    if (!lastGreetedAt) return true;
    return Date.now() - lastGreetedAt > GREET_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markGreeted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GREET_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore (private mode, quota etc)
  }
}

export function ChatButton({ element }: { element: ElementBase }) {
  const label = (element.label as string) ?? "Falar com a gente";
  const welcome =
    (element.welcomeMessage as string) ??
    "Oi. Se precisar de ajuda, estou aqui 👋";
  const trackingId = (element.trackingId as string) ?? "";
  // Slug da org: prioridade pro Context (server-side resolved, never
  // stale) e fallback pro element.orgSlug salvo no layout.
  const ctx = usePageRenderContext();
  const orgSlug = ctx.organizationSlug || (element.orgSlug as string) || "";
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
  /** Indicador visual no botão quando há mensagens não lidas. */
  const [hasUnread, setHasUnread] = useState(false);
  /** Marca se já fizemos a abordagem inicial (auto-greet). */
  const [hasGreeted, setHasGreeted] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** ID do timer de auto-close pra cancelar se o user interagir antes. */
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Info da org (logo + nome) — fetch único ao montar. */
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);

  /* ─── 0. Carrega info da org (logo + nome) ──────────────────────── */
  useEffect(() => {
    if (!orgSlug) return;
    let cancelled = false;
    fetch(`/api/in-chat/${orgSlug}/info`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrgInfo | null) => {
        if (!cancelled && data?.name) setOrgInfo(data);
      })
      .catch(() => {
        /* ignora — header cai pro fallback `agentName` do element */
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  /**
   * Último atendente que respondeu — usado pra trocar o avatar/nome no
   * header dinamicamente. Encontra a mensagem mais recente do agente
   * na lista e extrai senderName/senderImage. Se ninguém ainda
   * respondeu, mantém a info da org (logo + nome).
   */
  const lastAgent = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.fromAgent && (m.senderName || m.senderImage)) {
        return { name: m.senderName, image: m.senderImage };
      }
    }
    return null;
  })();

  // Decide o que mostrar no header:
  // 1. Atendente que respondeu (foto + nome) — quando há mensagem dele
  // 2. Foto + nome da org (do endpoint /info)
  // 3. Fallback: fallback `agentName` do element (config no editor)
  const headerName = lastAgent?.name || orgInfo?.name || agentName;
  const headerImage = lastAgent?.image || orgInfo?.logo || null;
  const headerSubtitle = lastAgent?.name
    ? "Online · Atendente"
    : orgInfo?.niche || (phase === "chatting" ? "Online" : "Pronto pra atender");

  /* ─── 1. Auto-greet ao montar (1x por sessão) ───────────────────── */
  useEffect(() => {
    if (!orgSlug || hasGreeted) return;
    if (!shouldAutoGreet()) {
      setHasGreeted(true);
      return;
    }
    // Marca como greeted ANTES da animação pra evitar re-trigger em
    // re-mounts (ex: navegação SPA dentro do site).
    markGreeted();
    setHasGreeted(true);

    // Pequeno delay pra parecer natural (não abrir antes do scroll).
    const openTimer = setTimeout(() => {
      setOpen(true);
      setMessages([
        {
          id: "greet",
          body: welcome,
          fromAgent: true,
          createdAt: Date.now(),
        },
      ]);
      // Após 3s, fecha + acende a bolinha.
      autoCloseTimerRef.current = setTimeout(() => {
        setOpen(false);
        setHasUnread(true);
      }, AUTO_CLOSE_DELAY_MS);
    }, 1200);

    return () => {
      clearTimeout(openTimer);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [orgSlug, welcome, hasGreeted]);

  /* ─── Auto-open via Marketing element ────────────────────────── */
  // O Marketing toolkit dispara `nasa:chat:auto-open` X segundos após o
  // load se o toggle "Auto-abrir Chat IA" estiver ligado. Aqui forçamos
  // a abertura mesmo se o cooldown de 24h do auto-greet próprio já
  // gastou (ele é apenas pra primeira impressão; o Marketing tem
  // intenção explícita do dono da page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setOpen(true);
      setHasUnread(false);
      // Se nunca mostramos mensagem ainda (welcome puro), injeta o
      // greeting pra não abrir popover vazio.
      setMessages((prev) =>
        prev.length === 0
          ? [
              {
                id: "marketing-greet",
                body: welcome,
                fromAgent: true,
                createdAt: Date.now(),
              },
            ]
          : prev,
      );
    };
    window.addEventListener("nasa:chat:auto-open", handler);
    return () => window.removeEventListener("nasa:chat:auto-open", handler);
  }, [welcome]);

  /* ─── 2. Quando user reabre, limpa unread + cancela auto-close ─── */
  useEffect(() => {
    if (!open) return;
    setHasUnread(false);
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    // Se já tinha histórico no servidor (cookie de sessão anterior),
    // carrega.
    if (orgSlug && phase === "welcome") {
      fetch(`/api/in-chat/${orgSlug}/messages`, {
        credentials: "same-origin",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          // API retorna `items` em DESC. Convenção WhatsApp-style:
          // fromMe=true = lado da org (atendente/agente). Por isso
          // fromAgent = m.fromMe direto, SEM negar.
          if (data?.items?.length) {
            const asc = [...data.items].reverse();
            setMessages(
              asc.map(
                (m: {
                  id: string;
                  body: string | null;
                  fromMe: boolean;
                  createdAt: string;
                  senderName?: string | null;
                  senderImage?: string | null;
                }) => ({
                  id: m.id,
                  body: m.body ?? "",
                  fromAgent: m.fromMe,
                  createdAt: new Date(m.createdAt).getTime(),
                  senderName: m.senderName ?? null,
                  senderImage: m.senderImage ?? null,
                }),
              ),
            );
            setPhase("chatting");
            cursorRef.current = asc.at(-1)?.id ?? null;
          }
          // Senão, fica em "welcome" e espera o user digitar pra
          // começar a captura de nome/phone (fluxo scripted).
        })
        .catch(() => {
          /* mantém welcome */
        });
    }
  }, [open, orgSlug, phase]);

  /* ─── 3. Polling enquanto chatting ──────────────────────────────── */
  useEffect(() => {
    if (phase !== "chatting" || !orgSlug) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/in-chat/${orgSlug}/messages`, {
          credentials: "same-origin",
        });
        if (!r.ok) return;
        const data = await r.json();
        const items = data?.items as
          | Array<{
              id: string;
              body: string | null;
              fromMe: boolean;
              createdAt: string;
              senderName?: string | null;
              senderImage?: string | null;
            }>
          | undefined;
        if (!items?.length) return;
        const asc = [...items].reverse();
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const news = asc
            .filter((m) => !ids.has(m.id))
            .map((m) => ({
              id: m.id,
              body: m.body ?? "",
              fromAgent: m.fromMe,
              createdAt: new Date(m.createdAt).getTime(),
              senderName: m.senderName ?? null,
              senderImage: m.senderImage ?? null,
            }));
          if (news.length === 0) return prev;
          cursorRef.current = news.at(-1)?.id ?? cursorRef.current;
          // Se chegou mensagem do agente E popover está fechado, acende
          // bolinha vermelha pra avisar o cliente.
          if (!open && news.some((m) => m.fromAgent)) {
            setHasUnread(true);
          }
          return [...prev, ...news];
        });
      } catch {
        // ignora erros transientes
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, orgSlug, open]);

  /* ─── Scroll pro fim quando mensagens mudam ─────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ─── Erros user-friendly do endpoint identify ──────────────────── */
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

  /* ─── Identify: cria/encontra lead + cookie + mensagem de handoff ── */
  const identify = async () => {
    const trimmedName = name.trim();
    // `phone` no state vem mascarado — extrai dígitos pra validar e enviar.
    const trimmedPhone = digitsOf(phone);
    if (!trimmedName || !trimmedPhone) {
      setError("Preencha nome e número.");
      return;
    }
    // Validação client-side: celular BR válido (11 dígitos, DDD ativo,
    // 9° dígito). Se inválido, mostra mensagem scriptada NO CHAT (não
    // no banner de erro) e mantém phase=phone pra o user corrigir.
    if (!isValidBRWhatsApp(trimmedPhone)) {
      setMessages((prev) => [
        ...prev,
        {
          id: `phone-invalid-${Date.now()}`,
          body: "Humm, parece que você digitou um número inválido. Confirma pra mim por favor 🙏",
          fromAgent: true,
          createdAt: Date.now(),
        },
      ]);
      // Limpa o campo pra forçar redigitar — UX mais clara que deixar
      // o número errado e fazer o user apagar manualmente.
      setPhone("");
      setError(null);
      return;
    }
    if (!orgSlug) {
      setError("Chat não configurado pelo dono do site.");
      return;
    }
    setSending(true);
    setError(null);
    try {
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
      if (!r.ok || json.error) {
        const code = json.error ?? `HTTP ${r.status}`;
        throw new Error(errorMessages[code] ?? code);
      }
      // Pega o primeiro nome (resposta do servidor — pode diferir do
      // que user digitou se já existia cadastro com outro nome).
      const greetingName =
        (json.leadName as string)?.split(" ")[0] ??
        trimmedName.split(" ")[0];
      setPhase("chatting");
      // Mensagem de handoff: independente de IA, o atendente humano
      // recebe no tracking-chat e segue a partir daqui.
      setMessages((prev) => [
        ...prev,
        {
          id: `handoff-${Date.now()}`,
          body: `Olá ${greetingName}, estou direcionando sua dúvida para um outro atendente, só um momento.`,
          fromAgent: true,
          createdAt: Date.now(),
        },
      ]);
      // Se o user já tinha digitado uma pergunta antes de identificar,
      // ela está guardada no input — envia automaticamente como
      // primeira mensagem real, pra continuar o flow sem pedir pra ele
      // digitar de novo.
      if (input.trim()) {
        const pendingBody = input.trim();
        setInput("");
        // Pequeno delay pra a UX parecer natural.
        setTimeout(() => {
          sendBody(pendingBody);
        }, 400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao identificar");
    } finally {
      setSending(false);
    }
  };

  /* ─── Envio de mensagem (após identify) ─────────────────────────── */
  const sendBody = async (body: string) => {
    if (!body) return;
    setSending(true);
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
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Falha ao enviar — tente de novo");
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    setInput("");
    await sendBody(body);
  };

  /**
   * Handler do Enter no campo de "welcome" — captura a primeira
   * mensagem do user (antes do identify) e dispara o flow scripted
   * de captura.
   *
   * Comportamento:
   *  1. Adiciona mensagem do user no chat
   *  2. Resposta automática scriptada pedindo nome/telefone
   *  3. Muda phase pra "name" (form aparece)
   *  4. O `input` original fica preservado pra ser enviado depois do
   *     identify (no flow do identify acima)
   */
  const startCapture = () => {
    const body = input.trim();
    if (!body) return;
    setMessages((prev) => [
      ...prev,
      { id: `pre-${Date.now()}`, body, fromAgent: false, createdAt: Date.now() },
      {
        id: `ask-${Date.now() + 1}`,
        body: "Certo, me confirma seu telefone e nome, por favor 🙂",
        fromAgent: true,
        createdAt: Date.now() + 1,
      },
    ]);
    setPhase("name");
    // Mantém o `input` cheio — vai ser enviado automaticamente após
    // identify bem-sucedido.
  };

  /* ─── Portal pro <body> (escapa do canvas com transform) ────────── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Botão flutuante com bolinha vermelha quando há unread. */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 relative"
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
        {/* Bolinha vermelha: aparece quando há mensagem não lida (auto-
            greet acabou de fechar OU resposta chegou com popover off). */}
        {hasUnread && !open && (
          <span
            aria-label="Nova mensagem"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#ef4444",
              border: "2px solid #ffffff",
              boxShadow: "0 0 0 2px rgba(239,68,68,0.3)",
            }}
          />
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
          {/* Header — estilo /whatsapp/[slug]: avatar circular grande +
              nome semibold + status. Substitui dinamicamente entre:
              org (logo+nome) → atendente (foto+nome) ao primeiro
              respondê-lo. Mantém a barra colorida `bg` do element pra
              respeitar a customização visual do dono da page. */}
          <div
            className="px-4 py-3 flex items-center gap-3 border-b shrink-0"
            style={{ background: bg, color: fg }}
          >
            {headerImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={headerImage}
                alt={headerName}
                className="size-10 rounded-full object-cover ring-2 ring-white/30 shrink-0"
              />
            ) : (
              <div className="size-10 rounded-full bg-white/25 flex items-center justify-center text-sm font-extrabold ring-2 ring-white/30 shrink-0">
                {headerName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate leading-tight">
                {headerName}
              </p>
              <p className="text-[11px] opacity-80 truncate flex items-center gap-1.5">
                <span
                  className="inline-block size-1.5 rounded-full bg-emerald-400"
                  aria-hidden
                />
                {headerSubtitle}
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

          {/* Welcome: input livre. Ao enviar, dispara startCapture(). */}
          {phase === "welcome" && (
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
                    startCapture();
                  }
                }}
                autoFocus
              />
              <button
                onClick={startCapture}
                disabled={!input.trim()}
                className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: bg, color: fg }}
              >
                ▶
              </button>
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
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(maskBR(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="flex-1 h-10 rounded-lg border px-3 text-sm bg-white font-mono tracking-wide"
                onKeyDown={(e) => {
                  if (e.key === "Enter") identify();
                }}
                autoFocus
              />
              <button
                onClick={identify}
                disabled={sending || digitsOf(phone).length < 11}
                className="px-4 rounded-lg text-sm font-bold disabled:opacity-50"
                style={{ background: bg, color: fg }}
              >
                {sending ? "…" : "Enviar"}
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
        </div>
      )}
    </>,
    document.body,
  );
}
