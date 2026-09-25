import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AstroAppShell } from "@/features/astro-commander/components/astro-app-shell";

/** App ASTRO — comandos, execuções, custos e configuração (spec 0023). */
export default async function AstroAppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  return (
    <Suspense>
      <AstroAppShell />
    </Suspense>
  );
}
