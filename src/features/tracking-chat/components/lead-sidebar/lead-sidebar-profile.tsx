"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Circle, ClipboardClockIcon, Mail, MapPinIcon, NotebookPenIcon, UserRoundIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "@/components/whatsapp";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { ActionButton } from "@/features/leads/components/lead-info/action-button";
import { FieldEmail } from "@/features/leads/components/lead-info/fields/field-email";
import { FieldPhone } from "@/features/leads/components/lead-info/fields/field-phone";
import { FieldResponsible } from "@/features/leads/components/lead-info/fields/field-responsible";
import { ObservationLead } from "@/features/leads/components/observations";
import { ListHistoric } from "@/features/leads/components/list-historic";
import { LeadAddressFields, type LeadAddress } from "@/features/leads/components/lead-info/lead-address-fields";
import { HeatRing } from "@/features/leads/components/lead-audit/heat-ring";
import { HEAT_LEVELS, computeLeadHeat } from "@/features/leads/components/lead-audit/lead-heat";
import type { LeadMetricsView } from "@/features/leads/components/lead-audit/metric-format";

export interface LeadSidebarProfileLead extends LeadAddress {
  id: string;
  name: string;
  nickname: string | null;
  profile: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  trackingId: string;
  updatedAt: Date | string;
  createdAt: Date | string;
  responsible: { id: string; name: string } | null;
  tracking: { name: string };
  status: { name: string };
  statusFlow: string;
  lastInboundAt: Date | string | null;
  lastOutboundAt: Date | string | null;
  metrics: LeadMetricsView | null;
}

type LeadInfoField = "phone" | "email" | "responsible" | "notes" | "address";

const CONTACT_BUTTONS: { field: LeadInfoField; title: string; icon: ReactNode }[] = [
  { field: "phone", title: "Telefone", icon: <WhatsappIcon className="size-4" /> },
  { field: "email", title: "E-mail", icon: <Mail className="size-4" /> },
];

const DETAIL_BUTTONS: { field: LeadInfoField; title: string; icon: ReactNode }[] = [
  { field: "responsible", title: "Responsável", icon: <UserRoundIcon className="size-4" /> },
  { field: "notes", title: "Observações", icon: <NotebookPenIcon className="size-4" /> },
  { field: "address", title: "Endereço", icon: <MapPinIcon className="size-4" /> },
];

const STATUS_FLOW_LABELS: Record<string, string> = {
  NEW: "Novo",
  ACTIVE: "Ativo",
  WAITING: "Aguardando",
  FINISHED: "Finalizado",
};

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
    <ActionButton
      key={button.field}
      icon={button.icon}
      title={button.title}
      onClick={() => toggleField(button.field)}
      className={cn(openField === button.field && "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50")}
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
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center gap-3">
          <HeatRing heat={heat}>
            <Avatar className="size-full border border-muted">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary/5 text-xl font-bold">
                {lead.name.trim().slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </HeatRing>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="line-clamp-2 text-base font-bold leading-tight">{lead.name || "Sem nome"}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {lead.tracking.name} <span className="px-1 opacity-50">|</span> {lead.status.name}
            </p>
            {heat && (
              <span className="text-xs font-semibold" style={{ color: HEAT_LEVELS[heat.level].color }}>
                {HEAT_LEVELS[heat.level].label}
              </span>
            )}
            {isEditingNickname ? (
              <Input
                autoFocus
                disabled={mutation.isPending}
                placeholder="Apelido"
                className="h-6 text-xs"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onBlur={saveNickname}
                onKeyDown={(event) => event.key === "Enter" && saveNickname()}
              />
            ) : (
              <button
                type="button"
                className="w-fit text-left text-[11px] text-muted-foreground"
                onClick={() => setIsEditingNickname(true)}
              >
                {lead.nickname || <span className="italic opacity-60">+ adicionar apelido</span>}
              </button>
            )}
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Circle className="size-2 fill-emerald-500 text-emerald-500" />
              <span className="uppercase">{STATUS_FLOW_LABELS[lead.statusFlow] ?? lead.statusFlow}</span>
              <span>· Última interação: {lastInteractionOf(lead).toLocaleDateString("pt-BR")}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {CONTACT_BUTTONS.map(renderFieldButton)}
          <ActionButton icon={<ClipboardClockIcon className="size-4" />} title="Histórico" onClick={() => setIsHistoryOpen(true)} />
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
