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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadJourneyEventKind } from "@/lib/lead-journey/track";

const ICON_MAP: Partial<
  Record<LeadJourneyEventKind, { icon: typeof MessageCircle; color: string; bg: string }>
> = {
  message_in: { icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50" },
  message_out: { icon: MessageCircleReply, color: "text-emerald-600", bg: "bg-emerald-50" },
  first_response: { icon: MessageCircleReply, color: "text-emerald-700", bg: "bg-emerald-100" },
  appointment_created: { icon: CalendarPlus, color: "text-purple-600", bg: "bg-purple-50" },
  appointment_done: { icon: CalendarCheck, color: "text-emerald-700", bg: "bg-emerald-100" },
  appointment_no_show: { icon: CalendarX, color: "text-rose-600", bg: "bg-rose-50" },
  status_changed: { icon: ArrowRightLeft, color: "text-indigo-600", bg: "bg-indigo-50" },
  tag_added: { icon: Tag, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  lead_assigned: { icon: UserPlus, color: "text-amber-700", bg: "bg-amber-50" },
  linnker_scan: { icon: QrCode, color: "text-cyan-700", bg: "bg-cyan-50" },
  ctwa_referral: { icon: Megaphone, color: "text-emerald-700", bg: "bg-emerald-100" },
  utm_landing: { icon: Globe, color: "text-sky-700", bg: "bg-sky-50" },
  form_submit: { icon: ClipboardCheck, color: "text-blue-700", bg: "bg-blue-50" },
  won: { icon: Trophy, color: "text-emerald-700", bg: "bg-emerald-100" },
  lost: { icon: XCircle, color: "text-rose-700", bg: "bg-rose-50" },
};

const FALLBACK = { icon: Activity, color: "text-slate-600", bg: "bg-slate-100" };

const LABELS: Partial<Record<LeadJourneyEventKind, string>> = {
  message_in: "Mensagem recebida",
  message_out: "Mensagem enviada",
  first_response: "Primeira resposta da equipe",
  appointment_created: "Agendamento criado",
  appointment_done: "Agendamento concluído",
  appointment_no_show: "Agendamento — no-show",
  status_changed: "Mudança de etapa",
  tag_added: "Tag aplicada",
  lead_assigned: "Atribuído a um responsável",
  linnker_scan: "Lead capturado via Linnker",
  ctwa_referral: "Veio de anúncio (Click-to-WhatsApp)",
  utm_landing: "Veio de link com UTM",
  form_submit: "Preencheu um formulário",
  won: "Lead ganho",
  lost: "Lead perdido",
};

export function kindLabel(kind: LeadJourneyEventKind | string) {
  return LABELS[kind as LeadJourneyEventKind] ?? kind.replaceAll("_", " ");
}

export function JourneyEventIcon({
  kind,
  className,
}: {
  kind: LeadJourneyEventKind | string;
  className?: string;
}) {
  const { icon: Icon, color, bg } = ICON_MAP[kind as LeadJourneyEventKind] ?? FALLBACK;
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
