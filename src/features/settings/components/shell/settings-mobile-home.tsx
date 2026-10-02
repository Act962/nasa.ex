"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { useOrgRole } from "@/hooks/use-org-role";
import {
  SETTINGS_GROUP_LABELS,
  SETTINGS_GROUP_ORDER,
  SETTINGS_PROFILE_QUERY,
  SETTINGS_ROOT_PATH,
  getVisibleSettingsSections,
  type SettingsSection,
} from "../../lib/settings-sections";
import { SettingsSectionRow } from "./settings-section-row";

const PROFILE_HREF = `${SETTINGS_ROOT_PATH}?${SETTINGS_PROFILE_QUERY}`;

function resolveSectionHref(section: SettingsSection): string {
  return section.path === SETTINGS_ROOT_PATH ? PROFILE_HREF : section.path;
}

/** Celular: lista de seções no lugar das abas. */
export function SettingsMobileHome() {
  const { data: session, isPending } = authClient.useSession();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { isSingle } = useOrgRole();

  const visibleSections = getVisibleSettingsSections(isSingle);
  const userName = session?.user?.name ?? "";

  return (
    <div className="space-y-5 px-4">
      <div>
        <h1 className="text-xl leading-tight font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil, a empresa e a equipe em um só lugar.
        </p>
      </div>

      <Link
        href={PROFILE_HREF}
        className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3 transition-colors active:bg-muted/60"
      >
        {isPending ? (
          <Skeleton className="size-12 rounded-full" />
        ) : (
          <Avatar className="size-12">
            {session?.user?.image && <AvatarImage src={session.user.image} alt={userName} />}
            <AvatarFallback>{userName.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{userName || "Seu perfil"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {activeOrganization?.name ?? session?.user?.email ?? ""}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      {SETTINGS_GROUP_ORDER.map((group) => {
        const groupSections = visibleSections.filter((section) => section.group === group);
        if (groupSections.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold text-muted-foreground">
              {SETTINGS_GROUP_LABELS[group]}
            </h2>
            <div className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-card">
              {groupSections.map((section) => (
                <SettingsSectionRow
                  key={section.id}
                  href={resolveSectionHref(section)}
                  title={section.title}
                  description={section.description}
                  icon={section.icon}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
