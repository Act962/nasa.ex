"use client";

import { CheckCircle2, Clock, Copy, Eye, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export interface SignerRow {
  name: string;
  email: string;
  token: string;
  signed_at: string | null;
}

export function toSignerRows(signers: unknown): SignerRow[] {
  return Array.isArray(signers) ? (signers as SignerRow[]) : [];
}

export function hasOnlyOrphanSigners(signers: SignerRow[]) {
  return signers.length > 0 && signers.every((signer) => !signer.token);
}

export function SignerLinksPanel({ signers, contractTitle }: { signers: SignerRow[]; contractTitle: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const validSigners = signers.filter((signer) => !!signer.token);
  const orphanCount = signers.length - validSigners.length;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
  };

  return (
    <>
      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Links de assinatura
        </p>
        <p className="text-sm font-medium truncate mt-0.5">{contractTitle}</p>
      </div>
      {orphanCount > 0 && (
        <div className="mx-2 mt-2 rounded-md border border-warning/30 bg-warning/10 dark:bg-warning/15 dark:border-warning/40 px-3 py-2 text-[11px] text-warning dark:text-warning">
          {orphanCount} assinante{orphanCount > 1 ? "s" : ""} sem link válido — re-salve o contrato para gerar.
        </div>
      )}
      <div className="p-2 space-y-1">
        {validSigners.map((signer, index) => {
          const url = `${origin}/contrato/${signer.token}`;
          const whatsappText = encodeURIComponent(`Olá ${signer.name}, segue o link para assinar o contrato "${contractTitle}":\n${url}`);
          const mailSubject = encodeURIComponent(`Contrato para assinatura: ${contractTitle}`);
          const mailBody = encodeURIComponent(`Olá ${signer.name},\n\nSegue o link para assinatura:\n\n${url}\n\nAtenciosamente.`);

          return (
            <div key={signer.token ?? index} className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                {signer.signed_at
                  ? <CheckCircle2 className="size-3.5 text-success shrink-0" />
                  : <Clock className="size-3.5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{signer.name}</p>
                  {signer.signed_at
                    ? <p className="text-[10px] text-success dark:text-success">
                        Assinado em {new Date(signer.signed_at).toLocaleDateString("pt-BR")}
                      </p>
                    : <p className="text-[10px] text-muted-foreground">Aguardando assinatura</p>}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir contrato"
                  className="size-6 rounded flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                >
                  <Eye className="size-3.5 text-muted-foreground" />
                </a>
              </div>

              {!signer.signed_at && (
                <div className="flex gap-1.5">
                  <a
                    href={`https://wa.me/?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-success/10 border border-success/30 text-success dark:text-success text-[11px] font-medium hover:bg-success/20 transition-colors"
                  >
                    <MessageCircle className="size-3" /> WhatsApp
                  </a>
                  <a
                    href={`mailto:${signer.email}?subject=${mailSubject}&body=${mailBody}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-info/10 border border-info/30 text-info dark:text-info text-[11px] font-medium hover:bg-info/20 transition-colors"
                  >
                    <Mail className="size-3" /> E-mail
                  </a>
                  <button
                    onClick={() => handleCopy(url)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground text-[11px] font-medium hover:bg-muted/80 transition-colors"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
