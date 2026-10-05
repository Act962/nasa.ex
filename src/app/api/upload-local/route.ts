import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Fallback local upload — only used when S3 is not configured.
// Files are saved to /public/uploads/ and served as static assets.

const DEV_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const DEV_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"];
    // Vídeo só em desenvolvimento: sem R2 local, é o único jeito de testar Reel e Story em vídeo.
    const isDevVideo = process.env.NODE_ENV !== "production" && DEV_VIDEO_TYPES.includes(file.type);
    if (!ALLOWED.includes(file.type) && !file.name.endsWith(".svg") && !isDevVideo) {
      return NextResponse.json({ error: `Tipo não suportado: ${file.type}` }, { status: 400 });
    }

    const MAX = isDevVideo ? DEV_VIDEO_MAX_BYTES : 10 * 1024 * 1024;
    if (file.size > MAX) {
      return NextResponse.json({ error: `Arquivo muito grande. Máx ${Math.round(MAX / 1024 / 1024)}MB.` }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${uuidv4()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadDir = join(process.cwd(), "public", "uploads");
    await writeFile(join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("[upload-local]", err);
    return NextResponse.json({ error: "Erro ao salvar arquivo" }, { status: 500 });
  }
}
