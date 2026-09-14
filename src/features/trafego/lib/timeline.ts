/**
 * Quando a campanha consegue, de fato, entrar no ar.
 *
 * Existe porque a expectativa errada é o mal-entendido mais caro do produto:
 * o cliente paga hoje achando que anuncia amanhã, e descobre depois que nem
 * conta de anúncios tem. A conta é feita em dias úteis e mostrada ANTES do
 * pagamento — o cliente precisa reconhecer a data para continuar.
 *
 * Os prazos são de execução da equipe, não promessa de aprovação da
 * plataforma: Meta e Google revisam anúncio no tempo deles.
 */

/** Conta de anúncios já existente: só pedir acesso e configurar. */
export const SETUP_DAYS_WITH_ACCOUNT = 2;
/** Sem conta: criar BM, página, pixel e esperar a Meta liberar. */
export const SETUP_DAYS_WITHOUT_ACCOUNT = 5;
/** Instagram/Facebook ainda não vinculados à conta de anúncios. */
export const SOCIAL_LINK_DAYS = 2;
/** Cliente ainda não tem criativo nem copy prontos. */
export const MATERIALS_DAYS = 3;

export interface EarliestStartInput {
  /** null = "não sei dizer", tratado como quem não tem. */
  hasAdAccount: boolean | null;
  hasSocialLinked: boolean | null;
  materialsReady: boolean | null;
  from?: Date;
}

export interface EarliestStartEstimate {
  earliestStart: Date;
  businessDays: number;
  /** O que puxou o prazo — vira a lista que o cliente lê. */
  reasons: string[];
}

/** Pula sábado e domingo. Feriado não entra: a lista muda por estado. */
export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}

export function estimateEarliestStart(
  input: EarliestStartInput,
): EarliestStartEstimate {
  const from = input.from ?? new Date();
  const reasons: string[] = [];

  // As frentes correm em paralelo — quem manda é a mais lenta, não a soma.
  let businessDays =
    input.hasAdAccount === true ? SETUP_DAYS_WITH_ACCOUNT : SETUP_DAYS_WITHOUT_ACCOUNT;
  reasons.push(
    input.hasAdAccount === true
      ? "Pedir acesso à sua conta de anúncios e configurar a campanha"
      : "Criar e configurar a conta de anúncios no seu nome",
  );

  if (input.hasSocialLinked === false) {
    businessDays = Math.max(businessDays, SETUP_DAYS_WITH_ACCOUNT + SOCIAL_LINK_DAYS);
    reasons.push("Vincular Instagram e Facebook à conta de anúncios");
  }

  if (input.materialsReady === false) {
    businessDays = Math.max(businessDays, MATERIALS_DAYS);
    reasons.push("Aguardar seus criativos e a copy");
  }

  return { earliestStart: addBusinessDays(from, businessDays), businessDays, reasons };
}

/** Data só com o dia (o horário atrapalha a comparação com um `<input type=date>`). */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isDesiredStartTooSoon(
  desiredStartAt: string | null | undefined,
  earliestStart: Date,
): boolean {
  if (!desiredStartAt) return false;
  const desired = startOfDay(new Date(`${desiredStartAt}T12:00:00`));
  return desired < startOfDay(earliestStart);
}

export function formatStartDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "long",
  });
}
