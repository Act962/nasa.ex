import { z } from "zod";

/**
 * Validação centralizada das variáveis de ambiente do projeto.
 *
 * - Servidor: valida todas as variáveis (server + client).
 * - Browser: valida apenas as variáveis com prefixo `NEXT_PUBLIC_`, já que o
 *   Next.js só inlining essas no bundle do cliente.
 *
 * Importe via `import { env } from "@/lib/env"`. Acessar uma variável de
 * servidor a partir de um Client Component dispara erro em runtime.
 *
 * Para pular a validação em builds especiais (ex: Docker layer cache),
 * defina `SKIP_ENV_VALIDATION=true`.
 */

const isServer = typeof window === "undefined";

const requiredString = z.string().min(1, "obrigatória");
const optionalString = z.string().min(1).optional();
const optionalUrl = z.url().optional();
const optionalNumberFromString = z.coerce.number().int().nonnegative().optional();

const serverSchema = z.object({
  // Node
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SKIP_ENV_VALIDATION: z.string().optional(),

  // Database
  DATABASE_URL: z.url(),

  // Better Auth
  BETTER_AUTH_SECRET: requiredString,
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_EMAIL: optionalString,
  AUTH_SECRET: optionalString,
  TRUSTED_ORIGINS: optionalString,

  // Google OAuth (login do usuário)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  // Google OAuth (integrações de calendar/ads do tracking)
  GOOGLE_INTEGRATIONS_CLIENT_ID: optionalString,
  GOOGLE_INTEGRATIONS_CLIENT_SECRET: optionalString,
  GOOGLE_INTEGRATIONS_REDIRECT_URI: optionalUrl,
  GOOGLE_ADS_DEVELOPER_TOKEN: optionalString,
  GOOGLE_FONTS_API_KEY: optionalString,

  // Meta / Facebook
  FACEBOOK_APP_ID: optionalString,
  FACEBOOK_APP_SECRET: optionalString,
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_OAUTH_REDIRECT_URI: optionalUrl,
  META_WEBHOOK_VERIFY_TOKEN: optionalString,
  META_MCP_SERVER_CMD: optionalString,

  // Resend (e-mail)
  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: optionalString,

  // Stripe — sistema (planos, recargas, webhooks da plataforma)
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_COURSE_WEBHOOK_SECRET: optionalString,
  STRIPE_STARS_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_EARTH: optionalString,
  STRIPE_PRICE_EXPLORE: optionalString,
  STRIPE_PRICE_CONSTELLATION: optionalString,
  STRIPE_PRICE_TOPUP_100: optionalString,
  STRIPE_PRICE_TOPUP_500: optionalString,
  STRIPE_PRICE_TOPUP_1000: optionalString,

  // AWS / R2 (storage)
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_ENDPOINT_URL_S3: optionalUrl,
  AWS_REGION: optionalString,
  AWS_BUCKET_NAME: optionalString,
  R2_NASA_ROUTE_BUCKET: optionalString,

  // Pusher (server)
  PUSHER_APP_ID: optionalString,
  PUSHER_SECRET: optionalString,

  // LiveKit
  LIVEKIT_WS_URL: optionalUrl,
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,

  // IA / LLM providers
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  IDEOGRAM_API_KEY: optionalString,
  FAL_API_KEY: optionalString,
  REPLICATE_API_TOKEN: optionalString,
  LLM_KEY: optionalString,
  AGENT_DEFAULT_MODEL: optionalString,
  ASTRO_DEFAULT_MODEL: optionalString,
  AI_SECRETS_KEY: z
    .string()
    .min(16, "AI_SECRETS_KEY precisa de pelo menos 16 caracteres")
    .optional(),

  // UAZAPI (WhatsApp)
  UAZAPI_TOKEN: optionalString,

  // NERP (ERP integration)
  NERP_BASE_URL: optionalUrl,
  NERP_SYNC_BASE_URL: optionalUrl,
  NERP_CLIENT_ID: optionalString,
  NERP_CLIENT_SECRET: optionalString,
  NERP_OAUTH_AUTHORIZE_PATH: optionalString,
  NERP_OAUTH_EXCHANGE_PATH: optionalString,
  NERP_REQUEST_TIMEOUT_MS: optionalNumberFromString,

  // Comments app
  COMMENTS_APP_BASE_URL: optionalUrl,
  COMMENTS_REQUEST_TIMEOUT_MS: optionalNumberFromString,
  COMMENTS_OAUTH_AUTHORIZE_PATH: optionalString,
  COMMENTS_OAUTH_EXCHANGE_PATH: optionalString,
  NASA_COMMENTS_CLIENT_ID: optionalString,
  NASA_COMMENTS_CLIENT_SECRET: optionalString,

  // Sync NASA ↔ NERP (HMAC app-to-app)
  SYNC_SHARED_SECRET: optionalString,
  SYNC_API_KEY: optionalString,
  SYNC_REQUEST_TIMEOUT_MS: optionalNumberFromString,

  // Inngest
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,

  // Diversos
  CRON_SECRET: optionalString,
  PAYMENT_MASTER_HASH: optionalString,
  FINGERPRINT_SALT: optionalString,
  KICKOFF_CALENDAR_LINK: optionalUrl,
  CALENDAR_REPORT_SCORE_THRESHOLD: optionalNumberFromString,
  NOMINATIM_USER_AGENT: optionalString,
  PIPER_HTTP_URL: optionalUrl,
  WEBHOOK_AI_AGENT_N8N: optionalUrl,
  VERCEL_URL: optionalString,
});

