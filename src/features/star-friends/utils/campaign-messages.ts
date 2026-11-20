// Textos da campanha por cupom que mudam com o modo (spec 0135). Sorteio mantém os textos da
// 0102; pontos fala só em ⭐ e prêmios: nada de número da sorte nem sorteio (RNF-1).

import { formatCents } from "./campaign";

export type CampaignMode = "RAFFLE" | "POINTS";

/** RNF-1: nenhuma mensagem do modo pontos pode conter isto. */
export const POINTS_MODE_FORBIDDEN = /sorte|sorteio|sortear|sorteado|🎟️/i;

const MAX_CODES_IN_MESSAGE = 60;

/** Minúsculas, sem acento e com espaços simples: o mesmo jeito que a conversa compara texto. */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * RF-11: o pedido escrito também vale quando cita o nome do programa, com o símbolo inteiro: "Sempre +"
 * casa com "sempre +", "sempre+" e "sempre mais", mas não com um "sempre" solto na frase.
 */
export function asksForProgramByName(text: string, programName: string | null): boolean {
  const name = programName ? normalizeText(programName) : "";
  if (name.length < 3) return false;
  const normalized = normalizeText(text);
  const variants = [name, name.replace(/\s+/g, ""), name.replace(/\s*\+/g, " mais")];
  return variants.some((variant) => normalized.includes(variant));
}

/** "a promoção" no sorteio, "o programa" nos pontos. */
export function campaignNoun(mode: CampaignMode) {
  return mode === "POINTS"
    ? { the: "o programa", The: "O programa", of: "do programa", in: "no programa" }
    : { the: "a promoção", The: "A promoção", of: "da promoção", in: "na promoção" };
}

function starsLabel(stars: number): string {
  return stars === 1 ? "1 ⭐" : `${stars} ⭐`;
}

/** RF-2/RF-3: quanto falta, a partir da sobra guardada, para a próxima ⭐ (ou número). */
function missingForNext(carryOverCents: number, amountPerNumberCents: number): number {
  return Math.max(amountPerNumberCents - carryOverCents, 0);
}

export function acceptedReceiptMessage(input: {
  mode: CampaignMode;
  totalCents: number;
  codes: string[];
  carryOverCents: number;
  amountPerNumberCents: number;
  starsBalance?: number | null;
}): string {
  const header = `Cupom de ${formatCents(input.totalCents)} cadastrado. ✅`;
  const missing = formatCents(missingForNext(input.carryOverCents, input.amountPerNumberCents));

  if (input.mode === "POINTS") {
    const earned = input.codes.length;
    const earnedLine =
      earned === 0
        ? `Ele ainda não completou ${formatCents(input.amountPerNumberCents)}, então o valor ficou guardado.`
        : `Você ganhou ${starsLabel(earned)}!`;
    const balanceLine = typeof input.starsBalance === "number" ? `\nSeu saldo: ${starsLabel(input.starsBalance)}.` : "";
    return `${header}\n\n${earnedLine}${balanceLine}\nFaltam ${missing} para a próxima ⭐.`;
  }

  const perNumber = formatCents(input.amountPerNumberCents);
  const carryLine = `Saldo acumulado para o próximo número: ${formatCents(input.carryOverCents)} de ${perNumber}.`;
  if (input.codes.length === 0) {
    return `${header}\n\nEle ainda não completou ${perNumber}, então o valor ficou guardado.\n${carryLine}`;
  }
  const codesLabel = input.codes.length === 1 ? "Seu número da sorte" : `Seus ${input.codes.length} números da sorte`;
  // A Meta corta em 1024 caracteres a mensagem que leva botões.
  const shownCodes = input.codes.slice(0, MAX_CODES_IN_MESSAGE);
  const hiddenLine = input.codes.length > shownCodes.length ? `\n… e mais ${input.codes.length - shownCodes.length}, em "Ver meus códigos".` : "";
  return `${header}\n\n${codesLabel}:\n${shownCodes.map((code) => `🎟️ ${code}`).join("\n")}${hiddenLine}\n\n${carryLine}\n\nOs cupons passam por uma conferência antes do sorteio. Boa sorte!`;
}

export function pendingReviewMessage(mode: CampaignMode): string {
  const after =
    mode === "POINTS"
      ? "Assim que for conferido, as ⭐ entram no seu saldo."
      : "Assim que for conferido, os números da sorte aparecem em \"Ver meus códigos\".";
  return `Recebemos o seu cupom. 📋\n\nNão deu para ler todos os dados pela foto, então ele vai passar por uma conferência da nossa equipe. ${after}`;
}

