/**
 * Melhora os prompts do workflow Comprovante (Atendimento ACT):
 *  - AI_VISION/READ_PDF extraem MAIS dados (valor, remetente, banco, data, ID)
 *  - AI_DECISION valida que nome do remetente bate com nome do lead
 *  - Timeout estendido pra 30min (teste real)
 *  - Anti-duplicação preparada via vars.processedReceiptIds
 *    (próxima fase: persistir em tabela PaymentReceipt)
 *
 * Reaplicável: roda quantas vezes precisar — prompt sempre atualiza.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

const WF_ID = "lu15tjrvd1f1bbdmyf3a0bz7";
const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const EXPECTED_AMOUNT = 100.0; // valor da proposta — usado pra validar no decide
const TIMEOUT_MIN = 30; // 30min pra você enviar o comprovante real
const TAG_PAGO = "cmpu1t2yw000012xb4w1ayvjc";

async function main() {
  const nodes = await prisma.node.findMany({
    where: { workflowId: WF_ID },
    select: { id: true, type: true, data: true },
  });

  for (const n of nodes) {
    const data = n.data as Record<string, unknown>;
    let updated: Record<string, unknown> | null = null;

    if (n.type === "AI_VISION") {
      updated = {
        ...data,
        imageUrl: "{{vars.lastEvent.mediaUrl}}",
        organizationId: ORG_ID,
        prompt: `Você é um especialista em comprovantes de pagamento bancário brasileiros (PIX, TED, DOC, boleto, recibo). Analise esta imagem com MUITA atenção.

Identifique INDEPENDENTEMENTE DO BANCO ou tipo de operação:
1) Esta imagem É um comprovante de transação financeira REAL? (sim/não)
2) Valor exato pago em R$ (formato BR: 100,00 ou 1.500,00)
3) Nome COMPLETO do REMETENTE/pagador (quem ENVIOU o dinheiro)
4) Nome do destinatário (quem RECEBEU)
5) Data da operação (DD/MM/AAAA ou variantes)
6) Banco emissor (Itaú, Nubank, Bradesco, BB, Santander, Inter, C6, etc — extraia mesmo de logos)
7) ID/código da transação (ex: "ID: E1234abc", "transação 123456789", "PIX ID")
8) Sinal de adulteração? (cores erradas, textos sobrepostos, datas/valores recortados, ruído estranho — descreva o que viu)

FORMATO DE RESPOSTA (texto plano, sem markdown):
COMPROVANTE: sim|nao
VALOR: 100,00
REMETENTE: <nome completo OU "não identificado">
DESTINATARIO: <nome OU "não identificado">
DATA: <data OU "não identificada">
BANCO: <banco OU "não identificado">
ID_TRANSACAO: <id OU "não encontrado">
SUSPEITA_ADULTERACAO: nao|sim — <descrição se sim>
OBSERVACOES: <qualquer coisa relevante que viu, ex: tipo de operação (PIX/TED), instituição destinatária, formato suspeito>

Se NÃO for comprovante de pagamento, responda apenas:
NAO_E_COMPROVANTE: <descreva o que é, ex: foto pessoal, screenshot vazio, outra coisa>`,
      };
    } else if (n.type === "READ_PDF") {
      updated = {
        ...data,
        pdfUrl: "{{vars.lastEvent.mediaUrl}}",
        organizationId: ORG_ID,
        prompt: `Você está extraindo dados de um PDF que PODE ser um comprovante bancário (PIX, TED, DOC, boleto, recibo). Analise o texto extraído com atenção.

Identifique INDEPENDENTEMENTE DO BANCO:
1) É um comprovante de transação financeira real? (sim/não)
2) Valor pago em R$
3) Nome completo do REMETENTE (pagador)
4) Nome do destinatário
5) Data da operação
6) Banco emissor
7) ID/código da transação
8) Sinal de adulteração no texto?

FORMATO (texto plano):
COMPROVANTE: sim|nao
VALOR: <valor>
REMETENTE: <nome OU "não identificado">
DESTINATARIO: <nome OU "não identificado">
DATA: <data>
BANCO: <banco>
ID_TRANSACAO: <id>
SUSPEITA_ADULTERACAO: nao|sim
OBSERVACOES: <relevante>

Se não for comprovante:
NAO_E_COMPROVANTE: <descreva>`,
      };
    } else if (n.type === "AI_DECISION") {
      updated = {
        ...data,
        organizationId: ORG_ID,
        // Adicionar valor esperado em metadata pro prompt referenciar
        defaultBranchId: "sem_resposta",
        prompt: `Você está validando se o pagamento de R$ ${EXPECTED_AMOUNT.toFixed(2)} do lead {{lead.name}} foi confirmado.

Fontes disponíveis (use TODAS):
- Texto do lead: "{{vars.lastIncomingMessage}}"
- Tipo de mídia: {{vars.lastEvent.mediaType}}
- Nome do arquivo: {{vars.lastEvent.fileName}}
- Análise visual (se foto): {{vars.lastVisionResult}}
- Texto do PDF (se documento): {{vars.lastPdfText}}

VALIDAÇÃO ESTRITA (TODOS os 4 critérios precisam passar pra "pago"):

1) **VALOR**: o comprovante mostra R$ ${EXPECTED_AMOUNT.toFixed(2)} (ou bem próximo, ±R$ 1 por arredondamento)?

2) **REMETENTE**: o nome do REMETENTE/pagador no comprovante bate com "{{lead.name}}" (Atendimento ACT)?
   - Comparação tolerante: aceita variações de capitalização, abreviações, nome social vs completo, com/sem segundo nome.
   - Se REMETENTE vier "não identificado" mas valor + data + banco estiverem corretos, classifique como **divergente** (não fail completo, mas precisa revisão humana).
   - Se REMETENTE for CLARAMENTE outra pessoa não relacionada ao lead, classifique como **divergente**.

3) **DATA**: data do pagamento existe e é recente (até 7 dias atrás)?

4) **AUTENTICIDADE**: SUSPEITA_ADULTERACAO=nao? Se sim, classifique como **divergente** mesmo que tudo bata.

CLASSIFICAÇÃO:
- **pago**: todos os 4 critérios passam (valor + remetente + data + sem adulteração)
- **divergente**: enviou algo mas falhou em 1+ critério (valor errado, remetente diferente, suspeita de fraude)
- **sem_resposta**: lead só respondeu texto sem comprovante OU não respondeu nada

Responda APENAS o id (pago | divergente | sem_resposta).`,
      };
    } else if (n.type === "WAIT_FOR_EVENT") {
      updated = { ...data, timeoutMinutes: TIMEOUT_MIN };
    }

    if (updated) {
      await prisma.node.update({
        where: { id: n.id },
        data: { data: updated as never },
      });
      console.log("  ✓ patched", n.type, n.id);
    }
  }
  console.log(`\n✓ Workflow ${WF_ID} atualizado:`);
  console.log(`  - AI_VISION/READ_PDF extraem 8 campos (valor, remetente, destinatário, data, banco, ID, adulteração, observações)`);
  console.log(`  - AI_DECISION valida 4 critérios (valor R$ ${EXPECTED_AMOUNT} + remetente=${" Atendimento ACT"} + data recente + autenticidade)`);
  console.log(`  - WAIT_FOR_EVENT timeout = ${TIMEOUT_MIN} min`);
  console.log();
  console.log(`Tag "Pago" id: ${TAG_PAGO}`);
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
