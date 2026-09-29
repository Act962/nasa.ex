import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarInset } from "@/components/ui/sidebar";
import { AstroAppShell } from "@/features/astro-commander/components/astro-app-shell";

/** App ASTRO — comandos, execuções, custos e configuração (spec 0028). */
export default async function AstroAppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  return (
    // `SidebarInset` é o que dá a largura restante da tela às páginas do app;
    // sem ele, o conteúdo parava na metade.
    <SidebarInset className="min-h-full">
      <Suspense>
        <AstroAppShell />
      </Suspense>
    </SidebarInset>
  );
}
