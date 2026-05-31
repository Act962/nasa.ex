/**
 * Substitui os nodes do workflow "Agente de Agendamento" do tracking
 * AGENDAMENTO por um fluxo completo:
 *
 *   NEW_LEAD
 *     → SEND saudação + menu 1/2/3
 *     → WAIT 24h por resposta
 *     → AI_DECISION "qual opção?"
 *        ├ "opcao_3" (agendar)
 *        │    SEND link agenda
 *        │    WAIT 5min por mensagem
 *        │    AI_DECISION "agendou?"
 *        │      ├ "agendou" → SEND obrigado + link reagendar → TAG AGENDA → FIM
 *        │      └ "ainda_nao" →
 *        │            TAG "Quer agendar"
 *        │            SEND "conseguiu agendar?"
 *        │            WAIT 24h
 *        │            AI_DECISION "resposta?"
 *        │              ├ "agradeceu" → SEND "conta com a gente!" → FIM
 *        │              ├ "nao_quer" → TAG Follow-up 15 + SEND "te entendo" → FIM
 *        │              └ "sem_resposta" → LOOP follow-up 1/2/3/5/7 dias
 *        │                     (LOOP_OVER + 5x WAIT + SEND msg variada)
 *        │
 *        └ "outras" → SEND fallback → FIM
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();

import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";

// ─── Constantes do tracking — args via CLI override ──
const WORKFLOW_ID = process.argv[2] ?? "u79dbh3ghv32by1djax7p2g0";
const TRACKING_ID = process.argv[3] ?? "cmpqztlub007vdxxb27ubal43";
const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const AGENDA_LINK = "http://localhost:3000/agenda/gothan-city/consultoria-gotham";
const TAG_AGENDA = "cmpn85en3001s89xbrosqihn9";
const TAG_QUER_AGENDAR = "cmpr7u5il0026cgxbrt9itmo2";
const TAG_FOLLOWUP_15 = "cmpr7vl3r002bcgxb4bs7cxz2";

async function main() {
  // 1. Garante tags necessárias (idempotente)
  async function ensureTag(name: string, slug: string, color: string) {
    let t = await prisma.tag.findFirst({
      where: { name, organizationId: ORG_ID, trackingId: null },
      select: { id: true },
    });
    if (!t) {
      t = await prisma.tag.create({
        data: {
          id: createId(),
          name,
          slug,
          organizationId: ORG_ID,
          color,
        },
        select: { id: true },
      });
      console.log(`✓ Tag "${name}" criada: ${t.id}`);
    }
    return t.id;
  }
  const TAG_DESISTIU_90 = await ensureTag("Desistiu 90", "desistiu-90", "#ef4444");
  const TAG_INTERESSE_PRODUTOS = await ensureTag(
    "Interesse em produtos",
    "interesse-produtos",
    "#3b82f6",
  );
  const TAG_QUER_SABER_NASA = await ensureTag(
    "Quer saber mais sobre NASA",
    "quer-saber-nasa",
    "#a855f7",
  );
  const TAG_ATENDIMENTO_HUMANO = await ensureTag(
    "Atendimento humano",
    "atendimento-humano",
    "#f59e0b",
  );

  // 2. Limpa workflow atual (nodes + connections)
  await prisma.connection.deleteMany({ where: { workflowId: WORKFLOW_ID } });
  await prisma.node.deleteMany({ where: { workflowId: WORKFLOW_ID } });
  console.log(`✓ Workflow limpo`);

  // 3. Constrói blueprint
  const ids = {
    triggerNewLead: "trg",
    sendMenu: "send-menu",
    waitMenuReply: "wait-menu",
    decideOpcao: "decide-opcao",
    // Opção 3 - agendar
    sendLinkAgenda: "send-link",
    waitAgendou: "wait-agendou",
    decideAgendou: "decide-agendou",
    // Agendou
    sendObrigadoAgendou: "send-obrigado",
    tagAgendaAdd: "tag-agenda",
    // Não agendou
    tagQuerAgendar: "tag-quer",
    sendConseguiu: "send-conseguiu",
    waitRespostaQuer: "wait-resp",
    decideResposta: "decide-resp",
    sendAgradeceu: "send-agradeceu",
    tagFollowup15: "tag-fu15",
    sendTeEntendo: "send-te-entendo",
    // Follow-up loop (5 mensagens em sequência com WAIT entre)
    wait1d: "wait-1d",
    sendFu1: "send-fu1",
    waitResp1: "wait-resp1",
    aiDecideResp1: "ai-decide-resp1",
    wait1d2: "wait-1d2",
    sendFu2: "send-fu2",
    waitResp2: "wait-resp2",
    aiDecideResp2: "ai-decide-resp2",
    wait1d3: "wait-1d3",
    sendFu3: "send-fu3",
    waitResp3: "wait-resp3",
    aiDecideResp3: "ai-decide-resp3",
    wait2d: "wait-2d",
    sendFu4: "send-fu4",
    waitResp4: "wait-resp4",
    aiDecideResp4: "ai-decide-resp4",
    wait2d2: "wait-2d2",
    sendFu5: "send-fu5",
    waitResp5: "wait-resp5",
    aiDecideResp5: "ai-decide-resp5",
    tagDesistiu90: "tag-desistiu",
    // Branch outras opções
    sendOutras: "send-outras",
    tagAtendimentoHumano: "tag-humano",
    // Branch opção 1 (Produtos)
    tagInteresseProdutos: "tag-int-prod",
    sendProdutos: "send-prod",
    // Branch opção 2 (NASA)
    tagQuerSaberNasa: "tag-quer-nasa",
    sendNasa: "send-nasa",
    // Caminho de conversão (MERGE para os 5 AI_DECISIONs do loop)
    mergeAgendouLoop: "merge-loop",
  } as const;

  const nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }> = [];

  // Helpers pra reduzir verbosidade
  const N = (
    id: string,
    type: string,
    x: number,
    y: number,
    data: Record<string, unknown> = {},
  ) => nodes.push({ id, type, position: { x, y }, data });

  N(ids.triggerNewLead, "NEW_LEAD", 0, 0);

  N(ids.sendMenu, "SEND_MESSAGE", 280, 0, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Olá {{lead.name}}, seja bem-vindo ao NASA!\n\nEscolha uma das opções abaixo:\n\n1 - Produtos\n2 - NASA\n3 - Agendar reunião",
      },
    },
  });

  N(ids.waitMenuReply, "WAIT_FOR_EVENT", 560, 0, {
    eventName: "message-incoming",
    timeoutMinutes: 60 * 24,
  });

  N(ids.decideOpcao, "AI_DECISION", 840, 0, {
    organizationId: ORG_ID,
    prompt:
      "Analise APENAS a última mensagem do lead {{lead.name}} respondendo ao menu:\n1 - Produtos\n2 - NASA\n3 - Agendar reunião\n\nClassificação rigorosa:\n- 'opcao_1' → SE disse '1' OU palavras claras sobre produtos ('produto', 'produtos', 'catálogo')\n- 'opcao_2' → SE disse '2' OU perguntou sobre o NASA ('nasa', 'sobre vocês', 'o que é')\n- 'opcao_3' → SE disse '3' OU 'agendar', 'agenda', 'marcar', 'reunião', 'consulta'\n- 'outras' → DEFAULT pra qualquer resposta fora do menu (saudação solta, dúvida ampla, mensagem genérica)\n\nNa dúvida → 'outras'.",
    branches: [
      { id: "outras", label: "Fora do menu / ambíguo (default)", description: "Default — qualquer resposta fora das 3 opções" },
      { id: "opcao_1", label: "Quer ver produtos", description: "Disse '1' ou 'produtos'" },
      { id: "opcao_2", label: "Quer saber sobre NASA", description: "Disse '2' ou 'nasa', 'sobre vocês'" },
      { id: "opcao_3", label: "Quer agendar reunião", description: "Disse '3' ou 'agendar', 'reunião'" },
    ],
  });

  // ── Branch "opcao_1" (Produtos) ──
  N(ids.tagInteresseProdutos, "TAG", 1120, 350, {
    action: { type: "ADD", tagsIds: [TAG_INTERESSE_PRODUTOS] },
  });
  N(ids.sendProdutos, "SEND_MESSAGE", 1400, 350, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Show, {{lead.name}}! 🚀\n\nNossos produtos cobrem toda a operação comercial: tracking de leads, agendamento, propostas, IA conversacional. Um especialista vai te chamar com mais detalhes em instantes.",
      },
    },
  });

  // ── Branch "opcao_2" (NASA) ──
  N(ids.tagQuerSaberNasa, "TAG", 1120, 500, {
    action: { type: "ADD", tagsIds: [TAG_QUER_SABER_NASA] },
  });
  N(ids.sendNasa, "SEND_MESSAGE", 1400, 500, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Que ótimo, {{lead.name}}! 🌎\n\nO NASA é a plataforma all-in-one pra times comerciais — automação, IA, agendamento e analytics num lugar só. Um consultor vai te explicar tudo em detalhe.",
      },
    },
  });

  // Branch "agendar" (opção 3)
  N(ids.sendLinkAgenda, "SEND_MESSAGE", 1120, -120, {
    action: {
      payload: {
        type: "TEXT",
        message: `Ótima escolha, {{lead.name}}! Segue o link de agendamento:\n\n${AGENDA_LINK}`,
      },
    },
  });

  N(ids.waitAgendou, "WAIT_FOR_EVENT", 1400, -120, {
    eventName: "message-incoming",
    timeoutMinutes: 1,
  });

  N(ids.decideAgendou, "AI_DECISION", 1680, -120, {
    organizationId: ORG_ID,
    prompt:
      "O lead {{lead.name}} recebeu um link de agendamento e acabou de responder algo. CRITÉRIO RIGOROSO:\n\nResponda 'agendou' SOMENTE se o lead confirmar EXPLICITAMENTE que ele conseguiu marcar/agendou, com palavras claras como:\n- 'agendei'\n- 'marquei'\n- 'consegui agendar'\n- 'pronto, está marcado'\n- 'feito'\n- 'confirmado'\n\nPra qualquer outra coisa (dúvida, número solto como '1' ou '2', '?', resposta ambígua, pergunta sobre horário, 'estou tentando', silêncio com mensagem qualquer) responda 'ainda_nao'.\n\nNa dúvida → 'ainda_nao'.",
    branches: [
      { id: "ainda_nao", label: "Ainda não agendou ou ambíguo", description: "Default conservador — tudo que não for confirmação explícita" },
      { id: "agendou", label: "Confirmou agendamento EXPLICITAMENTE", description: "SOMENTE se disse 'agendei', 'marquei', 'pronto', 'consegui'" },
    ],
  });

  // Agendou — happy path
  N(ids.sendObrigadoAgendou, "SEND_MESSAGE", 1960, -240, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Obrigado, {{lead.name}}! Recebi teu agendamento.\n\nPara reagendar ou cancelar, é só clicar no link abaixo:\nhttp://localhost:3000/agenda/appointment/{{vars.lastAppointmentId}}",
      },
    },
  });

  N(ids.tagAgendaAdd, "TAG", 2240, -240, {
    action: { type: "ADD", tagsIds: [TAG_AGENDA] },
  });

  // Não agendou — follow-up
  N(ids.tagQuerAgendar, "TAG", 1960, 0, {
    action: { type: "ADD", tagsIds: [TAG_QUER_AGENDAR] },
  });

  N(ids.sendConseguiu, "SEND_MESSAGE", 2240, 0, {
    action: {
      payload: {
        type: "TEXT",
        message: "Opa {{lead.name}}, conseguiu agendar?",
      },
    },
  });

  N(ids.waitRespostaQuer, "WAIT_FOR_EVENT", 2520, 0, {
    eventName: "message-incoming",
    timeoutMinutes: 60 * 24,
  });

  N(ids.decideResposta, "AI_DECISION", 2800, 0, {
    organizationId: ORG_ID,
    prompt:
      "O lead {{lead.name}} respondeu ao 'Conseguiu agendar?'. Classifique com critério estrito:\n\n- 'agradeceu' → SE disse claramente que JÁ agendou ou agradeceu de forma positiva ('obrigado', 'agendei sim', 'já tá marcado')\n- 'nao_quer' → SE disse explicitamente que NÃO quer ('não', 'agora não', 'depois', 'no momento não', 'sem pretensão', 'desconsiderar')\n- 'sem_resposta' → DEFAULT pra qualquer resposta ambígua, número solto, pergunta solta, ou neutra\n\nNa dúvida → 'sem_resposta' (segue pro follow-up).",
    branches: [
      { id: "sem_resposta", label: "Ambíguo (default)", description: "Default — qualquer resposta sem confirmação clara segue pro follow-up" },
      { id: "agradeceu", label: "Confirmou agendamento", description: "SOMENTE com 'obrigado', 'agendei', 'tá marcado'" },
      { id: "nao_quer", label: "Recusou explicitamente", description: "SOMENTE com 'não quero', 'agora não', 'depois'" },
    ],
  });

  N(ids.sendAgradeceu, "SEND_MESSAGE", 3080, -150, {
    action: { payload: { type: "TEXT", message: "Conta com a gente, {{lead.name}}!" } },
  });

  N(ids.tagFollowup15, "TAG", 3080, 50, {
    action: { type: "ADD", tagsIds: [TAG_FOLLOWUP_15] },
  });

  N(ids.sendTeEntendo, "SEND_MESSAGE", 3360, 50, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Te entendo então, {{lead.name}}! Mas quando precisar da gente, é só enviar uma mensagem.",
      },
    },
  });

  // ── Loop follow-up [1,2,3,5,7] ──────────────────
  // 5 tentativas em sequência — cada uma: WAIT N dias → SEND msg → WAIT resposta
  // → AI_DECISION (agendou/desistiu/segue) → branches.
  const followupMessages = [
    "{{lead.name}}, se tiver com dificuldades em agendar, é só me falar.\n\nSegue o link: " +
      AGENDA_LINK,
    "{{lead.name}}, vi que ontem não agendou. Temos vagas essa semana, confere no link:\n\n" +
      AGENDA_LINK,
    "{{lead.name}}, eita, faz 3 dias já... que houve? Aproveita que temos vagas:\n\n" +
      AGENDA_LINK,
    "Ei {{lead.name}}, estou com esses dias que dá para encaixar você, confere no link:\n\n" +
      AGENDA_LINK,
    "Lembrei de você {{lead.name}}, é só marcar e garantir uma agenda conosco. Segue o link:\n\n" +
      AGENDA_LINK,
  ];
  const followupDays = [1, 1, 1, 2, 2]; // 1, 2 (cumulativo), 3, 5, 7
  const waitIds = [ids.wait1d, ids.wait1d2, ids.wait1d3, ids.wait2d, ids.wait2d2];
  const sendIds = [ids.sendFu1, ids.sendFu2, ids.sendFu3, ids.sendFu4, ids.sendFu5];
  const waitRespIds = [ids.waitResp1, ids.waitResp2, ids.waitResp3, ids.waitResp4, ids.waitResp5];
  const decideRespIds = [
    ids.aiDecideResp1,
    ids.aiDecideResp2,
    ids.aiDecideResp3,
    ids.aiDecideResp4,
    ids.aiDecideResp5,
  ];

  let yLoop = 250;
  for (let i = 0; i < 5; i++) {
    const x = 3360 + i * 280;
    N(waitIds[i], "WAIT", x, yLoop, {
      action: { type: "days", days: followupDays[i] },
    });
    N(sendIds[i], "SEND_MESSAGE", x, yLoop + 100, {
      action: { payload: { type: "TEXT", message: followupMessages[i] } },
    });
    N(waitRespIds[i], "WAIT_FOR_EVENT", x, yLoop + 200, {
      eventName: "message-incoming",
      timeoutMinutes: 60 * 24,
    });
    N(decideRespIds[i], "AI_DECISION", x, yLoop + 300, {
      organizationId: ORG_ID,
      prompt:
        "Lead {{lead.name}} respondeu ao follow-up #" +
        (i + 1) +
        ". Critério estrito:\n\n- 'agendou' → SOMENTE se confirmou explicitamente ('agendei', 'marquei', 'pronto', 'feito')\n- 'desistiu' → SOMENTE se rejeitou de forma clara ('não', 'pare', 'sai', 'tira meu nome', 'remover', 'spam')\n- 'sem_resposta' → DEFAULT pra qualquer outra coisa\n\nNa dúvida → 'sem_resposta'.",
      branches: [
        { id: "sem_resposta", label: "Ambíguo (default)", description: "Default — continua o loop" },
        { id: "agendou", label: "Confirmou agendamento", description: "SOMENTE com 'agendei', 'marquei', 'pronto'" },
        { id: "desistiu", label: "Rejeitou explicitamente", description: "SOMENTE com 'não', 'pare', 'tira meu nome'" },
      ],
    });
  }

  // MERGE final do path "agendou" do loop (todos os 5 AI_DECISIONs com "agendou" convergem aqui)
  N(ids.mergeAgendouLoop, "MERGE", 5000, yLoop);

  // Tag final pra quem esgotou o follow-up (5 dias × ~7 dias = 90 dias se considerar +tempo)
  N(ids.tagDesistiu90, "TAG", 5000, yLoop + 300, {
    action: { type: "ADD", tagsIds: [TAG_DESISTIU_90] },
  });

  // Branch "outras" — fallback genérico (saudação solta, dúvida ampla)
  N(ids.tagAtendimentoHumano, "TAG", 1120, 200, {
    action: { type: "ADD", tagsIds: [TAG_ATENDIMENTO_HUMANO] },
  });
  N(ids.sendOutras, "SEND_MESSAGE", 1400, 200, {
    action: {
      payload: {
        type: "TEXT",
        message:
          "Sem problema, {{lead.name}}! Um consultor humano vai entrar em contato pra te atender melhor.",
      },
    },
  });

  // ── Edges ──────────────────────────────────────
  const edges: Array<{ fromNodeId: string; toNodeId: string; fromOutput: string; toInput: string }> = [];
  const E = (from: string, to: string, out = "main") =>
    edges.push({ fromNodeId: from, toNodeId: to, fromOutput: out, toInput: "main" });

  E(ids.triggerNewLead, ids.sendMenu);
  E(ids.sendMenu, ids.waitMenuReply);
  E(ids.waitMenuReply, ids.decideOpcao);
  E(ids.decideOpcao, ids.sendLinkAgenda, "opcao_3");
  E(ids.decideOpcao, ids.tagInteresseProdutos, "opcao_1");
  E(ids.tagInteresseProdutos, ids.sendProdutos);
  E(ids.decideOpcao, ids.tagQuerSaberNasa, "opcao_2");
  E(ids.tagQuerSaberNasa, ids.sendNasa);
  E(ids.decideOpcao, ids.tagAtendimentoHumano, "outras");
  E(ids.tagAtendimentoHumano, ids.sendOutras);
  E(ids.sendLinkAgenda, ids.waitAgendou);
  E(ids.waitAgendou, ids.decideAgendou);
  // Agendou
  E(ids.decideAgendou, ids.sendObrigadoAgendou, "agendou");
  E(ids.sendObrigadoAgendou, ids.tagAgendaAdd);
  // Não agendou
  E(ids.decideAgendou, ids.tagQuerAgendar, "ainda_nao");
  E(ids.tagQuerAgendar, ids.sendConseguiu);
  E(ids.sendConseguiu, ids.waitRespostaQuer);
  E(ids.waitRespostaQuer, ids.decideResposta);
  E(ids.decideResposta, ids.sendAgradeceu, "agradeceu");
  E(ids.decideResposta, ids.tagFollowup15, "nao_quer");
  E(ids.tagFollowup15, ids.sendTeEntendo);
  // Sem resposta → loop follow-up
  E(ids.decideResposta, ids.wait1d, "sem_resposta");
  for (let i = 0; i < 5; i++) {
    E(waitIds[i], sendIds[i]);
    E(sendIds[i], waitRespIds[i]);
    E(waitRespIds[i], decideRespIds[i]);
    // "agendou" → converge no MERGE → mensagem de obrigado
    E(decideRespIds[i], ids.mergeAgendouLoop, "agendou");
    // "desistiu" → tag desistiu 90 + FIM
    E(decideRespIds[i], ids.tagDesistiu90, "desistiu");
    if (i < 4) {
      // "sem_resposta" → próximo waitId
      E(decideRespIds[i], waitIds[i + 1], "sem_resposta");
    } else {
      // último → tag desistiu 90
      E(decideRespIds[i], ids.tagDesistiu90, "sem_resposta");
    }
  }
  // MERGE do loop → manda obrigado + tag AGENDA
  E(ids.mergeAgendouLoop, ids.sendObrigadoAgendou);

  // ── Persiste ──────────────────────────────────
  const idMap = new Map<string, string>();
  for (const n of nodes) {
    const realId = createId();
    idMap.set(n.id, realId);
    await prisma.node.create({
      data: {
        id: realId,
        workflowId: WORKFLOW_ID,
        name: n.type,
        type: n.type as never,
        position: n.position,
        data: n.data as never,
      },
    });
  }
  for (const e of edges) {
    await prisma.connection.create({
      data: {
        id: createId(),
        workflowId: WORKFLOW_ID,
        fromNodeId: idMap.get(e.fromNodeId)!,
        toNodeId: idMap.get(e.toNodeId)!,
        fromOutput: e.fromOutput,
        toInput: e.toInput,
      },
    });
  }

  console.log(`\n✓ Workflow rebuilt:`);
  console.log(`  nodes: ${nodes.length}`);
  console.log(`  edges: ${edges.length}`);
  console.log(`  url:   /tracking/${TRACKING_ID}/workflows/${WORKFLOW_ID}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
