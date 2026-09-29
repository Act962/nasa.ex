"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLeadProposals } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { ScreenList, formatDateTime } from "./screen-list";
import { DocumentDropzone } from "./document-dropzone";

// Documentos comerciais do lead: propostas e orçamentos do Forge.

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  PAGA: "Paga",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

interface DocumentsScreenProps {
  conversationId: string;
  lead: { id: string; name: string; phone: string | null };
}

export function DocumentsScreen({
  conversationId,
  lead,
}: DocumentsScreenProps) {
  const { data, isLoading } = useLeadProposals(lead.id);
  const proposals = data?.proposals ?? [];

  return (
    <div className="flex flex-col gap-4">
      <DocumentDropzone conversationId={conversationId} lead={lead} />
      <ScreenList
        isLoading={isLoading}
        isEmpty={proposals.length === 0}
        emptyText="Nenhuma proposta ou orçamento para este lead."
      >
        {proposals.map((proposal) => (
          <li
            key={proposal.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <Link
                href={`/forge?tab=proposals&id=${proposal.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                #{proposal.number} · {proposal.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Criada em {formatDateTime(proposal.createdAt)}
              </p>
            </div>
            <Badge variant="secondary">
              {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status}
            </Badge>
          </li>
        ))}
      </ScreenList>
    </div>
  );
}
