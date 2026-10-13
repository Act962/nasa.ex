import "server-only";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";

// Token público do lead (`/lead/<token>`, prefill de formulário). Nasce vazio e é criado na primeira vez
// em que um link precisa dele (spec 0100, RF-1).

/** Devolve o token do lead, criando-o se ainda não existir. `null` quando o lead não é da empresa. */
export async function ensureLeadPublicToken(params: { leadId: string; organizationId: string }): Promise<string | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, tracking: { organizationId: params.organizationId } },
    select: { publicToken: true },
  });
  if (!lead) return null;
  if (lead.publicToken) return lead.publicToken;
  const publicToken = crypto.randomBytes(18).toString("base64url");
  await prisma.lead.update({ where: { id: params.leadId }, data: { publicToken } });
  return publicToken;
}
