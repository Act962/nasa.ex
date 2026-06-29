import { spawn, type ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MetaAuth } from "@/http/meta/ads-management";

/**
 * Handle pra um servidor MCP da Meta rodando como subprocesso.
 *
 * O comando exato vem de `META_MCP_SERVER_CMD` (env var). Quando não setada,
 * o `client.ts` usa modo direto (Marketing API) e este módulo nem é chamado.
 *
 * Exemplo de comando:
 *   META_MCP_SERVER_CMD="npx -y @meta/ads-mcp"
 *
 * Cada org ativa pode ter seu próprio handle (token diferente). Recomenda-se
 * pool com TTL de inatividade no chamador (não implementado aqui — Etapa 2).
 */

export type McpServerHandle = {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
};

export async function spawnMetaMcpServer(auth: MetaAuth): Promise<McpServerHandle> {
  const cmd = process.env.META_MCP_SERVER_CMD;
  if (!cmd) {
    throw new Error(
      "META_MCP_SERVER_CMD não definido. Use modo direto ou configure o servidor MCP da Meta.",
    );
  }

  const [bin, ...args] = cmd.split(" ");
  const child: ChildProcess = spawn(bin, args, {
    env: {
      ...process.env,
      META_ACCESS_TOKEN: auth.accessToken,
      META_AD_ACCOUNT_ID: auth.adAccountId,
      // Outras envs específicas do MCP server da Meta entram aqui
      // conforme a documentação oficial do package.
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr?.on("data", (chunk) => {
    // eslint-disable-next-line no-console
    console.warn("[meta-mcp]", chunk.toString());
  });

  const transport = new StdioClientTransport({
    command: bin,
    args,
    env: {
      META_ACCESS_TOKEN: auth.accessToken,
      META_AD_ACCOUNT_ID: auth.adAccountId,
    },
  });

  const client = new Client(
    { name: "nasa-meta-mcp-bridge", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  return {
    async callTool(name, params) {
      const result = await client.callTool({ name, arguments: params });
      // O resultado pode vir em `content` array ou direto. Normalizamos.
      if (result.isError) {
        const errMsg =
          (Array.isArray(result.content) &&
            result.content[0]?.type === "text" &&
            result.content[0].text) ||
          "MCP tool error";
        throw new Error(`[meta-mcp:${name}] ${errMsg}`);
      }
      // Quando o tool retorna structuredContent, é o JSON da resposta
      if ("structuredContent" in result && result.structuredContent) {
        return result.structuredContent;
      }
      // Fallback: parse do primeiro content text como JSON
      const first =
        Array.isArray(result.content) && result.content[0]?.type === "text"
          ? result.content[0].text
          : null;
      if (typeof first === "string") {
        try {
          return JSON.parse(first);
        } catch {
          return first;
        }
      }
      return result.content ?? null;
    },
    async close() {
      try {
        await client.close();
      } catch {
        // ignore
      }
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    },
  };
}
