import { describe, expect, it } from "vitest";
import {
  buildAutomation,
  buildCommentEvent,
  buildRule,
  buildTrigger,
} from "./automation-fixtures";
import { selectTrigger, triggerCoversContent } from "./trigger-selection";

const specificTo = (externalContentId: string) =>
  buildTrigger({ targetScope: "SPECIFIC_CONTENT", targets: [{ externalContentId }] });

describe("triggerCoversContent", () => {
  it("gatilho de outro tipo de evento não cobre", () => {
    const trigger = buildTrigger({ eventType: "DIRECT_MESSAGE_RECEIVED" });

    expect(triggerCoversContent(trigger, buildCommentEvent())).toBe(false);
  });

  it("mensagem direta é coberta independentemente do escopo de conteúdo", () => {
    const trigger = buildTrigger({
      eventType: "DIRECT_MESSAGE_RECEIVED",
      targetScope: "SPECIFIC_CONTENT",
    });
    const event = buildCommentEvent({ type: "DIRECT_MESSAGE_RECEIVED", content: undefined });

    expect(triggerCoversContent(trigger, event)).toBe(true);
  });

  it("ALL_CONTENT cobre qualquer publicação e NEXT_CONTENT nenhuma", () => {
    expect(triggerCoversContent(buildTrigger({ targetScope: "ALL_CONTENT" }), buildCommentEvent())).toBe(true);
    expect(triggerCoversContent(buildTrigger({ targetScope: "NEXT_CONTENT" }), buildCommentEvent())).toBe(false);
  });

  it("D-3: SPECIFIC_CONTENT só cobre as publicações escolhidas", () => {
    expect(triggerCoversContent(specificTo("post-1"), buildCommentEvent())).toBe(true);
    expect(triggerCoversContent(specificTo("post-2"), buildCommentEvent())).toBe(false);
    expect(triggerCoversContent(specificTo("post-1"), buildCommentEvent({ content: undefined }))).toBe(false);
  });
});

describe("selectTrigger", () => {
  it("devolve null quando nenhum gatilho é elegível", () => {
    const automations = [
      buildAutomation({ triggers: [buildTrigger({ rules: [buildRule({ terms: ["frete"] })] })] }),
    ];

    expect(selectTrigger(automations, buildCommentEvent())).toBeNull();
    expect(selectTrigger([], buildCommentEvent())).toBeNull();
  });

  it("ignora automação inativa e gatilho desligado", () => {
    const automations = [
      buildAutomation({ id: "inativa", isActive: false }),
      buildAutomation({ id: "desligada", triggers: [buildTrigger({ isEnabled: false })] }),
    ];

    expect(selectTrigger(automations, buildCommentEvent())).toBeNull();
  });

  it("CA-9: entre vários elegíveis, escolhe um só", () => {
    const automations = [
      buildAutomation({ id: "a", triggers: [buildTrigger({ id: "t-a" })] }),
      buildAutomation({ id: "b", triggers: [buildTrigger({ id: "t-b" })] }),
    ];

    const selection = selectTrigger(automations, buildCommentEvent());

    expect(selection?.trigger.id).toBe("t-a");
  });

  it("RF-12: publicação específica ganha de todas as publicações, mesmo casando menos termos", () => {
    const allContent = buildTrigger({
      id: "todas",
      rules: [buildRule({ terms: ["preço", "qual"] })],
    });
    const specific = { ...specificTo("post-1"), id: "especifica" };
    const automations = [buildAutomation({ triggers: [allContent, specific] })];

    const selection = selectTrigger(automations, buildCommentEvent());

    expect(selection?.trigger.id).toBe("especifica");
    expect(selection?.isSpecificTarget).toBe(true);
  });

  it("RF-12: no mesmo escopo, ganha quem casou mais termos", () => {
    const oneTerm = buildTrigger({ id: "um-termo", rules: [buildRule({ terms: ["preço"] })] });
    const twoTerms = buildTrigger({
      id: "dois-termos",
      rules: [buildRule({ terms: ["preço", "qual"] })],
    });
    const automations = [buildAutomation({ triggers: [oneTerm, twoTerms] })];

    const selection = selectTrigger(automations, buildCommentEvent());

    expect(selection?.trigger.id).toBe("dois-termos");
    expect(selection?.outcome.matchedTerms).toEqual(["preco", "qual"]);
  });

  it("RF-12: no empate, ganha o gatilho mais antigo, em qualquer ordem de entrada", () => {
    const older = buildTrigger({ id: "antigo", createdAt: new Date("2026-01-01T00:00:00Z") });
    const newer = buildTrigger({ id: "novo", createdAt: new Date("2026-02-01T00:00:00Z") });

    const newerFirst = selectTrigger(
      [buildAutomation({ triggers: [newer, older] })],
      buildCommentEvent(),
    );
    const olderFirst = selectTrigger(
      [buildAutomation({ triggers: [older, newer] })],
      buildCommentEvent(),
    );

    expect(newerFirst?.trigger.id).toBe("antigo");
    expect(olderFirst?.trigger.id).toBe("antigo");
  });
});
