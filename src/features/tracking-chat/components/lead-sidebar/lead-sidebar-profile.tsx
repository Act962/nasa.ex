"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Circle, ClipboardClockIcon, Mail, MapPinIcon, NotebookPenIcon, UserRoundIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "@/components/whatsapp";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { FieldEmail } from "@/features/leads/components/lead-info/fields/field-email";
import { FieldPhone } from "@/features/leads/components/lead-info/fields/field-phone";
import { FieldResponsible } from "@/features/leads/components/lead-info/fields/field-responsible";
import { ObservationLead } from "@/features/leads/components/observations";
import { ListHistoric } from "@/features/leads/components/list-historic";
import { LeadAddressFields, type LeadAddress } from "@/features/leads/components/lead-info/lead-address-fields";
import { HeatRing } from "@/features/leads/components/lead-audit/heat-ring";
import { computeLeadHeat } from "@/features/leads/components/lead-audit/lead-heat";
import type { LeadMetricsView } from "@/features/leads/components/lead-audit/metric-format";
import { LeadSidebarDeal } from "./lead-sidebar-deal";

export interface LeadSidebarProfileLead extends LeadAddress {
  id: string;
  name: string;
  nickname: string | null;
  profile: string | null;
  email: string | null;
  phone: string | null;
  amount: number;
  description: string | null;
  trackingId: string;
  updatedAt: Date | string;
  createdAt: Date | string;
  responsible: { id: string; name: string } | null;
  tracking: { name: string };
  status: { id: string; name: string; color: string | null };
  statusFlow: string;
  lastInboundAt: Date | string | null;
  lastOutboundAt: Date | string | null;
  metrics: LeadMetricsView | null;
}

type LeadInfoField = "phone" | "email" | "responsible" | "notes" | "address";

const CONTACT_BUTTONS: { field: LeadInfoField; title: string; icon: ReactNode }[] = [
  { field: "phone", title: "Telefone", icon: <WhatsappIcon className="size-5" /> },
  { field: "email", title: "E-mail", icon: <Mail className="size-5" /> },
];

const DETAIL_BUTTONS: { field: LeadInfoField; title: string; icon: ReactNode }[] = [
  { field: "responsible", title: "Responsável", icon: <UserRoundIcon className="size-5" /> },
  { field: "notes", title: "Observações", icon: <NotebookPenIcon className="size-5" /> },
  { field: "address", title: "Endereço", icon: <MapPinIcon className="size-5" /> },
];

const STATUS_FLOW_COLORS: Record<string, string> = {
  NEW: "text-info",
  ACTIVE: "text-success",
  WAITING: "text-warning",
  FINISHED: "text-muted-foreground",
};

const STATUS_FLOW_LABELS: Record<string, string> = {
  NEW: "Novo",
  ACTIVE: "Ativo",
  WAITING: "Aguardando",
  FINISHED: "Finalizado",
};

function ProfileIconButton({
  icon,
  title,
  isActive,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-1 justify-center">
      {/* Leiaute v2 (2026-09-29): botões em #19191A, como os cards de Módulos do Lead. */}
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={onClick}
        className={cn(
          "flex h-10 w-full items-center justify-center rounded-xl border border-line bg-card text-muted-foreground outline-none transition-colors hover:border-input hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isActive && "bg-info/20 text-info ring-1 ring-info/50",
        )}
      >
        {icon}
      </button>
    </div>
  );
}

function lastInteractionOf(lead: LeadSidebarProfileLead): Date {
  const candidates = [lead.lastInboundAt, lead.lastOutboundAt, lead.updatedAt]
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value).getTime());
  return new Date(Math.max(...candidates));
}

