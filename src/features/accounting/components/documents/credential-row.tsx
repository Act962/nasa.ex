"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Fingerprint, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDeleteCompanyCredential,
  useRevealCompanyCredential,
} from "@/features/accounting/hooks/use-accounting-credentials";
import { findCredentialPortal } from "./credential-portals";
import type { EditableCredential } from "./credential-form-dialog";

const REVEAL_SECONDS = 30;

export interface CredentialRowView extends EditableCredential {
  secretLast4: string | null;
  revealCount: number;
  lastRevealedAt: Date | string | null;
}

interface CredentialRowProps {
  credential: CredentialRowView;
  hasPasskey: boolean;
  onEdit: (credential: CredentialRowView) => void;
}

function describeRevealError(error: Error): string {
  if (error.name === "NotAllowedError") return "Confirmação cancelada ou expirada.";
  return error.message || "Não foi possível revelar a senha.";
}

export function CredentialRow({ credential, hasPasskey, onEdit }: CredentialRowProps) {
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const revealCredential = useRevealCompanyCredential();
  const deleteCredential = useDeleteCompanyCredential();
  const portalLabel = findCredentialPortal(credential.portal)?.label ?? credential.portal;

  useEffect(() => {
    if (!revealedSecret) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [revealedSecret]);

  useEffect(() => {
    if (revealedSecret && secondsLeft === 0) setRevealedSecret(null);
  }, [revealedSecret, secondsLeft]);

  function reveal() {
    revealCredential.mutate(credential.id, {
      onSuccess: (secret) => {
        setRevealedSecret(secret);
        setSecondsLeft(REVEAL_SECONDS);
      },
      onError: (error) => toast.error(describeRevealError(error)),
    });
  }

  function copySecret() {
    if (!revealedSecret) return;
    navigator.clipboard.writeText(revealedSecret).then(
      () => toast.success("Senha copiada."),
      () => toast.error("Não foi possível copiar."),
    );
  }

  function remove() {
    if (!window.confirm(`Remover "${credential.label}" do cofre? Esta ação não pode ser desfeita.`)) return;
    deleteCredential.mutate(
      { credentialId: credential.id },
      {
        onSuccess: () => toast.success("Credencial removida."),
        onError: (error) => toast.error(error.message || "Não foi possível remover."),
      },
    );
  }

  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold leading-snug">{credential.label}</p>
          <p className="text-xs text-muted-foreground">
            {portalLabel}
            {credential.username && ` · ${credential.username}`}
          </p>
          <p className="font-mono text-sm">
            {revealedSecret ?? `••••••${credential.secretLast4 ?? ""}`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {credential.revealCount === 0
              ? "Nunca revelada"
              : `Revelada ${credential.revealCount} ${credential.revealCount === 1 ? "vez" : "vezes"}`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Opções da credencial">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(credential)}>
              <Pencil className="size-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={deleteCredential.isPending} onClick={remove}>
              <Trash2 className="size-3.5" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {revealedSecret ? (
          <Button size="sm" variant="outline" onClick={copySecret}>
            <Copy className="size-3.5" /> Copiar ({secondsLeft}s)
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={!hasPasskey || revealCredential.isPending} onClick={reveal}>
            {revealCredential.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Fingerprint className="size-3.5" />}
            Revelar
          </Button>
        )}
        {credential.url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={credential.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Abrir portal
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
