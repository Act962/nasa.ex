"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserInfo } from "../user-info";
import { TabsList } from "../tabs-list";
import { SETTINGS_ROOT_PATH, findSettingsSection } from "../../lib/settings-sections";
import { SettingsMobileHome } from "./settings-mobile-home";
import { SettingsMobileSectionTop } from "./settings-mobile-section-top";

const FALLBACK_SECTION_TITLE = "Configurações";

/**
 * Computador: topo + abas. Celular: em `/settings` a lista de seções;
 * dentro de uma seção, título dela e botão de voltar.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isProfileOpen = searchParams.get("secao") === "perfil";
  const isMobileHome = pathname === SETTINGS_ROOT_PATH && !isProfileOpen;
  const currentSection = findSettingsSection(pathname);

  return (
    <div className="mt-4 space-y-6 max-lg:pb-40">
      <div className="space-y-5 max-md:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-knob">
              <SettingsIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl leading-tight font-bold tracking-tight">
                Configurações
              </h1>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                Seu perfil, a empresa e a equipe em um só lugar.
              </p>
            </div>
          </div>
          <UserInfo />
        </div>
        <TabsList />
      </div>

      <div className="md:hidden">
        {isMobileHome ? (
          <SettingsMobileHome />
        ) : (
          <SettingsMobileSectionTop
            title={currentSection?.title ?? FALLBACK_SECTION_TITLE}
            description={currentSection?.description}
          />
        )}
      </div>

      <main className={cn("mx-auto w-full max-w-7xl", isMobileHome && "max-md:hidden")}>
        {children}
      </main>
    </div>
  );
}
