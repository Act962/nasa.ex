import "server-only";
import prisma from "@/lib/prisma";
import { campaignAvailabilityAt, findActiveCampaign } from "@/features/star-friends/lib/campaign/campaign";
import { findMemberForLead } from "@/features/star-friends/lib/members";
import { isPhotoOrPdf } from "../lib/nodes";

/**
 * Foto ou PDF de inscrito em campanha aberta, com o lead fora de fluxo (spec 0140, D-3): é cupom para a campanha da IA do
 * funil, não começo de fluxo. Inscrito manda a foto direto, sem passar pelo menu.
 */
export async function isCampaignReceiptOutsideFlow(params: { trackingId: string; leadId: string; messageInternalId: string }): Promise<boolean> {
  const message = await prisma.message.findUnique({ where: { id: params.messageInternalId }, select: { mimetype: true } });
  if (!isPhotoOrPdf(message?.mimetype)) return false;
  const tracking = await prisma.tracking.findUnique({ where: { id: params.trackingId }, select: { organizationId: true } });
  if (!tracking) return false;
  const campaign = await findActiveCampaign(tracking.organizationId, params.trackingId);
  if (!campaign || campaignAvailabilityAt(campaign, new Date()) !== "open") return false;
  const member = await findMemberForLead(tracking.organizationId, params.leadId);
  if (!member) return false;
  const entry = await prisma.loyaltyCampaignEntry.findUnique({
    where: { campaignId_memberId: { campaignId: campaign.id, memberId: member.id } },
    select: { id: true },
  });
  return Boolean(entry);
}
