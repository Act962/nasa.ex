import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SETTINGS_ROOT_PATH } from "../../lib/settings-sections";

interface SettingsMobileSectionTopProps {
  title: string;
  description?: string;
}

/** Celular: topo da seção aberta, com volta para a lista. */
export function SettingsMobileSectionTop({ title, description }: SettingsMobileSectionTopProps) {
  return (
    <div className="flex items-center gap-3 px-4">
      <Link
        href={SETTINGS_ROOT_PATH}
        aria-label="Voltar para Configurações"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-knob transition-colors active:bg-muted"
      >
        <ArrowLeft className="size-[18px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="line-clamp-2 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
