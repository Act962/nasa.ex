import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPostHogClient } from "@/lib/posthog-server";
import { broadcastAgentWorkflowEvent } from "@/inngest/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contractId, token, name, method } = body as {
      contractId?: string;
      token?: string;
      name?: string;
      method?: "manual" | "govbr";
    };

    if (!contractId || !token) {
      return NextResponse.json({ error: "Missing contractId or token" }, { status: 400 });
    }

    // manual method always requires a name; govbr uses the existing signer name
    if (method !== "govbr" && !name?.trim()) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // Include proposal → client → tracking pra emitir evento de workflow.
    const contract = await prisma.forgeContract.findUnique({
      where: { id: contractId },
      include: {
        proposal: {
          select: {
            id: true,
            client: { select: { id: true, trackingId: true } },
          },
        },
      },
    });
    if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const signers = contract.signers as {
      name: string;
      email: string;
      whatsapp?: string;
      token: string;
      signed_at: string | null;
      sign_method?: string;
    }[];

    const idx = signers.findIndex((s) => s.token === token);
    if (idx === -1) return NextResponse.json({ error: "Signer not found" }, { status: 404 });
    if (signers[idx].signed_at)
      return NextResponse.json({ error: "Already signed" }, { status: 409 });

    signers[idx].signed_at = new Date().toISOString();
    signers[idx].sign_method = method ?? "manual";

    // For manual: update the name; for govbr: keep the existing name
    if (name?.trim()) {
      signers[idx].name = name.trim();
    }

    const allSigned = signers.every((s) => !!s.signed_at);

    await prisma.forgeContract.update({
      where: { id: contractId },
      data: {
        signers,
        status: allSigned ? "ATIVO" : contract.status,
      },
    });

    const signer = signers[idx];
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: signer.email,
      event: "contract_signed",
      properties: {
        contract_id: contractId,
        sign_method: method ?? "manual",
        all_signed: allSigned,
      },
    });
    await posthog.shutdown();

    // Emite `contract-signed` pro engine de workflows acordar runs aguardando
    // esse evento via WAIT_FOR_EVENT. Só dispara quando TODOS assinaram (do
    // contrário workflow disparava antes da hora) E o contrato está vinculado
    // a uma proposta com lead. Best-effort.
    if (allSigned && contract.proposal?.client?.id && contract.proposal.client.trackingId) {
      await broadcastAgentWorkflowEvent({
        event: "contract-signed",
        leadId: contract.proposal.client.id,
        trackingId: contract.proposal.client.trackingId,
        organizationId: contract.organizationId,
        extra: {
          contractId,
          proposalId: contract.proposal.id,
          signerName: signer.name,
          signMethod: method ?? "manual",
        },
      });
    }

    return NextResponse.json({ ok: true, allSigned });
  } catch (err) {
    console.error("[sign-contract]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
