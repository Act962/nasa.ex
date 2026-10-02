import { cn } from "@/lib/utils";

interface SettingsRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Controle pequeno (switch, avatar, botão) fica ao lado do texto também no celular. */
  isInlineOnMobile?: boolean;
  controlClassName?: string;
}

/** Linha de configuração: texto à esquerda, controle à direita (ou embaixo no celular). */
export function SettingsRow({
  title,
  description,
  children,
  isInlineOnMobile = false,
  controlClassName,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-5",
        isInlineOnMobile
          ? "items-center justify-between"
          : "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6",
      )}
    >
      <div className="min-w-0">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div
        className={cn(
          "min-w-0",
          !isInlineOnMobile && "w-full sm:w-72 sm:shrink-0",
          isInlineOnMobile && "shrink-0",
          controlClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
