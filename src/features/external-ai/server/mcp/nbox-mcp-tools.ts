import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/prisma";
import { resolvePublicOrigin } from "@/lib/public-origin";
import { NBoxItemType } from "@/generated/prisma/enums";
import { isOrgActionAllowed, resolveOrgPermissions } from "@/features/permissions/server/resolve-org-permissions";
import { NBOX_MAX_FILE_BYTES, NBOX_TRANSFER_DEFAULT_DAYS, NBOX_TRANSFER_MAX_DAYS } from "@/features/nbox/lib/storage-limits";
import { UNRESTRICTED_ITEM_FILTER, canViewRestrictedNBox } from "@/features/nbox/server/can-view-restricted-nbox";
import { NBOX_TREE_ITEM_FILTER, assertFolderWritable, registerUploadedNboxFile, toNboxItemDto, type NboxActor } from "@/features/nbox/server/items";
import { createDownloadUrl } from "@/features/nbox/server/storage-objects";
import { getNboxStorageUsage } from "@/features/nbox/server/storage-usage";
import { createNboxTransfer } from "@/features/nbox/server/transfers";
import { startNboxUpload } from "@/features/nbox/server/uploads";
import { NBOX_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { createScopedToolRunner } from "./tool-runner";

// Nbox pelo MCP (spec 0148, RF-13 e RF-14): as mesmas funções da tela, com as regras de pasta restrita e de espaço.

const APP_KEY = "nbox";
const ITEMS_PAGE_SIZE = 50;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
const NOT_FOUND_ITEM = "Arquivo não encontrado, ou você não tem acesso a ele.";

type NboxAction = "view" | "create";

const runNboxTool = createScopedToolRunner({ scope: NBOX_SCOPE, appName: "ao Nbox", rateLimitKey: "mcp-nbox" });

async function listCallerOrganizationIds(caller: ExternalAiCaller): Promise<string[]> {
  const memberships = await prisma.member.findMany({ where: { userId: caller.userId }, select: { organizationId: true } });
  return memberships
    .map((membership) => membership.organizationId)
    .filter((organizationId) => caller.credential !== "key" || caller.organizationIds.includes(organizationId));
}

async function isNboxActionAllowed(caller: ExternalAiCaller, organizationId: string, action: NboxAction): Promise<boolean> {
  if (caller.credential === "key" && !caller.organizationIds.includes(organizationId)) return false;
  return isOrgActionAllowed(await resolveOrgPermissions(caller.userId, organizationId), APP_KEY, action);
}

async function assertNboxAccess(caller: ExternalAiCaller, organizationId: string, action: NboxAction) {
  if (!(await isNboxActionAllowed(caller, organizationId, action))) {
    throw new Error("Empresa não liberada para esta conexão, ou você não tem acesso ao Nbox nela.");
  }
}

/** O app aparece para quem é membro de alguma empresa com o Nbox liberado. Para no primeiro "sim". */
export async function hasAnyNboxAccess(userId: string): Promise<boolean> {
  const memberships = await prisma.member.findMany({ where: { userId }, select: { organizationId: true } });
  for (const membership of memberships) {
    if (isOrgActionAllowed(await resolveOrgPermissions(userId, membership.organizationId), APP_KEY, "view")) return true;
  }
  return false;
}

async function loadActor(caller: ExternalAiCaller): Promise<NboxActor> {
  const user = await prisma.user.findUnique({ where: { id: caller.userId }, select: { id: true, name: true, email: true, image: true } });
  if (!user) throw new Error("Usuário da conexão não encontrado.");
  return user;
}

const isStoredKey = (url: string | null): url is string => !!url && !/^https?:\/\//.test(url);

export function registerNboxMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "nbox_list_folders",
    {
      description: "Empresas com Nbox, o espaço usado de cada uma e as pastas (id, nome, pasta-mãe). Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runNboxTool(caller, async () => {
        const actor = await loadActor(caller);
        const organizationIds = await listCallerOrganizationIds(caller);
        const allowed = await Promise.all(organizationIds.map((organizationId) => isNboxActionAllowed(caller, organizationId, "view")));
        const visibleIds = organizationIds.filter((_, index) => allowed[index]);
        return Promise.all(
          visibleIds.map(async (organizationId) => {
            const [organization, usage, canViewRestricted] = await Promise.all([
              prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
              getNboxStorageUsage(organizationId),
              canViewRestrictedNBox(actor, organizationId),
            ]);
            const folders = await prisma.nBoxFolder.findMany({
              where: { organizationId, expiresAt: null, ...(canViewRestricted ? {} : { isRestricted: false }) },
              select: { id: true, name: true, parentId: true, isRestricted: true },
              orderBy: { name: "asc" },
            });
            return {
              organizationId,
              organizationName: organization?.name ?? null,
              storage: { usedBytes: usage.usedBytes, limitBytes: usage.limitBytes },
              folders,
            };
          }),
        );
      }),
  );

  server.registerTool(
    "nbox_list_items",
    {
      description: `Arquivos e links do Nbox, do mais novo para o mais antigo, ${ITEMS_PAGE_SIZE} por página. Sem folderId lista todas as pastas; folderId null é a raiz. Use nbox_get_download_url para ler um arquivo.`,
      inputSchema: {
        organizationId: z.string(),
        folderId: z.string().nullable().optional(),
        search: z.string().max(120).optional().describe("Parte do nome do arquivo"),
        page: z.number().int().min(0).max(1000).optional(),
      },
    },
    ({ organizationId, folderId, search, page }) =>
      runNboxTool(caller, async () => {
        await assertNboxAccess(caller, organizationId, "view");
        const canViewRestricted = await canViewRestrictedNBox(await loadActor(caller), organizationId);
        const items = await prisma.nBoxItem.findMany({
          where: {
            organizationId,
            ...(folderId !== undefined ? { folderId } : {}),
            ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
            AND: [NBOX_TREE_ITEM_FILTER, ...(canViewRestricted ? [] : [UNRESTRICTED_ITEM_FILTER])],
          },
          select: { id: true, name: true, type: true, mimeType: true, size: true, description: true, tags: true, folderId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: ITEMS_PAGE_SIZE + 1,
          skip: (page ?? 0) * ITEMS_PAGE_SIZE,
        });
        return {
          items: items.slice(0, ITEMS_PAGE_SIZE).map(toNboxItemDto),
          hasMore: items.length > ITEMS_PAGE_SIZE,
        };
      }),
  );

  server.registerTool(
    "nbox_get_download_url",
    {
      description: "Link para baixar um arquivo do Nbox, válido por 15 minutos. Para link guardado (tipo LINK), devolve o endereço.",
      inputSchema: { organizationId: z.string(), itemId: z.string() },
    },
    ({ organizationId, itemId }) =>
      runNboxTool(caller, async () => {
        await assertNboxAccess(caller, organizationId, "view");
        const item = await prisma.nBoxItem.findFirst({
          where: { id: itemId, organizationId },
          select: { id: true, name: true, type: true, url: true, mimeType: true, size: true, folder: { select: { isRestricted: true } } },
        });
        if (!item) throw new Error(NOT_FOUND_ITEM);
        if (item.folder?.isRestricted && !(await canViewRestrictedNBox(await loadActor(caller), organizationId))) throw new Error(NOT_FOUND_ITEM);
        if (!item.url) throw new Error("Este item não tem arquivo para baixar.");
        const downloadUrl = isStoredKey(item.url) ? await createDownloadUrl(item.url, item.name, DOWNLOAD_URL_TTL_SECONDS) : item.url;
        return {
          itemId: item.id,
          name: item.name,
          mimeType: item.mimeType,
          sizeBytes: item.size === null ? null : Number(item.size),
          downloadUrl,
          expiresInSeconds: isStoredKey(item.url) ? DOWNLOAD_URL_TTL_SECONDS : null,
        };
      }),
  );

  server.registerTool(
    "nbox_request_upload_url",
    {
      description:
        "Começa o envio de um arquivo local para o Nbox (até 5 GB). mode=single: faça PUT do arquivo inteiro em uploadUrl com o Content-Type informado. mode=multipart: corte o arquivo em pedaços de partSize bytes, faça PUT de cada pedaço em partUploadUrls[n] (sem Content-Type) e guarde o ETag de cada resposta. Depois chame nbox_complete_upload.",
      inputSchema: {
        organizationId: z.string(),
        folderId: z.string().nullable().optional().describe("Pasta de destino; vazio = raiz"),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
        sizeBytes: z.number().int().min(1).max(NBOX_MAX_FILE_BYTES),
      },
    },
    ({ organizationId, folderId, fileName, contentType, sizeBytes }) =>
      runNboxTool(caller, async () => {
        await assertNboxAccess(caller, organizationId, "create");
        const kind = await assertFolderWritable(await loadActor(caller), organizationId, folderId ?? null);
        const ticket = await startNboxUpload({ organizationId, kind, fileName, contentType, sizeBytes });
        return { ...ticket, contentType, next: "nbox_complete_upload" };
      }),
  );

  server.registerTool(
    "nbox_complete_upload",
    {
      description: "Fecha o envio começado em nbox_request_upload_url e cria o arquivo no Nbox com o tamanho real. No modo multipart, mande multipartUploadId e as partes (partNumber começando em 1 e o ETag de cada uma).",
      inputSchema: {
        organizationId: z.string(),
        folderId: z.string().nullable().optional(),
        key: z.string().min(1).max(512),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        multipartUploadId: z.string().optional(),
        parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1) })).max(10_000).optional(),
      },
    },
    ({ organizationId, folderId, key, fileName, contentType, description, multipartUploadId, parts }) =>
      runNboxTool(caller, async () => {
        await assertNboxAccess(caller, organizationId, "create");
        const item = await registerUploadedNboxFile({
          actor: await loadActor(caller),
          organizationId,
          folderId: folderId ?? null,
          key,
          name: fileName,
          mimeType: contentType,
          description,
          multipartUploadId,
          parts: parts?.map((part) => ({ partNumber: part.partNumber, etag: part.etag.replace(/"/g, "") })),
        });
        return { itemId: item.id, name: item.name, sizeBytes: item.size, folderId: item.folderId };
      }),
  );

  server.registerTool(
    "nbox_create_transfer",
    {
      description: `Cria um link público com prazo (1 a ${NBOX_TRANSFER_MAX_DAYS} dias, padrão ${NBOX_TRANSFER_DEFAULT_DAYS}) para alguém baixar arquivos do Nbox sem login. Os arquivos são copiados para a transferência e apagados depois do prazo; o original fica onde está. Arquivos de pasta restrita não podem ir. ANTES de criar, mostre ao usuário os arquivos e o prazo e espere a confirmação dele nesta conversa: quem tiver o link baixa os arquivos.`,
      inputSchema: {
        organizationId: z.string(),
        itemIds: z.array(z.string()).min(1).max(100),
        days: z.number().int().min(1).max(NBOX_TRANSFER_MAX_DAYS).optional(),
        name: z.string().max(120).optional(),
      },
    },
    ({ organizationId, itemIds, days, name }) =>
      runNboxTool(caller, async () => {
        await assertNboxAccess(caller, organizationId, "create");
        const items = await prisma.nBoxItem.findMany({ where: { id: { in: itemIds }, organizationId }, select: { type: true } });
        if (items.some((item) => item.type !== NBoxItemType.FILE && item.type !== NBoxItemType.IMAGE)) {
          throw new Error("Só arquivos e imagens podem ir numa transferência.");
        }
        const transfer = await createNboxTransfer({
          actor: await loadActor(caller),
          organizationId,
          name,
          days: days ?? NBOX_TRANSFER_DEFAULT_DAYS,
          existingItemIds: itemIds,
        });
        return { transferId: transfer.transferId, name: transfer.name, expiresAt: transfer.expiresAt, url: `${resolvePublicOrigin()}${transfer.path}` };
      }),
  );
}
