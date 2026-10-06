"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ORG_SLUG_PATTERN, buildSlugCandidates } from "../_lib/org-slug";

const MAX_SLUG_LENGTH = 80;

export interface OrgSlugCheck {
  isAvailable: boolean;
  suggestions: string[];
}

export async function checkOrgSlug(slug: string): Promise<OrgSlugCheck> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Não autorizado");
  }
  if (slug.length > MAX_SLUG_LENGTH || !ORG_SLUG_PATTERN.test(slug)) {
    throw new Error("Identificador inválido");
  }

  const candidates = buildSlugCandidates(slug);
  const takenOrganizations = await prisma.organization.findMany({
    where: { slug: { in: [slug, ...candidates] } },
    select: { slug: true },
  });
  const takenSlugs = new Set(takenOrganizations.map((organization) => organization.slug));

  return {
    isAvailable: !takenSlugs.has(slug),
    suggestions: candidates.filter((candidate) => !takenSlugs.has(candidate)),
  };
}
