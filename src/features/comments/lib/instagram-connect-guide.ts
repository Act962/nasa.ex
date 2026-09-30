// Guia "Conectar Instagram" do COMMENTS (spec 0047): as telas da Meta com o
// print, o alvo da seta vermelha e os balões do Astro. Os dados moram no JSON
// para o script de prints (scripts/guides) ler o mesmo.

import type { MetaGuideDefinition, MetaGuideStep } from "@/features/meta-guide/lib/types";
import guideData from "./instagram-connect-guide.json";

export type InstagramGuideCopyKey = "privacyUrl" | "callbackUrl" | "verifyToken";

export const INSTAGRAM_GUIDE_STEPS = guideData.steps as MetaGuideStep[];

/** Primeiro passo das chaves: onde "Já tenho o app" e "Trocar conta" começam. */
export const FIRST_KEY_STEP_SLUG = "id-conta";
export const CONNECT_STEP_SLUG = "conectar";

/** Em qual passo cada chave é colada — o mesmo em que ela é copiada na Meta. */
export const KEY_STEP_SLUGS = {
  accountId: "id-conta",
  accessToken: "copiar-token",
  appSecret: "chave-secreta",
} as const;

export const INSTAGRAM_GUIDE: MetaGuideDefinition = {
  id: "instagram-comments-guide",
  imageBasePath: "/guides/instagram-comments",
  phases: guideData.phases,
  steps: INSTAGRAM_GUIDE_STEPS,
  milestones: [
    { percent: 25, headline: "Bom começo! Um quarto do caminho já foi." },
    { percent: 50, headline: "Metade feita! Você está indo muito bem." },
    { percent: 75, headline: "Falta pouco para a ÓRBITA responder seus comentários sozinha." },
    { percent: 100, headline: "Instagram conectado! Agora é criar sua primeira automação." },
  ],
  copyLabels: {
    privacyUrl: "URL da Política de Privacidade",
    callbackUrl: "URL de callback",
    verifyToken: "Verificar token",
  },
};

const INSTAGRAM_ACCOUNT_ID_PATTERN = /^\d{15,20}$/;
const APP_SECRET_PATTERN = /^[a-f0-9]{32}$/i;
const MIN_ACCESS_TOKEN_LENGTH = 40;

export function isInstagramAccountIdValid(value: string): boolean {
  return INSTAGRAM_ACCOUNT_ID_PATTERN.test(value.trim());
}

export function isAppSecretValid(value: string): boolean {
  return APP_SECRET_PATTERN.test(value.trim());
}

export function isAccessTokenValid(value: string): boolean {
  return value.trim().length >= MIN_ACCESS_TOKEN_LENGTH;
}

/** O ID da conta profissional começa com 1784; o do app do Instagram, não. */
export function looksLikeInstagramAppId(value: string): boolean {
  return isInstagramAccountIdValid(value) && !value.trim().startsWith("1784");
}

/** Segredo de handshake do webhook: a ÓRBITA gera, o cliente só copia (spec 0047, D-3). */
export function generateVerifyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `orbita-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
