"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CheckIcon,
  CheckCheckIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  StopCircleIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { pusherClient } from "@/lib/pusher";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import type { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { useConstructUrl } from "@/hooks/use-construct-url";

/**
 * Janela do In-Chat (cliente) — UI WhatsApp-like completa:
 *  - Header com avatar + nome da org
 *  - Bolhas verde/branca com rabinho triangular (estilo WA Web)
 *  - Checks ✓ / ✓✓ (azul quando SEEN)
 *  - Composer com:
 *    - Botão `+` (popover: Foto, Documento)
 *    - Botão de emoji
 *    - Textarea
 *    - Botão de mic (gravação de áudio via MediaRecorder)
 *    - Botão de enviar
 *  - Real-time via Pusher no canal `<conversationId>` (cuid 25-chars,
 *    unguessable, sem auth privada no MVP)
 *  - Safety polling de 30s caso o Pusher caia
 */

interface Message {
  id: string;
  messageId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  createdAt: string;
  fromMe: boolean;
  status: string;
  senderName: string | null;
  viaInChat: boolean;
}

const SAFETY_POLL_MS = 30_000;

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputImageRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Initial load + safety polling
  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/in-chat/${slug}/messages`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: Message[];
          conversationId: string;
        };
        if (cancelled) return;
        const ordered = [...data.items].reverse();
        // Merge — mantém otimistas (tempId começa com "optimistic-") que
        // ainda não foram substituídas, dedup por id, ordena por createdAt
        setMessages((prev) => {
          const byId = new Map<string, Message>();
          // Servidor (canonical) vem primeiro
          for (const m of ordered) byId.set(m.id, m);
          // Otimistas locais sobrescrevem se o servidor ainda não conhece
          for (const m of prev) {
            if (m.id.startsWith("optimistic-") && !byId.has(m.id)) {
              byId.set(m.id, m);
            }
          }
          return Array.from(byId.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          );
        });
        setConversationId(data.conversationId);
      } catch {}
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, SAFETY_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  // Pusher real-time
  useEffect(() => {
    if (!conversationId) return;
    const channel = pusherClient.subscribe(conversationId);

    const upsert = (incoming: Message) => {
      setMessages((prev) => {
        // Dedup robusto: dois caminhos possíveis pro mesmo id já estar
        // no array — (a) otimista que virou real, (b) Pusher entregou
        // antes do response do POST chegar. Map por id garante 1 entrada.
        const byId = new Map<string, Message>();
        for (const m of prev) byId.set(m.id, m);
        byId.set(incoming.id, incoming);
        // Mantém ordem cronológica por createdAt
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
            ? { ...m, status: payload.status ?? m.status }
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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // ── Envio de mensagem ────────────────────────────────────────────────
  const sendMessage = async (payload: {
    body?: string;
    mediaUrl?: string;
    mimetype?: string;
    fileName?: string;
  }) => {
    if (sending) return;
    setSending(true);

    const tempId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      messageId: tempId,
      body: payload.body ?? null,
      mediaUrl: payload.mediaUrl ?? null,
      mediaType: payload.mimetype?.startsWith("image/")
        ? "image"
        : payload.mimetype?.startsWith("audio/")
          ? "audio"
          : payload.mimetype?.startsWith("video/")
            ? "video"
            : payload.mediaUrl
              ? "document"
              : null,
      mimetype: payload.mimetype ?? null,
      fileName: payload.fileName ?? null,
      createdAt: new Date().toISOString(),
      fromMe: false,
      status: "SENT",
      senderName: null,
      viaInChat: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/in-chat/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("send failed");
      const { message } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? message : m)),
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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
    sendMessage({ body: text });
  };

  // ── Upload (foto / documento) via /api/s3/upload (presigned) ─────────
  const handleFileUpload = async (file: File) => {
    if (uploadingMedia || file.size > 20 * 1024 * 1024) {
      if (file.size > 20 * 1024 * 1024) {
        alert("Arquivo grande demais (máx 20MB)");
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
      });
    } catch (err) {
      console.error("[in-chat upload]", err);
      alert("Falha ao enviar arquivo");
    } finally {
      setUploadingMedia(false);
      setAttachOpen(false);
    }
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
        // Para todos os tracks pra liberar mic
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
      console.error("[in-chat mic]", err);
      alert("Permita acesso ao microfone pra gravar áudio");
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

  return (
    <div className="min-h-screen flex flex-col bg-[#dbe9f7] dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
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
      </header>

      {/* Mensagens — background SVG espacial */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-2",
          "bg-[url('/chat-bg/mobile.png')] md:bg-[url('/chat-bg/desktop.png')]",
          "bg-cover bg-center bg-fixed",
        )}
      >
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}
        {/* Dedup defensivo — race condition entre polling + Pusher pode
            entregar a mesma mensagem 2x antes do upsert estabilizar. Filtrar
            aqui garante keys únicas no React. */}
        {(() => {
          const seen = new Set<string>();
          const deduped = messages.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          return deduped;
        })().map((msg, i, arr) => {
          // No In-Chat o lead É o "atendente" da própria perspectiva:
          // mensagens dele (no DB `fromMe: false`) vão pra DIREITA (verde).
          // Mensagens do consultor (DB `fromMe: true`) vêm da ESQUERDA.
          const isOwnFromLead = !msg.fromMe;
          const prev = arr[i - 1];
          const showDateHeader =
            !prev ||
            new Date(msg.createdAt).toDateString() !==
              new Date(prev.createdAt).toDateString();

          return (
            <div key={msg.id}>
              {showDateHeader && (
                <div className="flex justify-center my-3">
                  <span className="bg-white/80 dark:bg-zinc-800/80 text-[10px] font-medium px-2 py-1 rounded-md shadow uppercase text-zinc-700 dark:text-zinc-200">
                    {formatDateHeader(msg.createdAt)}
                  </span>
                </div>
              )}
              <div
                className={cn("flex", isOwnFromLead && "justify-end")}
              >
                <ChatBubble
                  msg={msg}
                  isOwn={isOwnFromLead}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      {recording ? (
        <RecordingBar onStop={stopRecording} onCancel={cancelRecording} />
      ) : (
        <form
          onSubmit={handleSubmitText}
          className="bg-white dark:bg-zinc-800 border-t px-2 py-2 flex items-end gap-1.5 sticky bottom-0"
        >
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
              <div className="flex flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start gap-2 px-3 py-2 h-auto"
                  onClick={() => fileInputImageRef.current?.click()}
                  disabled={uploadingMedia}
                >
                  <ImageIcon className="size-4 text-violet-500" />
                  <span className="text-sm">Foto</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start gap-2 px-3 py-2 h-auto"
                  onClick={() => fileInputDocRef.current?.click()}
                  disabled={uploadingMedia}
                >
                  <FileIcon className="size-4 text-blue-500" />
                  <span className="text-sm">Documento</span>
                </Button>
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

          {/* Textarea */}
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

          {/* Mic (se vazio) ou Send (se tem texto) */}
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

          {/* Inputs file ocultos */}
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
        </form>
      )}
    </div>
  );
}

/**
 * Bolha individual de mensagem — replica visual do tracking-chat:
 * verde-clarinho/escuro pra própria, branco/cinza-petróleo pra recebida.
 * Rabinho triangular CSS, checks ✓/✓✓ azuis pra status SEEN.
 */
function ChatBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const isImage = msg.mimetype?.startsWith("image/");
  const isAudio = msg.mimetype?.startsWith("audio/");
  const isVideo = msg.mimetype?.startsWith("video/");
  const isFile =
    msg.mediaUrl &&
    !isImage &&
    !isAudio &&
    !isVideo;

  const mediaSrc = useConstructUrl(msg.mediaUrl ?? "");
  const isDeleted = msg.status === "DELETED";

  return (
    <div
      className={cn(
        "relative max-w-[85%] text-sm rounded-lg px-2 py-1 shadow-sm",
        isOwn
          ? "bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-50 rounded-tr-none"
          : "bg-white text-zinc-900 dark:bg-[#202c33] dark:text-zinc-50 rounded-tl-none",
      )}
    >
      {/* Rabinho triangular */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 w-0 h-0 pointer-events-none",
          isOwn
            ? "right-[-8px] border-t-[8px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[8px] border-r-transparent"
            : "left-[-8px] border-t-[8px] border-t-white dark:border-t-[#202c33] border-l-[8px] border-l-transparent",
        )}
      />

      {/* Conteúdo */}
      {isDeleted ? (
        <div className="italic text-zinc-500 dark:text-zinc-400 px-1.5 py-1 text-sm">
          🚫 Mensagem apagada
        </div>
      ) : (
        <>
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
          {msg.body && (
            <div className="whitespace-pre-wrap px-1.5 pt-1 pb-0.5">
              {msg.body}
            </div>
          )}
        </>
      )}

      {/* Timestamp + status (dentro da bolha, estilo WA) */}
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
  );
}

/** Barra mostrada durante gravação de áudio. */
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
    <div className="bg-white dark:bg-zinc-800 border-t px-3 py-2 flex items-center gap-2 sticky bottom-0">
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
