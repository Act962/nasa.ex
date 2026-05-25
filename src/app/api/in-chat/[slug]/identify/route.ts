/**
 * In-Chat — endpoint público de identificação do lead.
 *
 * POST /api/in-chat/[slug]/identify
 * Body: { phone: string }
 *
 * Valida que o telefone bate com um lead existente na org (pelo slug).
 * Se bater, seta cookie `nasa_inchat_lead` (httpOnly, sameSite=lax,
 * secure em prod) com o `leadId` — usado pelas rotas seguintes pra
 * autenticar o lead sem precisar de senha.
 *
 * Se não encontrar lead → 404. Não vaza informação sobre quais números
 * são leads da org (mesma resposta pra "phone inválido" ou "phone não
 * cadastrado").
 *
 * Sem rate-limit dedicado por enquanto — vulnerabilidade conhecida de
 * brute-force, mas baixo impacto (atacante teria que conhecer slug +
 * tentar phones; informação no DB é só conversa de WhatsApp, não senhas).
 * TODO: rate-limit por IP em sprint futura se for problema.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const inputSchema = z.object({
  phone: z.string().min(8).max(20),
});

const COOKIE_NAME = "nasa_inchat_lead";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Normaliza telefone — só dígitos, dedup de tentativas com formatação
  // diferente ("+55 86 99999..." vs "5586999999...").
  const phone = parsed.data.phone.replace(/[^\d]/g, "");
  if (phone.length < 8) {
    return NextResponse.json({ error: "phone_too_short" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) {
    // Mesma resposta de "phone não bateu" pra não vazar slugs válidos
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Acha o primeiro lead com esse phone em qualquer tracking da org.
  // Se houver múltiplos (raro — phone+trackingId é unique), pega o mais
  // recente.
  const lead = await prisma.lead.findFirst({
    where: {
      phone,
      tracking: { organizationId: org.id },
    },
    select: { id: true, name: true, trackingId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = NextResponse.json({
    success: true,
    leadId: lead.id,
    leadName: lead.name,
    orgName: org.name,
  });
  res.cookies.set({
    name: COOKIE_NAME,
    value: `${org.id}:${lead.id}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
