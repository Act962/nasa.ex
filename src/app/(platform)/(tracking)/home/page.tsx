import { redirect } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { NasaCommandCenter } from "@/features/nasa-command/components/nasa-command-center";
import { resolveHomeAppUrl as resolveAppLinkHomeUrl } from "@/features/apps/lib/app-signup-link";
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

  // Item do menu ou app fora do menu (Astro, Astro Chat, Comments, NERP).
  return resolveAppLinkHomeUrl(preference.itemKey.slice(HOME_APP_PREFIX.length));
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
    // Altura da tela travada: a conversa rola por dentro e a caixa do ASTRO fica parada embaixo.
    <SidebarInset className="h-svh overflow-hidden">
      <NasaCommandCenter />
    </SidebarInset>
  );
}
