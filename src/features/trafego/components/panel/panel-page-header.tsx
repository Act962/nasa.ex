import type { ReactNode } from "react";
import { MegaphoneIcon } from "lucide-react";

interface PanelPageHeaderProps {
  /** Título do computador (nome da página). */
  title: string;
  /** Título do celular: a seção atual, já que a navegação fica no menu de baixo. */
  mobileTitle?: string;
  subtitle: ReactNode;
  mobileSubtitle?: ReactNode;
  /** Linha acima do título (código e status do pedido, por exemplo). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export function PanelPageHeader({
  title,
  mobileTitle,
  subtitle,
  mobileSubtitle,
  eyebrow,
  actions,
}: PanelPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 md:size-11">
          <MegaphoneIcon className="size-5 text-info" />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              {eyebrow}
            </div>
          )}
          <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">
            {mobileTitle ?? title}
          </h1>
          <h1 className="truncate text-xl leading-tight font-semibold max-md:hidden">
            {title}
          </h1>
          <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
            <span className="md:hidden">{mobileSubtitle ?? subtitle}</span>
            <span className="max-md:hidden">{subtitle}</span>
          </p>
        </div>
      </div>
      {actions}
    </div>
  );
}
