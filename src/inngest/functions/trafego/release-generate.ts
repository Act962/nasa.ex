import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  parseReleaseSources,
  type ReleaseSource,
} from "@/features/trafego/lib/release";
import { fetchSiteText } from "@/features/trafego/server/lib/release/fetch-site";
import { extractPdfText } from "@/features/trafego/server/lib/release/extract-pdf";
import {
  draftRelease,
  type ReleaseSourceText,
} from "@/features/trafego/server/lib/release/draft-release";
import { refreshTrafegoRecommendations } from "@/features/trafego/server/lib/recommendations";

/**
 * Monta o Release a partir do que o cliente apontou.
 *
 * Sai do request porque ler site e PDF leva dezenas de segundos. O painel
 * acompanha por `releaseGeneratedAt`. O resultado é rascunho: só quando o
 * cliente salva (`releaseSavedAt`) ele alimenta copies e recomendações.
 */
export const trafegoReleaseGenerate = inngest.createFunction(
  { id: "trafego-release-generate", retries: 2, concurrency: { limit: 4 } },
  { event: "trafego/release.generate" },
  async ({ event, step }) => {
    const { orderId } = event.data as { orderId: string };

    const order = await step.run("load-order", async () =>
      prisma.trafegoOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          businessName: true,
          businessNiche: true,
          releaseSources: true,
        },
      }),
    );
    if (!order) return { skipped: "order_not_found" as const };

    const sources = parseReleaseSources(order.releaseSources);
    const readable = sources.filter(
      (source) => source.kind === "site" || source.kind === "pdf",
    );
    if (readable.length === 0) return { skipped: "no_readable_sources" as const };

    // Cada fonte é um step: uma que falha não derruba as outras no retry.
    const extracted: (ReleaseSourceText & { sourceId: string })[] = [];
    const readAt: Record<string, { extractedAt: string; chars: number } | { note: string }> = {};

    for (const source of readable) {
      const result = await step.run(`read-${source.id}`, async () => {
        if (source.kind === "site") {
          const site = await fetchSiteText(source.value);
          return site ? { text: site.text, chars: site.chars } : null;
        }
        if (!source.fileKey) return null;
        const pdf = await extractPdfText(source.fileKey);
        return pdf ? { text: pdf.text, chars: pdf.chars } : null;
      });

      if (result) {
        extracted.push({
          sourceId: source.id,
          kind: source.kind as "site" | "pdf",
          label: source.value,
          text: result.text,
        });
        readAt[source.id] = { extractedAt: new Date().toISOString(), chars: result.chars };
      } else {
        readAt[source.id] = {
          note:
            source.kind === "site"
              ? "Não conseguimos ler esse site — ele pode exigir login ou bloquear leitura automática."
              : "Não conseguimos ler esse PDF — ele pode ser só imagem, sem texto.",
        };
      }
    }

    const release = await step.run("draft", async () =>
      draftRelease({
        businessName: order.businessName,
        businessNiche: order.businessNiche,
        sources: extracted.map(({ kind, label, text }) => ({ kind, label, text })),
      }),
    );

    await step.run("persist", async () => {
      // Relê as fontes: o cliente pode ter adicionado ou removido enquanto líamos.
      const current = await prisma.trafegoOrder.findUnique({
        where: { id: orderId },
        select: { releaseSources: true },
      });
      const merged: ReleaseSource[] = parseReleaseSources(current?.releaseSources).map(
        (source) => {
          const status = readAt[source.id];
          if (!status) return source;
          return "note" in status
            ? { ...source, note: status.note, extractedAt: null, chars: null }
            : { ...source, extractedAt: status.extractedAt, chars: status.chars, note: null };
        },
      );

      await prisma.trafegoOrder.update({
        where: { id: orderId },
        data: {
          releaseSources: merged as unknown as object,
          ...(release
            ? { release: release as unknown as object, releaseGeneratedAt: new Date() }
            : {}),
        },
      });
    });

    if (release) {
      await step.run("refresh-recommendations", async () => {
        await refreshTrafegoRecommendations(orderId).catch((error) =>
          console.error("[trafego/release] recomendações não atualizadas:", error),
        );
        return { done: true };
      });
    }

    return { read: extracted.length, drafted: Boolean(release) };
  },
);
