import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { request, type RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { dirname, join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Upload } from "@aws-sdk/lib-storage";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { takeRateLimit } from "@/lib/rate-limit";
import { UnsafeSiteAddressError, parsePublicSiteUrl, pinnedLookup, resolvePublicAddress } from "@/lib/safe-public-url";
import { LOCAL_UPLOAD_PREFIX, isLocalUploadEnabled } from "./local-upload";

// Mídia anexada por link (spec 0136): o ÓRBITA baixa com as travas de rede da spec 0088 e guarda uma cópia no R2 da empresa.

export type MediaKind = "image" | "video";

export class RemoteMediaError extends Error {}

const LIMITS: Record<MediaKind, { maxBytes: number; timeoutMs: number }> = {
  image: { maxBytes: 15 * 1024 * 1024, timeoutMs: 20_000 },
  video: { maxBytes: 100 * 1024 * 1024, timeoutMs: 90_000 },
};
const MAX_REDIRECTS = 3;
const SNIFF_BYTES = 16;
const DOWNLOADS_PER_HOUR = 30;

interface SniffedType {
  kind: MediaKind;
  contentType: string;
  extension: string;
}

/** O tipo vale pelos primeiros bytes, nunca pelo nome ou pelo que o site declarou (RF-5, RNF-8). */
function sniffMediaType(head: Buffer): SniffedType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: "image", contentType: "image/jpeg", extension: "jpg" };
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: "image", contentType: "image/png", extension: "png" };
  }
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return { kind: "image", contentType: "image/webp", extension: "webp" };
  if (head.length >= 12 && head.toString("ascii", 4, 8) === "ftyp") {
    const brand = head.toString("ascii", 8, 12);
    if (brand === "qt  ") return { kind: "video", contentType: "video/quicktime", extension: "mov" };
    if (!brand.startsWith("hei") && !brand.startsWith("mif") && !brand.startsWith("avi")) return { kind: "video", contentType: "video/mp4", extension: "mp4" };
  }
  return null;
}

function publicStorageHost(): string | null {
  const publicBase = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
  if (!publicBase || publicBase === "undefined") return null;
  return publicBase.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0].toLowerCase();
}

/** Link que já é do armazenamento do ÓRBITA (o `publicUrl` do request_upload_url): anexa sem baixar (RF-2). */
export function isOwnStorageUrl(rawUrl: string, appOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.hostname.toLowerCase() === publicStorageHost()) return true;
  return isLocalUploadEnabled() && rawUrl.startsWith(`${appOrigin}/${LOCAL_UPLOAD_PREFIX}`);
}

function openOnce(url: URL, timeoutMs: number): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    void resolvePublicAddress(url.hostname).then((resolved) => {
      const options: RequestOptions = {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: pinnedLookup(resolved),
        timeout: timeoutMs,
        // Nada que identifique a empresa, a pessoa ou a plataforma sai neste pedido (RNF-7).
        headers: { accept: "image/*,video/*", "accept-encoding": "identity", "user-agent": "Mozilla/5.0 (compatible; MediaFetcher/1.0)" },
      };
      const outgoing = request(options, resolve);
      outgoing.on("timeout", () => outgoing.destroy(new RemoteMediaError("O site demorou demais para responder.")));
      outgoing.on("error", reject);
      outgoing.end();
    }, reject);
  });
}

/** Segue até 3 redirecionamentos, conferindo cada salto como um link novo (RNF-3). */
async function openPublicMedia(rawUrl: string, timeoutMs: number): Promise<IncomingMessage> {
  let url = parsePublicSiteUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const incoming = await openOnce(url, timeoutMs);
    const statusCode = incoming.statusCode ?? 0;
    if (statusCode >= 300 && statusCode < 400) {
      incoming.resume();
      const location = incoming.headers.location;
      if (!location) throw new RemoteMediaError("O site redirecionou sem dizer para onde.");
      url = parsePublicSiteUrl(new URL(location, url).toString());
      continue;
    }
    if (statusCode !== 200) {
      incoming.resume();
      throw new RemoteMediaError(statusCode === 403 || statusCode === 404 || statusCode === 410 ? "O link não está mais disponível (expirou ou foi apagado). Gere a mídia de novo." : `O site respondeu ${statusCode} ao baixar a mídia.`);
    }
    return incoming;
  }
  throw new RemoteMediaError("O link redirecionou vezes demais.");
}

