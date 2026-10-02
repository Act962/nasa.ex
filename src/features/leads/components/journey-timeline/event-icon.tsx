import {
  MessageCircle,
  MessageCircleReply,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  ArrowRightLeft,
  Tag,
  UserPlus,
  QrCode,
  Megaphone,
  Globe,
  Trophy,
  XCircle,
  ClipboardCheck,
  Activity,
  Inbox,
  StickyNote,
  Timer,
  Eye,
  Trash2,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadJourneyEventKind } from "@/lib/lead-journey/track";

// Mapa de ícones aceita LeadJourneyEventKind + kinds extras vindos do
// LeadHistory (tracking_changed, tag_removed, file_uploaded, note,
// sla_breached, public_link_viewed, deleted) — type-cast como string pra
// não exigir mudança no enum compartilhado.
const ICON_MAP: Record<string, { icon: typeof MessageCircle; color: string; bg: string }> = {
  message_in: { icon: MessageCircle, color: "text-info", bg: "bg-info/10" },
  message_out: { icon: MessageCircleReply, color: "text-success", bg: "bg-success/10" },
  first_response: { icon: MessageCircleReply, color: "text-success", bg: "bg-success/15" },
  appointment_created: { icon: CalendarPlus, color: "text-info", bg: "bg-info/10" },
  appointment_done: { icon: CalendarCheck, color: "text-success", bg: "bg-success/15" },
  appointment_no_show: { icon: CalendarX, color: "text-destructive", bg: "bg-destructive/10" },
  status_changed: { icon: ArrowRightLeft, color: "text-info", bg: "bg-info/10" },
  tracking_changed: { icon: GitBranch, color: "text-info", bg: "bg-info/10" },
  tag_added: { icon: Tag, color: "text-info", bg: "bg-info/10" },
  tag_removed: { icon: Tag, color: "text-muted-foreground", bg: "bg-muted" },
  lead_assigned: { icon: UserPlus, color: "text-warning", bg: "bg-warning/10" },
  linnker_scan: { icon: QrCode, color: "text-info", bg: "bg-info/10" },
  ctwa_referral: { icon: Megaphone, color: "text-success", bg: "bg-success/15" },
  utm_landing: { icon: Globe, color: "text-info", bg: "bg-info/10" },
  form_submit: { icon: ClipboardCheck, color: "text-info", bg: "bg-info/10" },
  file_uploaded: { icon: Inbox, color: "text-info", bg: "bg-info/10" },
  note: { icon: StickyNote, color: "text-muted-foreground", bg: "bg-muted" },
  sla_breached: { icon: Timer, color: "text-destructive", bg: "bg-destructive/10" },
  public_link_viewed: { icon: Eye, color: "text-success", bg: "bg-success/10" },
  won: { icon: Trophy, color: "text-success", bg: "bg-success/15" },
  lost: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  deleted: { icon: Trash2, color: "text-muted-foreground", bg: "bg-muted" },
};

const FALLBACK = { icon: Activity, color: "text-muted-foreground", bg: "bg-muted" };

const LABELS: Record<string, string> = {
  message_in: "Mensagem recebida",
  message_out: "Mensagem enviada",
  first_response: "Primeira resposta da equipe",
  appointment_created: "Agendamento criado",
  appointment_done: "Agendamento concluído",
  appointment_no_show: "Agendamento — no-show",
  status_changed: "Mudança de etapa",
  tracking_changed: "Mudança de setor",
  tag_added: "Tag aplicada",
  tag_removed: "Tag removida",
  lead_assigned: "Atribuído a um responsável",
  linnker_scan: "Lead capturado via Linnker",
  ctwa_referral: "Veio de anúncio (Click-to-WhatsApp)",
  utm_landing: "Veio de link com UTM",
  form_submit: "Preencheu um formulário",
  file_uploaded: "Arquivo enviado",
  note: "Nota adicionada",
  sla_breached: "Prazo (SLA) excedido",
  public_link_viewed: "Cliente abriu o acompanhamento",
  won: "Lead ganho",
  lost: "Lead perdido",
  deleted: "Lead arquivado",
};

export function kindLabel(kind: LeadJourneyEventKind | string) {
  return LABELS[kind] ?? kind.replaceAll("_", " ");
}

export function JourneyEventIcon({
  kind,
  className,
}: {
  kind: LeadJourneyEventKind | string;
  className?: string;
}) {
  const { icon: Icon, color, bg } = ICON_MAP[kind] ?? FALLBACK;
  return (
    <div
      className={cn(
        "size-6 rounded-full flex items-center justify-center ring-2 ring-background",
        bg,
        className,
      )}
    >
      <Icon className={cn("size-3.5", color)} />
    </div>
  );
}
