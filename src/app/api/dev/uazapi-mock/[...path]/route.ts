/**
 * Uazapi falsa para testar o Chat sem WhatsApp real (só desenvolvimento).
 *
 * Uma instância de teste aponta o `baseUrl` para cá (ver `prisma/seed-gothan-chat.ts --sandbox-instance`).
 * O envio percorre o caminho real do app — salva a mensagem, dispara gatilhos — mas nada sai para o WhatsApp.
 * Em produção a rota responde 404.
 */
import { NextResponse, type NextRequest } from "next/server";

type RouteContext = { params: Promise<{ path: string[] }> };
type MockPayload = Record<string, unknown>;

const SANDBOX_PHONE = "5586900000000";
const SANDBOX_JID = `${SANDBOX_PHONE}@s.whatsapp.net`;

function isMockEnabled() {
  return process.env.NODE_ENV !== "production";
}

function buildSentMessage(payload: MockPayload, messageType: string) {
  const externalId = `sandbox-${crypto.randomUUID()}`;
  const recipient = String(payload.number ?? "");
  return {
    id: externalId,
    messageid: externalId,
    chatid: recipient.includes("@") ? recipient : `${recipient}@s.whatsapp.net`,
    sender: SANDBOX_JID,
    senderName: "Sandbox",
    isGroup: false,
    fromMe: true,
    messageType,
    source: "sandbox",
    messageTimestamp: Date.now(),
    status: "Sent",
    text: typeof payload.text === "string" ? payload.text : "",
  };
}

async function readPayload(request: NextRequest): Promise<MockPayload> {
  try {
    return (await request.json()) as MockPayload;
  } catch {
    return {};
  }
}

async function handleMock(request: NextRequest, context: RouteContext) {
  if (!isMockEnabled()) return new NextResponse(null, { status: 404 });

  const { path } = await context.params;
  const endpoint = `/${path.join("/")}`;
  const payload = request.method === "GET" ? {} : await readPayload(request);

  if (endpoint === "/instance/status") {
    return NextResponse.json({
      instance: { id: "sandbox", status: "connected", name: "Sandbox", profileName: "Sandbox" },
      status: { connected: true, loggedIn: true, jid: SANDBOX_JID },
    });
  }

  if (endpoint.startsWith("/send/")) {
    const messageType = endpoint.replace("/send/", "");
    return NextResponse.json(buildSentMessage(payload, messageType));
  }

  return NextResponse.json({ success: true, sandbox: true, endpoint });
}

export const GET = handleMock;
export const POST = handleMock;
export const PUT = handleMock;
export const PATCH = handleMock;
export const DELETE = handleMock;
