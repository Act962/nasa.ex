import { redirect } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { NasaCommandCenter } from "@/features/nasa-command/components/nasa-command-center";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import { HOME_APP_PREFIX } from "@/app/router/sidebar-prefs";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * O app marcado como principal em /apps → Personalizar abre no lugar do Início.
 * O link "Início" da barra lateral passa `?home=1` pra continuar acessível.
 */
async function resolveHomeAppUrl(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const preference = await prisma.userSidebarPreference.findFirst({
    where: {
      userId: session.user.id,
      itemKey: { startsWith: HOME_APP_PREFIX },
      visible: true,
    },
    select: { itemKey: true },
  });
  if (!preference) return null;

  const appKey = preference.itemKey.slice(HOME_APP_PREFIX.length);
  const navItem = SIDEBAR_NAV_ITEMS.find((item) => item.key === appKey);
  return navItem && navItem.url !== "/home" ? navItem.url : null;
}

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>;
}) {
  const { home } = await searchParams;

  if (home !== "1") {
    const homeAppUrl = await resolveHomeAppUrl();
    if (homeAppUrl) redirect(homeAppUrl);
  }

  return (
    <SidebarInset className="overflow-hidden">
      <NasaCommandCenter />
    </SidebarInset>
  );
}
