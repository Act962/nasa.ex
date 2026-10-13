import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import { buildFirstRemindAt, computeNextRemindAt } from "./reminder-recurrence";

// Horários em BRT (UTC-3): 09:00 BRT = 12:00Z.
const utc = (iso: string) => new Date(iso);

function nextRemindAtFor(
  recurrenceType: ReminderRecurrenceType,
  nextRemindAt: string | null,
  dayOfMonth: number | null = null,
) {
  return computeNextRemindAt({
    recurrenceType,
    dayOfMonth,
    nextRemindAt: nextRemindAt ? utc(nextRemindAt) : null,
  });
}

describe("computeNextRemindAt", () => {
  it("sem data atual não há próxima", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.WEEKLY, null)).toBeNull();
  });

  it("lembrete único não se repete", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.ONCE, "2026-01-15T12:00:00Z")).toBeNull();
  });

  it("semanal avança 7 dias, mantendo o horário", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.WEEKLY, "2026-01-28T12:00:00Z")).toEqual(
      utc("2026-02-04T12:00:00Z"),
    );
  });

  it("quinzenal avança 14 dias, atravessando a virada do ano", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.BIWEEKLY, "2026-12-25T12:00:00Z")).toEqual(
      utc("2027-01-08T12:00:00Z"),
    );
  });

  it("mensal sem dia fixo repete o mesmo dia do mês seguinte", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-15T12:00:00Z")).toEqual(
      utc("2026-02-15T12:00:00Z"),
    );
  });

  it("mensal calcula sobre a data em BRT, não em UTC", () => {
    // 22:30 BRT do dia 28/02 já é 01:30Z do dia 01/03.
    expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-03-01T01:30:00Z")).toEqual(
      utc("2026-03-29T01:30:00Z"),
    );
  });

  it("mensal com dia fixo limita ao último dia do mês seguinte", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-28T12:00:00Z", 31)).toEqual(
      utc("2026-02-28T12:00:00Z"),
    );
  });

  it("mensal com dia fixo volta ao dia configurado depois de um mês curto", () => {
    expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-02-28T12:00:00Z", 31)).toEqual(
      utc("2026-03-31T12:00:00Z"),
    );
  });

  // Comportamento atual, candidato a correção (ver docs/architecture/testing-strategy.md §6):
  // somar um mês a partir de um dia que não existe no mês seguinte transborda
  // para o mês depois dele, e o mês curto é pulado.
  describe("dias 29 a 31 pulam o mês que não tem esse dia", () => {
    it("sem dia fixo, 31/01 vai para 03/03", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-31T12:00:00Z")).toEqual(
        utc("2026-03-03T12:00:00Z"),
      );
    });

    it("com dia fixo 31, 31/01 vai para 31/03, sem disparar em fevereiro", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-31T12:00:00Z", 31)).toEqual(
        utc("2026-03-31T12:00:00Z"),
      );
    });

    it("com dia fixo 31, 31/03 vai para 31/05, sem disparar em abril", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-03-31T12:00:00Z", 31)).toEqual(
        utc("2026-05-31T12:00:00Z"),
      );
    });
  });
});

describe("buildFirstRemindAt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeNowAt(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(utc(iso));
  }

  it("sem dia fixo, usa a data em BRT do primeiro disparo com o horário informado", () => {
    // 02:00Z do dia 10 ainda é dia 09 em BRT.
    expect(buildFirstRemindAt("09:00", "2026-05-10T02:00:00Z")).toEqual(
      utc("2026-05-09T12:00:00Z"),
    );
  });

  it("sem dia fixo e sem primeiro disparo, lança erro", () => {
    expect(() => buildFirstRemindAt("09:00")).toThrow(
      "firstRemindAt é obrigatório quando dayOfMonth não é informado",
    );
  });

  it("com dia fixo ainda por vir, agenda neste mês", () => {
    freezeNowAt("2026-05-10T15:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 20)).toEqual(utc("2026-05-20T12:00:00Z"));
  });

  it("com dia fixo que já passou, agenda no mês seguinte", () => {
    freezeNowAt("2026-05-10T15:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 5)).toEqual(utc("2026-06-05T12:00:00Z"));
  });

  it("com dia fixo igual a hoje e horário já passado, agenda no mês seguinte", () => {
    freezeNowAt("2026-05-10T15:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 10)).toEqual(utc("2026-06-10T12:00:00Z"));
  });

  // Comportamento atual, candidato a correção: abril não tem dia 31 e o
  // primeiro disparo cai em 01/05, não em 30/04.
  it("dia fixo que não existe no mês corrente transborda para o dia 1 do mês seguinte", () => {
    freezeNowAt("2026-04-10T15:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 31)).toEqual(utc("2026-05-01T12:00:00Z"));
  });
});