/** Lê os primeiros bytes e pausa o download (sair de um `for await` destruiria o fluxo). */
function readHead(incoming: IncomingMessage): Promise<{ head: Buffer; hasEnded: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const finish = (hasEnded: boolean) => {
      incoming.pause();
      incoming.off("data", onData);
      incoming.off("end", onEnd);
      incoming.off("error", reject);
      resolve({ head: Buffer.concat(chunks), hasEnded });
    };
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      length += chunk.length;
      if (length >= SNIFF_BYTES) finish(false);
    };
    const onEnd = () => finish(true);
    incoming.on("data", onData);
    incoming.once("end", onEnd);
    incoming.once("error", reject);
  });
}

/** Corta o fluxo no limite de bytes e no tempo total, durante o download (RNF-4). */
function limitStream(maxBytes: number, deadline: number, kind: MediaKind): Transform {
  let receivedBytes = 0;
  const limited = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) return callback(new RemoteMediaError(`${kind === "image" ? "A imagem" : "O vídeo"} passou de ${Math.round(maxBytes / 1024 / 1024)} MB.`));
      if (Date.now() > deadline) return callback(new RemoteMediaError("O download demorou demais."));
      callback(null, chunk);
    },
  });
  return limited;
}

async function storeLocally(key: string, body: Readable): Promise<void> {
  const filePath = join(process.cwd(), "public", key);
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await pipeline(body, createWriteStream(filePath));
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
}

async function storeInBucket(key: string, contentType: string, body: Readable): Promise<void> {
  // Em partes: o vídeo nunca fica inteiro na memória (RNF-5); se o download cair, o envio é cancelado (CB-3).
  const upload = new Upload({ client: S3, params: { Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!, Key: key, Body: body, ContentType: contentType } });
  body.once("error", () => void upload.abort().catch(() => undefined));
  await upload.done();
}

/**
 * Baixa a mídia de um site público e guarda a cópia em `external-ai/<org>/` (RF-3).
 * Devolve o link da cópia, que é o que vai para o post.
 */
export async function copyRemoteMediaToStorage(input: { rawUrl: string; organizationId: string; userId: string; kind: MediaKind; appOrigin: string }): Promise<string> {
  const rateLimit = takeRateLimit("mcp-remote-media", input.userId, { max: DOWNLOADS_PER_HOUR, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) throw new RemoteMediaError(`Muitas mídias baixadas na última hora. Tente de novo em ${Math.ceil(rateLimit.retryAfterSeconds / 60)} min.`);

  const { maxBytes, timeoutMs } = LIMITS[input.kind];
  const deadline = Date.now() + timeoutMs;
  let incoming: IncomingMessage;
  try {
    incoming = await openPublicMedia(input.rawUrl, timeoutMs);
  } catch (error) {
    if (error instanceof UnsafeSiteAddressError) throw new RemoteMediaError("O link precisa ser público, em https e de um site (não endereço interno ou IP).");
    throw error;
  }

  try {
    const { head, hasEnded } = await readHead(incoming);
    const sniffed = sniffMediaType(head);
    if (!sniffed) throw new RemoteMediaError("O arquivo não é uma imagem JPG, PNG ou WebP, nem um vídeo MP4 ou MOV.");
    if (sniffed.kind !== input.kind) throw new RemoteMediaError(`O arquivo é ${sniffed.kind === "image" ? "uma imagem" : "um vídeo"}, mas foi enviado como kind=${input.kind}.`);

    const limited = limitStream(maxBytes, deadline, input.kind);
    limited.write(head);
    if (hasEnded) {
      limited.end();
    } else {
      incoming.on("error", (error) => limited.destroy(error));
      incoming.pipe(limited);
    }

    const key = `${isLocalUploadEnabled() ? LOCAL_UPLOAD_PREFIX : "external-ai/"}${input.organizationId}/${uuidv4()}.${sniffed.extension}`;
    if (isLocalUploadEnabled()) {
      await storeLocally(key, limited);
      return `${input.appOrigin}/${key}`;
    }
    await storeInBucket(key, sniffed.contentType, limited);
    return getPublicMediaUrl(key);
  } finally {
    incoming.destroy();
  }
}
