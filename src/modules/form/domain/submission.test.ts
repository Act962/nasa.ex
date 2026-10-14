import { describe, expect, it } from "vitest";
import {
  didLeadChangePosition,
  readDraftLeadIdentity,
  readLeadIdentity,
  responseMilestoneAction,
  type LeadPlacement,
  type LeadPlacementOutcome,
} from "./submission";

describe("readLeadIdentity", () => {
  it("lê nome, e-mail e telefone dos campos de identificação", () => {
    const response = JSON.stringify({ user_name: "Ana", user_email: "ana@exemplo.com", user_phone: "5511912345678" });

    expect(readLeadIdentity(response)).toEqual({
      name: "Ana",
      email: "ana@exemplo.com",
      phone: "5511912345678",
    });
  });

  it("campo ausente ou vazio vira 'Sem nome' e nulo", () => {
    expect(readLeadIdentity(JSON.stringify({ user_name: "", user_phone: "" }))).toEqual({
      name: "Sem nome",
      email: null,
      phone: null,
    });
  });

  it.each(["isto não é json", "null", "42", "[]"])("resposta %s vira identidade vazia", (response) => {
    expect(readLeadIdentity(response)).toEqual({ name: "Sem nome", email: null, phone: null });
  });
});

describe("readDraftLeadIdentity", () => {
  it("aceita só texto e mantém o texto vazio como veio", () => {
    expect(readDraftLeadIdentity(JSON.stringify({ user_name: "", user_phone: 5511, user_email: "ana@exemplo.com" }))).toEqual({
      name: "",
      email: "ana@exemplo.com",
      phone: null,
    });
  });

  it.each(["isto não é json", "null"])("resposta %s vira identidade vazia", (response) => {
    expect(readDraftLeadIdentity(response)).toEqual({ name: "Sem nome", email: null, phone: null });
  });
});

describe("responseMilestoneAction", () => {
  it("só a 10ª e a 100ª resposta são marco", () => {
    expect(responseMilestoneAction(10)).toBe("form_10_responses");
    expect(responseMilestoneAction(100)).toBe("form_100_responses");
    expect([0, 1, 9, 11, 99, 101, 1000].map(responseMilestoneAction)).toEqual(Array(7).fill(null));
  });
});

describe("didLeadChangePosition", () => {
  const placementWith = (outcome: LeadPlacementOutcome): LeadPlacement => ({
    lead: { id: "lead", name: "Ana", email: null, phone: null, publicToken: null, responsibleId: null },
    outcome,
    from: null,
    to: { trackingId: "tracking", statusId: "status" },
  });

  it("mover de coluna e trocar de tracking mudam a posição; criar e reaproveitar, não", () => {
    expect(didLeadChangePosition(placementWith("moved"))).toBe(true);
    expect(didLeadChangePosition(placementWith("relocated"))).toBe(true);
    expect(didLeadChangePosition(placementWith("created"))).toBe(false);
    expect(didLeadChangePosition(placementWith("reused"))).toBe(false);
  });
});
