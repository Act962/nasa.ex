// Confere o menu em texto numerado para número fora da API oficial (spec 0095). Puro.
import { formatNumberedMenu, numberedMenuMetadata, readNumberedOptions, resolveNumberedReply } from "../src/features/tracking-chat/lib/numbered-menu";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const options = [
  { id: "agendar", title: "Agendar consulta" },
  { id: "horarios", title: "Meus horários" },
  { id: "atendente", title: "Falar com atendente" },
];
const text = formatNumberedMenu({ body: "Olá! Como posso ajudar?", options, footer: "Clínica" });
check("CA-2 corpo, uma linha por opção na ordem, rodapé e instrução", text === "Olá! Como posso ajudar?\n\n1 – Agendar consulta\n2 – Meus horários\n3 – Falar com atendente\n\nClínica\nResponda com o número da opção.", JSON.stringify(text));
check("CA-2 sem rodapé não sobra linha", formatNumberedMenu({ body: "Oi", options }).endsWith("3 – Falar com atendente\n\nResponda com o número da opção."));
check("CB-1 mais de 10 opções saem todas", formatNumberedMenu({ body: "x", options: Array.from({ length: 14 }, (_, index) => ({ id: `o${index}`, title: `Opção ${index}` })) }).includes("14 – Opção 13"));

for (const reply of ["2", "2.", " 2 ", "opção 2", "Opcao 2", "2)", "número 2"]) check(`CA-3 "${reply}" escolhe a segunda opção`, resolveNumberedReply(reply, options)?.id === "horarios");
check("CA-3 o texto exato da opção vale, sem acento e com maiúscula", resolveNumberedReply("MEUS HORARIOS", options)?.id === "horarios" && resolveNumberedReply("Agendar consulta.", options)?.id === "agendar");
for (const reply of ["22", "0", "4", "olá", "quero o 2 por favor", "", "2 e 3"]) check(`CA-3 "${reply}" não escolhe nada`, resolveNumberedReply(reply, options) === null);
check("CB-2 sem menu pendente, número é texto comum", resolveNumberedReply("2", []) === null);

const stored = numberedMenuMetadata(options);
check("o que é gravado na mensagem é lido de volta", readNumberedOptions(stored).length === 3 && readNumberedOptions(stored)[1].id === "horarios");
check("segurança: metadado estranho não vira opção", readNumberedOptions({ numberedOptions: [{ id: 1, title: "x" }, "y", null, { id: "ok", title: "Certo" }] }).length === 1 && readNumberedOptions(null).length === 0 && readNumberedOptions({ numberedOptions: "tudo" }).length === 0);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
