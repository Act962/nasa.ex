"use client";

interface Signer {
  name: string;
  email: string;
  token: string;
  signed_at: string | null;
  sign_method?: string;
}

interface SignatureBlockProps {
  signers: Signer[];
}

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const methodLabel = (m?: string): string => {
  switch (m) {
    case "govbr":
      return "GOV.br";
    case "electronic":
      return "Eletrônica";
    default:
      return "Eletrônica";
  }
};

// Bloco de rubricas que aparece no corpo do contrato/PDF.
// Renderizado dentro do card "Termos do Contrato" para sair na impressão.
export function SignatureBlock({ signers }: SignatureBlockProps) {
  if (!signers || signers.length === 0) return null;
  const isSingle = signers.length === 1;

  return (
    <div className="forge-signature-block mt-10 pt-6 border-t border-border">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-6 text-center">
        Assinaturas
      </p>
      <div
        className={
          isSingle
            ? "flex justify-center"
            : "grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8"
        }
      >
        {signers.map((s) => {
          const signed = !!s.signed_at;
          return (
            <div
              key={s.token}
              className="flex flex-col items-center text-center forge-avoid-break"
            >
              <div className="w-full max-w-xs h-12 flex items-end justify-center border-b-2 border-foreground/70 mb-1.5">
                {signed ? (
                  <span className="font-serif italic text-base translate-y-1.5 text-foreground">
                    {s.name}
                  </span>
                ) : null}
              </div>
              <p className="text-[13px] font-medium text-foreground">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">{s.email}</p>
              {signed && s.signed_at ? (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Assinado em {fmtDateTime(s.signed_at)} via {methodLabel(s.sign_method)}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Aguardando assinatura
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
