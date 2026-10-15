import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readUnsubscribeToken } from "@/features/campanhas/email/unsubscribe-token";

// Spec 0107 (RF-4): descadastro. Atende o "um clique" do provedor (List-Unsubscribe-Post)
// e o botão da página /email/descadastrar (que volta para a página com a confirmação).
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const target = readUnsubscribeToken(token);
  if (!target) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  await prisma.emailUnsubscribe.upsert({
    where: {
      organizationId_email: { organizationId: target.organizationId, email: target.email },
    },
    create: { organizationId: target.organizationId, email: target.email },
    update: {},
  });

  if (url.searchParams.get("from") === "page") {
    return NextResponse.redirect(new URL(`/email/descadastrar?t=${token}&ok=1`, url), 303);
  }
  return NextResponse.json({ ok: true });
}
