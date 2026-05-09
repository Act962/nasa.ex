"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeSlaState,
  formatRemaining,
  slaBadgeColor,
} from "@/features/leads/lib/sla";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileIcon,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Image as ImageLucide,
  Inbox,
  MapPin,
  MessageSquare,
  Paperclip,
  Tag as TagIcon,
  Timer,
  Trophy,
  UserCog,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { pusherClient } from "@/lib/pusher";
import { Badge } from "@/components/ui/badge";

type TimelineEntry = {
  id: string;
  at: string;
  source: "history" | "journey";
  kind: string;
  actor?: { name?: string | null; image?: string | null } | null;
  title: string;
  details?: string | null;
  fromColor?: string | null;
  toColor?: string | null;
  rawMetadata?: Record<string, unknown>;
};

type AttachmentItem = {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  createdAt: string;
  folder: "Arquivos" | "Chat" | "Formulários";
  subFolder?: string | null;
  source: "manual" | "chat" | "form";
  context?: {
    formId?: string;
    formName?: string;
    formResponseId?: string;
    blockType?: string;
    blockLabel?: string;
    fromMe?: boolean;
    senderName?: string | null;
  };
};

type LeadPublicData = {
  id: string;
  name: string;
  createdAt: Date | string;
  slaDeadline: Date | string | null;
  statusEnteredAt: Date | string | null;
  status: { id: string; name: string; color: string | null };
  tracking: { id: string; name: string };
  responsible: { name: string; image: string | null } | null;
  timeline: TimelineEntry[];
};