export function LeadSidebarProfile({ lead }: { lead: LeadSidebarProfileLead }) {
  const avatarUrl = useConstructUrl(lead.profile ?? "");
  const mutation = useMutationLeadUpdate(lead.id, lead.trackingId);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(lead.nickname ?? "");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const heat = lead.metrics
    ? computeLeadHeat({ metrics: lead.metrics, createdAt: lead.createdAt, lastInboundAt: lead.lastInboundAt })
    : null;
  // Campos fechados por padrão: o comportamento e a qualidade sobem na tela.
  const [openField, setOpenField] = useState<LeadInfoField | null>(null);
  const toggleField = (field: LeadInfoField) =>
    setOpenField((current) => (current === field ? null : field));
  const renderFieldButton = (button: { field: LeadInfoField; title: string; icon: ReactNode }) => (
    <ProfileIconButton
      key={button.field}
      icon={button.icon}
      title={button.title}
      isActive={openField === button.field}
      onClick={() => toggleField(button.field)}
    />
  );

  useEffect(() => setNickname(lead.nickname ?? ""), [lead.nickname]);

  const saveNickname = () => {
    const trimmed = nickname.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    if (next === (lead.nickname ?? null)) {
      setIsEditingNickname(false);
      return;
    }
    mutation.mutate(
      { id: lead.id, nickname: next },
      {
        onSuccess: () => setIsEditingNickname(false),
        onError: () => setNickname(lead.nickname ?? ""),
      },
    );
  };



  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-4">
          <HeatRing heat={heat} size={72}>
            <Avatar className="size-full border border-muted">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary/5 text-xl font-bold">
                {lead.name.trim().slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </HeatRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-start gap-1">
              <h2 className="line-clamp-2 min-w-0 flex-1 text-[17px] leading-tight font-bold break-words" title={lead.name}>
                {lead.name || "Sem nome"}
              </h2>
              <button
                type="button"
                title={lead.nickname ? `Apelido: ${lead.nickname}` : "Adicionar apelido"}
                onClick={() => setIsEditingNickname(true)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <UserRoundIcon className="size-4" />
              </button>
            </div>
            {isEditingNickname && (
              <Input
                autoFocus
                disabled={mutation.isPending}
                placeholder="Apelido"
                className="h-7 text-xs"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onBlur={saveNickname}
                onKeyDown={(event) => event.key === "Enter" && saveNickname()}
              />
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full bg-current/10 px-2 py-0.5 text-xs font-medium",
                  STATUS_FLOW_COLORS[lead.statusFlow],
                )}
              >
                <Circle className="size-2 fill-current" />
                {STATUS_FLOW_LABELS[lead.statusFlow] ?? lead.statusFlow}
              </span>
              <span className="text-xs text-muted-foreground">
                Última interação: {lastInteractionOf(lead).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>
        <LeadSidebarDeal
          key={`${lead.id}:${lead.trackingId}:${lead.status.id}`}
          leadId={lead.id}
          trackingId={lead.trackingId}
          trackingName={lead.tracking.name}
          statusId={lead.status.id}
          statusName={lead.status.name}
          statusColor={lead.status.color}
          amount={lead.amount}
        />
        <div className="grid grid-cols-6 gap-1.5">
          {CONTACT_BUTTONS.map(renderFieldButton)}
          <ProfileIconButton
            icon={<ClipboardClockIcon className="size-5" />}
            title="Histórico"
            onClick={() => setIsHistoryOpen(true)}
          />
          {DETAIL_BUTTONS.map(renderFieldButton)}
        </div>
        {openField && (
          <div className="rounded-xl border bg-muted/20 px-3 py-2">
            {openField === "phone" && (
              <FieldPhone leadId={lead.id} label="Telefone" value={lead.phone ?? ""} trackingId={lead.trackingId} />
            )}
            {openField === "email" && (
              <FieldEmail leadId={lead.id} label="E-mail" value={lead.email ?? ""} trackingId={lead.trackingId} />
            )}
            {openField === "responsible" && (
              <FieldResponsible
                leadId={lead.id}
                label="Responsável"
                value={lead.responsible?.id ?? ""}
                displayName={lead.responsible?.name ?? ""}
                trackingId={lead.trackingId}
              />
            )}
            {openField === "notes" && (
              <ObservationLead compact leadId={lead.id} trackingId={lead.trackingId} description={lead.description} />
            )}
            {openField === "address" && (
              <div className="flex flex-col gap-1">
                <LeadAddressFields address={lead} trackingId={lead.trackingId} leadId={lead.id} />
              </div>
            )}
          </div>
        )}
      </div>


      <ListHistoric leadId={lead.id} open={isHistoryOpen} onOpenChange={setIsHistoryOpen} />
    </div>
  );
}
