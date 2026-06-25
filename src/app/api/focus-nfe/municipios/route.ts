import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listarMunicipios } from "@/http/focus-nfe/listar-municipios";
import type { FocusMunicipioParams } from "@/http/focus-nfe/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;

  const params: FocusMunicipioParams = {
    nome: searchParams.get("nome") ?? undefined,
    uf: searchParams.get("uf") ?? undefined,
    codigo_ibge: searchParams.get("codigo_ibge") ?? undefined,
    habilita_nfse: searchParams.get("habilita_nfse") === "1" ? 1 : undefined,
  };

  try {
    const municipios = await listarMunicipios(params, "HOMOLOGACAO");
    console.log("municipios:", municipios);
    return NextResponse.json(municipios);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
