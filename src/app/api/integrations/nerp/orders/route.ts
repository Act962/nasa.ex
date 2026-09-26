import { NextResponse } from "next/server";
import { verifyNerpRequest } from "@/features/nerp-catalog/lib/verify-nerp-request";
import { nerpCatalogOrderPayloadSchema } from "@/features/nerp-catalog/schemas/order-payload";
import {
  CatalogIntegrationInactiveError,
  receiveCatalogOrder,
} from "@/features/nerp-catalog/lib/receive-order";

// Entrada dos pedidos do Catálogo online do NERP. Assinado com o par
// apiKey/secret da integração NERP da org. Idempotente por `nerpSaleId`.
export async function POST(request: Request) {
  const verification = await verifyNerpRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(verification.value.rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const payload = nerpCatalogOrderPayloadSchema.safeParse(parsedBody);
  if (!payload.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    const response = await receiveCatalogOrder(
      verification.value.organizationId,
      payload.data,
    );
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof CatalogIntegrationInactiveError) {
      return NextResponse.json({ error: "catalog_integration_inactive" }, { status: 409 });
    }
    console.error("[nerp/orders] falha ao receber pedido", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
