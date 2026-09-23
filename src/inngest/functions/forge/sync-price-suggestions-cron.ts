import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { PRICE_FETCHERS, type FetchedPrice } from "@/http/forge-prices";

// Sincroniza preços públicos como SUGESTÕES (suggest-only). Semanal.
// Nunca escreve em ForgePriceItem — só cria ForgePriceSuggestion PENDING para
// o admin aprovar. Regra 18: I/O de rede em step.run, escritas de DB separadas.
export const syncPriceSuggestionsCron = inngest.createFunction(
  { id: "forge-sync-price-suggestions", retries: 1 },
  { cron: "0 6 * * 1" }, // segunda-feira, 06h
  async ({ step }) => {
    const fetched = await step.run("fetch-public-prices", async () => {
      const results: FetchedPrice[] = [];
      for (const fetcher of PRICE_FETCHERS) {
        try {
          results.push(...(await fetcher.run()));
        } catch (err) {
          console.error(`[forge-price-sync] fonte ${fetcher.key} falhou`, err);
        }
      }
      return results;
    });

    if (fetched.length === 0) return { suggestionsCreated: 0 };

    const created = await step.run("create-suggestions", async () => {
      const orgs = await prisma.forgePriceItem.findMany({
        distinct: ["organizationId"],
        select: { organizationId: true },
      });

      let count = 0;
      for (const { organizationId } of orgs) {
        for (const price of fetched) {
          const current = await prisma.forgePriceItem.findFirst({
            where: { organizationId, category: price.category, code: price.code },
          });

          const suggestedValue = {
            unitPrice: price.unitPrice != null ? String(price.unitPrice) : undefined,
            inputPer1k: price.inputPer1k != null ? String(price.inputPer1k) : undefined,
            outputPer1k: price.outputPer1k != null ? String(price.outputPer1k) : undefined,
            cachedInputPer1k: price.cachedInputPer1k != null ? String(price.cachedInputPer1k) : undefined,
            unit: price.unit,
          };

          const currentValue = current
            ? {
                unitPrice: current.unitPrice?.toString(),
                inputPer1k: current.inputPer1k?.toString(),
                outputPer1k: current.outputPer1k?.toString(),
                cachedInputPer1k: current.cachedInputPer1k?.toString(),
              }
            : null;

          // Ignora se não mudou nada em relação ao item atual.
          const unchanged =
            current &&
            currentValue?.unitPrice === suggestedValue.unitPrice &&
            currentValue?.inputPer1k === suggestedValue.inputPer1k &&
            currentValue?.outputPer1k === suggestedValue.outputPer1k;
          if (unchanged) continue;

          // Evita sugestão PENDING duplicada para o mesmo item/código.
          const pending = await prisma.forgePriceSuggestion.findFirst({
            where: { organizationId, category: price.category, code: price.code, status: "PENDING" },
          });
          if (pending) continue;

          await prisma.forgePriceSuggestion.create({
            data: {
              organizationId,
              priceItemId: current?.id ?? null,
              category: price.category,
              code: price.code,
              name: price.name ?? current?.name ?? price.code,
              currency: price.currency,
              currentValue: currentValue ?? undefined,
              suggestedValue,
              sourceUrl: price.sourceUrl,
              sourceLabel: price.sourceLabel,
            },
          });
          count += 1;
        }
      }
      return count;
    });

    return { suggestionsCreated: created };
  },
);
