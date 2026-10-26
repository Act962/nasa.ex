"use client";

import { useState, type ReactNode } from "react";
import { ClipboardClockIcon, Mail, MapPinIcon, NotebookPenIcon, UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "@/components/whatsapp";
import { FieldEmail } from "@/features/leads/components/lead-info/fields/field-email";
import { FieldPhone } from "@/features/leads/components/lead-info/fields/field-phone";
import { FieldResponsible } from "@/features/leads/components/lead-info/fields/field-responsible";
import { ObservationLead } from "@/features/leads/components/observations";
import { ListHistoric } from "@/features/leads/components/list-historic";
import { LeadAddressFields, type LeadAddress } from "@/features/leads/components/lead-info/lead-address-fields";
import { LeadSidebarDeal } from "./lead-sidebar-deal";

export interface LeadSidebarProfileLead extends LeadAddress {
  id: string;
  email: string | null;
  phone: string | null;
  amount: number;
  description: string | null;
  trackingId: string;
  responsible: { id: string; name: string } | null;
  tracking: { name: string };
  status: { id: string; name: string; color: string | null };
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
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center justify-center rounded-lg border border-line bg-card text-muted-foreground outline-none transition-colors hover:border-input hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isActive && "bg-info/20 text-info ring-1 ring-info/50",
      )}
    >
      {icon}
    </button>
  );
}

export function LeadSidebarProfile({ lead }: { lead: LeadSidebarProfileLead }) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-6 gap-1.5">
          {CONTACT_BUTTONS.map(renderFieldButton)}
          <ProfileIconButton
            icon={<ClipboardClockIcon className="size-5" />}
            title="Histórico"
            onClick={() => setIsHistoryOpen(true)}
          />
          {DETAIL_BUTTONS.map(renderFieldButton)}
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
