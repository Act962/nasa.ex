// Custo, taxa e lotes do disparo (spec 0040). Substitui scripts/campanhas-qa-check-pure-libs.ts.

import { describe, expect, it } from "vitest";
import { quoteBroadcastFee } from "./broadcast-fee";
import { planDailyBatches, resolveMessagingLimit } from "./messaging-limits";
import { estimateMetaCost } from "./meta-pricing";

const beforeUtilityCharge = new Date("2026-09-27T12:00:00Z");
const afterUtilityCharge = new Date("2026-10-02T12:00:00Z");

describe("spec 0040 — custo da Meta", () => {
  it("CA-1: marketing custa mais que utilidade", () => {
    const marketing = estimateMetaCost({ recipients: 1000, category: "MARKETING", now: beforeUtilityCharge });
    const utility = estimateMetaCost({ recipients: 1000, category: "UTILITY", now: beforeUtilityCharge });

    expect(marketing.totalBrlCents).toBeGreaterThan(utility.totalBrlCents);
  });

  it("utilidade dentro da janela aberta é grátis até 01/10/2026", () => {
    const estimate = estimateMetaCost({
      recipients: 100,
      category: "UTILITY",
      openWindowRecipients: 40,
      now: beforeUtilityCharge,
    });

    expect(estimate.chargedRecipients).toBe(60);
  });

  it("utilidade dentro da janela aberta passa a ser cobrada depois de 01/10/2026", () => {
    const estimate = estimateMetaCost({
      recipients: 100,
      category: "UTILITY",
      openWindowRecipients: 40,
      now: afterUtilityCharge,
    });

    expect(estimate.chargedRecipients).toBe(100);
  });
});

describe("spec 0040 — taxa de serviço", () => {
  it.each([
    [5_000, 50],
    [10_001, 40],
    [60_000, 35],
    [300_000, 30],
    [600_000, 25],
  ])("CA-2: custo Meta de %i centavos paga %i%% de taxa", (metaCostBrlCents, expectedPercent) => {
    expect(quoteBroadcastFee({ metaCostBrlCents }).feePercent).toBe(expectedPercent);
  });

  it("CA-2: campanha pequena paga a taxa mínima", () => {
    const quote = quoteBroadcastFee({ metaCostBrlCents: 1_000 });

    expect(quote.isMinimumApplied).toBe(true);
    expect(quote.serviceFeeBrlCents).toBe(1_990);
  });
});

describe("spec 0040 — lotes diários", () => {
  it("CA-1: 1.000 contatos no limite de 250 levam 4 dias", () => {
    expect(planDailyBatches(1000, resolveMessagingLimit("TIER_250")).days).toBe(4);
  });

  it("CA-5: 600 contatos no limite de 250 viram 3 lotes", () => {
    const batches = planDailyBatches(600, resolveMessagingLimit("TIER_250"));

    expect(batches.days).toBe(3);
    expect(batches.perDay).toEqual([250, 250, 100]);
  });

  it("nível desconhecido cai em 250 contatos por dia", () => {
    expect(resolveMessagingLimit(null).dailyUniqueContacts).toBe(250);
  });

  it("o nível antigo TIER_1K equivale a 2.000 contatos por dia", () => {
    expect(resolveMessagingLimit("TIER_1K").dailyUniqueContacts).toBe(2000);
  });
});
