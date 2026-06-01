/**
 * Resolve um lote de tags sugeridas pela IA → mapa `{slug → tagId}`. Pra
 * cada tag pedida:
 *
 *  1. Busca por slug exato na org → reusa
 *  2. Busca por nome similar (Jaccard >= 0.7 nos tokens) → reusa
 *  3. Cria nova com os atributos sugeridos
 *
 * Retorna 3 listas pro caller mostrar feedback:
 *   - `reused`:  tags que já existiam (slug exato OU similaridade)
 *   - `created`: tags novas criadas
 *   - `tagMap`:  slug-do-blueprint → id real (pra resolvePlaceholders no
 *                createWorkflowFromBlueprint)
 *
 * Evita duplicar tag ("proposta-pendente" vs "proposta_pendente" vs
 * "Proposta Pendente") — Jaccard nos tokens normalizados (sem acento,
 * lowercase, sem stopwords curtas).
 */
import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export interface TagRequest {
  /** Slug sugerido pelo LLM (kebab-case). Pode colidir com existente. */
  slug: string;
  /** Nome legível ("Proposta Pendente"). Usado em match por similaridade. */
  name: string;
  /** Cor hex (#RRGGBB). Default cinza. */
  color?: string;
  /** Pro caller mostrar "por quê essa tag" — não vai pro banco. */
  reason?: string;
}

export interface FindOrCreateTagsResult {
  tagMap: Record<string, string>;
  reused: Array<{ slug: string; id: string; name: string; matchedBy: "slug" | "similarity" }>;
  created: Array<{ slug: string; id: string; name: string; reason?: string }>;
}

export async function findOrCreateTags(
  client: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  requests: TagRequest[],
): Promise<FindOrCreateTagsResult> {
  if (requests.length === 0) {
    return { tagMap: {}, reused: [], created: [] };
  }

  const tagMap: Record<string, string> = {};
  const reused: FindOrCreateTagsResult["reused"] = [];
  const created: FindOrCreateTagsResult["created"] = [];

  // ── Carrega todas as tags da org de uma vez (1 query) ──────────
  // Cache local pra match por slug exato + similaridade.
  const existing = await client.tag.findMany({
    where: { organizationId, archivedAt: null },
    select: { id: true, slug: true, name: true },
  });
  const bySlug = new Map(existing.map((t) => [t.slug.toLowerCase(), t]));

  for (const req of requests) {
    const slugLower = req.slug.toLowerCase();

    // 1. Match exato por slug
    const exact = bySlug.get(slugLower);
    if (exact) {
      tagMap[req.slug] = exact.id;
      reused.push({
        slug: req.slug,
        id: exact.id,
        name: exact.name,
        matchedBy: "slug",
      });
      continue;
    }

    // 2. Match por similaridade no nome
    const reqTokens = tokenize(req.name);
    let best: { tag: (typeof existing)[number]; score: number } | null = null;
    for (const t of existing) {
      const score = jaccard(reqTokens, tokenize(t.name));
      if (score >= 0.7 && (!best || score > best.score)) {
        best = { tag: t, score };
      }
    }
    if (best) {
      tagMap[req.slug] = best.tag.id;
      reused.push({
        slug: req.slug,
        id: best.tag.id,
        name: best.tag.name,
        matchedBy: "similarity",
      });
      continue;
    }

    // 3. Cria nova
    const newTag = await client.tag.create({
      data: {
        organizationId,
        slug: req.slug,
        name: req.name,
        color: req.color ?? "#6B7280",
      },
      select: { id: true, slug: true, name: true },
    });
    tagMap[req.slug] = newTag.id;
    bySlug.set(slugLower, newTag); // adiciona ao cache pra próximo req não duplicar
    existing.push(newTag);
    created.push({
      slug: req.slug,
      id: newTag.id,
      name: newTag.name,
      reason: req.reason,
    });
  }

  return { tagMap, reused, created };
}

// ── Tokenização + Jaccard (mesma estratégia do fallback-ai.ts) ──

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}
