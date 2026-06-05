import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Webhook da API Oficial do WhatsApp (WhatsApp Cloud API / Meta Graph API).
 *
 * Fluxo conforme a doc da Meta:
 * - GET  → handshake de verificação do endpoint (hub.mode / hub.verify_token / hub.challenge)
 * - POST → notificações de eventos (mensagens, status, etc), autenticadas via
 *          header `X-Hub-Signature-256` (HMAC SHA256 do corpo cru usando o App Secret)
 *
 * Variáveis de ambiente necessárias:
 * - WHATSAPP_VERIFY_TOKEN → token arbitrário cadastrado no painel da Meta (Webhook → Verify token)
 * - WHATSAPP_APP_SECRET   → App Secret do app Meta (Configurações → Básico), usado pra validar a assinatura
 */

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

/**
 * Verificação do webhook (GET).
 * A Meta chama esta rota uma vez ao cadastrar o webhook no painel. Devemos conferir
 * que `hub.mode === "subscribe"` e que `hub.verify_token` bate com o token configurado,
 * então ecoar de volta o `hub.challenge` com status 200.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    console.error("[whatsapp-oficial] WHATSAPP_VERIFY_TOKEN não configurado");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const isVerificationValid =
    mode === "subscribe" && verifyToken === VERIFY_TOKEN && challenge !== null;

  if (isVerificationValid) {
    // O challenge precisa voltar como texto puro, não JSON.
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Confere a assinatura `X-Hub-Signature-256` enviada pela Meta.
 * A assinatura é `sha256=<hmac>`, onde o hmac é HMAC-SHA256 do corpo cru da requisição
 * usando o App Secret como chave. Comparação em tempo constante pra evitar timing attack.
 */
function isSignatureValid(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader) return false;

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(rawBody, "utf-8").digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Recebimento de notificações (POST).
 * Lemos o corpo cru pra validar a assinatura antes de fazer parse do JSON, e sempre
 * respondemos 200 rapidamente — a Meta reenvia caso não receba 200 dentro do timeout.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!isSignatureValid(rawBody, signatureHeader)) {
    console.warn("[whatsapp-oficial] Assinatura inválida — requisição rejeitada");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Só processamos notificações de contas WhatsApp Business.
  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // Mensagens recebidas dos contatos.
        for (const message of value?.messages ?? []) {
          const contact = value?.contacts?.find(
            (candidate) => candidate.wa_id === message.from,
          );
          console.log("[whatsapp-oficial] Mensagem recebida", {
            phoneNumberId: value?.metadata?.phone_number_id,
            from: message.from,
            name: contact?.profile?.name,
            type: message.type,
            text: message.text?.body,
            messageId: message.id,
          });
          // TODO: persistir lead/conversa/mensagem (ver padrão em
          // src/app/api/integrations/facebook/webhook/route.ts).
        }

        // Atualizações de status de mensagens enviadas (sent/delivered/read/failed).
        for (const status of value?.statuses ?? []) {
          console.log("[whatsapp-oficial] Status de mensagem", {
            messageId: status.id,
            recipientId: status.recipient_id,
            status: status.status,
          });
          // TODO: atualizar status da mensagem no banco.
        }
      }
    }
  } catch (error) {
    console.error("[whatsapp-oficial] Erro ao processar webhook:", error);
    // Mesmo em erro respondemos 200 pra Meta não ficar reenviando indefinidamente;
    // o erro já está logado pra investigação.
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// --- Tipos do payload do webhook (WhatsApp Cloud API) ---

interface WhatsAppWebhookPayload {
  object: string;
  entry?: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes?: WhatsAppChange[];
}

interface WhatsAppChange {
  field: string;
  value?: WhatsAppChangeValue;
}

interface WhatsAppChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppContact {
  wa_id: string;
  profile?: { name?: string };
}

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppStatus {
  id: string;
  recipient_id: string;
  status: string;
  timestamp: string;
}
