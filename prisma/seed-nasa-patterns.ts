/**
 * seed-nasa-patterns.ts
 *
 * Popula o banco com padrões NASA exemplificativos:
 *  - 1 organização "NASA Demo"
 *  - 1 usuário admin "nasa-admin"
 *  - 2 Trackings (funis de vendas) marcados como padrão
 *  - 2 Workspaces marcados como padrão
 *  - 2 Propostas marcadas como padrão
 *  - 2 Contratos marcados como padrão
 *
 * Uso:
 *   npx tsx prisma/seed-nasa-patterns.ts
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── helpers ──────────────────────────────────────────────────────────────────

async function upsertOrg() {
  return prisma.organization.upsert({
    where: { slug: "nasa-demo" },
    update: {},
    create: {
      id: "nasa-demo-org",
      name: "NASA Demo",
      slug: "nasa-demo",
      createdAt: new Date(),
    },
  });
}

async function upsertAdmin(orgId: string) {
  const user = await prisma.user.upsert({
    where: { email: "admin@nasademo.com" },
    update: {},
    create: {
      id: "nasa-admin-user",
      name: "NASA Admin",
      email: "admin@nasademo.com",
      emailVerified: true,
      isSystemAdmin: true,
    },
  });

  await prisma.member.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    update: {},
    create: {
      userId: user.id,
      organizationId: orgId,
      role: "owner",
      createdAt: new Date(),
    },
  });

  return user;
}

// ─── TRACKING PATTERNS ────────────────────────────────────────────────────────

async function seedTrackings(orgId: string, userId: string) {
  // ── 1. Funil de Vendas B2B ─────────────────────────────────────────────────
  const existing1 = await prisma.tracking.findFirst({
    where: { organizationId: orgId, name: "Funil de Vendas B2B" },
  });

  if (!existing1) {
    const t1 = await prisma.tracking.create({
      data: {
        name: "Funil de Vendas B2B",
        description:
          "Funil completo para gestão de oportunidades empresariais com automações e qualificação por temperatura.",
        organizationId: orgId,
        isTemplate: true,
        templateMarkedByModerator: true,
        participants: { create: { userId, role: "OWNER" } },
        status: {
          createMany: {
            data: [
              { name: "Prospecção",        color: "#6366f1", order: 0 },
              { name: "Qualificação",       color: "#f59e0b", order: 1 },
              { name: "Proposta enviada",   color: "#3b82f6", order: 2 },
              { name: "Negociação",         color: "#8b5cf6", order: 3 },
              { name: "Fechado - Ganho",    color: "#10b981", order: 4 },
              { name: "Fechado - Perdido",  color: "#ef4444", order: 5 },
            ],
          },
        },
        winLossReasons: {
          createMany: {
            data: [
              { name: "Preço competitivo",     type: "WIN" },
              { name: "Relacionamento forte",  type: "WIN" },
              { name: "Solução diferenciada",  type: "WIN" },
              { name: "Preço alto",            type: "LOSS" },
              { name: "Concorrência",          type: "LOSS" },
              { name: "Budget insuficiente",   type: "LOSS" },
              { name: "Sem necessidade agora", type: "LOSS" },
            ],
          },
        },
        aiSettings: {
          create: {
            assistantName: "Nora",
            prompt:
              "Você é Nora, assistente comercial especializada em vendas B2B. Seu objetivo é qualificar leads, identificar dores e apresentar soluções adequadas. Seja consultiva, objetiva e profissional.",
            finishSentence:
              "Posso te mostrar como empresas similares resolveram esse desafio. Temos alguns horários disponíveis essa semana para uma conversa rápida. Qual seria o melhor para você?",
          },
        },
        tags: {
          createMany: {
            data: [
              { name: "Quente",        slug: `quente-${orgId}`,        color: "#ef4444", organizationId: orgId, type: "CUSTOM" },
              { name: "Follow-up",     slug: `follow-up-${orgId}`,     color: "#f59e0b", organizationId: orgId, type: "CUSTOM" },
              { name: "Decisor",       slug: `decisor-${orgId}`,       color: "#8b5cf6", organizationId: orgId, type: "CUSTOM" },
              { name: "Enterprise",    slug: `enterprise-${orgId}`,    color: "#3b82f6", organizationId: orgId, type: "CUSTOM" },
              { name: "SMB",           slug: `smb-${orgId}`,           color: "#6366f1", organizationId: orgId, type: "CUSTOM" },
            ],
          },
        },
      },
    });

    // Workflow: Boas-vindas automático
    const wf1 = await prisma.workflow.create({
      data: {
        name: "Boas-vindas ao Lead",
        description: "Envia mensagem de boas-vindas quando um novo lead entra no funil.",
        trackingId: t1.id,
        userId,
      },
    });

    const nodeA = await prisma.node.create({
      data: {
        workflowId: wf1.id,
        name: "Novo lead",
        type: "NEW_LEAD",
        position: { x: 100, y: 200 },
        data: {},
      },
    });

    const nodeB = await prisma.node.create({
      data: {
        workflowId: wf1.id,
        name: "Enviar mensagem de boas-vindas",
        type: "SEND_MESSAGE",
        position: { x: 400, y: 200 },
        data: {
          message:
            "Olá {{lead_name}}! 👋 Recebemos seu contato e em breve nossa equipe entrará em contato. Aguarde!",
        },
      },
    });

    await prisma.connection.create({
      data: {
        workflowId: wf1.id,
        fromNodeId: nodeA.id,
        toNodeId: nodeB.id,
        fromOutput: "main",
        toInput: "main",
      },
    });

    // Agenda: Consultoria B2B
    const agenda1 = await prisma.agenda.create({
      data: {
        name: "Consultoria B2B",
        description: "Agende uma consultoria de 30 minutos com nosso time comercial.",
        slug: `consultoria-b2b-${orgId}`,
        isActive: true,
        slotDuration: 30,
        trackingId: t1.id,
        organizationId: orgId,
        responsibles: { create: { userId } },
      },
    });

    await prisma.agendaAvailability.createMany({
      data: [
        { agendaId: agenda1.id, dayOfWeek: "MONDAY",    isActive: true },
        { agendaId: agenda1.id, dayOfWeek: "TUESDAY",   isActive: true },
        { agendaId: agenda1.id, dayOfWeek: "WEDNESDAY", isActive: true },
        { agendaId: agenda1.id, dayOfWeek: "THURSDAY",  isActive: true },
        { agendaId: agenda1.id, dayOfWeek: "FRIDAY",    isActive: true },
      ],
    });

    const availabilities = await prisma.agendaAvailability.findMany({
      where: { agendaId: agenda1.id },
    });

    for (const av of availabilities) {
      await prisma.agendaTimeSlot.createMany({
        data: [
          { availabilityId: av.id, startTime: "09:00", endTime: "12:00", order: 0 },
          { availabilityId: av.id, startTime: "14:00", endTime: "18:00", order: 1 },
        ],
      });
    }

    console.log("✅ Tracking 'Funil de Vendas B2B' criado");
  } else {
    console.log("⏭  Tracking 'Funil de Vendas B2B' já existe");
  }

  // ── 2. Atendimento ao Cliente ──────────────────────────────────────────────
  const existing2 = await prisma.tracking.findFirst({
    where: { organizationId: orgId, name: "Atendimento ao Cliente" },
  });

  if (!existing2) {
    const t2 = await prisma.tracking.create({
      data: {
        name: "Atendimento ao Cliente",
        description:
          "Pipeline de suporte e atendimento com priorização de tickets, SLA e acompanhamento de satisfação.",
        organizationId: orgId,
        isTemplate: true,
        templateMarkedByModerator: true,
        participants: { create: { userId, role: "OWNER" } },
        status: {
          createMany: {
            data: [
              { name: "Novo ticket",        color: "#6366f1", order: 0 },
              { name: "Em análise",         color: "#f59e0b", order: 1 },
              { name: "Aguardando cliente", color: "#3b82f6", order: 2 },
              { name: "Em resolução",       color: "#8b5cf6", order: 3 },
              { name: "Resolvido",          color: "#10b981", order: 4 },
              { name: "Encerrado",          color: "#6b7280", order: 5 },
            ],
          },
        },
        winLossReasons: {
          createMany: {
            data: [
              { name: "Problema resolvido rapidamente", type: "WIN" },
              { name: "Cliente satisfeito",             type: "WIN" },
              { name: "Sem retorno do cliente",         type: "LOSS" },
              { name: "Fora do escopo de suporte",      type: "LOSS" },
            ],
          },
        },
        aiSettings: {
          create: {
            assistantName: "Max",
            prompt:
              "Você é Max, assistente de suporte da empresa. Seu objetivo é entender o problema do cliente, coletar informações necessárias para abertura do ticket e dar uma estimativa de resolução. Seja empático e prestativo.",
            finishSentence:
              "Seu chamado foi registrado e nossa equipe técnica entrará em contato em até 24 horas. Há mais alguma informação que você gostaria de adicionar?",
          },
        },
        tags: {
          createMany: {
            data: [
              { name: "Urgente",   slug: `urgente-${orgId}`,   color: "#ef4444", organizationId: orgId, type: "CUSTOM" },
              { name: "Bug",       slug: `bug-${orgId}`,       color: "#f97316", organizationId: orgId, type: "CUSTOM" },
              { name: "Dúvida",   slug: `duvida-${orgId}`,    color: "#3b82f6", organizationId: orgId, type: "CUSTOM" },
              { name: "Melhoria", slug: `melhoria-${orgId}`,  color: "#10b981", organizationId: orgId, type: "CUSTOM" },
            ],
          },
        },
      },
    });

    console.log("✅ Tracking 'Atendimento ao Cliente' criado");
  } else {
    console.log("⏭  Tracking 'Atendimento ao Cliente' já existe");
  }
}

// ─── WORKSPACE PATTERNS ───────────────────────────────────────────────────────

async function seedWorkspaces(orgId: string, userId: string) {
  // ── 1. Lançamento de Produto ───────────────────────────────────────────────
  const existing1 = await prisma.workspace.findFirst({
    where: { organizationId: orgId, name: "Lançamento de Produto" },
  });

  if (!existing1) {
    await prisma.workspace.create({
      data: {
        name: "Lançamento de Produto",
        description:
          "Workspace completo para gerenciar todas as etapas de lançamento: planejamento, criação de conteúdo, marketing e pós-lançamento.",
        color: "#7c3aed",
        icon: "🚀",
        organizationId: orgId,
        createdBy: userId,
        isTemplate: true,
        templateMarkedByModerator: true,
        members: { create: { userId, role: "OWNER" } },
        columns: {
          createMany: {
            data: [
              { name: "Backlog",       color: "#6b7280", order: 0 },
              { name: "A fazer",       color: "#6366f1", order: 1 },
              { name: "Em progresso",  color: "#f59e0b", order: 2 },
              { name: "Revisão",       color: "#3b82f6", order: 3 },
              { name: "Concluído",     color: "#10b981", order: 4 },
            ],
          },
        },
        tags: {
          createMany: {
            data: [
              { name: "Marketing",   color: "#f59e0b" },
              { name: "Dev",         color: "#3b82f6" },
              { name: "Design",      color: "#8b5cf6" },
              { name: "Conteúdo",    color: "#10b981" },
              { name: "Alta prioridade", color: "#ef4444" },
            ],
          },
        },
        automations: {
          createMany: {
            data: [
              {
                name: "Mover para Em progresso ao atribuir responsável",
                isActive: true,
                trigger: "ACTION_ASSIGNED",
                triggerData: {},
                conditions: [],
                steps: [{ type: "MOVE_COLUMN", columnName: "Em progresso" }],
              },
              {
                name: "Notificar equipe ao concluir ação",
                isActive: true,
                trigger: "ACTION_COMPLETED",
                triggerData: {},
                conditions: [],
                steps: [{ type: "NOTIFY_MEMBERS", message: "Uma ação foi concluída no projeto de lançamento!" }],
              },
            ],
          },
        },
      },
    });

    console.log("✅ Workspace 'Lançamento de Produto' criado");
  } else {
    console.log("⏭  Workspace 'Lançamento de Produto' já existe");
  }

  // ── 2. Gestão de Projetos Ágil ─────────────────────────────────────────────
  const existing2 = await prisma.workspace.findFirst({
    where: { organizationId: orgId, name: "Gestão de Projetos Ágil" },
  });

  if (!existing2) {
    await prisma.workspace.create({
      data: {
        name: "Gestão de Projetos Ágil",
        description:
          "Modelo baseado em metodologia ágil com sprints, revisões e retrospectivas. Ideal para times de tecnologia.",
        color: "#0ea5e9",
        icon: "⚡",
        organizationId: orgId,
        createdBy: userId,
        isTemplate: true,
        templateMarkedByModerator: true,
        members: { create: { userId, role: "OWNER" } },
        columns: {
          createMany: {
            data: [
              { name: "Product Backlog", color: "#6b7280", order: 0 },
              { name: "Sprint Backlog",  color: "#6366f1", order: 1 },
              { name: "Em desenvolvimento", color: "#f59e0b", order: 2 },
              { name: "Code Review",     color: "#3b82f6", order: 3 },
              { name: "QA / Testes",     color: "#8b5cf6", order: 4 },
              { name: "Pronto",          color: "#10b981", order: 5 },
            ],
          },
        },
        tags: {
          createMany: {
            data: [
              { name: "Bug",           color: "#ef4444" },
              { name: "Feature",       color: "#3b82f6" },
              { name: "Melhoria",      color: "#10b981" },
              { name: "Técnico",       color: "#6b7280" },
              { name: "Sprint atual",  color: "#f59e0b" },
            ],
          },
        },
        automations: {
          createMany: {
            data: [
              {
                name: "Alertar quando ação estiver atrasada",
                isActive: true,
                trigger: "ACTION_OVERDUE",
                triggerData: {},
                conditions: [],
                steps: [{ type: "NOTIFY_OWNER", message: "Atenção: ação atrasada no sprint atual!" }],
              },
            ],
          },
        },
      },
    });

    console.log("✅ Workspace 'Gestão de Projetos Ágil' criado");
  } else {
    console.log("⏭  Workspace 'Gestão de Projetos Ágil' já existe");
  }
}

// ─── FORGE PROPOSAL PATTERNS ──────────────────────────────────────────────────

async function seedProposals(orgId: string, userId: string) {
  // Produto fictício para vincular às propostas
  let product = await prisma.forgeProduct.findFirst({
    where: { organizationId: orgId, sku: "CONSUL-001" },
  });

  if (!product) {
    product = await prisma.forgeProduct.create({
      data: {
        organizationId: orgId,
        name: "Consultoria Estratégica",
        sku: "CONSUL-001",
        unit: "hr",
        description: "Hora de consultoria estratégica com especialista sênior.",
        value: 350,
        createdById: userId,
      },
    });
  }

  let product2 = await prisma.forgeProduct.findFirst({
    where: { organizationId: orgId, sku: "IMPL-001" },
  });

  if (!product2) {
    product2 = await prisma.forgeProduct.create({
      data: {
        organizationId: orgId,
        name: "Implementação de Sistema",
        sku: "IMPL-001",
        unit: "projeto",
        description: "Implementação completa incluindo configuração, treinamento e suporte inicial.",
        value: 8500,
        createdById: userId,
      },
    });
  }

  // ── 1. Proposta de Consultoria ─────────────────────────────────────────────
  const existing1 = await prisma.forgeProposal.findFirst({
    where: { organizationId: orgId, title: "Proposta de Consultoria Estratégica" },
  });

  if (!existing1) {
    const lastProposal = await prisma.forgeProposal.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: "desc" },
    });

    await prisma.forgeProposal.create({
      data: {
        organizationId: orgId,
        title: "Proposta de Consultoria Estratégica",
        description:
          "Proposta modelo para serviços de consultoria estratégica com pacote de horas mensais e entregáveis definidos.",
        number: (lastProposal?.number ?? 0) + 1,
        responsibleId: userId,
        createdById: userId,
        isTemplate: true,
        templateMarkedByModerator: true,
        discount: 5,
        discountType: "PERCENTUAL",
        products: {
          create: {
            productId: product.id,
            quantity: 10,
            unitValue: 350,
            order: 0,
            description: "Pacote mensal de 10 horas de consultoria",
          },
        },
      },
    });

    console.log("✅ Proposta 'Consultoria Estratégica' criada");
  } else {
    console.log("⏭  Proposta 'Consultoria Estratégica' já existe");
  }

  // ── 2. Proposta de Implementação ───────────────────────────────────────────
  const existing2 = await prisma.forgeProposal.findFirst({
    where: { organizationId: orgId, title: "Proposta de Implementação Completa" },
  });

  if (!existing2) {
    const lastProposal2 = await prisma.forgeProposal.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: "desc" },
    });

    await prisma.forgeProposal.create({
      data: {
        organizationId: orgId,
        title: "Proposta de Implementação Completa",
        description:
          "Proposta modelo para projetos de implementação incluindo consultoria, desenvolvimento e treinamento da equipe.",
        number: (lastProposal2?.number ?? 0) + 1,
        responsibleId: userId,
        createdById: userId,
        isTemplate: true,
        templateMarkedByModerator: true,
        products: {
          createMany: {
            data: [
              {
                productId: product2.id,
                quantity: 1,
                unitValue: 8500,
                order: 0,
                description: "Implementação do sistema com todas as funcionalidades",
              },
              {
                productId: product.id,
                quantity: 5,
                unitValue: 350,
                order: 1,
                description: "Horas de suporte pós-implementação",
              },
            ],
          },
        },
      },
    });

    console.log("✅ Proposta 'Implementação Completa' criada");
  } else {
    console.log("⏭  Proposta 'Implementação Completa' já existe");
  }
}

// ─── FORGE CONTRACT PATTERNS ──────────────────────────────────────────────────

async function seedContracts(orgId: string, userId: string) {
  // ── 1. Contrato de Prestação de Serviços ──────────────────────────────────
  const existing1 = await prisma.forgeContract.findFirst({
    where: { organizationId: orgId, value: { equals: 3500 }, isTemplate: true },
  });

  if (!existing1) {
    const lastContract = await prisma.forgeContract.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: "desc" },
    });

    await prisma.forgeContract.create({
      data: {
        organizationId: orgId,
        number: (lastContract?.number ?? 0) + 1,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        value: 3500,
        isTemplate: true,
        templateMarkedByModerator: true,
        createdById: userId,
        content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Entre as partes:

CONTRATANTE: {{nome_contratante}}, inscrito no CNPJ sob nº {{cnpj_contratante}}, doravante denominado CONTRATANTE.

CONTRATADA: {{nome_contratada}}, inscrita no CNPJ sob nº {{cnpj_contratada}}, doravante denominada CONTRATADA.

As partes acima identificadas têm entre si justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termos de pagamento descritos no presente instrumento.

CLÁUSULA 1ª – DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{descricao_servico}} pela CONTRATADA, conforme especificações técnicas acordadas entre as partes.

CLÁUSULA 2ª – DO PRAZO
O presente contrato terá vigência de {{prazo_meses}} meses, com início em {{data_inicio}} e término em {{data_fim}}, podendo ser renovado mediante acordo entre as partes.

CLÁUSULA 3ª – DO VALOR E PAGAMENTO
Pelos serviços prestados, o CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {{valor_mensal}}, mediante faturamento e prazo de pagamento de {{prazo_pagamento}} dias.

CLÁUSULA 4ª – DAS OBRIGAÇÕES DA CONTRATADA
A CONTRATADA obriga-se a:
a) Executar os serviços com qualidade e dentro dos prazos acordados;
b) Manter sigilo sobre as informações do CONTRATANTE;
c) Designar profissionais qualificados para a execução dos serviços.

CLÁUSULA 5ª – DAS OBRIGAÇÕES DO CONTRATANTE
O CONTRATANTE obriga-se a:
a) Efetuar os pagamentos nos prazos acordados;
b) Fornecer as informações necessárias para a execução dos serviços;
c) Comunicar eventuais alterações com antecedência mínima de 15 dias.

CLÁUSULA 6ª – DA RESCISÃO
Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.

CLÁUSULA 7ª – DO FORO
Fica eleito o foro da comarca de {{cidade_foro}} para dirimir quaisquer dúvidas oriundas do presente contrato.

{{cidade}}, {{data_assinatura}}

___________________________          ___________________________
       CONTRATANTE                           CONTRATADA`,
        signers: [
          { name: "{{Nome do Representante}}", email: "{{email@contratante.com}}", token: "token-tpl-1", signed_at: null },
          { name: "{{Nome do Diretor}}", email: "{{email@contratada.com}}", token: "token-tpl-2", signed_at: null },
        ],
      },
    });

    console.log("✅ Contrato 'Prestação de Serviços' criado");
  } else {
    console.log("⏭  Contrato 'Prestação de Serviços' já existe");
  }

  // ── 2. Contrato de Licença de Software ────────────────────────────────────
  const existing2 = await prisma.forgeContract.findFirst({
    where: { organizationId: orgId, value: { equals: 1200 }, isTemplate: true },
  });

  if (!existing2) {
    const lastContract2 = await prisma.forgeContract.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: "desc" },
    });

    await prisma.forgeContract.create({
      data: {
        organizationId: orgId,
        number: (lastContract2?.number ?? 0) + 1,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        value: 1200,
        isTemplate: true,
        templateMarkedByModerator: true,
        createdById: userId,
        content: `CONTRATO DE LICENÇA DE USO DE SOFTWARE

LICENCIANTE: {{nome_licenciante}}, CNPJ {{cnpj_licenciante}}.
LICENCIADO: {{nome_licenciado}}, CNPJ {{cnpj_licenciado}}.

CLÁUSULA 1ª – OBJETO
O LICENCIANTE concede ao LICENCIADO licença de uso não-exclusiva e intransferível do software {{nome_software}}, versão {{versao}}, para uso interno.

CLÁUSULA 2ª – VIGÊNCIA E VALOR
Vigência: {{data_inicio}} a {{data_fim}}.
Valor: R$ {{valor_mensal}}/mês, cobrado no dia {{dia_vencimento}} de cada mês.

CLÁUSULA 3ª – RESTRIÇÕES
É expressamente proibido ao LICENCIADO:
a) Copiar, modificar ou distribuir o software;
b) Fazer engenharia reversa;
c) Sublicenciar ou transferir o direito de uso a terceiros.

CLÁUSULA 4ª – SUPORTE
O LICENCIANTE prestará suporte técnico via {{canal_suporte}}, com SLA de {{sla_horas}} horas para chamados críticos.

CLÁUSULA 5ª – RESCISÃO
Rescisão imediata por descumprimento contratual. Rescisão sem justa causa com aviso prévio de 30 dias.

{{cidade}}, {{data_assinatura}}

___________________________          ___________________________
       LICENCIANTE                            LICENCIADO`,
        signers: [
          { name: "{{Representante Licenciante}}", email: "{{email@licenciante.com}}", token: "token-tpl-3", signed_at: null },
          { name: "{{Representante Licenciado}}", email: "{{email@licenciado.com}}", token: "token-tpl-4", signed_at: null },
        ],
      },
    });

    console.log("✅ Contrato 'Licença de Software' criado");
  } else {
    console.log("⏭  Contrato 'Licença de Software' já existe");
  }
}

// ─── FORM PATTERNS ────────────────────────────────────────────────────────────

async function seedForms(orgId: string, userId: string) {
  // ── 1. Captação de Leads ───────────────────────────────────────────────────
  const existing1 = await prisma.form.findFirst({
    where: { organizationId: orgId, name: "Captação de Leads" },
  });

  if (!existing1) {
    const blocks1 = JSON.stringify([
      {
        id: "row-lead-1",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "heading-lead-1",
            blockType: "Heading",
            attributes: { label: "Fale com nosso time", level: 1, fontSize: "4x-large", fontWeight: "bold" },
          },
          {
            id: "para-lead-1",
            blockType: "Paragraph",
            attributes: { label: "Paragraph", text: "Preencha o formulário abaixo e entraremos em contato em até 24h.", fontSize: "small", fontWeight: "normal" },
          },
        ],
      },
      {
        id: "row-lead-2",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "field-nome",
            blockType: "TextField",
            attributes: { label: "Nome completo", helperText: "", required: true, placeHolder: "Digite seu nome" },
          },
        ],
      },
      {
        id: "row-lead-3",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "field-email",
            blockType: "TextField",
            attributes: { label: "E-mail", helperText: "", required: true, placeHolder: "seu@email.com" },
          },
          {
            id: "field-phone",
            blockType: "TextField",
            attributes: { label: "Telefone / WhatsApp", helperText: "", required: false, placeHolder: "(00) 00000-0000" },
          },
        ],
      },
      {
        id: "row-lead-4",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "field-empresa",
            blockType: "TextField",
            attributes: { label: "Empresa", helperText: "", required: false, placeHolder: "Nome da empresa" },
          },
        ],
      },
      {
        id: "row-lead-5",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "radio-como",
            blockType: "RadioSelect",
            attributes: {
              label: "Como nos conheceu?",
              required: false,
              options: [
                { value: "Google", tagId: null },
                { value: "Indicação", tagId: null },
                { value: "Redes sociais", tagId: null },
                { value: "Evento", tagId: null },
                { value: "Outro", tagId: null },
              ],
            },
          },
        ],
      },
      {
        id: "row-lead-6",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "textarea-mensagem",
            blockType: "TextArea",
            attributes: { label: "Mensagem", helperText: "Conte um pouco sobre seu desafio.", required: false, placeHolder: "Como podemos ajudar?", rows: 4 },
          },
        ],
      },
    ]);

    await prisma.form.create({
      data: {
        name: "Captação de Leads",
        description: "Formulário modelo para capturar leads qualificados com nome, e-mail, empresa e origem do contato.",
        userId,
        organizationId: orgId,
        jsonBlock: blocks1,
        content: blocks1,
        published: true,
        isTemplate: true,
        templateMarkedByModerator: true,
        shareUrl: `tpl-leads-${orgId}`,
        settings: {
          create: {
            primaryColor: "#673ab7",
            backgroundColor: "#f0ebf8",
          },
        },
      },
    });

    console.log("✅ Form 'Captação de Leads' criado");
  } else {
    console.log("⏭  Form 'Captação de Leads' já existe");
  }

  // ── 2. Pesquisa de Satisfação ──────────────────────────────────────────────
  const existing2 = await prisma.form.findFirst({
    where: { organizationId: orgId, name: "Pesquisa de Satisfação" },
  });

  if (!existing2) {
    const blocks2 = JSON.stringify([
      {
        id: "row-nps-1",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "heading-nps-1",
            blockType: "Heading",
            attributes: { label: "Como foi sua experiência?", level: 1, fontSize: "4x-large", fontWeight: "bold" },
          },
          {
            id: "para-nps-1",
            blockType: "Paragraph",
            attributes: { label: "Paragraph", text: "Sua opinião é muito importante para continuarmos melhorando.", fontSize: "small", fontWeight: "normal" },
          },
        ],
      },
      {
        id: "row-nps-2",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "star-satisfacao",
            blockType: "StarRating",
            attributes: { label: "Avalie seu atendimento", helperText: "1 = Péssimo · 5 = Excelente", maxStars: 5, required: true },
          },
        ],
      },
      {
        id: "row-nps-3",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "radio-indicaria",
            blockType: "RadioSelect",
            attributes: {
              label: "Você nos indicaria para um amigo ou colega?",
              required: true,
              options: [
                { value: "Com certeza", tagId: null },
                { value: "Provavelmente sim", tagId: null },
                { value: "Talvez", tagId: null },
                { value: "Provavelmente não", tagId: null },
                { value: "Não indicaria", tagId: null },
              ],
            },
          },
        ],
      },
      {
        id: "row-nps-4",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "radio-melhorar",
            blockType: "RadioSelect",
            attributes: {
              label: "O que poderíamos melhorar?",
              required: false,
              options: [
                { value: "Tempo de resposta", tagId: null },
                { value: "Qualidade do serviço", tagId: null },
                { value: "Comunicação", tagId: null },
                { value: "Preço", tagId: null },
                { value: "Nada, estou satisfeito", tagId: null },
              ],
            },
          },
        ],
      },
      {
        id: "row-nps-5",
        blockType: "RowLayout",
        isLocked: false,
        attributes: {},
        childblocks: [
          {
            id: "textarea-comentario",
            blockType: "TextArea",
            attributes: { label: "Comentário adicional", helperText: "Opcional.", required: false, placeHolder: "Deixe seu comentário aqui...", rows: 4 },
          },
        ],
      },
    ]);

    await prisma.form.create({
      data: {
        name: "Pesquisa de Satisfação",
        description: "Formulário modelo para medir NPS e satisfação do cliente com avaliação por estrelas e questões de múltipla escolha.",
        userId,
        organizationId: orgId,
        jsonBlock: blocks2,
        content: blocks2,
        published: true,
        isTemplate: true,
        templateMarkedByModerator: true,
        shareUrl: `tpl-nps-${orgId}`,
        settings: {
          create: {
            primaryColor: "#0ea5e9",
            backgroundColor: "#e0f2fe",
          },
        },
      },
    });

    console.log("✅ Form 'Pesquisa de Satisfação' criado");
  } else {
    console.log("⏭  Form 'Pesquisa de Satisfação' já existe");
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Iniciando seed de padrões NASA...\n");

  const org = await upsertOrg();
  console.log(`✅ Organização: ${org.name} (${org.id})`);

  const user = await upsertAdmin(org.id);
  console.log(`✅ Usuário admin: ${user.email}\n`);

  await seedTrackings(org.id, user.id);
  await seedWorkspaces(org.id, user.id);
  await seedProposals(org.id, user.id);
  await seedContracts(org.id, user.id);
  await seedForms(org.id, user.id);

  console.log("\n✅ Seed de padrões NASA concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
