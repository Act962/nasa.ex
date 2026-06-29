import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Body parser must be disabled for streaming large files
export const runtime = "nodejs";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  const missingVars: string[] = [];
  if (!process.env.AWS_ENDPOINT_URL_S3) missingVars.push("AWS_ENDPOINT_URL_S3");
  if (!process.env.AWS_ACCESS_KEY_ID) missingVars.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missingVars.push("AWS_SECRET_ACCESS_KEY");
  if (!process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES) missingVars.push("NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES");

  if (missingVars.length > 0) {
    return NextResponse.json({ error: "S3 não configurado: " + missingVars.join(", ") }, { status: 503 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "video/mp4";
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    const filename = req.headers.get("x-filename") ?? "video.mp4";

    if (contentLength > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Limite: 500 MB." }, { status: 413 });
    }

    const ext = filename.split(".").pop() ?? "mp4";
    const key = `nasa-planner/videos/${uuidv4()}.${ext}`;

    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.AWS_ENDPOINT_URL_S3!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
    });

    if (!req.body) {
      return NextResponse.json({ error: "Body vazio" }, { status: 400 });
    }

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: key,
        Body: req.body as any,
        ContentType: contentType,
        ContentLength: contentLength || undefined,
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024, // 10 MB parts
    });

    await upload.done();

    return NextResponse.json({ key });
  } catch (error) {
    console.error("[s3/upload-video]", error);
    return NextResponse.json({ error: "Erro ao fazer upload do vídeo" }, { status: 500 });
  }
}