/** RF-7: aviso da conferência manual aprovada. */
export function reviewApprovedMessage(input: {
  mode: CampaignMode;
  totalCents: number;
  codes: string[];
  carryOverCents: number;
  amountPerNumberCents: number;
}): string {
  const header = `Seu cupom de ${formatCents(input.totalCents)} foi conferido e aprovado. ✅`;
  if (input.mode === "POINTS") {
    const missing = formatCents(missingForNext(input.carryOverCents, input.amountPerNumberCents));
    const earnedLine =
      input.codes.length === 0
        ? `Ele ainda não completou ${formatCents(input.amountPerNumberCents)}, então o valor ficou guardado.`
        : `Você ganhou ${starsLabel(input.codes.length)}!`;
    return `${header}\n\n${earnedLine}\nFaltam ${missing} para a próxima ⭐.`;
  }
  const perNumber = formatCents(input.amountPerNumberCents);
  const carryLine = `Saldo acumulado para o próximo número: ${formatCents(input.carryOverCents)} de ${perNumber}.`;
  const shownCodes = input.codes.slice(0, MAX_CODES_IN_MESSAGE);
  const hiddenLine = input.codes.length > shownCodes.length ? `\n… e mais ${input.codes.length - shownCodes.length}, em "Ver meus códigos".` : "";
  const codesBlock =
    input.codes.length === 0
      ? `Ele ainda não completou ${perNumber}, então o valor ficou guardado.`
      : `${input.codes.length === 1 ? "Seu número da sorte" : `Seus ${input.codes.length} números da sorte`}:\n${shownCodes.map((code) => `🎟️ ${code}`).join("\n")}${hiddenLine}`;
  return `${header}\n\n${codesBlock}\n\n${carryLine}`;
}

/** RF-5: "Ver meus pontos". */
export function pointsSummaryMessage(input: {
  mode: CampaignMode;
  campaignName: string;
  programName: string | null;
  totalSpentCents: number;
  acceptedReceipts: number;
  validNumbers: number;
  carryOverCents: number;
  amountPerNumberCents: number;
  starsBalance: number;
  tierLabel?: string | null;
}): string {
  const purchases = `Compras cadastradas: ${formatCents(input.totalSpentCents)} em ${input.acceptedReceipts} cupom(ns)`;
  if (input.mode === "POINTS") {
    return [
      `*Seus pontos — ${input.campaignName}*`,
      "",
      purchases,
      `Saldo: ${starsLabel(input.starsBalance)}`,
      ...(input.tierLabel ? [`Nível: ${input.tierLabel}`] : []),
      `Faltam ${formatCents(missingForNext(input.carryOverCents, input.amountPerNumberCents))} para a próxima ⭐`,
    ].join("\n");
  }
  return [
    `*Seus pontos — ${input.campaignName}*`,
    "",
    purchases,
    `Números da sorte: ${input.validNumbers}`,
    `Saldo para o próximo número: ${formatCents(input.carryOverCents)} de ${formatCents(input.amountPerNumberCents)}`,
    ...(input.programName ? [`Stars no ${input.programName}: ${input.starsBalance} ⭐`] : []),
  ].join("\n");
}

/** RF-6: "Ver prêmios". */
export function rewardsMessage(rewards: { name: string; costStars: number }[]): string {
  if (rewards.length === 0) return "Os prêmios estão sendo preparados. Continue juntando suas ⭐!";
  const lines = rewards.map((reward) => `• ${reward.name} — ${starsLabel(reward.costStars)}`);
  return `*Prêmios*\n\n${lines.join("\n")}\n\nA troca é feita na loja.`;
}

/** RF-12: resumo de regras sugerido no formulário. */
export function defaultRulesSummary(mode: CampaignMode, amountPerNumberCents: number): string {
  // Espaço comum no lugar do não separável do toLocaleString: o texto sugerido é comparado com o que está no campo.
  const amount = formatCents(amountPerNumberCents).replace(/\u00a0/g, " ");
  return mode === "POINTS"
    ? `A cada ${amount} em compras você ganha 1 ⭐. Envie a foto do cupom por aqui. Cada cupom vale uma vez só. Junte ⭐ e troque por prêmios na loja.`
    : `A cada ${amount} em compras você ganha 1 número da sorte. Envie a foto do cupom por aqui. Cada cupom vale uma vez só e os cupons são conferidos antes do sorteio: cupom repetido ou irregular tem os números cancelados.`;
}
