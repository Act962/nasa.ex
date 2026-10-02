import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface SettingsSectionRowProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function SettingsSectionRow({
  href,
  title,
  description,
  icon: Icon,
}: SettingsSectionRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors active:bg-muted/60 hover:bg-muted/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-knob">
        <Icon className="size-[18px] text-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
