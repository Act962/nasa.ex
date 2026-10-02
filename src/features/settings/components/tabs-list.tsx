"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrgRole } from "@/hooks/use-org-role";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  SETTINGS_TAB_ORDER,
  type SettingsSection,
} from "../lib/settings-sections";

const ORDERED_TAB_SECTIONS: SettingsSection[] = SETTINGS_TAB_ORDER.map((sectionId) =>
  SETTINGS_SECTIONS.find((section) => section.id === sectionId),
).filter((section): section is SettingsSection => Boolean(section));

/** Abas do computador; no celular a navegação é a lista de seções. */
export function TabsList() {
  const pathname = usePathname();
  const { isSingle } = useOrgRole();

  const visibleTabs = ORDERED_TAB_SECTIONS.filter(
    (section) => !isSingle || section.isVisibleToSingleUser,
  );

  return (
    <nav aria-label="Seções de configurações" className="scroll-hidden-x px-4">
      <div className="mx-auto flex w-max max-w-7xl items-center gap-1 rounded-full bg-panel p-1">
        {visibleTabs.map((section) => {
          const isActive = pathname === section.path;
          return (
            <Link
              key={section.id}
              href={section.path}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-knob hover:text-foreground",
              )}
            >
              <section.icon className="size-4" />
              {section.tabLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
