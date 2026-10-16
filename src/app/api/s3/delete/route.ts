import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteStoredObject } from "@/lib/s3-client";
import {
  getUploadTokenSecret,
  isUploadDeleteTokenValid,
} from "@/lib/security/upload-delete-token";

const MAX_KEY_LENGTH = 512;

/**
 * Apaga um arquivo do bucket. Exige sessão ou o token de exclusão devolvido
 * no upload daquele arquivo (visitante de formulário público não tem sessão).
 */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    deleteToken?: unknown;
  } | null;
  const objectKey = body?.key;

  if (typeof objectKey !== "string" || !objectKey || objectKey.length > MAX_KEY_LENGTH) {
    return NextResponse.json({ error: "Missing or invalid object key" }, { status: 400 });
  }

  const deleteToken = typeof body?.deleteToken === "string" ? body.deleteToken : null;
  const hasValidDeleteToken = isUploadDeleteTokenValid(objectKey, deleteToken, getUploadTokenSecret());
  if (!hasValidDeleteToken) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
  }

  const isDeleted = await deleteStoredObject(objectKey);
  if (!isDeleted) {
    return NextResponse.json({ error: "Falha ao apagar o arquivo" }, { status: 502 });
  }

  return NextResponse.json({ message: "File deleted successfully" }, { status: 200 });
}
