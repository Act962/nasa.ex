/**
 * "Quick add evento via imagem" — recebe um flyer/banner via
 * `multipart/form-data` (campo `file`), extrai os dados via Claude
 * Vision (AI SDK + Anthropic), sobe a imagem como cover no R2 e cria
 * a Action `isPublic=true`.
 *
 * Usa rota Next.js (não orpc) porque orpc + multipart é complexo.
 * Mesmo padrão que `/api/s3/upload-direct`.
 *
 * Devolve `{ event, missingFields, ai }` — UI usa `missingFields`
 * pra alertar o user sobre o que falta preencher antes de publicar.
 */
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";
import { resolveAnthropicApiKey } from "@/lib/anthropic-key";
import { extractEventFromImage } from "@/features/public-calendar/utils/extract-event-from-image";
import { createEventFromParsed } from "@/features/public-calendar/utils/create-event-from-parsed";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "Sem organização ativa" },
      { status: 400 },
    );
  }

  // Env vars do S3 — mesmo guard do upload-direct.
  if (
    !process.env.AWS_ENDPOINT_URL_S3 ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    !process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES
  ) {
    return NextResponse.json(
      { error: "Armazenamento S3 não configurado" },
      { status: 503 },
    );
  }

  // Resolve a chave da Anthropic (env > integration > planner).
  const apiKey = await resolveAnthropicApiKey(orgId);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Chave da API Anthropic não configurada. Acesse um Planner → aba IA pra adicionar.",
      },
      { status: 500 },
    );
  }

  let file: File;
  try {
    const formData = await req.formData();
    const f = formData.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'file' não enviado" },
        { status: 400 },
      );
    }
    if (!f.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Envie um arquivo de imagem (PNG, JPG, WEBP, AVIF)" },
        { status: 400 },
      );
    }
    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Imagem muito grande. Limite: 15MB" },
        { status: 413 },
      );
    }
    file = f;
  } catch {
    return NextResponse.json(
      { error: "FormData inválido" },
      { status: 400 },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);

    // ── 1. Extrai metadados via Claude Vision ────────────────────
    const parsed = await extractEventFromImage(imageBytes, file.type, apiKey);
    if (!parsed || !parsed.title) {
      return NextResponse.json(
        {
          error:
            "Não consegui extrair informações dessa imagem. Tente outra ou crie manualmente.",
        },
        { status: 422 },
      );
    }

    // ── 2. Sobe a imagem como cover ─────────────────────────────
    const ext = file.type.split("/")[1]?.split(";")[0]?.trim() || "bin";
    const coverImageKey = `${uuidv4()}.${ext}`;
    try {
      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: coverImageKey,
          Body: Buffer.from(arrayBuffer),
          ContentType: file.type,
          ContentLength: file.size,
        }),
      );
    } catch (uploadErr) {
      console.error("[quick-create-from-image] upload R2 falhou", uploadErr);
      // Continua mesmo sem cover — UI alerta como "missing imagem".
    }

    // ── 3. Cria a Action ────────────────────────────────────────
    const result = await createEventFromParsed({
      parsed,
      sourceUrl: null, // sem URL fonte — user só colou a imagem
      coverImageKey,
      userId: session.user.id,
      userName: session.user.name ?? "Eu",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Não consegui criar o evento" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      event: result.event,
      missingFields: result.missingFields,
      ai: {
        title: parsed.title,
        hadDate: !!parsed.startDate,
        hadLocation: !!(parsed.city || parsed.address),
        category: parsed.eventCategory,
      },
    });
  } catch (err) {
    console.error("[quick-create-from-image]", err);
    return NextResponse.json(
      { error: "Erro ao processar imagem" },
      { status: 500 },
    );
  }
}
