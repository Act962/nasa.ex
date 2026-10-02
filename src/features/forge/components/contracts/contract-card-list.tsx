"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Calendar, MoreHorizontal, Pencil, Share2, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatContractNumber, formatCurrency, getContractStatus } from "./contract-status";
import {
  SignerLinksPanel,
  hasOnlyOrphanSigners,
  toSignerRows,
  type SignerRow,
} from "./signer-links-panel";

export interface ContractCardItem {
  id: string;
  number: number;
  status: string;
  startDate: Date;
  endDate: Date;
  value: string;
  signers: unknown;
  clientData: unknown;
  isTemplate: boolean | null;
  proposal: { title: string } | null;
}

interface ContractCardListProps {
  contracts: ContractCardItem[];
  togglingTemplateId: string | null;
  onEdit: (contractId: string) => void;
  onDelete: (contractId: string) => void;
  onToggleTemplate: (contractId: string, isTemplate: boolean) => void;
}

interface SharingContract {
  title: string;
  signers: SignerRow[];
}

function getClientName(clientData: unknown): string | null {
  if (!clientData || typeof clientData !== "object") return null;
  const clientName = (clientData as Record<string, unknown>).name;
  return typeof clientName === "string" && clientName.trim() ? clientName : null;
}

function toShortDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR");
}

export function ContractCardList({
  contracts,
  togglingTemplateId,
  onEdit,
  onDelete,
  onToggleTemplate,
}: ContractCardListProps) {
  const [sharingContract, setSharingContract] = useState<SharingContract | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {contracts.map((contract) => {
          const status = getContractStatus(contract.status);
          const signers = toSignerRows(contract.signers);
          const signedCount = signers.filter((signer) => signer.signed_at).length;
          const contractTitle = contract.proposal?.title ?? `Contrato ${formatContractNumber(contract.number)}`;
          const clientName = getClientName(contract.clientData);
          const isTemplate = contract.isTemplate ?? false;

          const handleShare = () => {
            if (hasOnlyOrphanSigners(signers)) {
              toast.info("Re-salve o contrato para gerar links de assinatura");
              return;
            }
            setSharingContract({ title: contractTitle, signers });
          };

          return (
            <li key={contract.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onEdit(contract.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit(contract.id);
                  }
                }}
                className="flex gap-3 rounded-[20px] border border-line bg-card p-3 transition-colors active:bg-muted"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">
                      {formatContractNumber(contract.number)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                        status.color,
                      )}
                    >
                      {status.label}
                    </span>
                    {isTemplate && <Sparkles className="size-3.5 text-info" aria-label="Padrão" />}
                  </div>
                  <p className="truncate text-sm font-semibold">{contractTitle}</p>
                  {clientName && <p className="truncate text-xs text-muted-foreground">{clientName}</p>}
                  <p className="text-base font-bold tabular-nums">{formatCurrency(contract.value)}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {toShortDate(contract.startDate)} → {toShortDate(contract.endDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {signedCount}/{signers.length} assinaturas
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Ações do contrato"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors active:bg-muted/70"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem onSelect={handleShare}>
                      <Share2 /> Links de assinatura
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={togglingTemplateId === contract.id}
                      onSelect={() => onToggleTemplate(contract.id, isTemplate)}
                    >
                      <Sparkles className={cn(isTemplate && "text-info")} />
                      {isTemplate ? "Desmarcar como padrão" : "Marcar como padrão"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(contract.id)}>
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(contract.id)}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!sharingContract} onOpenChange={(isOpen) => !isOpen && setSharingContract(null)}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[24px] p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetTitle className="sr-only">Links de assinatura</SheetTitle>
          {sharingContract && (
            <SignerLinksPanel signers={sharingContract.signers} contractTitle={sharingContract.title} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
