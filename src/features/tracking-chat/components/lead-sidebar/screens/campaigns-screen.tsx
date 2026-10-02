"use client";

import { useState } from "react";
import Link from "next/link";
import { MegaphoneIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeadCampaigns } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConnectNumberWizard } from "@/features/campanhas/components/self-service/connect-number-wizard";
import { BeforeYouStart } from "@/features/campanhas/components/self-service/before-you-start";
import { MetaNumberPanel } from "@/features/campanhas/components/self-service/meta-number-panel";
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
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="size-5 text-warning" />
        <p className="text-sm font-semibold">Ative um número da API Oficial do WhatsApp</p>
      </div>
      <p className="text-xs text-muted-foreground">
        O Disparo em Massa só sai por um número conectado pela API Oficial da Meta. Você traz o seu ou compra um aqui,
        conecta à Meta e cadastra o cartão — a gente guia cada passo.
      </p>
      {hasAnyInstance && (
        <p className="text-xs text-warning dark:text-warning">
          Este tracking usa um número que não é da API Oficial. Conectar pela Meta troca o número dele para a API Oficial.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setIsWizardOpen(true)}>
          Conectar número oficial
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIsGuideOpen(true)}>
          Como funciona e quanto custa
        </Button>
      </div>
      <ConnectNumberWizard trackingId={trackingId} open={isWizardOpen} onOpenChange={setIsWizardOpen} />
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Antes de começar</DialogTitle>
          </DialogHeader>
          <BeforeYouStart />
        </DialogContent>
      </Dialog>
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
      {massSend?.hasOfficialNumber && <MetaNumberPanel trackingId={massSend.trackingId} />}
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
