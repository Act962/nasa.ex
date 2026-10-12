// Confere a abertura de assunto dos fluxos montados a partir do roteiro (spec 0091, ajuste de
// 2026-10-11): a saudação e a apresentação da assistente, que o menu já fez, não se repetem. Puro.
import { BOOKS_BY_AGENDA_RULE, allowBookingInPrompt, scriptBehaviorRules, stripRepeatedIntroduction } from "../src/features/tracking-chat-ai/lib/attendance-setup/script-draft";

let failureCount = 0;
function check(name: string, input: string, expected: string) {
  const actual = stripRepeatedIntroduction(input);
  const isOk = actual === expected;
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${isOk ? "" : ` — veio: ${actual}`}`);
}

check("tira saudação, cortesia e apresentação", "👋 Olá! Tudo bem? Sou a Oculina, assistente virtual da Clínica Tércio Rezende. O SLT é um tratamento moderno e seguro. Quer saber como funciona?", "O SLT é um tratamento moderno e seguro. Quer saber como funciona?");
check("apresentação emendada com o assunto mantém o assunto", "👋 Olá! Tudo bem? Sou a Oculina, assistente da Clínica, e vou te explicar tudo sobre a Cirurgia de Catarata. Posso te contar como funciona?", "Vou te explicar tudo sobre a Cirurgia de Catarata. Posso te contar como funciona?");
check("só saudação e cortesia", "👋 Olá! Que bom ter você aqui! O SPA dos Olhos alivia os sintomas do olho seco.", "O SPA dos Olhos alivia os sintomas do olho seco.");
check("\"Oi\" e \"Me chamo\"", "Oi! Me chamo Ana. Trabalhamos com polimento e vitrificação de pintura.", "Trabalhamos com polimento e vitrificação de pintura.");
check("abertura sem saudação fica como está", "A Cirurgia Refrativa corrige miopia, hipermetropia e astigmatismo.", "A Cirurgia Refrativa corrige miopia, hipermetropia e astigmatismo.");
check("palavra que só começa parecido não é cortada", "Oitenta por cento dos pacientes voltam às atividades no dia seguinte.", "Oitenta por cento dos pacientes voltam às atividades no dia seguinte.");
check("\"Sou\" no meio da frase não é apresentação", "O atendimento é comigo, que sou especialista em retina, de segunda a sexta.", "O atendimento é comigo, que sou especialista em retina, de segunda a sexta.");
check("se sobrar quase nada, volta o texto original", "Olá! Sou a Oculina.", "Olá! Sou a Oculina.");

// Agenda ligada: a regra do roteiro que proíbe marcar sai, e entra a de marcar pela agenda.
function checkThat(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const rules = [
  "Não realize agendamento direto: direcione o paciente para o link de agendamento ou para a equipe de agendamento.",
  "Não indique agendamento de consulta de rotina por aqui: informe o contato da central de agendamento.",
  "Ao encaminhar para o agendamento, diga: \"Perfeito! Agora vou encaminhar suas informações ao nosso setor de agendamentos.\"",
  "Sobre convênio: confirme se é aceito e cheque se o agendamento é para a avaliação daquele assunto.",
  "Nunca informe valores de cirurgia.",
  "Siga a ordem: identificar se é cirurgia; verificar se já há indicação médica; coletar os dados; avisar que vai encaminhar ao agendamento.",
];
const withAgenda = scriptBehaviorRules(rules, true);
const withoutAgenda = scriptBehaviorRules(rules, false);
checkThat("sem agenda, as regras do roteiro ficam como vieram", withoutAgenda.length === 6 && !withoutAgenda.includes(BOOKS_BY_AGENDA_RULE));
checkThat("com agenda, saem as três regras que proíbem marcar", withAgenda.length === 4, withAgenda.join(" | ").slice(0, 160));
checkThat("com agenda, a regra de convênio e a de valores continuam", withAgenda.some((rule) => rule.includes("convênio")) && withAgenda.some((rule) => rule.includes("valores")));
checkThat("regra com outra orientação junto fica, só troca o trecho de encaminhar", withAgenda.some((rule) => rule.includes("verificar se já há indicação médica") && rule.includes("oferecer os horários da agenda e marcar") && !rule.includes("encaminhar")));
checkThat("com agenda, entra a regra de marcar pela agenda", withAgenda.at(-1) === BOOKS_BY_AGENDA_RULE);
const savedPrompt = ["Você é Oculina.", ...rules.map((rule) => `- ${rule}`), "", "Você não é profissional de saúde."].join("\n");
const fixedPrompt = allowBookingInPrompt(savedPrompt);
checkThat("instruções já gravadas: tira as proibições e mantém o resto", !/Não realize agendamento|setor de agendamentos|central de agendamento/.test(fixedPrompt) && fixedPrompt.includes("Você é Oculina.") && fixedPrompt.includes("profissional de saúde") && fixedPrompt.includes("valores de cirurgia"));
checkThat("aplicar duas vezes não duplica a regra", allowBookingInPrompt(fixedPrompt).split(BOOKS_BY_AGENDA_RULE).length === 2);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
