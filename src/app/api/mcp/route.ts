import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildServerInstructions } from "@/features/external-ai/server/mcp/apps";
import { authenticateMcpRequest } from "@/features/external-ai/server/mcp/authenticate";
import { protectedResourceMetadataUrl } from "@/features/external-ai/server/oauth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MCP do ÓRBITA (specs 0065 e 0135): sem estado, aceita chave `orb_live_` ou token OAuth; ferramentas vêm do registro de apps.

// Credencial só no cabeçalho, sem cookie: abrir para qualquer origem não expõe sessão (clientes MCP no navegador).
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "access-control-expose-headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorized(): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Conecte a sua conta do ÓRBITA (OAuth) ou use uma chave gerada em Satélites → IA externa." },
      id: null,
    },
    // O resource_metadata diz à IA onde fazer o login (RFC 9728, spec 0135 RF-4).
    { status: 401, headers: { "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl()}"` } },
  );
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const authenticated = await authenticateMcpRequest(request.headers.get("authorization"));
  if (!authenticated) return unauthorized();

  const { caller, apps } = authenticated;
  const server = new McpServer({ name: "orbita-planner", version: "1.0.0" }, { instructions: buildServerInstructions(apps) });
  for (const app of apps) app.register(server, caller);

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}

const handleWithCors = async (request: Request) => withCors(await handleMcpRequest(request));

export const POST = handleWithCors;
export const GET = handleWithCors;
export const DELETE = handleWithCors;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS_HEADERS });
