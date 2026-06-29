import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Fallback local upload — only used when S3 is not configured.
// Files are saved to /public/uploads/ and served as static assets.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"];
    if (!ALLOWED.includes(file.type) && !file.name.endsWith(".svg")) {
      return NextResponse.json({ error: `Tipo não suportado: ${file.type}` }, { status: 400 });
    }

    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
      return NextResponse.json({ error: "Arquivo muito grande. Máx 10MB." }, { status: 400 });
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
