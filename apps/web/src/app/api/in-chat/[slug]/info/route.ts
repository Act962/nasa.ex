/**
 * In-Chat — info pública da empresa pro header do widget/chat.
 *
 * GET /api/in-chat/[slug]/info
 *
 * Retorna dados básicos da org (nome, logo, nicho, CEP, telefone) pra o
 * widget público do NASA Pages mostrar logo+nome da empresa no header
 * do ChatButton, e pra página `/whatsapp/[slug]` exibir no "ver perfil".
 *
 * SEM gate de in-chat-mode — o widget do ChatButton precisa funcionar
 * mesmo com instância ok. Só retorna 404 se a org não existir.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      companyNiche: true,
      companyCep: true,
      whatsappInstances: {
        select: { phoneNumber: true },
        take: 1,
      },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    name: org.name,
    logo: org.logo,
    niche: org.companyNiche,
    cep: org.companyCep,
    phone: org.whatsappInstances[0]?.phoneNumber ?? null,
  });
}
