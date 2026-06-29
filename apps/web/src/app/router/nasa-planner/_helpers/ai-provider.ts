import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { IntegrationPlatform } from "@/generated/prisma/enums";

// ─── Timeout helper ───────────────────────────────────────────────────────────

export function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── S3 upload helper ─────────────────────────────────────────────────────────

export async function uploadToS3(buffer: Buffer, contentType = "image/jpeg"): Promise<string | null> {
  try {
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
    if (!bucket) { console.error("[IMG] S3 bucket not configured"); return null; }
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const key = `nasa-planner/posts/${uuidv4()}.${ext}`;
    await S3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    return key;
  } catch (err: any) {
    console.error("[IMG] S3 upload error:", err?.message);
    return null;
  }
}

// ─── Provider selection ───────────────────────────────────────────────────────

export type ImageQuality = "standard" | "hd";

export interface ImageProvider {
  provider: "dalle3" | "pollinations";
  apiKey: string | null;
}

export async function selectImageProvider(organizationId: string): Promise<ImageProvider> {
  const openai = await prisma.platformIntegration.findFirst({
    where: { organizationId, platform: IntegrationPlatform.OPENAI, isActive: true },
  });
  if (openai) {
    const config = openai.config as Record<string, string>;
    if (config?.apiKey) return { provider: "dalle3", apiKey: config.apiKey };
  }
  return { provider: "pollinations", apiKey: null };
}

// ─── DALL-E 3 image generation ────────────────────────────────────────────────

async function generateImageViaDalle3(prompt: string, apiKey: string, quality: ImageQuality): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: "1024x1024",
          quality,
          response_format: "url",
        }),
      },
      90000,
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText);
      console.error(`[IMG] DALL-E 3 error: ${resp.status} — ${err}`);
      return null;
    }

    const data = await resp.json();
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) return null;

    // Download and upload to R2
    const imgResp = await fetchWithTimeout(imageUrl, {}, 60000);
    if (!imgResp.ok) return null;
    const buffer = Buffer.from(await imgResp.arrayBuffer());
    return await uploadToS3(buffer, "image/png");
  } catch (err: any) {
    console.error("[IMG] DALL-E 3 exception:", err?.message);
    return null;
  }
}

// ─── Pollinations fallback ────────────────────────────────────────────────────

async function generateImageViaPollinations(prompt: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(prompt.slice(0, 400));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true&seed=${Date.now()}`;
    const resp = await fetchWithTimeout(url, {}, 50000);
    if (!resp.ok) { console.error(`[IMG] Pollinations HTTP ${resp.status}`); return null; }
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 500) return null;
    const ct = resp.headers.get("content-type") ?? "image/jpeg";
    return await uploadToS3(buffer, ct.startsWith("image/") ? ct : "image/jpeg");
  } catch (err: any) {
    console.error("[IMG] Pollinations error:", err?.message);
    return null;
  }
}

// ─── Unified generateImage ────────────────────────────────────────────────────

export async function generateImage(
  prompt: string,
  providerInfo: ImageProvider,
  quality: ImageQuality = "standard",
): Promise<string | null> {
  if (providerInfo.provider === "dalle3" && providerInfo.apiKey) {
    const key = await generateImageViaDalle3(prompt, providerInfo.apiKey, quality);
    if (key) return key;
    console.warn("[IMG] DALL-E 3 failed, falling back to Pollinations");
  }
  return generateImageViaPollinations(prompt);
}

// ─── Text via Pollinations ────────────────────────────────────────────────────

export async function generateTextViaPollinations(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const MODELS = ["openai", "openai-large", "mistral", "mistral-large"];
  for (const model of MODELS) {
    try {
      const resp = await fetchWithTimeout(
        "https://text.pollinations.ai/openai",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            jsonMode: true,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        },
        60000,
      );
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => null);
      const text: string | undefined =
        data?.choices?.[0]?.message?.content ?? (typeof data === "string" ? data : undefined);
      if (text?.trim()) return text.trim();
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Stars cost constants ─────────────────────────────────────────────────────

export const STARS_IMAGE_STANDARD = 3;   // DALL-E 3 standard ou Pollinations
export const STARS_IMAGE_HD = 5;         // DALL-E 3 HD
export const STARS_IMAGE_POLLINATIONS = 1; // taxa de serviço quando Pollinations
export const STARS_TEXT = 1;
export const STARS_POST_FULL = 5;        // texto + imagem HD
export const STARS_PUBLISH = 1;
export const STARS_SCHEDULE = 1;
