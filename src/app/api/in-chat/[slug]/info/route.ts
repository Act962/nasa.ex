/**
 * In-Chat — info pública da empresa pro header da página.
 *
 * GET /api/in-chat/[slug]/info
 *
 * Retorna dados básicos da org (nome, logo, endereço, site, telefone)
 * pra o lead consultar quando clica no nome no header — equivalente a
 * "ver perfil" do WhatsApp. Não exige cookie de identificação.
 *
 * Só retorna info se a org tem alguma instância em modo In-Chat ativo
 * (não vaza dados de orgs em estado normal).
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
        where: { inChatModeActive: true },
        select: {
          phoneNumber: true,
        },
        take: 1,
      },
    },
  });

  if (!org || org.whatsappInstances.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    name: org.name,
    logo: org.logo,
    niche: org.companyNiche,
    cep: org.companyCep,
    phone: org.whatsappInstances[0].phoneNumber,
  });
}
