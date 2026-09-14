/** Base pública do app para links em e-mail/WhatsApp (mesma regra do Inngest de compra). */
export function resolveTrafegoBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    ""
  ).replace(/\/$/, "");
}

export function trafegoPanelUrl(orderId: string): string {
  return `${resolveTrafegoBaseUrl()}/trafego/painel/${orderId}`;
}

export function trafegoActivationUrl(signupToken: string): string {
  return `${resolveTrafegoBaseUrl()}/trafego/ativar/${signupToken}`;
}
