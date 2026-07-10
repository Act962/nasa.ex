// Registry aberto de gateways fiscais (mesmo padrão de
// src/features/tracking-chat/lib/providers/factory.ts). Adicionar um novo
// gateway = novo adapter que chama registerGateway ao ser importado pelo
// barrel index.ts — sem tocar em handlers.

import type { FiscalGateway } from "@/generated/prisma/enums";
import type { FiscalGatewayAdapter } from "./types";

const registry = new Map<FiscalGateway, FiscalGatewayAdapter>();

export function registerGateway(adapter: FiscalGatewayAdapter): void {
  registry.set(adapter.id, adapter);
}

export class UnknownGatewayError extends Error {
  constructor(gatewayId: string) {
    super(
      `Gateway fiscal "${gatewayId}" não está registrado. ` +
        `Registrados: [${Array.from(registry.keys()).join(", ") || "nenhum"}]`,
    );
    this.name = "UnknownGatewayError";
  }
}

export function resolveGateway(gatewayId: FiscalGateway): FiscalGatewayAdapter {
  const adapter = registry.get(gatewayId);
  if (!adapter) throw new UnknownGatewayError(gatewayId);
  return adapter;
}

export function resolveGatewayForInvoice(invoice: {
  gateway: FiscalGateway;
}): FiscalGatewayAdapter {
  return resolveGateway(invoice.gateway);
}