const clientSchema = z.object({
  // URLs públicas
  NEXT_PUBLIC_BASE_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_PRIMARY_HOST: optionalString,

  // Storage público (R2/S3)
  NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES: optionalString,
  NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL: optionalString,
  NEXT_PUBLIC_S3_PUBLIC_URL: optionalString,
  NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL: optionalString,

  // Pusher (client key + cluster são públicos por design)
  NEXT_PUBLIC_PUSHER_APP_KEY: optionalString,
  NEXT_PUBLIC_PUSHER_CLUSTER: optionalString,

  // LiveKit
  NEXT_PUBLIC_LIVEKIT_URL: optionalUrl,

  // PostHog
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,

  // UAZAPI (URL do tenant)
  NEXT_PUBLIC_UAZAPI_BASE_URL: optionalUrl,

  // NERP (subdomínio público)
  NEXT_PUBLIC_NERP_DOMAIN: optionalString,

  // Stripe (price IDs públicos de marketplace)
  NEXT_PUBLIC_STRIPE_PRICE_WHATSAPP: optionalString,
  NEXT_PUBLIC_STRIPE_PRICE_INSTAGRAM: optionalString,
  NEXT_PUBLIC_STRIPE_PRICE_TIKTOK: optionalString,
  NEXT_PUBLIC_STRIPE_PRICE_LINKEDIN: optionalString,

  // Astro voice
  NEXT_PUBLIC_PIPER_ENABLED: optionalString,
});

// IMPORTANTE: Next.js só consegue inlining `process.env.NEXT_PUBLIC_*` quando o
// acesso é literal. Por isso esses valores precisam ser enumerados aqui (e não
// lidos via `Object.entries(process.env)`).
const clientEnv = {
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PRIMARY_HOST: process.env.NEXT_PUBLIC_PRIMARY_HOST,
  NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
  NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL: process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL,
  NEXT_PUBLIC_S3_PUBLIC_URL: process.env.NEXT_PUBLIC_S3_PUBLIC_URL,
  NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_NASA_ROUTE_PUBLIC_URL,
  NEXT_PUBLIC_PUSHER_APP_KEY: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
  NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_UAZAPI_BASE_URL: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
  NEXT_PUBLIC_NERP_DOMAIN: process.env.NEXT_PUBLIC_NERP_DOMAIN,
  NEXT_PUBLIC_STRIPE_PRICE_WHATSAPP: process.env.NEXT_PUBLIC_STRIPE_PRICE_WHATSAPP,
  NEXT_PUBLIC_STRIPE_PRICE_INSTAGRAM: process.env.NEXT_PUBLIC_STRIPE_PRICE_INSTAGRAM,
  NEXT_PUBLIC_STRIPE_PRICE_TIKTOK: process.env.NEXT_PUBLIC_STRIPE_PRICE_TIKTOK,
  NEXT_PUBLIC_STRIPE_PRICE_LINKEDIN: process.env.NEXT_PUBLIC_STRIPE_PRICE_LINKEDIN,
  NEXT_PUBLIC_PIPER_ENABLED: process.env.NEXT_PUBLIC_PIPER_ENABLED,
} as const;

const mergedSchema = z.object({ ...serverSchema.shape, ...clientSchema.shape });

type Env = z.infer<typeof mergedSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function loadEnv(): Env | ClientEnv {
  const skip = process.env.SKIP_ENV_VALIDATION;
  if (skip && skip !== "false" && skip !== "0") {
    return (isServer ? process.env : clientEnv) as unknown as Env;
  }

  if (isServer) {
    const parsed = mergedSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error(
        `\n❌ Variáveis de ambiente inválidas:\n${formatIssues(parsed.error)}\n`,
      );
      throw new Error("Invalid environment variables");
    }
    return parsed.data;
  }

  const parsed = clientSchema.safeParse(clientEnv);
  if (!parsed.success) {
    console.error(
      `\n❌ Variáveis de ambiente públicas inválidas:\n${formatIssues(parsed.error)}\n`,
    );
    throw new Error("Invalid public environment variables");
  }
  return parsed.data;
}

const loaded = loadEnv();

/**
 * Variáveis de ambiente validadas e tipadas.
 *
 * No browser, qualquer acesso a uma var sem prefixo `NEXT_PUBLIC_` lança erro
 * — isso protege contra vazamento acidental de segredos pro bundle do cliente.
 */
export const env = new Proxy(loaded as Env, {
  get(target, prop) {
    if (typeof prop !== "string") return Reflect.get(target, prop);
    if (!isServer && !prop.startsWith("NEXT_PUBLIC_")) {
      throw new Error(
        `❌ Tentativa de ler env.${prop} no cliente. Apenas variáveis NEXT_PUBLIC_* são expostas ao browser.`,
      );
    }
    return Reflect.get(target, prop);
  },
}) as Env;

export type { Env, ClientEnv };
