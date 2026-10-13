import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderRecurrenceType } from "@/generated/prisma/enums";
import {
  buildFirstRemindAt,
  computeNextRemindAt,
  resolveMonthlyAnchorDay,
} from "./reminder-recurrence";

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

  describe("spec 0102: mês que não tem o dia de referência", () => {
    it("CA-1: dia 31 em 31/01 vai para o último dia de fevereiro", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-31T12:00:00Z", 31)).toEqual(
        utc("2026-02-28T12:00:00Z"),
      );
    });

    it("CA-1: em ano bissexto, fevereiro vai até o dia 29", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2028-01-31T12:00:00Z", 31)).toEqual(
        utc("2028-02-29T12:00:00Z"),
      );
    });

    it("CA-2: depois do mês curto, volta ao dia de referência", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-02-28T12:00:00Z", 31)).toEqual(
        utc("2026-03-31T12:00:00Z"),
      );
    });

    it("CA-3: dia 31 em 31/03 vai para 30/04", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-03-31T12:00:00Z", 31)).toEqual(
        utc("2026-04-30T12:00:00Z"),
      );
    });

    it("CA-4: dezembro vai para janeiro do ano seguinte", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-12-31T12:00:00Z", 31)).toEqual(
        utc("2027-01-31T12:00:00Z"),
      );
    });

    it("RF-1: um ano de ocorrências com dia 31 passa por todos os meses", () => {
      const occurrences: string[] = [];
      let current: Date | null = utc("2026-01-31T12:00:00Z");
      for (let i = 0; i < 12 && current; i++) {
        occurrences.push(current.toISOString().slice(0, 10));
        current = computeNextRemindAt({
          recurrenceType: ReminderRecurrenceType.MONTHLY,
          dayOfMonth: 31,
          nextRemindAt: current,
        });
      }

      expect(occurrences).toEqual([
        "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
        "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31",
      ]);
    });

    it("CB-1: lembrete antigo sem dia de referência não pula o mês, mas fica no dia 28", () => {
      const february = nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-01-31T12:00:00Z");
      const march = computeNextRemindAt({
        recurrenceType: ReminderRecurrenceType.MONTHLY,
        dayOfMonth: null,
        nextRemindAt: february,
      });

      expect(february).toEqual(utc("2026-02-28T12:00:00Z"));
      expect(march).toEqual(utc("2026-03-28T12:00:00Z"));
    });

    it("CB-3: às 22:30 BRT do dia 31/01, a conta usa a data em BRT", () => {
      expect(nextRemindAtFor(ReminderRecurrenceType.MONTHLY, "2026-02-01T01:30:00Z", 31)).toEqual(
        utc("2026-03-01T01:30:00Z"),
      );
    });
  });
});

describe("resolveMonthlyAnchorDay", () => {
  it("CA-5: mensal sem dia fixo grava o dia da data de início", () => {
    expect(
      resolveMonthlyAnchorDay(ReminderRecurrenceType.MONTHLY, undefined, utc("2026-01-31T12:00:00Z")),
    ).toBe(31);
  });

  it("CB-3: o dia vem da data em BRT, não em UTC", () => {
    expect(
      resolveMonthlyAnchorDay(ReminderRecurrenceType.MONTHLY, undefined, utc("2026-02-01T01:30:00Z")),
    ).toBe(31);
  });

  it("CB-4: dia fixo informado prevalece", () => {
    expect(
      resolveMonthlyAnchorDay(ReminderRecurrenceType.MONTHLY, 15, utc("2026-01-31T12:00:00Z")),
    ).toBe(15);
  });

  it.each([
    ReminderRecurrenceType.ONCE,
    ReminderRecurrenceType.WEEKLY,
    ReminderRecurrenceType.BIWEEKLY,
  ])("CA-6: %s não deriva dia de referência", (recurrenceType) => {
    expect(resolveMonthlyAnchorDay(recurrenceType, undefined, utc("2026-01-31T12:00:00Z"))).toBeNull();
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

  it("CA-7: dia fixo que não existe no mês corrente cai no último dia do mês", () => {
    freezeNowAt("2026-04-10T15:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 31)).toEqual(utc("2026-04-30T12:00:00Z"));
  });

  it("CB-6: se o último dia válido do mês já passou, vai para o mês seguinte", () => {
    freezeNowAt("2026-04-30T23:00:00Z");

    expect(buildFirstRemindAt("09:00", undefined, 31)).toEqual(utc("2026-05-31T12:00:00Z"));
  });
});
