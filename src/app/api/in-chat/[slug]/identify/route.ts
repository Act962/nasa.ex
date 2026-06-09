/**
 * In-Chat — endpoint público de identificação do lead.
 *
 * POST /api/in-chat/[slug]/identify
 * Body: { phone: string, name?: string, trackingId?: string }
 *
 * Fluxo (Sprint 3.5 — In-Chat sempre acessível):
 *  1. Valida `phone` (só dígitos, 8-15).
 *  2. Acha org pelo `slug`. Não existe → 404.
 *  3. Procura lead com aquele phone na org (qualquer tracking).
 *     - Achou → seta cookie + retorna leadId.
 *     - Não achou:
 *        a) Sem `name` no body → retorna `error: needs_name` (UI mostra
 *           form pedindo nome).
 *        b) Com `name` → cria lead novo via pipeline compartilhado
 *           (`createInChatLead`), com `LeadSource.IN_CHAT` + workflows +
 *           round-robin + logActivity. Seta cookie + retorna.
 *
 * `trackingId`: opcional. Quando lead novo + org tem múltiplos trackings,
 * client pode escolher qual. Default: primeiro tracking ativo da org.
 *
 * Cookie `nasa_inchat_lead = <orgId>:<leadId>` (httpOnly, sameSite=lax,
 * secure em prod, 30 dias).
 *
 * Sem rate-limit dedicado por enquanto — TODO: rate-limit por IP em
 * sprint futura. Pra MVP, dependemos do gate de phone (atacante precisa
 * conhecer phones válidos OU iterar muito).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createInChatLead } from "@/features/tracking-chat/lib/incoming-message-pipeline";

const inputSchema = z.object({
  phone: z.string().min(8).max(20),
  /** Nome do lead — obrigatório quando phone é novo (lead novo). */
  name: z.string().min(1).max(120).optional(),
  /** Tracking de destino quando lead novo + org tem múltiplos. */
  trackingId: z.string().optional(),
  /** Status de destino dentro do tracking (configurado nas Configurações
   *  da Página). Validado contra o tracking no `createInChatLead`; se
   *  ausente/inválido, cai no primeiro status do funil. */
  statusId: z.string().optional(),
});

const COOKIE_NAME = "nasa_inchat_lead";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function setLeadCookie(res: NextResponse, orgId: string, leadId: string) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: `${orgId}:${leadId}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

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
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Acha o primeiro lead com esse phone em qualquer tracking da org.
  const existingLead = await prisma.lead.findFirst({
    where: {
      phone,
      tracking: { organizationId: org.id },
    },
    select: { id: true, name: true, trackingId: true },
    orderBy: { updatedAt: "desc" },
  });

  if (existingLead) {
    // Lead existente — seta cookie + retorna.
    const res = NextResponse.json({
      success: true,
      leadId: existingLead.id,
      leadName: existingLead.name,
      orgName: org.name,
      isNew: false,
    });
    setLeadCookie(res, org.id, existingLead.id);
    return res;
  }

  // ── Lead novo ─────────────────────────────────────────────────────────
  // Sem nome → UI mostra "Como podemos te chamar?".
  if (!parsed.data.name?.trim()) {
    return NextResponse.json(
      {
        error: "needs_name",
        orgName: org.name,
      },
      { status: 200 },
    );
  }

  // Determina trackingId — usa o explícito do body OU pega o primeiro
  // tracking ativo da org (não-arquivado).
  let trackingId = parsed.data.trackingId;
  if (!trackingId) {
    const firstTracking = await prisma.tracking.findFirst({
      where: {
        organizationId: org.id,
        isArchived: false,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!firstTracking) {
      return NextResponse.json(
        { error: "no_tracking_available" },
        { status: 503 },
      );
    }
    trackingId = firstTracking.id;
  } else {
    // Confirma que o tracking pertence à org (defesa contra IDs forjados)
    const t = await prisma.tracking.findFirst({
      where: { id: trackingId, organizationId: org.id },
      select: { id: true },
    });
    if (!t) {
      return NextResponse.json(
        { error: "invalid_tracking" },
        { status: 400 },
      );
    }
  }

  // Cria lead via pipeline compartilhado — dispara workflow NEW_LEAD,
  // round-robin, logActivity automaticamente.
  try {
    const appOrigin = req.nextUrl.origin;
    const created = await createInChatLead({
      trackingId,
      statusId: parsed.data.statusId,
      phone,
      name: parsed.data.name.trim(),
      appOrigin,
    });

    const res = NextResponse.json({
      success: true,
      leadId: created.lead.id,
      leadName: created.lead.name,
      orgName: org.name,
      isNew: true,
    });
    setLeadCookie(res, org.id, created.lead.id);
    return res;
  } catch (err: any) {
    console.error("[in-chat/identify] create_lead_failed", err);
    return NextResponse.json(
      {
        error: "create_lead_failed",
        detail:
          err?.message === "status_not_configured"
            ? "Tracking sem status configurado"
            : "Falha ao criar lead",
      },
      { status: 500 },
    );
  }
}
