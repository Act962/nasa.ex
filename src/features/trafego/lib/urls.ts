import { resolvePublicOrigin } from "@/lib/public-origin";

export function trafegoPanelUrl(orderId: string): string {
  return `${resolvePublicOrigin()}/trafego/painel/${orderId}`;
}

export function trafegoActivationUrl(signupToken: string): string {
  return `${resolvePublicOrigin()}/trafego/ativar/${signupToken}`;
}
