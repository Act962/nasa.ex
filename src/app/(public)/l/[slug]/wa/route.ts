import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  extractWhatsappPhone,
  buildWaMeUrl,
  type SocialLink,
} from "@/features/linnker/lib/extract-whatsapp-phone";

/**
 * QR Bridge: redireciona pra `wa.me/<phone>?text=...` registrando
 * scan na hora. Acionado quando alguém escaneia o QR exibido no
 * popup do Linnker.
 *
 * GET /l/<slug>/wa?utm_source=qr&utm_medium=event&utm_campaign=...
 *
 * Fluxo:
 *   1. Acha LinnkerPage por slug. Se não existe / não publicada /
 *      qrEnabled=false → 404.
 *   2. Extrai phone de socialLinks WhatsApp. Se não tem → 404.
 *   3. Monta mensagem template (default ou page.qrMessageTemplate).
 *   4. Grava LinnkerScan com UTM + User-Agent + IP — pra que o
 *      workflow MESSAGE_INCOMING depois correlacione e aplique tag.
 *   5. Redirect 302 pra wa.me com o text encoded.
 *
 * Note: gravamos o scan ANTES do redirect (await). Pequena latência
 * adicional (~10-50ms) é tolerável e garante que o scan existe
 * antes da pessoa abrir o WhatsApp.
 */

const DEFAULT_MESSAGE =
  "Olá! Te conheci pelo QR no evento. Quero saber mais 👋";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(req.url);

  const utmSource = url.searchParams.get("utm_source") ?? "qr";
  const utmMedium = url.searchParams.get("utm_medium") ?? "event";
  const utmCampaign = url.searchParams.get("utm_campaign") ?? null;
  // Permite override do texto via query (raro mas útil pra A/B test).
  const textOverride = url.searchParams.get("text");

  // Não usar `select` aqui — assim funciona ANTES da migration
  // qrEnabled/qrMessageTemplate (Prisma client antigo não conhece
  // os campos novos e select explícito quebra). Depois da migration,
  // o `findUnique` puro retorna tudo incluindo os 2 campos novos.
  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    include: {
      organization: { select: { name: true } },
    },
  });

  // qrEnabled default = true (schema default). Se for explicitamente
  // false, esconde. Pré-migration vem undefined → permite (default).
  const qrEnabled =
    (page as unknown as { qrEnabled?: boolean })?.qrEnabled !== false;

  if (!page || !page.isPublished || !qrEnabled) {
    return NextResponse.json(
      { error: "QR não disponível" },
      { status: 404 },
    );
  }

  const socialLinks = (page.socialLinks as SocialLink[] | null) ?? [];
  const phoneDigits = extractWhatsappPhone(socialLinks);
  if (!phoneDigits) {
    return NextResponse.json(
      { error: "WhatsApp não configurado nessa página" },
      { status: 404 },
    );
  }

  // Template: query > coluna salva > default. Suporta interpolação
  // simples de `{org}` pra incluir nome da organização sem precisar
  // editar manualmente em cada page.
  const savedTemplate =
    (page as unknown as { qrMessageTemplate?: string | null })
      .qrMessageTemplate ?? null;
  const template = textOverride ?? savedTemplate ?? DEFAULT_MESSAGE;
  const text = template.replace(/\{org\}/g, page.organization?.name ?? "");

  // User-Agent + IP do request — pra correlacionar com inbound
  // depois (helper match-scan-to-lead).
  const userAgent = req.headers.get("user-agent") ?? null;
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Best-effort: tenta gravar com campos UTM novos; se a migration
  // ainda não rodou, faz fallback gravando só os campos clássicos.
  try {
    await prisma.linnkerScan.create({
      data: {
        pageId: page.id,
        scanKind: "qr_button",
        utmSource,
        utmMedium,
        utmCampaign,
        userAgent,
        ipAddress,
      } as Parameters<typeof prisma.linnkerScan.create>[0]["data"],
    });
  } catch {
    // Fallback: sem campos novos (pré-migration)
    try {
      await prisma.linnkerScan.create({
        data: {
          pageId: page.id,
          userAgent,
          ipAddress,
        },
      });
    } catch (err) {
      console.warn("[linnker/wa] scan tracking failed:", err);
    }
  }

  const waUrl = buildWaMeUrl(phoneDigits, text);
  return NextResponse.redirect(waUrl, { status: 302 });
}
