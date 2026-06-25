import { NextRequest, NextResponse } from "next/server";
import { consultarCnpj, CnpjWsError } from "@/http/cnpj-ws/client";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const { cnpj } = await params;
  const digits = cnpj.replace(/\D/g, "");

  if (digits.length !== 14) {
    return NextResponse.json({ error: "CNPJ deve ter 14 dígitos" }, { status: 400 });
  }

  try {
    const data = await consultarCnpj(digits);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof CnpjWsError) {
      const httpStatus = err.status === 404 ? 404 : err.status === 429 ? 429 : 422;
      return NextResponse.json({ error: err.message }, { status: httpStatus });
    }
    return NextResponse.json({ error: "Erro interno ao consultar CNPJ" }, { status: 500 });
  }
}
