"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInChatMessages } from "@/features/tracking-chat/hooks/use-in-chat-messages";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  BanIcon,
  CameraIcon,
  CheckIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  FileIcon,
  ImageIcon,
  InfoIcon,
  MapPinIcon,
  MicIcon,
  PaperclipIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  StopCircleIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { pusherClient } from "@/lib/pusher";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import type { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { toast } from "sonner";

/**
 * Janela do In-Chat (cliente) — UI estilo WhatsApp Web do lado do LEAD.
 *
 * Features (perspectiva do user-final, NÃO do atendente):
 *  - Header clicável → dialog com info da empresa
 *  - Bolhas verde/branca + rabinho + checks azuis
 *  - Botão + (popover): Foto, Câmera, Documento, Localização, Contato
 *  - Botão emoji + textarea + mic (gravação MediaRecorder)
 *  - Menu nas mensagens: Responder, Copiar, Apagar (próprias)
 *  - Real-time via Pusher + safety polling 30s
 *
 * O que NÃO tem (perspectiva atendente, exposta só em /tracking-chat):
 *  - Formulários, scripts, NBox, IA do lead, propostas, tags, lembretes
 *  - Reagir, Encaminhar, Fixar (são features atendente WhatsApp Business)
 */

interface QuotedMessageRef {
  id: string;
  body: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fromMe: boolean;
  senderName: string | null;
}

interface Message {
  id: string;
  messageId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  latitude: number | null;
  longitude: number | null;
  // Pode chegar como `Date` (oRPC + Prisma) ou `string` (optimistic toISOString
  // / Pusher payload serializado). `new Date()` aceita ambos sem problema.
  createdAt: string | Date;
  fromMe: boolean;
  status: string;
  senderName: string | null;
  viaInChat: boolean;
  quotedMessageId: string | null;
  quotedMessage: QuotedMessageRef | null;
}

interface OrgInfo {
  name: string;
  logo: string | null;
  niche: string | null;
  cep: string | null;
  phone: string | null;
}

export function InChatWindow({
  slug,
  orgName,
  orgLogo,
}: {
  slug: string;
  orgName: string;
  orgLogo: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  const [newMessageBadge, setNewMessageBadge] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const fetchMoreGuardRef = useRef(false);

  // ── Carregamento + paginação via oRPC + React Query ──────────────────
  const {
    data: messagesPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInChatMessages(slug);

  // Pages vêm em DESC (mais nova primeiro), e cada página posterior é
  // mais antiga que a anterior. Flatten + reverse pra exibir ASC.
  const fetchedMessages = useMemo<Message[]>(() => {
    if (!messagesPages) return [];
    const all = messagesPages.pages.flatMap((p) => p.items as Message[]);
    return [...all].reverse();
  }, [messagesPages]);
  const fileInputImageRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Sincroniza a query (server) com o estado local (que carrega também
  // optimistic + atualizações do Pusher). Optimistic NUNCA é sobrescrito —
  // sumirá quando a query trouxer a real (mesmo id ou via dedup do POST).
  useEffect(() => {
    if (!fetchedMessages.length) return;
    setMessages((prev) => {
      const byId = new Map<string, Message>();
      for (const m of fetchedMessages) byId.set(m.id, m);
      for (const m of prev) {
        if (m.id.startsWith("optimistic-")) {
          byId.set(m.id, m);
          continue;
        }
        // Pusher pode ter trazido updates (status, delete) mais recentes
        // do que a página inicial — preserva esses por id.
        if (!byId.has(m.id)) byId.set(m.id, m);
      }
      return Array.from(byId.values()).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, [fetchedMessages]);

  // conversationId vem da primeira página (todas trazem o mesmo).
  useEffect(() => {
    const id = messagesPages?.pages[0]?.conversationId;
    if (id) setConversationId(id);
  }, [messagesPages]);

  // Pusher real-time
  useEffect(() => {
    if (!conversationId) return;
    const channel = pusherClient.subscribe(conversationId);
    const upsert = (incoming: Message) => {
      setMessages((prev) => {
        // Dedup contra optimistic: se chegar a real do próprio envio
        // (fromMe=false, viaInChat=true, body igual), remove o temp.
        const matchedOptimistic = prev.find(
          (m) =>
            m.id.startsWith("optimistic-") &&
            m.fromMe === incoming.fromMe &&
            (m.body ?? null) === (incoming.body ?? null) &&
            (m.mediaUrl ?? null) === (incoming.mediaUrl ?? null),
        );
        const byId = new Map<string, Message>();
        for (const m of prev) {
          if (matchedOptimistic && m.id === matchedOptimistic.id) continue;
          byId.set(m.id, m);
        }
        byId.set(incoming.id, incoming);
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
      });
    };
    const handleCreated = (payload: any) => {
      if (payload?.id) upsert(payload as Message);
    };
    const handleNew = (payload: any) => {
      if (payload?.id) upsert(payload as Message);
    };
    const handleUpdated = (payload: any) => {
      if (!payload?.messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
                ...m,
                status: payload.status ?? m.status,
                ...(payload.status === "DELETED" && {
                  body: null,
                  mediaUrl: null,
                  mediaType: null,
                  mimetype: null,
                  fileName: null,
                  latitude: null,
                  longitude: null,
                }),
              }
            : m,
        ),
      );
    };
    channel.bind("message:created", handleCreated);
    channel.bind("message:new", handleNew);
    channel.bind("message:updated", handleUpdated);
    return () => {
      channel.unbind("message:created", handleCreated);
      channel.unbind("message:new", handleNew);
      channel.unbind("message:updated", handleUpdated);
      pusherClient.unsubscribe(conversationId);
    };
  }, [conversationId]);

  // ── Scroll inteligente (inspirado no tracking-chat) ──────────────────
  // Inicial: pula pro fim sem animação na 1ª carga. Marca já como "no fim"
  // pra que o auto-fetch subsequente pine no scrollHeight em vez de
  // preservar posição relativa — usuário sempre cai na última mensagem.
  useEffect(() => {
    if (hasInitialScrolled || !messages.length) return;
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = true;
    setHasInitialScrolled(true);
    setIsAtBottom(true);
    // Double rAF: garante que o DOM mediu altura das bolhas antes do scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
      });
    });
  }, [hasInitialScrolled, messages.length]);

  // A cada nova mensagem: se o usuário está perto do fim, rola suave;
  // senão mostra badge "novas mensagens". Regra única — vale tanto pra
  // mensagem que o lead enviou quanto pra mensagem do atendente.
  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    const lastId = last.id;
    const prevId = lastMessageIdRef.current;
    lastMessageIdRef.current = lastId;

    if (!hasInitialScrolled || !prevId || prevId === lastId) return;

    const el = scrollRef.current;
    if (!el) return;

    if (isAtBottom) {
      // Trava o ref ANTES da animação: se mídia carregar e mudar a altura
      // durante o smooth scroll, o ResizeObserver mantém pinado no fim.
      isAtBottomRef.current = true;
      // Double rAF garante que o DOM já mediu a altura do novo conteúdo.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        });
      });
      setNewMessageBadge(false);
    } else if (last.fromMe) {
      // Mensagem chegou do atendente e estamos longe → badge.
      setNewMessageBadge(true);
    }
  }, [messages, hasInitialScrolled, isAtBottom]);

  // Mantém no fim quando imagens/áudios carregam (mudam altura) e quando
  // o container redimensiona (teclado mobile, viewport, etc).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const keepAtBottomIfNeeded = () => {
      if (!hasInitialScrolled) return;
      if (!isAtBottomRef.current) return;
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
      });
    };

    const onLoad = (e: Event) => {
      if (
        e.target instanceof HTMLImageElement ||
        e.target instanceof HTMLVideoElement ||
        e.target instanceof HTMLAudioElement
      ) {
        keepAtBottomIfNeeded();
      }
    };
    el.addEventListener("load", onLoad, true);

    const ro = new ResizeObserver(keepAtBottomIfNeeded);
    ro.observe(el);

    return () => {
      el.removeEventListener("load", onLoad, true);
      ro.disconnect();
    };
  }, [hasInitialScrolled]);

  // Scroll infinito reverso — preserva a posição de leitura compensando
  // a altura ganha com as mensagens antigas (mesmo padrão do tracking-chat).
  const fetchOlder = async () => {
    if (!hasNextPage || isFetchingNextPage || fetchMoreGuardRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    fetchMoreGuardRef.current = true;
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;

    try {
      const result = await fetchNextPage();
      if (result.isError) return;
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (!node) return;
        if (isAtBottomRef.current) {
          // Usuário ainda no fim (acabou de entrar / não rolou pra cima)
          // → pina na última mensagem em vez de preservar posição relativa.
          node.scrollTop = node.scrollHeight;
        } else {
          // Usuário lendo histórico — mantém a mensagem visível no lugar.
          node.scrollTop =
            node.scrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } finally {
      requestAnimationFrame(() => {
        fetchMoreGuardRef.current = false;
      });
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (
      el.scrollTop <= 80 &&
      hasNextPage &&
      !isFetchingNextPage &&
      !fetchMoreGuardRef.current
    ) {
      fetchOlder();
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 80;
    isAtBottomRef.current = nearBottom;
    setIsAtBottom(nearBottom);
    if (nearBottom) setNewMessageBadge(false);
  };

  // Auto-fetch enquanto o conteúdo não enche o viewport — sem isso, com
  // poucas mensagens (ou primeira página menor que a altura), o usuário
  // não consegue rolar pra cima e o scroll-infinito nunca dispara.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!hasNextPage || isFetchingNextPage || fetchMoreGuardRef.current) {
      return;
    }
    if (el.scrollHeight <= el.clientHeight + 4) {
      fetchOlder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, hasNextPage, isFetchingNextPage]);

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setIsAtBottom(true);
    setNewMessageBadge(false);
  };

  // ── Envio ────────────────────────────────────────────────────────────
  const sendMessage = async (payload: {
    body?: string;
    mediaUrl?: string;
    mimetype?: string;
    fileName?: string;
    latitude?: number;
    longitude?: number;
    contactName?: string;
    contactPhone?: string;
    quotedMessageId?: string;
  }) => {
    if (sending) return;
    setSending(true);

    const tempId = `optimistic-${Date.now()}`;
    const optimisticType = payload.latitude != null
      ? "location"
      : payload.contactName || payload.contactPhone
        ? "contact"
        : payload.mimetype?.startsWith("image/")
          ? "image"
          : payload.mimetype?.startsWith("audio/")
            ? "audio"
            : payload.mimetype?.startsWith("video/")
              ? "video"
              : payload.mediaUrl
                ? "document"
                : null;

    const optimistic: Message = {
      id: tempId,
      messageId: tempId,
      body:
        payload.contactName ?? payload.body ?? null,
      mediaUrl: payload.mediaUrl ?? null,
      mediaType: optimisticType,
      mimetype: payload.mimetype ?? null,
      fileName: payload.contactPhone ?? payload.fileName ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      createdAt: new Date().toISOString(),
      fromMe: false,
      status: "SENT",
      senderName: null,
      viaInChat: true,
      quotedMessageId: payload.quotedMessageId ?? null,
      quotedMessage: replyTo
        ? {
            id: replyTo.id,
            body: replyTo.body,
            mediaType: replyTo.mediaType,
            mimetype: replyTo.mimetype,
            fromMe: replyTo.fromMe,
            senderName: replyTo.senderName,
          }
        : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);

    // Rola pro fim quando o lead envia E está perto do fim. Não depende
    // do useEffect (que pode pegar isAtBottom stale entre re-renders) —
    // lemos o ref e disparamos direto. Double rAF garante que o DOM já
    // mediu a altura da nova bolha antes do scroll.
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        });
      });
    }

    try {
      const res = await fetch(`/api/in-chat/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("send failed");
      const { message } = await res.json();
      setMessages((prev) => {
        // Remove temp + qualquer duplicata da real que o Pusher já tenha trazido.
        const byId = new Map<string, Message>();
        for (const m of prev) {
          if (m.id === tempId || m.id === message.id) continue;
          byId.set(m.id, m);
        }
        byId.set(message.id, message);
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Falha ao enviar — tente de novo");
      if (payload.body) setDraft(payload.body);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    sendMessage({
      body: text,
      quotedMessageId: replyTo?.id,
    });
  };

  // ── Upload (foto / documento / áudio) ────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (uploadingMedia || file.size > 20 * 1024 * 1024) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Arquivo grande demais (máx 20MB)");
      }
      return;
    }
    setUploadingMedia(true);
    try {
      const presignRes = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: file.type.startsWith("image/"),
        }),
      });
      if (!presignRes.ok) throw new Error("presign failed");
      const { presignedUrl, key } = await presignRes.json();
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("upload failed");
      await sendMessage({
        mediaUrl: key,
        mimetype: file.type,
        fileName: file.name,
        quotedMessageId: replyTo?.id,
      });
    } catch (err) {
      console.error("[in-chat upload]", err);
      toast.error("Falha ao enviar arquivo");
    } finally {
      setUploadingMedia(false);
      setAttachOpen(false);
    }
  };

  // ── Localização ──────────────────────────────────────────────────────
  const handleLocation = () => {
    setAttachOpen(false);
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada nesse dispositivo");
      return;
    }
    toast.info("Obtendo localização...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendMessage({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          quotedMessageId: replyTo?.id,
        });
      },
      (err) => {
        console.warn("[geolocation]", err);
        toast.error("Permita acesso à localização");
      },
      { timeout: 15_000, enableHighAccuracy: false },
    );
  };

  // ── Gravação de áudio ────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        await handleFileUpload(file);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("[mic]", err);
      toast.error("Permita acesso ao microfone");
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };
  const cancelRecording = () => {
    mediaRecorderRef.current?.stream
      .getTracks()
      .forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setRecording(false);
  };

  // ── Deletar mensagem ─────────────────────────────────────────────────
  const handleDelete = async (msg: Message) => {
    if (!confirm("Apagar essa mensagem?")) return;
    try {
      const res = await fetch(
        `/api/in-chat/${slug}/messages/${msg.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("delete failed");
      // Otimista — o Pusher também vai atualizar
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                status: "DELETED",
                body: null,
                mediaUrl: null,
                mediaType: null,
                mimetype: null,
                fileName: null,
                latitude: null,
                longitude: null,
              }
            : m,
        ),
      );
    } catch {
      toast.error("Falha ao apagar — tente de novo");
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#dbe9f7] dark:bg-zinc-900 overflow-hidden">
      {/* Header — clicável pra abrir dialog de info */}
      <header
        className="shrink-0 bg-white dark:bg-zinc-800 border-b shadow-sm px-4 py-3 flex items-center gap-3 z-10 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        onClick={() => setInfoOpen(true)}
        role="button"
        aria-label={`Ver informações de ${orgName}`}
      >
        {orgLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={orgLogo}
            alt={orgName}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="size-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold">
            {orgName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{orgName}</p>
          <p className="text-[10px] text-zinc-500">Atendimento via WhatsApp</p>
        </div>
        <InfoIcon className="size-4 text-zinc-400 shrink-0" />
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "relative flex-1 min-h-0 overflow-y-auto p-4 space-y-2",
          "bg-[url('/chat-bg/mobile.png')] md:bg-[url('/chat-bg/desktop.png')]",
          "bg-cover bg-center bg-fixed",
        )}
      >
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-2">
            <div className="size-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}
        {(() => {
          const seen = new Set<string>();
          const dedup = messages.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          // Agrupa por data (toDateString) pra fixar o label no topo do grupo,
          // como o tracking-chat — `sticky top-2 z-10` no wrapper do grupo.
          const groups: { date: string; messages: typeof dedup }[] = [];
          for (const m of dedup) {
            const key = new Date(m.createdAt).toDateString();
            const last = groups[groups.length - 1];
            if (last && last.date === key) last.messages.push(m);
            else groups.push({ date: key, messages: [m] });
          }
          return groups.map((group) => (
            <div key={group.date} className="flex flex-col gap-2">
              <div className="flex justify-center my-3 sticky top-2 z-10">
                <span className="bg-white/80 dark:bg-zinc-800/80 text-[10px] font-medium px-2 py-1 rounded-md shadow uppercase text-zinc-700 dark:text-zinc-200">
                  {formatDateHeader(group.messages[0].createdAt)}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isOwnFromLead = !msg.fromMe;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex group",
                      isOwnFromLead && "justify-end",
                    )}
                  >
                    <ChatBubble
                      msg={msg}
                      isOwn={isOwnFromLead}
                      onReply={() => setReplyTo(msg)}
                      onCopy={() => {
                        navigator.clipboard
                          .writeText(msg.body ?? "")
                          .then(() => toast.success("Copiado"));
                      }}
                      onDelete={() => handleDelete(msg)}
                    />
                  </div>
                );
              })}
            </div>
          ));
        })()}
        <div ref={bottomRef} />
      </div>

      {/* Botão flutuante "rolar pra baixo" + badge */}
      {(!isAtBottom || newMessageBadge) && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Rolar para o fim"
          className={cn(
            "absolute bottom-20 right-3 z-20 size-10 rounded-full",
            "bg-white dark:bg-zinc-800 shadow-md border",
            "flex items-center justify-center text-zinc-700 dark:text-zinc-200",
            "hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors",
          )}
        >
          <ChevronDownIcon className="size-5" />
          {newMessageBadge && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center">
              •
            </span>
          )}
        </button>
      )}

      {/* Composer */}
      {recording ? (
        <RecordingBar onStop={stopRecording} onCancel={cancelRecording} />
      ) : (
        <form
          onSubmit={handleSubmitText}
          className="shrink-0 bg-white dark:bg-zinc-800 border-t"
        >
          {/* Reply preview */}
          {replyTo && (
            <div className="border-b px-3 py-2 flex items-start gap-2 bg-zinc-50 dark:bg-zinc-900/30">
              <div className="flex-1 min-w-0 border-l-4 border-emerald-500 pl-2">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {replyTo.fromMe ? orgName : "Você"}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                  {replyTo.body ?? "[mídia]"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setReplyTo(null)}
                className="size-7 shrink-0"
                aria-label="Cancelar resposta"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )}

          {/* Linha do composer */}
          <div className="px-2 py-2 flex items-end gap-1.5">
            {/* Botão + (anexos) */}
            <Popover open={attachOpen} onOpenChange={setAttachOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 size-9 rounded-full text-zinc-600 dark:text-zinc-300"
                  aria-label="Anexar"
                  disabled={uploadingMedia}
                >
                  <PaperclipIcon className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-fit p-1 rounded-xl"
              >
                <div className="flex flex-col gap-0.5 min-w-[180px]">
                  <AttachItem
                    icon={ImageIcon}
                    color="text-violet-500"
                    label="Foto"
                    onClick={() => {
                      setAttachOpen(false);
                      fileInputImageRef.current?.click();
                    }}
                  />
                  <AttachItem
                    icon={CameraIcon}
                    color="text-pink-500"
                    label="Câmera"
                    onClick={() => {
                      setAttachOpen(false);
                      setCameraOpen(true);
                    }}
                  />
                  <AttachItem
                    icon={FileIcon}
                    color="text-blue-500"
                    label="Documento"
                    onClick={() => {
                      setAttachOpen(false);
                      fileInputDocRef.current?.click();
                    }}
                  />
                  <AttachItem
                    icon={MapPinIcon}
                    color="text-red-500"
                    label="Localização"
                    onClick={handleLocation}
                  />
                  <AttachItem
                    icon={UserIcon}
                    color="text-green-500"
                    label="Contato"
                    onClick={() => {
                      setAttachOpen(false);
                      setContactDialogOpen(true);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Botão emoji */}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 size-9 rounded-full text-zinc-600 dark:text-zinc-300"
                  aria-label="Emojis"
                >
                  <SmileIcon className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-fit p-0 border-none bg-transparent"
              >
                <EmojiPicker
                  searchPlaceholder="Pesquisar emoji"
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  emojiData={pt as EmojiData}
                  theme={Theme.DARK}
                  onEmojiClick={(emoji) =>
                    setDraft((prev) => prev + emoji.emoji)
                  }
                />
              </PopoverContent>
            </Popover>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                uploadingMedia ? "Enviando..." : "Digite uma mensagem"
              }
              disabled={uploadingMedia}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none px-2 py-2 max-h-32 min-h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement).requestSubmit();
                }
              }}
            />

            {draft.trim() ? (
              <Button
                type="submit"
                size="icon-sm"
                disabled={sending || uploadingMedia}
                className="shrink-0 size-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                aria-label="Enviar"
              >
                <SendIcon className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                onClick={startRecording}
                disabled={uploadingMedia}
                className="shrink-0 size-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                aria-label="Gravar áudio"
              >
                <MicIcon className="size-4" />
              </Button>
            )}

            <input
              ref={fileInputImageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputDocRef}
              type="file"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.zip,.rar,.csv,.xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = "";
              }}
            />
          </div>
        </form>
      )}

      {/* Dialog: info da empresa */}
      <OrgInfoDialog
        slug={slug}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        fallbackName={orgName}
        fallbackLogo={orgLogo}
      />

      {/* Dialog: adicionar contato */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onSubmit={(name, phone) =>
          sendMessage({
            contactName: name,
            contactPhone: phone,
            quotedMessageId: replyTo?.id,
          })
        }
      />

      {/* Dialog: câmera */}
      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => handleFileUpload(file)}
      />
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────

