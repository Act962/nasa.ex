"use client";

/**
 * Hook com toda a máquina de estados e efeitos do Chat Button —
 * desacopla a lógica da renderização pra os componentes de UI ficarem
 * puramente visuais. Cobre:
 *
 *  1. Auto-greet ao montar (1x por sessão de 24h) e auto-open via evento
 *     `nasa:chat:auto-open` disparado pelo Marketing toolkit.
 *  2. Carga do histórico ao reabrir e polling de novas mensagens (3s)
 *     enquanto em phase=chatting, acendendo a bolinha de não-lida.
 *  3. Fluxo scripted de captura: welcome → name → phone → identify →
 *     chatting (handoff pro atendente humano via tracking-chat).
 *  4. Resolução dinâmica do header (org → atendente que respondeu).
 *
 * Funciona INDEPENDENTE de IA configurada: mensagens entram no banco com
 * `viaInChat=true`; sem IA ativa o atendente humano segue normal e o
 * polling pega a resposta dele em ≤3s.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElementBase } from "../../../types";
import { usePageRenderContext } from "../../public/page-context";
import { digitsOf, isValidBRWhatsApp } from "../../../lib/phone-br";
import type { Msg, OrgInfo, Phase } from "./types";
import { markGreeted, shouldAutoGreet } from "./greet-storage";
import { errorMessages } from "./error-messages";
import {
  fetchMessages,
  fetchOrgInfo,
  postIdentify,
  postMessage,
} from "./chat-api";
import { useChatRealtime } from "./use-chat-realtime";

const AUTO_CLOSE_DELAY_MS = 3000;

export function useChatButton(element: ElementBase) {
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
  /** Canal Pusher da conversa — alimenta o tempo real (sem polling). */
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** Espelha `open` num ref pra o handler de tempo real ler o valor atual
   *  sem re-subscrever o canal a cada toggle do popover. */
  const openRef = useRef(open);
  openRef.current = open;
  const bottomRef = useRef<HTMLDivElement>(null);
  /** ID do timer de auto-close pra cancelar se o user interagir antes. */
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Info da org (logo + nome) — fetch único ao montar. */
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);

  /* ─── 0. Carrega info da org (logo + nome) ──────────────────────── */
  useEffect(() => {
    if (!orgSlug) return;
    let cancelled = false;
    fetchOrgInfo(orgSlug).then((data) => {
      if (!cancelled && data) setOrgInfo(data);
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
      const message = messages[i];
      if (message.fromAgent && (message.senderName || message.senderImage)) {
        return { name: message.senderName, image: message.senderImage };
      }
    }
    return null;
  })();

  // Decide o que mostrar no header:
  // 1. Atendente que respondeu (foto + nome) — quando há mensagem dele
  // 2. Foto + nome da org (do endpoint /info)
  // 3. Fallback: `agentName` do element (config no editor)
  const headerName = lastAgent?.name || orgInfo?.name || agentName;
  const headerImage = lastAgent?.image || orgInfo?.logo || null;
  const headerSubtitle = lastAgent?.name
    ? "Online · Atendente"
    : orgInfo?.niche ||
      (phase === "chatting" ? "Online" : "Pronto pra atender");

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
        { id: "greet", body: welcome, fromAgent: true, createdAt: Date.now() },
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
  }, [open]);

  /* ─── 3. Adquire conversationId + carrega histórico ─────────────── */
  // Roda ao abrir enquanto ainda não temos o canal. Pega o `conversationId`
  // (pra subscrever no Pusher) e, se houver histórico de sessão anterior,
  // entra direto em chatting. Sem cookie ainda (visitante não identificado)
  // o GET responde 401 → fica sem canal até o identify.
  useEffect(() => {
    if (!open || !orgSlug || conversationId) return;
    let cancelled = false;
    fetchMessages(orgSlug)
      .then(({ messages: history, conversationId: id }) => {
        if (cancelled) return;
        if (id) setConversationId(id);
        if (phase === "welcome" && history.length) {
          setMessages(history);
          setPhase("chatting");
        }
      })
      .catch(() => {
        /* mantém welcome */
      });
    return () => {
      cancelled = true;
    };
  }, [open, orgSlug, phase, conversationId]);

  /* ─── 4. Tempo real via Pusher (substitui o polling) ────────────── */
  const handleAgentMessage = useCallback((message: Msg) => {
    setMessages((prev) =>
      prev.some((existing) => existing.id === message.id)
        ? prev
        : [...prev, message],
    );
    // Se o popover está fechado, acende a bolinha de não-lida.
    if (!openRef.current) setHasUnread(true);
  }, []);
  useChatRealtime(conversationId, handleAgentMessage);

  /* ─── Scroll pro fim quando mensagens mudam ─────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      const { id } = await postMessage(orgSlug, body);
      // Reconcilia o id otimista (`local-*`) com o id real persistido pra
      // dedupe consistente com eventos de tempo real.
      if (id) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? { ...message, id } : message,
          ),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
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
      const json = await postIdentify(orgSlug, {
        name: trimmedName,
        phone: trimmedPhone,
        trackingId: trackingId || undefined,
      });
      // Pega o primeiro nome (resposta do servidor — pode diferir do
      // que user digitou se já existia cadastro com outro nome).
      const greetingName =
        (json.leadName as string)?.split(" ")[0] ?? trimmedName.split(" ")[0];
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
        setTimeout(() => sendBody(pendingBody), 400);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "Falha ao identificar";
      setError(errorMessages[code] ?? code);
    } finally {
      setSending(false);
    }
  };

  /**
   * Handler do Enter no campo de "welcome" — captura a primeira
   * mensagem do user (antes do identify) e dispara o flow scripted de
   * captura: adiciona a msg do user, responde scriptado pedindo
   * nome/telefone e muda phase pra "name". O `input` original fica
   * preservado pra ser enviado depois do identify.
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
  };

  /** Avança da captura de nome pra de telefone (botão "Próximo"/Enter). */
  const advanceToPhone = () => setPhase("phone");

  /* ─── Portal pro <body> (escapa do canvas com transform) ────────── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return {
    // estilo / textos
    label,
    bg,
    fg,
    // estado
    open,
    setOpen,
    phase,
    name,
    setName,
    phone,
    setPhone,
    messages,
    input,
    setInput,
    sending,
    error,
    hasUnread,
    mounted,
    bottomRef,
    // header resolvido
    headerName,
    headerImage,
    headerSubtitle,
    // handlers
    identify,
    send,
    startCapture,
    advanceToPhone,
  };
}
