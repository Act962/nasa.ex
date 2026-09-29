import { createHash } from "node:crypto";
import { APPS } from "@/features/apps/components/apps-data";
import { ORBITA_COOKIES } from "./orbita-cookies";

/**
 * Inventário que alimenta Privacidade, Cookies e Termos do Órbita. As páginas
 * não têm lista fixa: apps saem do catálogo, cookies do registro e fornecedores
 * das integrações configuradas no ambiente.
 */

export type SubprocessorPurpose =
  | "infrastructure"
  | "payments"
  | "communication"
  | "artificial-intelligence"
  | "analytics";

export interface OrbitaSubprocessor {
  name: string;
  purpose: SubprocessorPurpose;
  description: string;
  /** Integração ligada quando alguma destas variáveis existe; vazio = sempre. */
  enabledByEnv: string[];
}

export const SUBPROCESSOR_PURPOSE_LABELS: Record<SubprocessorPurpose, string> = {
  infrastructure: "Infraestrutura",
  payments: "Pagamentos",
  communication: "Comunicação",
  "artificial-intelligence": "Inteligência artificial",
  analytics: "Análise de uso",
};

const SUBPROCESSORS: OrbitaSubprocessor[] = [
  { name: "Banco de dados PostgreSQL", purpose: "infrastructure", description: "Armazena os dados da plataforma.", enabledByEnv: ["DATABASE_URL"] },
  { name: "Armazenamento de arquivos (S3/R2)", purpose: "infrastructure", description: "Guarda anexos, imagens e documentos.", enabledByEnv: ["AWS_ACCESS_KEY_ID"] },
  { name: "Inngest", purpose: "infrastructure", description: "Executa automações e tarefas em segundo plano.", enabledByEnv: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"] },
  { name: "LiveKit", purpose: "infrastructure", description: "Áudio e vídeo em tempo real na Space Station.", enabledByEnv: ["LIVEKIT_API_KEY"] },
  { name: "Stripe", purpose: "payments", description: "Processa pagamentos por cartão e assinaturas.", enabledByEnv: ["STRIPE_SECRET_KEY"] },
  { name: "Asaas", purpose: "payments", description: "Processa cobranças por PIX.", enabledByEnv: ["ASAAS_API_KEY"] },
  { name: "Resend", purpose: "communication", description: "Envia e-mails transacionais.", enabledByEnv: ["RESEND_API_KEY"] },
  { name: "Pusher", purpose: "communication", description: "Entrega notificações e mensagens em tempo real.", enabledByEnv: ["PUSHER_APP_ID"] },
  { name: "Meta (WhatsApp Business e Instagram)", purpose: "communication", description: "Envia e recebe mensagens e comentários conectados pela sua empresa.", enabledByEnv: [] },
  { name: "Uazapi", purpose: "communication", description: "Conecta números de WhatsApp não oficiais.", enabledByEnv: ["UAZAPI_TOKEN"] },
  { name: "Web Push", purpose: "communication", description: "Envia notificações para o seu navegador.", enabledByEnv: ["VAPID_PRIVATE_KEY"] },
  { name: "OpenAI", purpose: "artificial-intelligence", description: "Gera respostas do ASTRO e de outras funções de IA.", enabledByEnv: ["OPENAI_API_KEY"] },
  { name: "Anthropic", purpose: "artificial-intelligence", description: "Gera respostas do ASTRO e de outras funções de IA.", enabledByEnv: ["ANTHROPIC_API_KEY"] },
  { name: "Google (Gemini)", purpose: "artificial-intelligence", description: "Gera respostas e analisa conteúdo com IA.", enabledByEnv: ["GOOGLE_GENERATIVE_AI_API_KEY"] },
  { name: "Ideogram", purpose: "artificial-intelligence", description: "Gera imagens a pedido do usuário.", enabledByEnv: ["IDEOGRAM_API_KEY"] },
  { name: "Google (login)", purpose: "infrastructure", description: "Permite entrar com a conta Google.", enabledByEnv: ["GOOGLE_CLIENT_ID"] },
  { name: "PostHog", purpose: "analytics", description: "Mede o uso da plataforma, somente com o seu consentimento.", enabledByEnv: ["NEXT_PUBLIC_POSTHOG_KEY"] },
];

export interface OrbitaAppSummary {
  name: string;
  description: string;
}

export function listPublishedApps(): OrbitaAppSummary[] {
  return APPS.filter((app) => app.status !== "development")
    .map((app) => ({ name: app.name, description: app.shortDesc }))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

export function listActiveSubprocessors(): OrbitaSubprocessor[] {
  return SUBPROCESSORS.filter(
    (subprocessor) =>
      subprocessor.enabledByEnv.length === 0 ||
      subprocessor.enabledByEnv.some((envName) => Boolean(process.env[envName])),
  );
}

export function listAllSubprocessorNames(): string[] {
  return SUBPROCESSORS.map((subprocessor) => subprocessor.name);
}

export function groupSubprocessorsByPurpose(subprocessors: OrbitaSubprocessor[]) {
  return (Object.keys(SUBPROCESSOR_PURPOSE_LABELS) as SubprocessorPurpose[])
    .map((purpose) => ({
      purpose,
      label: SUBPROCESSOR_PURPOSE_LABELS[purpose],
      subprocessors: subprocessors.filter((subprocessor) => subprocessor.purpose === purpose),
    }))
    .filter((group) => group.subprocessors.length > 0);
}

/**
 * Impressão digital do que as políticas descrevem. Muda sempre que entra ou
 * sai um app, cookie ou fornecedor — é o que dispara uma nova revisão.
 * Usa a lista completa de fornecedores (não a do ambiente) para ser a mesma
 * em dev, build e produção.
 */
export function computeInventoryFingerprint(): string {
  const inventorySnapshot = {
    apps: listPublishedApps(),
    cookies: ORBITA_COOKIES,
    subprocessors: SUBPROCESSORS,
  };
  return createHash("sha256").update(JSON.stringify(inventorySnapshot)).digest("hex").slice(0, 16);
}
