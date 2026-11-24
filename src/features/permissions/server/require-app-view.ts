import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAppViewAllowed, type AppViewId } from "../lib/app-view-keys";
import { permissionsForApp, resolveOrgPermissions } from "./resolve-org-permissions";

// Chamado no layout de cada app (spec 0153): "Ver" desligado devolve a pessoa ao Início
// antes de a tela carregar. Sem sessão ou sem empresa ativa, o layout da plataforma decide.
export async function requireAppView(viewId: AppViewId): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return;

  const resolved = await resolveOrgPermissions(session.user.id, organizationId);
  const isAllowed =
    !!resolved && isAppViewAllowed(viewId, (appKey) => permissionsForApp(resolved, appKey).canView);
  if (isAllowed) return;

  // Empresa de escopo restrito (ex.: só trafeGO) é mandada de volta ao próprio app pelo
  // TrafegoScopeGuard; bloquear esse app aqui faria as duas telas se redirecionarem sem fim.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { appScope: true },
  });
  if (organization?.appScope === viewId) return;
  redirect("/home");
}
