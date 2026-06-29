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
  message_in: { icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50" },
  message_out: { icon: MessageCircleReply, color: "text-emerald-600", bg: "bg-emerald-50" },
  first_response: { icon: MessageCircleReply, color: "text-emerald-700", bg: "bg-emerald-100" },
  appointment_created: { icon: CalendarPlus, color: "text-purple-600", bg: "bg-purple-50" },
  appointment_done: { icon: CalendarCheck, color: "text-emerald-700", bg: "bg-emerald-100" },
  appointment_no_show: { icon: CalendarX, color: "text-rose-600", bg: "bg-rose-50" },
  status_changed: { icon: ArrowRightLeft, color: "text-indigo-600", bg: "bg-indigo-50" },
  tracking_changed: { icon: GitBranch, color: "text-violet-600", bg: "bg-violet-50" },
  tag_added: { icon: Tag, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  tag_removed: { icon: Tag, color: "text-slate-500", bg: "bg-slate-100" },
  lead_assigned: { icon: UserPlus, color: "text-amber-700", bg: "bg-amber-50" },
  linnker_scan: { icon: QrCode, color: "text-cyan-700", bg: "bg-cyan-50" },
  ctwa_referral: { icon: Megaphone, color: "text-emerald-700", bg: "bg-emerald-100" },
  utm_landing: { icon: Globe, color: "text-sky-700", bg: "bg-sky-50" },
  form_submit: { icon: ClipboardCheck, color: "text-blue-700", bg: "bg-blue-50" },
  file_uploaded: { icon: Inbox, color: "text-cyan-600", bg: "bg-cyan-50" },
  note: { icon: StickyNote, color: "text-slate-600", bg: "bg-slate-100" },
  sla_breached: { icon: Timer, color: "text-rose-700", bg: "bg-rose-50" },
  public_link_viewed: { icon: Eye, color: "text-emerald-600", bg: "bg-emerald-50" },
  won: { icon: Trophy, color: "text-emerald-700", bg: "bg-emerald-100" },
  lost: { icon: XCircle, color: "text-rose-700", bg: "bg-rose-50" },
  deleted: { icon: Trash2, color: "text-slate-500", bg: "bg-slate-100" },
};

const FALLBACK = { icon: Activity, color: "text-slate-600", bg: "bg-slate-100" };

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
