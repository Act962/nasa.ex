import "server-only";
import { inngest } from "@/inngest/client";
import { awardPoints } from "@/app/router/space-point/utils";
import { awardStarFriendsForProposal } from "@/features/star-friends/lib/earn-forge";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";

interface PaidProposal {
  id: string;
  organizationId: string;
  clientId: string | null;
  responsibleId: string;
  orgProjectId: string | null;
}

/**
 * Efeitos de uma proposta que virou PAGA, depois do commit e best-effort.
 * `withOnboarding` dispara o onboarding de agência (projeto, planner, formulários e e-mail):
 * a venda de balcão registrada pelo vendedor não usa (spec 0148, D-3).
 */
export async function runProposalPaidEffects(proposal: PaidProposal, { withOnboarding }: { withOnboarding: boolean }) {
  try {
    if (proposal.clientId) {
      await awardStarFriendsForProposal(proposal.id, proposal.organizationId, proposal.clientId).catch((error) =>
        console.error("[forge] star_friends_award_failed", error),
      );
    }
    if (withOnboarding) {
      await inngest.send({
        name: "onboarding/proposal.paid",
        data: {
          proposalId: proposal.id,
          organizationId: proposal.organizationId,
          leadId: proposal.clientId,
          orgProjectId: proposal.orgProjectId,
        },
      });
    }
    // Compra nova muda o potencial e as compras do lead (spec 0035).
    if (proposal.clientId) await requestLeadMetricsRecompute(proposal.clientId);
    await awardPoints(proposal.responsibleId, proposal.organizationId, "proposal_accepted");
  } catch (error) {
    console.error("[forge] proposal_paid_effects_failed", error);
  }
}