export default function PublicLeadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const queryClient = useQueryClient();

  const queryOpts = orpc.leads.getByPublicToken.queryOptions({
    input: { token },
  });
  const { data, isLoading, isError } = useQuery(queryOpts);

  // Anexos do lead organizados em pastas (Arquivos, Chat, Formulários).
  const attachQueryOpts = orpc.leads.listAttachmentsByToken.queryOptions({
    input: { token },
  });
  const { data: attachData } = useQuery({ ...attachQueryOpts, retry: false });

  useEffect(() => {
    if (!token) return;
    const channel = pusherClient.subscribe(`lead-public-${token}`);
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: queryOpts.queryKey });
      queryClient.invalidateQueries({ queryKey: attachQueryOpts.queryKey });
    };
    channel.bind("update", handler);
    return () => {
      channel.unbind("update", handler);
      pusherClient.unsubscribe(`lead-public-${token}`);
    };
  }, [token, queryClient, queryOpts.queryKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (isError || !data?.lead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Verifique com o estabelecimento se o link está correto.
        </p>
      </div>
    );
  }

  const lead = data.lead as unknown as LeadPublicData;
  const sla = computeSlaState(lead.statusEnteredAt, lead.slaDeadline);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="text-center space-y-2 py-4">
          <h1 className="text-2xl font-semibold">Olá, {lead.name}</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em tempo real o status do seu atendimento.
          </p>
          {/* Tracking atual em destaque — o setor onde o lead está hoje
              é a info mais útil pro cliente entender o estágio. */}
          <div className="flex justify-center pt-1">
            <div
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold shadow-sm"
              style={{
                borderColor: lead.status.color ?? "#1447e6",
                color: lead.status.color ?? "#1447e6",
                background: `${lead.status.color ?? "#1447e6"}10`,
              }}
              title="Setor atual do atendimento"
            >
              <GitBranch className="w-4 h-4" />
              <span>{lead.tracking.name}</span>
            </div>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Etapa atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: lead.status.color ?? "#1447e6" }}
              />
              <div>
                <p className="font-medium">{lead.status.name}</p>
                <p className="text-xs text-muted-foreground">
                  Setor: <strong>{lead.tracking.name}</strong>
                </p>
              </div>
            </div>

            {lead.slaDeadline && (
              <div
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 ${slaBadgeColor(
                  sla.consumedPct,
                  sla.isBreached,
                )}`}
              >
                <Timer className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {sla.isBreached ? "Tempo excedido" : "Tempo restante"}: {formatRemaining(sla.remainingMs)}
                </span>
              </div>
            )}

            {lead.responsible && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Avatar className="h-7 w-7">
                  {lead.responsible.image && (
                    <AvatarImage src={lead.responsible.image} />
                  )}
                  <AvatarFallback className="text-[11px]">
                    {lead.responsible.name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="text-sm font-medium">{lead.responsible.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Linha do tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative ml-2 border-l border-foreground/10 pl-5 space-y-4">
              {(lead.timeline ?? [])
                .slice()
                .reverse()
                .map((evt) => (
                  <TimelineItem key={evt.id} entry={evt} token={token} />
                ))}
              {(!lead.timeline || lead.timeline.length === 0) && (
                <li className="text-sm text-muted-foreground">
                  Sem eventos ainda.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>

        {/* ── Arquivos do atendimento ──────────────────────────────── */}
        <AttachmentsCard
          items={(attachData?.items ?? []) as AttachmentItem[]}
          token={token}
        />

        <footer className="text-center text-xs text-muted-foreground py-4">
          <Badge variant="outline" className="gap-1">
            <MapPin className="w-3 h-3" />
            Atualização automática
          </Badge>
        </footer>
      </div>
    </main>
  );
}

/**
 * Render de um item da timeline pública. Cada `kind` recebe ícone, cor e
 * template próprios para que o cliente entenda imediatamente o que mudou.
 */
function TimelineItem({
  entry,
  token,
}: {
  entry: TimelineEntry;
  token: string;
}) {
  const { Icon, color } = iconForKind(entry.kind);
  const dt = new Date(entry.at);
  // Pra `form_submitted`, monta link pro form-view do cliente (read-only +
  // assinatura) usando o `formResponseId` do metadata.
  const formResponseId =
    entry.kind === "form_submitted"
      ? (entry.rawMetadata?.formResponseId as string | undefined)
      : undefined;
  const formLink = formResponseId
    ? `/lead/${token}/formulario/${formResponseId}`
    : null;

  return (
    <li className="relative">
      <span
        className="absolute -left-[27px] top-1 size-3 rounded-full"
        style={{ background: color }}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-sm font-medium">{entry.title}</span>
          <span
            className="text-[11px] text-muted-foreground"
            title={format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          >
            • {format(dt, "dd/MM HH:mm", { locale: ptBR })}
            <span className="ml-1">
              ({formatDistanceToNowStrict(dt, { addSuffix: true, locale: ptBR })})
            </span>
          </span>
        </div>

        {/* Detalhes específicos por tipo */}
        {entry.kind === "status_change" && entry.details && (
          <StatusChangeBadge entry={entry} />
        )}
        {entry.kind !== "status_change" && entry.details && (
          <p className="text-xs text-muted-foreground break-words">
            {entry.details}
          </p>
        )}

        {entry.kind === "tag_added" && entry.toColor && (
          <span
            className="inline-flex w-fit items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
            style={{
              borderColor: entry.toColor,
              color: entry.toColor,
              background: `${entry.toColor}15`,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: entry.toColor }}
            />
            {entry.details}
          </span>
        )}

        {/* Link pra ver o formulário (read-only + assinatura) — só aparece
            em eventos de form recebido/atualizado que tenham formResponseId. */}
        {formLink && (
          <Link
            href={formLink}
            className="inline-flex w-fit items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline mt-0.5"
          >
            <ExternalLink className="size-3" />
            Ver formulário
          </Link>
        )}

        {/* Quem fez a ação */}
        {entry.actor?.name && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            por <strong className="font-medium">{entry.actor.name}</strong>
          </span>
        )}
      </div>
    </li>
  );
}

function StatusChangeBadge({ entry }: { entry: TimelineEntry }) {
  // entry.details pode vir como "X → Y" — quebramos pra renderizar com cores.
  const parts = entry.details?.split(" → ") ?? [];
  if (parts.length !== 2) {
    return (
      <p className="text-xs text-muted-foreground break-words">
        {entry.details}
      </p>
    );
  }
  const [fromName, toName] = parts;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
        style={{
          borderColor: entry.fromColor || undefined,
          color: entry.fromColor || undefined,
          background: entry.fromColor ? `${entry.fromColor}15` : undefined,
        }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: entry.fromColor || "#888" }}
        />
        {fromName}
      </span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
        style={{
          borderColor: entry.toColor || undefined,
          color: entry.toColor || undefined,
          background: entry.toColor ? `${entry.toColor}15` : undefined,
        }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: entry.toColor || "#888" }}
        />
        {toName}
      </span>
    </div>
  );
}

function iconForKind(kind: string): {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
} {
  switch (kind) {
    case "status_change":
      return { Icon: GitBranch, color: "#3b82f6" };
    case "tracking_change":
      return { Icon: GitBranch, color: "#8b5cf6" };
    case "responsible_change":
      return { Icon: UserCog, color: "#0ea5e9" };
    case "form_submitted":
      return { Icon: FileText, color: "#10b981" };
    case "file_uploaded":
      return { Icon: Inbox, color: "#0ea5e9" };
    case "tag_added":
      return { Icon: TagIcon, color: "#f59e0b" };
    case "tag_removed":
      return { Icon: TagIcon, color: "#94a3b8" };
    case "note":
      return { Icon: MessageSquare, color: "#64748b" };
    case "sla_breached":
      return { Icon: Timer, color: "#ef4444" };
    case "public_link_viewed":
      return { Icon: CheckCircle2, color: "#10b981" };
    case "won":
      return { Icon: Trophy, color: "#10b981" };
    case "lost":
      return { Icon: XCircle, color: "#ef4444" };
    case "deleted":
      return { Icon: XCircle, color: "#94a3b8" };
    case "active":
      return { Icon: CheckCircle2, color: "#10b981" };
    case "appointment":
      return { Icon: Clock, color: "#8b5cf6" };
    case "message":
      return { Icon: MessageSquare, color: "#0ea5e9" };
    default:
      return { Icon: CheckCircle2, color: "#10b981" };
  }
}

// ─── Anexos ──────────────────────────────────────────────────────────
function isImageItem(item: AttachmentItem): boolean {
  const ext = (item.name || item.url)
    .split(".")
    .pop()
    ?.toLowerCase()
    ?.split("?")[0];
  return !!ext && ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "avif"].includes(ext);
}

function AttachmentsCard({
  items,
  token,
}: {
  items: AttachmentItem[];
  token: string;
}) {
  // Estado de pastas abertas/fechadas — Arquivos abre por padrão.
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    Arquivos: true,
    Chat: false,
    Formulários: true,
  });
  const [openSubFolders, setOpenSubFolders] = useState<Record<string, boolean>>(
    {},
  );

  // Agrupa por pasta e sub-pasta.
  const grouped: Record<
    string,
    { items: AttachmentItem[]; subFolders: Record<string, AttachmentItem[]> }
  > = {
    Arquivos: { items: [], subFolders: {} },
    Chat: { items: [], subFolders: {} },
    Formulários: { items: [], subFolders: {} },
  };
  for (const it of items) {
    const f = grouped[it.folder];
    if (!f) continue;
    if (it.subFolder) {
      if (!f.subFolders[it.subFolder]) f.subFolders[it.subFolder] = [];
      f.subFolders[it.subFolder].push(it);
    } else {
      f.items.push(it);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          Arquivos do atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["Arquivos", "Chat", "Formulários"] as const).map((folder) => {
          const data = grouped[folder];
          const folderTotal =
            data.items.length +
            Object.values(data.subFolders).reduce((a, l) => a + l.length, 0);
          if (folderTotal === 0) return null;
          const open = openFolders[folder];
          return (
            <div
              key={folder}
              className="border border-foreground/10 rounded-md bg-foreground/[0.02]"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenFolders((p) => ({ ...p, [folder]: !p[folder] }))
                }
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-foreground/5"
              >
                <div className="flex items-center gap-2">
                  {folder === "Chat" ? (
                    <MessageSquare className="size-4 text-blue-600" />
                  ) : folder === "Formulários" ? (
                    <FileText className="size-4 text-emerald-600" />
                  ) : open ? (
                    <FolderOpen className="size-4 text-amber-600" />
                  ) : (
                    <Folder className="size-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium">{folder}</span>
                  <span className="text-[11px] text-muted-foreground">
                    ({folderTotal})
                  </span>
                </div>
                <span
                  className={`size-4 transition-transform inline-block ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>
              {open && (
                <div className="p-3 space-y-3">
                  {data.items.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {data.items.map((it) => (
                        <PublicAttachmentTile
                          key={it.id}
                          item={it}
                          token={token}
                        />
                      ))}
                    </div>
                  )}
                  {Object.entries(data.subFolders).map(
                    ([subName, subList]) => {
                      const subKey = `${folder}:${subName}`;
                      const subOpen = openSubFolders[subKey] ?? true;
                      return (
                        <div key={subKey}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubFolders((p) => ({
                                ...p,
                                [subKey]: !subOpen,
                              }))
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground py-1"
                          >
                            {subOpen ? (
                              <FolderOpen className="size-3.5 text-emerald-600" />
                            ) : (
                              <Folder className="size-3.5 text-emerald-600" />
                            )}
                            <span>{subName}</span>
                            <span className="text-foreground/50 text-[10px]">
                              ({subList.length})
                            </span>
                          </button>
                          {subOpen && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                              {subList.map((it) => (
                                <PublicAttachmentTile
                                  key={it.id}
                                  item={it}
                                  token={token}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PublicAttachmentTile({
  item,
  token,
}: {
  item: AttachmentItem;
  token: string;
}) {
  const isImage = isImageItem(item);
  // Link pro form-view do cliente quando o arquivo veio de um formulário.
  const formLink =
    item.source === "form" && item.context?.formResponseId
      ? `/lead/${token}/formulario/${item.context.formResponseId}`
      : null;
  const ts = format(new Date(item.createdAt), "dd/MM HH:mm", {
    locale: ptBR,
  });
  return (
    <div className="relative group rounded-md border bg-background overflow-hidden aspect-video">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <FileIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 md:bg-black/60 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
        <span className="text-white text-xs truncate drop-shadow-md font-medium">
          {item.name}
        </span>
        <div className="flex items-center gap-1.5 mt-auto">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-6 rounded bg-white/90 text-foreground hover:bg-white"
            title="Abrir"
          >
            {isImage ? (
              <ImageLucide className="size-3" />
            ) : (
              <ExternalLink className="size-3" />
            )}
          </a>
          <a
            href={item.url}
            download={item.name}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center size-6 rounded bg-white/90 text-foreground hover:bg-white"
            title="Baixar"
          >
            <Download className="size-3" />
          </a>
          {formLink && (
            <Link
              href={formLink}
              className="inline-flex items-center gap-1 ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white hover:bg-emerald-600"
              title={`Ver formulário: ${item.context?.formName ?? ""}`}
            >
              Ver form
            </Link>
          )}
        </div>
        <span className="text-white/70 text-[9px] absolute right-2 top-2 drop-shadow">
          {ts}
        </span>
      </div>
    </div>
  );
}
