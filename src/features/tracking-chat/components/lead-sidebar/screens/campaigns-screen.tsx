"use client";

import Link from "next/link";
import { MegaphoneIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeadCampaigns } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { ScreenList, ScreenRow, formatDateTime } from "./screen-list";

// "Disparo em Massa" do lead: o que ele já recebeu e, sem número da API
// Oficial no tracking, como ativar — é por esse número que o disparo sai.

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  QUEUED: "Na fila",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
  SKIPPED: "Ignorada",
};

function ActivateOfficialNumber({ trackingId, hasAnyInstance }: { trackingId: string; hasAnyInstance: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-5 text-amber-500" />
        <p className="text-sm font-semibold">Ative um número da API Oficial do WhatsApp</p>
      </div>
      <p className="text-xs text-muted-foreground">
        O Disparo em Massa só sai por um número conectado pela API Oficial da Meta (Meta Cloud). Este tracking
        {hasAnyInstance ? " usa um número que não é da API Oficial." : " ainda não tem número conectado."}
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-xs">
        <li>Abra as configurações do tracking, na aba <strong>Integrações</strong>.</li>
        <li>
          Clique em <strong>Nova Instância</strong> e escolha <strong>API Oficial</strong>.
        </li>
        <li>
          No card <strong>Provider WhatsApp</strong>, conecte pela Meta (login do Facebook) — a conta WhatsApp Business é
          vinculada ali.
        </li>
        <li>Volte aqui: o botão de disparo em massa fica liberado.</li>
      </ol>
      <Button asChild size="sm" className="w-fit">
        <Link href={`/tracking/${trackingId}/settings?tab=instance`}>Ativar número</Link>
      </Button>
    </div>
  );
}

export function CampaignsScreen({ leadId }: { leadId: string }) {
  const { data, isLoading } = useLeadCampaigns(leadId);
  const recipients = data?.recipients ?? [];
  const massSend = data?.massSend;

  return (
    <div className="flex flex-col gap-4">
      {massSend && !massSend.hasOfficialNumber && (
        <ActivateOfficialNumber trackingId={massSend.trackingId} hasAnyInstance={massSend.hasAnyInstance} />
      )}
      {massSend?.hasOfficialNumber && (
        <Button asChild variant="outline" size="sm" className="w-fit gap-2">
          <Link href="/campanhas">
            <MegaphoneIcon className="size-4" />
            Novo disparo em massa
          </Link>
        </Button>
      )}
      <ScreenList isLoading={isLoading} isEmpty={recipients.length === 0} emptyText="Este lead ainda não recebeu disparos em massa.">
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
    </div>
  );
}
