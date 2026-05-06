import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Página de provisionamento + redirecionamento para criar evento público.
 *
 * Fluxo:
 *  1. Sem sessão → manda pra /sign-up (com callback de volta).
 *  2. Sem organização → cria "Meu Espaço" + Member (owner) + define como
 *     activeOrganizationId da sessão.
 *  3. Sem workspace → cria "Meu Workspace" com as 4 colunas padrão.
 *  4. Redireciona pra /workspaces/{id}?create=event-public — o
 *     `actions-view-switcher` detecta o param e abre `CreateActionModal`
 *     com `presetPublic=true` (toggle "Visualização Pública" já marcado).
 */
export const dynamic = "force-dynamic";

export default async function CriarEventoRedirect({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string }>;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const { startDate } = (await searchParams) ?? {};

  if (!session?.user) {
    const cb = startDate
      ? `/calendario/criar-evento?startDate=${encodeURIComponent(startDate)}`
      : "/calendario/criar-evento";
    redirect(`/sign-up?callbackUrl=${encodeURIComponent(cb)}`);
  }

  const userId = session.user.id;
  const userName = session.user.name ?? "Eu";

  // ── 1. Garantir organização ────────────────────────────────────────────
  let membership = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) {
    // Cria org default + Member (owner) — usuário recém-criado sem empresa.
    const orgName = `${userName.split(" ")[0]} — Espaço`;
    const baseSlug = orgName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    const slug = `${baseSlug || "espaco"}-${userId.slice(-6)}`;

    const newOrg = await prisma.organization.create({
      data: {
        name: orgName,
        slug,
        createdAt: new Date(),
        members: {
          create: {
            userId,
            role: "owner",
            createdAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    // Atualiza sessão pra usar essa org ativa.
    try {
      await prisma.session.update({
        where: { id: session.session.id },
        data: { activeOrganizationId: newOrg.id },
      });
    } catch (e) {
      console.error("[criar-evento] falha ao definir activeOrg:", e);
    }

    membership = { organizationId: newOrg.id };
  }

  const organizationId = membership.organizationId;

  // ── 2. Garantir workspace ──────────────────────────────────────────────
  let workspace = await prisma.workspace.findFirst({
    where: {
      organizationId,
      isArchived: false,
      OR: [
        { members: { some: { userId } } },
        { createdBy: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Meu Workspace",
        organizationId,
        createdBy: userId,
        members: {
          create: { userId, role: "OWNER" },
        },
        columns: {
          createMany: {
            data: [
              { name: "Para fazer", order: 0 },
              { name: "Em progresso", order: 1 },
              { name: "Em revisão", order: 2 },
              { name: "Concluído", order: 3 },
            ],
          },
        },
      },
      select: { id: true },
    });
  }

  // ── 3. Redirecionar pro workspace com flags pra abrir modal público ────
  // `seedTitle` pré-preenche o input "Título" no `CreateActionModal`.
  // `seedStartDate` (opcional) vem do clique numa data específica do
  // /calendario — pré-preenche a data de início. Após o user clicar
  // "Criar ação", `actions-view-switcher` adiciona `?actionId=...&highlight=public`
  // pra abrir a modal de detalhes destacando "Visualização Pública".
  const params = new URLSearchParams();
  params.set("create", "event-public");
  params.set("seedTitle", "Nome do meu primeiro evento");
  if (startDate) {
    params.set("seedStartDate", startDate);
  }
  redirect(`/workspaces/${workspace.id}?${params.toString()}`);
}
