import { describe, expect, it } from "vitest";
import { buildAutomation, buildRule, buildStep, buildTrigger } from "./automation-fixtures";
import { findReadinessIssues } from "./automation-readiness";

const issuesFor = (...triggers: ReturnType<typeof buildTrigger>[]) =>
  findReadinessIssues(buildAutomation({ triggers }));

describe("findReadinessIssues", () => {
  it("automação completa não tem pendência", () => {
    expect(issuesFor(buildTrigger({ rules: [buildRule()] }))).toEqual([]);
  });

  it("sem gatilho, a única pendência é adicionar um", () => {
    expect(issuesFor()).toEqual([{ message: "Adicione um gatilho." }]);
  });

  it("publicação específica sem publicação escolhida", () => {
    const issues = issuesFor(buildTrigger({ targetScope: "SPECIFIC_CONTENT", targets: [] }));

    expect(issues).toEqual([
      { triggerId: "trigger-1", message: "Escolha ao menos uma publicação ou mude para todas." },
    ]);
  });

  it("mensagem direta não exige publicação escolhida", () => {
    const issues = issuesFor(
      buildTrigger({
        eventType: "DIRECT_MESSAGE_RECEIVED",
        targetScope: "SPECIFIC_CONTENT",
        targets: [],
      }),
    );

    expect(issues).toEqual([]);
  });

  it("só regras de exclusão é pendência; qualquer comentário ou nenhuma regra não é", () => {
    const onlyExclude = buildTrigger({ rules: [buildRule({ kind: "EXCLUDE" })] });
    const anyText = buildTrigger({
      rules: [buildRule({ kind: "EXCLUDE" }), buildRule({ operator: "ANY_TEXT", terms: [] })],
    });

    expect(issuesFor(onlyExclude)).toEqual([
      {
        triggerId: "trigger-1",
        message:
          "Só há regras de exclusão — adicione palavras-chave ou marque qualquer comentário.",
      },
    ]);
    expect(issuesFor(anyText)).toEqual([]);
    expect(issuesFor(buildTrigger({ rules: [] }))).toEqual([]);
  });

  it("sem passo ligado, pede uma resposta", () => {
    expect(issuesFor(buildTrigger({ steps: [] }))).toEqual([
      { triggerId: "trigger-1", message: "Adicione uma resposta." },
    ]);
    expect(issuesFor(buildTrigger({ steps: [buildStep({ isEnabled: false })] }))).toEqual([
      { triggerId: "trigger-1", message: "Adicione uma resposta." },
    ]);
  });

  it("passos ligados sem conteúdo", () => {
    const emptyReply = buildStep({ config: { variants: ["", "  "], strategy: "RANDOM" } });
    const emptyMessage = buildStep({
      id: "step-2",
      kind: "SEND_DIRECT_MESSAGE",
      config: { source: "STATIC", text: " ", buttons: [] },
    });

    expect(issuesFor(buildTrigger({ steps: [emptyReply, emptyMessage] }))).toEqual([
      { triggerId: "trigger-1", message: "A resposta está vazia." },
    ]);
  });

  it("basta um passo ligado com conteúdo; mensagem por IA vale pelo prompt", () => {
    const emptyReply = buildStep({ config: { variants: [""], strategy: "RANDOM" } });
    const aiMessage = buildStep({
      id: "step-2",
      kind: "SEND_DIRECT_MESSAGE",
      config: { source: "AI", aiPrompt: "Responda com o preço.", buttons: [] },
    });
    const aiWithoutPrompt = buildStep({
      id: "step-3",
      kind: "SEND_DIRECT_MESSAGE",
      config: { source: "AI", text: "ignorado", buttons: [] },
    });

    expect(issuesFor(buildTrigger({ steps: [emptyReply, aiMessage] }))).toEqual([]);
    expect(issuesFor(buildTrigger({ steps: [aiWithoutPrompt] }))).toEqual([
      { triggerId: "trigger-1", message: "A resposta está vazia." },
    ]);
  });

  it("acumula as pendências de cada gatilho, com o id de cada um", () => {
    const issues = issuesFor(
      buildTrigger({ id: "t-1", targetScope: "SPECIFIC_CONTENT", steps: [] }),
      buildTrigger({ id: "t-2", rules: [buildRule({ kind: "EXCLUDE" })] }),
    );

    expect(issues.map((issue) => issue.triggerId)).toEqual(["t-1", "t-1", "t-2"]);
  });
});
