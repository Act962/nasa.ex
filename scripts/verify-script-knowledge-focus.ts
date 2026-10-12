// Confere o recorte do roteiro por assunto (spec 0091). Sem IA. Rodar:
//   pnpm tsx scripts/verify-script-knowledge-focus.ts <rascunho.json>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScriptKnowledge, scriptDraftSchema } from "../src/features/tracking-chat-ai/lib/attendance-setup/script-draft";
import { focusScriptKnowledge, isScriptKnowledge } from "../src/features/tracking-chat-ai/lib/attendance-setup/script-knowledge-focus";

const draft = scriptDraftSchema.parse(JSON.parse(readFileSync(process.argv[2], "utf8")));
const full = buildScriptKnowledge({ draft, trackingId: "t", writtenAt: new Date() }).content;
const focus = (tagNames: string[], recentText: string) => focusScriptKnowledge(full, { tagNames, recentText });
const has = (content: string, heading: string) => content.includes(`## ${heading}`);
let checks = 0;
const check = (label: string, isOk: boolean, detail = "") => {
  assert.ok(isOk, `${label} ${detail}`);
  checks += 1;
  console.log(`ok    ${label}${detail ? ` · ${detail}` : ""}`);
};

check("documento do roteiro é reconhecido", isScriptKnowledge(full));
const greeting = focus([], "oi, boa tarde");
check("saudação: só as informações gerais", has(greeting, "Informações gerais") && !has(greeting, "Cirurgia de Catarata"), `${full.length} → ${greeting.length} caracteres`);
check("saudação: os outros assuntos ficam listados por nome", greeting.includes("## Outros assuntos") && greeting.includes("Cirurgia de Catarata"));
const byTag = focus(["Interesse: Cirurgia de Catarata"], "ok");
check("tag de interesse traz o assunto dela", has(byTag, "Cirurgia de Catarata") && !has(byTag, "Toxina Botulínica"), `${byTag.length} caracteres`);
const byText = focus([], "quanto custa o botox?");
check("palavra do cliente sem ser o nome do assunto ainda acha (botox → Toxina Botulínica)", has(byText, "Toxina Botulínica"));
const eyelid = focus([], "tenho a pálpebra caída, o que vocês fazem?");
check("sintoma citado acha o assunto (pálpebra → Plástica Ocular)", has(eyelid, "Cirurgia Plástica Ocular (Blefaroplastia)"));
const two = focus(["Interesse: SLT (tratamento a laser para Glaucoma)"], "e o spa dos olhos, como funciona?");
check("dois assuntos em pauta trazem os dois", has(two, "SLT (tratamento a laser para Glaucoma)") && has(two, "SPA dos Olhos (tratamento para olho seco)"));
check("pergunta geral não puxa assunto nenhum", !has(focus([], "vocês atendem Unimed? qual o endereço?"), "Cirurgia Refrativa"));
console.log(`TUDO CERTO (${checks} verificações) · documento inteiro: ${full.length} caracteres`);
