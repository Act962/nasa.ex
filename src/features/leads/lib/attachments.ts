import prisma from "@/lib/prisma";

/**
 * Anexos de um lead organizados em pastas. Faz UNION de:
 *   1. `LeadFile` — arquivos manualmente anexados pelos consultores (pasta
 *      "Arquivos").
 *   2. `Message.mediaUrl` — mídia trocada no chat (pasta "Chat").
 *   3. `FormResponses` blocos `FileUpload` / `ImageUpload` — anexos em
 *      formulários (pasta "Formulários", sub-pasta por nome do form).
 *
 * Pra cada item retornamos URL, nome, tipo, autor, timestamp, e a pasta
 * lógica em que ele se encaixa. A UI agrupa por `folder` e (quando há)
 * `subFolder`.
 */

export type AttachmentItem = {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  size?: number | null;
  createdAt: string;
  folder: "Arquivos" | "Chat" | "Formulários";
  subFolder?: string | null; // ex: nome do formulário
  source: "manual" | "chat" | "form";
  // Origem detalhada — útil pra exibir contexto (ex: "do formulário X").
  context?: {
    formId?: string;
    formName?: string;
    formResponseId?: string;
    blockType?: string; // FileUpload | ImageUpload
    blockLabel?: string;
    messageId?: string;
    fromMe?: boolean;
    senderName?: string | null;
  };
  uploadedBy?: { name: string | null; image: string | null } | null;
};

type FormBlockNode = {
  id?: string;
  blockType?: string;
  attributes?: { label?: string };
  childblocks?: FormBlockNode[];
};

/**
 * Walka o jsonBlock do form pra montar um mapa { blockId → label } dos
 * blocos FileUpload/ImageUpload. Usado pra exibir o nome do bloco junto
 * dos arquivos anexados.
 */
function indexFormFileBlocks(jsonBlock: unknown): Map<string, { type: string; label: string }> {
  const out = new Map<string, { type: string; label: string }>();
  let parsed: unknown = jsonBlock;
  if (typeof jsonBlock === "string") {
    try {
      parsed = JSON.parse(jsonBlock);
    } catch {
      return out;
    }
  }
  function visit(node: FormBlockNode | null | undefined) {
    if (!node || typeof node !== "object") return;
    if (
      typeof node.id === "string" &&
      (node.blockType === "FileUpload" || node.blockType === "ImageUpload")
    ) {
      out.set(node.id, {
        type: node.blockType,
        label: node.attributes?.label ?? "Anexo",
      });
    }
    if (Array.isArray(node.childblocks)) {
      for (const c of node.childblocks) visit(c);
    }
  }
  if (Array.isArray(parsed)) {
    for (const node of parsed as FormBlockNode[]) visit(node);
  }
  return out;
}

/**
 * Agrega todos os anexos de um lead. Limita a `limit` itens por fonte
 * pra manter latência baixa em leads ativos com muitas mensagens.
 */
export async function resolveLeadAttachments(
  leadId: string,
  limit = 200,
): Promise<AttachmentItem[]> {
  const [leadFiles, messages, formResponses] = await Promise.all([
    prisma.leadFile.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        fileUrl: true,
        mimeType: true,
        createdAt: true,
        creator: { select: { name: true, image: true } },
      },
    }),
    prisma.message.findMany({
      where: {
        conversation: { leadId },
        OR: [{ mediaUrl: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        mediaUrl: true,
        mediaType: true,
        mediaCaption: true,
        mimetype: true,
        fileName: true,
        fromMe: true,
        senderName: true,
        createdAt: true,
      },
    }),
    prisma.formResponses.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        jsonResponse: true,
        form: { select: { id: true, name: true, jsonBlock: true } },
      },
    }),
  ]);

  const items: AttachmentItem[] = [];

  // 1. LeadFile
  for (const f of leadFiles) {
    if (!f.fileUrl) continue;
    items.push({
      id: `manual:${f.id}`,
      url: f.fileUrl,
      name: f.name,
      mimeType: f.mimeType,
      createdAt: f.createdAt.toISOString(),
      folder: "Arquivos",
      source: "manual",
      uploadedBy: f.creator ?? null,
    });
  }

  // 2. Mensagens com mediaUrl
  for (const m of messages) {
    if (!m.mediaUrl) continue;
    const fname =
      m.fileName ||
      m.mediaCaption ||
      m.mediaUrl.split("/").pop() ||
      "Mídia do chat";
    items.push({
      id: `chat:${m.id}`,
      url: m.mediaUrl,
      name: fname,
      mimeType: m.mimetype || m.mediaType || null,
      createdAt: m.createdAt.toISOString(),
      folder: "Chat",
      source: "chat",
      context: {
        messageId: m.id,
        fromMe: m.fromMe,
        senderName: m.senderName,
      },
    });
  }

  // 3. FormResponses — extrai do jsonResponse os campos com URLs S3.
  //    Cada `FileUpload`/`ImageUpload` salva `value: "url1,url2"` e
  //    `meta.files`/`meta.images` com `[{url, name}]`.
  for (const r of formResponses) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed =
        typeof r.jsonResponse === "string"
          ? JSON.parse(r.jsonResponse)
          : (r.jsonResponse as Record<string, unknown>) ?? {};
    } catch {
      continue;
    }
    const blocksIndex = indexFormFileBlocks(r.form?.jsonBlock);
    for (const [blockId, entry] of Object.entries(parsed)) {
      const blockMeta = blocksIndex.get(blockId);
      if (!blockMeta) continue; // não é FileUpload/ImageUpload
      if (!entry || typeof entry !== "object") continue;
      const e = entry as {
        value?: unknown;
        meta?: { files?: unknown; images?: unknown };
      };
      const list: Array<{ url: string; name?: string }> = [];

      // meta.files / meta.images têm objetos com nome original
      const fromMeta = e.meta?.files ?? e.meta?.images;
      if (Array.isArray(fromMeta)) {
        for (const item of fromMeta) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { url?: unknown }).url === "string"
          ) {
            list.push({
              url: (item as { url: string }).url,
              name: (item as { name?: string }).name,
            });
          }
        }
      } else if (typeof e.value === "string") {
        // fallback CSV
        for (const u of e.value.split(",")) {
          const trimmed = u.trim();
          if (!trimmed) continue;
          list.push({ url: trimmed });
        }
      }

      let fileIdx = 0;
      for (const f of list) {
        items.push({
          id: `form:${r.id}:${blockId}:${fileIdx++}`,
          url: f.url,
          name: f.name ?? f.url.split("/").pop() ?? "Anexo",
          mimeType: null,
          createdAt: r.createdAt.toISOString(),
          folder: "Formulários",
          subFolder: r.form?.name ?? "Formulário",
          source: "form",
          context: {
            formId: r.form?.id,
            formName: r.form?.name,
            formResponseId: r.id,
            blockType: blockMeta.type,
            blockLabel: blockMeta.label,
          },
        });
      }
    }
  }

  // Ordena por mais recente primeiro
  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return items;
}
