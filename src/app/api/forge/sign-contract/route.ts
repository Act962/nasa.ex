import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    const contract = await prisma.forgeContract.findUnique({ where: { id: contractId } });
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

    return NextResponse.json({ ok: true, allSigned });
  } catch (err) {
    console.error("[sign-contract]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
