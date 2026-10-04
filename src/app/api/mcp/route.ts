import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateExternalAiToken } from "@/features/external-ai/server/access-tokens";
import { registerPlannerMcpTools } from "@/features/external-ai/server/mcp/planner-mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP do ÓRBITA para IAs externas (spec 0065, RF-2). Sem estado (D-2): servidor e transporte novos por
 * requisição, resposta em JSON. Autenticação por chave Bearer da empresa (D-1).
 */

const SERVER_INSTRUCTIONS =
  "Você está conectado ao Planner do ÓRBITA. Fluxo: list_clients → get_brand_kit (siga a voz, as cores e as hashtags) → list_open_slots → create_draft → arte (get_video_templates: modelos Remotion com a marca, renderizados no seu computador) → request_upload_url → attach_media → submit_for_approval. Aprovar, programar e publicar é sempre de uma pessoa no ÓRBITA. Use get_review_feedback para ler pedidos de ajuste.";

async function handleMcpRequest(request: Request): Promise<Response> {
  const caller = await authenticateExternalAiToken(request.headers.get("authorization"));
  if (!caller) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Chave de acesso inválida ou revogada. Gere uma em Satélites → IA externa." }, id: null },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const server = new McpServer({ name: "orbita-planner", version: "1.0.0" }, { instructions: SERVER_INSTRUCTIONS });
  registerPlannerMcpTools(server, caller);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}

export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;
