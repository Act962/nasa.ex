import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CommandDetail } from "@/features/astro-commander/components/command-detail";

/** Página de um comando do ASTRO (spec 0028, RF-18). */
export default async function AstroCommandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/settings");

  const { id } = await params;
  return <CommandDetail commandId={id} />;
}
