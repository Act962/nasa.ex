/**
 * Cliente do servidor MCP oficial de anúncios da Meta (spec 0125, RF-1).
 * Remoto (`https://mcp.facebook.com/ads`), token no cabeçalho, um cliente por pedido:
 * nada fica na memória do processo.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MetaGraphError, type MetaGraphErrorKind } from "./graph-client";

export const META_ADS_MCP_URL = "https://mcp.facebook.com/ads";
const CALL_TIMEOUT_MS = 30_000;

export interface AdsMcpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AdsMcpConnection {
  listTools(): Promise<AdsMcpToolInfo[]>;
  /** Devolve o conteúdo da ferramenta já lido (JSON quando der). Erro da Meta vira `MetaGraphError`. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

function classifyMcpErrorText(text: string): MetaGraphErrorKind {
  const lower = text.toLowerCase();
  if (/(token|oauth|session has expired|invalid access|code 190)/.test(lower)) return "token_invalid";
  if (/(rate limit|too many|throttl|code (4|17|32|613)\b)/.test(lower)) return "rate_limited";
  if (/(permission|not authorized|not allowed|rolled out|ads_mcp_management|code (10|200)\b)/.test(lower)) {
    return "permission";
  }
  if (/(temporar|timeout|unavailable|try again)/.test(lower)) return "transient";
  return "unknown";
}

function toMetaError(error: unknown): MetaGraphError {
  if (error instanceof MetaGraphError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { code?: number } | null)?.code;
  const kind: MetaGraphErrorKind =
    status === 401 ? "token_invalid" : status === 403 ? "permission" : status === 429 ? "rate_limited" : classifyMcpErrorText(message);
  return new MetaGraphError({ kind, message: `[MetaAdsMCP] ${message}` });
}

/** O conteúdo das ferramentas vem como blocos de texto; quase sempre JSON. */
export function readMcpToolContent(content: unknown): unknown {
  const blocks = Array.isArray(content) ? (content as { type?: string; text?: string }[]) : [];
  const texts = blocks.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text as string);
  if (texts.length === 0) return null;
  const joined = texts.join("\n");
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}

export async function connectAdsMcp(accessToken: string): Promise<AdsMcpConnection> {
  const transport = new StreamableHTTPClientTransport(new URL(META_ADS_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: "orbita-astro-meta-ads", version: "1.0.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close().catch(() => undefined);
    throw toMetaError(error);
  }

  return {
    async listTools() {
      try {
        const tools: AdsMcpToolInfo[] = [];
        let cursor: string | undefined;
        do {
          const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: CALL_TIMEOUT_MS });
          tools.push(
            ...page.tools.map((mcpTool) => ({
              name: mcpTool.name,
              description: mcpTool.description ?? "",
              inputSchema: mcpTool.inputSchema as Record<string, unknown>,
            })),
          );
          cursor = page.nextCursor;
        } while (cursor);
        return tools;
      } catch (error) {
        throw toMetaError(error);
      }
    },
    async callTool(name, args) {
      let result: Awaited<ReturnType<typeof client.callTool>>;
      try {
        result = await client.callTool({ name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS });
      } catch (error) {
        throw toMetaError(error);
      }
      const content = readMcpToolContent(result.content);
      if (result.isError) {
        const text = typeof content === "string" ? content : JSON.stringify(content);
        throw new MetaGraphError({ kind: classifyMcpErrorText(text), message: `[MetaAdsMCP] ${text}`.slice(0, 600) });
      }
      return content;
    },
    async close() {
      await client.close().catch(() => undefined);
    },
  };
}
