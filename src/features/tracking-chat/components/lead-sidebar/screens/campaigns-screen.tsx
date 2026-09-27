"use client";

import { Badge } from "@/components/ui/badge";
import { useLeadCampaigns } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { ScreenList, ScreenRow, formatDateTime } from "./screen-list";

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  QUEUED: "Na fila",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
  SKIPPED: "Ignorada",
};

export function CampaignsScreen({ leadId }: { leadId: string }) {
  const { data, isLoading } = useLeadCampaigns(leadId);
  const recipients = data?.recipients ?? [];

  return (
    <ScreenList isLoading={isLoading} isEmpty={recipients.length === 0} emptyText="Este lead ainda não recebeu campanhas.">
      {recipients.map((recipient) => (
        <ScreenRow
          key={recipient.id}
          title={recipient.broadcast.name}
          subtitle={
            recipient.status === "FAILED" && recipient.errorMessage
              ? recipient.errorMessage
              : `Enviada em ${formatDateTime(recipient.sentAt ?? recipient.createdAt)}`
          }
          badge={
            <Badge variant={recipient.status === "FAILED" ? "destructive" : "secondary"}>
              {RECIPIENT_STATUS_LABELS[recipient.status] ?? recipient.status}
            </Badge>
          }
        />
      ))}
    </ScreenList>
  );
}
