"use client";

/**
 * Linha de configuração no formato das telas de referência: rótulo e explicação
 * à esquerda, controle à direita. Empilha no celular.
 */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-center md:gap-8">
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