function AttachItem({
  icon: Icon,
  color,
  label,
  onClick,
}: {
  icon: any;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="justify-start gap-3 px-3 py-2 h-auto"
      onClick={onClick}
    >
      <Icon className={cn("size-5", color)} />
      <span className="text-sm">{label}</span>
    </Button>
  );
}

function ChatBubble({
  msg,
  isOwn,
  onReply,
  onCopy,
  onDelete,
}: {
  msg: Message;
  isOwn: boolean;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const isImage = msg.mimetype?.startsWith("image/");
  const isAudio = msg.mimetype?.startsWith("audio/");
  const isVideo = msg.mimetype?.startsWith("video/");
  const isLocation = msg.latitude != null && msg.longitude != null;
  const isContact = msg.mediaType === "contact";
  const isFile =
    msg.mediaUrl && !isImage && !isAudio && !isVideo && !isLocation;
  const mediaSrc = useConstructUrl(msg.mediaUrl ?? "");
  const isDeleted = msg.status === "DELETED";
  // Lead só pode apagar suas próprias (do ponto de vista do DB: fromMe=false)
  const canDelete = !msg.fromMe && !isDeleted;

  return (
    <div className="flex items-center gap-1 group/msg max-w-[85%]">
      {/* Menu de mensagem — só pra próprias (esquerda do bubble) */}
      {isOwn && !isDeleted && (
        <MessageMenu
          onReply={onReply}
          onCopy={msg.body ? onCopy : undefined}
          onDelete={canDelete ? onDelete : undefined}
        />
      )}

      <div
        className={cn(
          "relative text-sm rounded-lg px-2 py-1 shadow-sm",
          isOwn
            ? "bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-50 rounded-tr-none"
            : "bg-white text-zinc-900 dark:bg-[#202c33] dark:text-zinc-50 rounded-tl-none",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0 w-0 h-0 pointer-events-none",
            isOwn
              ? "right-[-8px] border-t-[8px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[8px] border-r-transparent"
              : "left-[-8px] border-t-[8px] border-t-white dark:border-t-[#202c33] border-l-[8px] border-l-transparent",
          )}
        />

        {isDeleted ? (
          <div className="flex items-center gap-1.5 italic text-zinc-500 dark:text-zinc-400 px-1.5 py-1 text-sm">
            <BanIcon className="size-3.5" />
            <span>Mensagem apagada</span>
          </div>
        ) : (
          <>
            {/* Quoted/reply preview */}
            {msg.quotedMessage && (
              <div className="border-l-4 border-emerald-500 bg-black/5 dark:bg-white/5 rounded mb-1 px-2 py-1">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {msg.quotedMessage.fromMe
                    ? msg.quotedMessage.senderName ?? "Atendente"
                    : "Você"}
                </p>
                <p className="text-xs opacity-80 truncate max-w-[260px]">
                  {msg.quotedMessage.body ?? "[mídia]"}
                </p>
              </div>
            )}

            {isLocation && (
              <a
                href={`https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-1.5 py-1 hover:underline"
              >
                <MapPinIcon className="size-5 text-red-500" />
                <span className="text-sm">Localização</span>
              </a>
            )}

            {isContact && (
              <div className="flex items-center gap-2 px-1.5 py-1">
                <UserIcon className="size-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">
                    {msg.body ?? "Contato"}
                  </p>
                  {msg.fileName && (
                    <p className="text-xs text-zinc-500">{msg.fileName}</p>
                  )}
                </div>
              </div>
            )}

            {isImage && msg.mediaUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaSrc}
                alt={msg.fileName ?? "Imagem"}
                className="max-h-64 max-w-full rounded mb-1 object-contain"
              />
            )}
            {isAudio && msg.mediaUrl && (
              <audio
                src={mediaSrc}
                controls
                className="max-w-[260px] mb-1"
                preload="metadata"
              />
            )}
            {isVideo && msg.mediaUrl && (
              <video
                src={mediaSrc}
                controls
                className="max-h-64 max-w-full rounded mb-1"
                preload="metadata"
              />
            )}
            {isFile && msg.mediaUrl && (
              <a
                href={mediaSrc}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-1.5 py-1 hover:underline"
              >
                <FileIcon className="size-5" />
                <span className="text-sm truncate max-w-[200px]">
                  {msg.fileName ?? "Arquivo"}
                </span>
              </a>
            )}
            {msg.body && !isContact && (
              <div className="whitespace-pre-wrap px-1.5 pt-1 pb-0.5">
                {msg.body}
              </div>
            )}
          </>
        )}

        <div
          className={cn(
            "flex items-center justify-end gap-1 text-[10px] -mt-0.5",
            isOwn
              ? "text-zinc-700/70 dark:text-zinc-300/70"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          {format(new Date(msg.createdAt), "p")}
          {isOwn && !isDeleted && (
            <>
              {msg.status === "SEEN" ? (
                <CheckCheckIcon className="size-3.5 text-[#53bdeb]" />
              ) : (
                <CheckIcon className="size-3.5 text-zinc-500/80 dark:text-zinc-300/70" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Menu de mensagem — só pra recebidas (direita do bubble) */}
      {!isOwn && !isDeleted && (
        <MessageMenu onReply={onReply} onCopy={msg.body ? onCopy : undefined} />
      )}
    </div>
  );
}

function MessageMenu({
  onReply,
  onCopy,
  onDelete,
}: {
  onReply: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="opacity-0 group-hover/msg:opacity-100 transition-opacity size-7 shrink-0 text-zinc-500"
          aria-label="Opções da mensagem"
        >
          <EllipsisVerticalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={onReply}>
          <ReplyIcon className="size-4" />
          Responder
        </DropdownMenuItem>
        {onCopy && (
          <DropdownMenuItem onClick={onCopy}>
            <CopyIcon className="size-4" />
            Copiar
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-700"
            >
              <Trash2Icon className="size-4" />
              Apagar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrgInfoDialog({
  slug,
  open,
  onOpenChange,
  fallbackName,
  fallbackLogo,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fallbackName: string;
  fallbackLogo: string | null;
}) {
  const [info, setInfo] = useState<OrgInfo | null>(null);
  useEffect(() => {
    if (!open) return;
    fetch(`/api/in-chat/${slug}/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInfo(d));
  }, [open, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-4">
            {(info?.logo ?? fallbackLogo) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={info?.logo ?? fallbackLogo ?? ""}
                alt={info?.name ?? fallbackName}
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <div className="size-20 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xl font-semibold">
                {(info?.name ?? fallbackName).slice(0, 2).toUpperCase()}
              </div>
            )}
            <DialogTitle className="text-center">
              {info?.name ?? fallbackName}
            </DialogTitle>
            <DialogDescription className="text-center">
              Você está conversando via WhatsApp da empresa.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-2 py-2 text-sm">
          {info?.phone && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className="text-zinc-500">Telefone</span>
              <span className="font-medium">{info.phone}</span>
            </div>
          )}
          {info?.niche && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className="text-zinc-500">Segmento</span>
              <span className="font-medium">{info.niche}</span>
            </div>
          )}
          {info?.cep && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <span className="text-zinc-500">CEP</span>
              <span className="font-medium">{info.cep}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setName("");
          setPhone("");
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartilhar contato</DialogTitle>
          <DialogDescription>
            Envie um contato pra empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="contact-name">Nome</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="contact-phone">Telefone</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 86 9..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !phone.trim()) return;
              onSubmit(name.trim(), phone.trim());
              onOpenChange(false);
            }}
            disabled={!name.trim() || !phone.trim()}
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch((err) => {
        console.warn("[camera]", err);
        setError("Permita acesso à câmera");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        onOpenChange(false);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Tirar foto</DialogTitle>
          <DialogDescription className="sr-only">
            Use sua câmera pra capturar uma foto.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-black aspect-square w-full flex items-center justify-center">
          {error ? (
            <p className="text-white text-sm p-4">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <DialogFooter className="px-4 pb-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCapture} disabled={!!error}>
            <CameraIcon className="size-4" />
            Capturar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordingBar({
  onStop,
  onCancel,
}: {
  onStop: () => void;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="shrink-0 bg-white dark:bg-zinc-800 border-t px-3 py-2 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 size-9 rounded-full text-red-500"
        onClick={onCancel}
        aria-label="Cancelar gravação"
      >
        <XIcon className="size-5" />
      </Button>
      <div className="flex-1 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
        Gravando — {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
        {String(elapsed % 60).padStart(2, "0")}
      </div>
      <Button
        type="button"
        size="icon-sm"
        onClick={onStop}
        className="shrink-0 size-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
        aria-label="Enviar áudio"
      >
        <StopCircleIcon className="size-5" />
      </Button>
    </div>
  );
}

function formatDateHeader(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy");
}
