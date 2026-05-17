import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userBelongsToOrg,
  userCanAccessLead,
} from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de mutação de baixo nível — usadas pelos sub-agentes pra criar
 * entidades a partir de instrução natural. Cada tool faz UMA coisa, valida
 * permissão, retorna estado pro LLM responder em texto natural.
 *
 * Por que separado das tools "domain-specific" (actions/, leads/)? Porque
 * são primitivas — qualquer agente pode reusar (closer pra criar lead após
 * conversa, task-agent pra agendamento, automation-agent pra tag de regra).
 */

export function buildMutationTools(ctx: AgentContext) {
  return {
    create_lead: tool({
      description:
        "Cria um novo lead. Essenciais: NOME + TELEFONE. trackingId é OPCIONAL — default = tracking mais usado pelo user (com mais leads onde ele é responsável); fallback = primeiro tracking acessível na org. Status inicial = primeiro do tracking.",
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        phone: z
          .string()
          .optional()
          .describe("Telefone com DDD (ex: '11 99999-9999')"),
        email: z.string().email().optional(),
        document: z.string().optional().describe("CPF/CNPJ"),
        trackingId: z
          .string()
          .optional()
          .describe(
            "Opcional. Sem isso, usa o tracking mais usado pelo user.",
          ),
        description: z.string().optional(),
      }),
      execute: async ({
        name,
        phone,
        email,
        document,
        trackingId,
        description,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // ── Resolve trackingId (default = mais usado pelo user) ──
        let resolvedTrackingId = trackingId;
        if (!resolvedTrackingId) {
          const grouped = await prisma.lead.groupBy({
            by: ["trackingId"],
            where: {
              responsibleId: ctx.userId,
              tracking: { organizationId: ctx.organizationId },
            },
            _count: { _all: true },
            orderBy: { _count: { trackingId: "desc" } },
            take: 1,
          });
          if (grouped[0]) {
            resolvedTrackingId = grouped[0].trackingId;
          } else {
            const fallback = await prisma.tracking.findFirst({
              where: { organizationId: ctx.organizationId },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            });
            if (!fallback) {
              return {
                error:
                  "Sem tracking cadastrado na organização — crie um primeiro em [Tracking](/tracking).",
              };
            }
            resolvedTrackingId = fallback.id;
          }
        }

        // Valida tracking pertence à org + pega primeiro status (entrada do funil)
        const tracking = await prisma.tracking.findFirst({
          where: { id: resolvedTrackingId, organizationId: ctx.organizationId },
          select: {
            id: true,
            name: true,
            status: {
              select: { id: true, name: true },
              orderBy: { order: "asc" },
              take: 1,
            },
          },
        });
        if (!tracking) {
          return {
            error: `Tracking ${resolvedTrackingId} não encontrado nessa organização.`,
          };
        }
        const firstStatus = tracking.status[0];
        if (!firstStatus) {
          return {
            error: `Tracking "${tracking.name}" não tem nenhum status configurado. Configure o funil antes.`,
          };
        }

        try {
          const lead = await prisma.lead.create({
            data: {
              name,
              phone: phone ?? null,
              email: email ?? null,
              document: document ?? null,
              description: description ?? null,
              trackingId: tracking.id,
              statusId: firstStatus.id,
              responsibleId: ctx.userId,
            },
            select: { id: true, name: true },
          });
          return {
            success: true,
            leadId: lead.id,
            summary: `Lead "${lead.name}" criado em "${tracking.name}", status inicial "${firstStatus.name}".`,
          };
        } catch (err) {
          if (
            err != null &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            return {
              error: `Já existe um lead com esse telefone em "${tracking.name}".`,
            };
          }
          return {
            error: err instanceof Error ? err.message : "Erro ao criar lead",
          };
        }
      },
    }),

    create_tag: tool({
      description:
        "Cria uma nova tag. Essenciais: NOME. Cor defaulta pra vermelho (#dc2626). ⚠️ ANTES de chamar, PERGUNTE ao user se é tag pra TRACKING (leads) ou WORKSPACE (actions) — passe `scope` correspondente.",
      inputSchema: z.object({
        name: z.string().min(1).max(40),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe("Cor hex (default '#dc2626' — vermelho)."),
        scope: z
          .enum(["tracking", "workspace"])
          .optional()
          .describe(
            "Pra qual área a tag é usada — meta informativa. Tags são criadas no nível de org; o user filtra pelo escopo no app correspondente.",
          ),
        description: z.string().optional(),
      }),
      execute: async ({ name, color, scope, description }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const slug = name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        try {
          const tag = await prisma.tag.create({
            data: {
              name,
              slug: slug || `tag-${Date.now()}`,
              // Default vermelho conforme spec do user
              color: color ?? "#dc2626",
              description: description ?? null,
              organizationId: ctx.organizationId,
            },
            select: { id: true, name: true },
          });
          return {
            success: true,
            tagId: tag.id,
            scope: scope ?? null,
            summary: `Tag "${tag.name}" criada${scope ? ` pra ${scope}` : ""}.`,
          };
        } catch (err) {
          if (
            err != null &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            return { error: `Já existe uma tag chamada "${name}".` };
          }
          return {
            error: err instanceof Error ? err.message : "Erro ao criar tag",
          };
        }
      },
    }),

    create_workspace: tool({
      description:
        "Cria um novo workspace na organização atual. Essencial: NOME. Criador = user. Workspace começa com 0 colunas — o user adiciona depois.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
      execute: async ({ name, description, color }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const ws = await prisma.workspace.create({
          data: {
            name,
            description: description ?? null,
            color: color ?? "#1447e6",
            organizationId: ctx.organizationId,
            createdBy: ctx.userId,
          },
          select: { id: true, name: true },
        });
        return {
          success: true,
          workspaceId: ws.id,
          summary: `Workspace "${ws.name}" criado.`,
        };
      },
    }),

    create_tracking: tool({
      description:
        "Cria um novo tracking (pipeline / funil) na organização. Essencial: NOME. Criador adicionado como participante. Status inicial não é criado — o user configura as etapas depois no app.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        description: z.string().optional(),
      }),
      execute: async ({ name, description }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const tracking = await prisma.tracking.create({
          data: {
            name,
            description: description ?? null,
            organizationId: ctx.organizationId,
            participants: {
              create: { userId: ctx.userId, role: "OWNER" },
            },
          },
          select: { id: true, name: true },
        });
        return {
          success: true,
          trackingId: tracking.id,
          summary: `Tracking "${tracking.name}" criado. Configure as etapas em [Tracking](/tracking/${tracking.id}/settings).`,
        };
      },
    }),

    create_agenda: tool({
      description:
        "Cria uma nova agenda (Spacetime). Essenciais: NOME + TRACKING. Default tracking = mais usado pelo user. Default slot duration = 30 min. Criador é adicionado como responsável.",
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        description: z.string().optional(),
        trackingId: z
          .string()
          .optional()
          .describe(
            "Opcional. Sem isso, usa o tracking mais usado pelo user.",
          ),
        slotDuration: z
          .number()
          .int()
          .min(5)
          .max(480)
          .optional()
          .describe("Duração do slot em minutos. Default 30."),
      }),
      execute: async ({ name, description, trackingId, slotDuration }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // Resolve trackingId (default = mais usado pelo user)
        let resolvedTrackingId = trackingId;
        if (!resolvedTrackingId) {
          const grouped = await prisma.lead.groupBy({
            by: ["trackingId"],
            where: {
              responsibleId: ctx.userId,
              tracking: { organizationId: ctx.organizationId },
            },
            _count: { _all: true },
            orderBy: { _count: { trackingId: "desc" } },
            take: 1,
          });
          if (grouped[0]) {
            resolvedTrackingId = grouped[0].trackingId;
          } else {
            const fallback = await prisma.tracking.findFirst({
              where: { organizationId: ctx.organizationId },
              orderBy: { createdAt: "asc" },
              select: { id: true },
            });
            if (!fallback) {
              return {
                error:
                  "Sem tracking cadastrado — crie um primeiro em [Tracking](/tracking).",
              };
            }
            resolvedTrackingId = fallback.id;
          }
        }

        // Slug único por org — fallback timestamp
        const baseSlug = name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const slug = `${baseSlug || "agenda"}-${Date.now().toString(36)}`;

        try {
          const agenda = await prisma.agenda.create({
            data: {
              name,
              description: description ?? null,
              slug,
              slotDuration: slotDuration ?? 30,
              trackingId: resolvedTrackingId,
              organizationId: ctx.organizationId,
              responsibles: {
                create: { userId: ctx.userId },
              },
            },
            select: { id: true, name: true },
          });
          return {
            success: true,
            agendaId: agenda.id,
            summary: `Agenda "${agenda.name}" criada com slot de ${slotDuration ?? 30} min.`,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "Erro ao criar agenda",
          };
        }
      },
    }),

    update_lead: tool({
      description:
        "Atualiza dados de um lead existente. Use leadId obtido via search_entities. Só passe os campos que vai mudar.",
      inputSchema: z.object({
        leadId: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        document: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ leadId, ...patch }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        // Remove undefined pra não sobrescrever com null
        const data = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(data).length === 0) {
          return { error: "Nada pra atualizar — informe ao menos um campo." };
        }
        const updated = await prisma.lead.update({
          where: { id: leadId },
          data,
          select: { id: true, name: true },
        });
        return {
          success: true,
          summary: `Lead "${updated.name}" atualizado.`,
        };
      },
    }),

    move_lead: tool({
      description:
        "Move um lead pra outro status (dentro do mesmo tracking). Use statusId obtido via search_entities('status', …).",
      inputSchema: z.object({
        leadId: z.string(),
        toStatusId: z.string(),
      }),
      execute: async ({ leadId, toStatusId }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { id: true, name: true, statusId: true, trackingId: true },
        });
        if (!lead) return { error: "Lead não encontrado" };
        const status = await prisma.status.findUnique({
          where: { id: toStatusId },
          select: { id: true, name: true, trackingId: true },
        });
        if (!status) return { error: "Status alvo não encontrado" };
        if (status.trackingId !== lead.trackingId) {
          return {
            error:
              "Esse status pertence a outro tracking. Use move dentro do mesmo funil ou search_entities pra achar status do tracking certo.",
          };
        }
        if (lead.statusId === toStatusId) {
          return { error: `Lead já está em "${status.name}".` };
        }
        await prisma.lead.update({
          where: { id: leadId },
          data: { statusId: toStatusId },
        });
        return {
          success: true,
          summary: `"${lead.name}" movido pra "${status.name}".`,
        };
      },
    }),

    // ── FINANCEIRO (PaymentEntry) ─────────────────────────────────────────
    create_payment_entry: tool({
      description:
        "Cria um lançamento financeiro (PaymentEntry). Use pra 'gastei/comprei/insira/retirar' (PAYABLE) ou 'recebi/adicionar/incluir' (RECEIVABLE). Converte o valor em reais pra centavos antes (ex: 'R$ 100' → amountCents=10000). Defaults: dueDate=AGORA; status=PAID; paidAmount=amountCents; documentNumber auto-gerado; installments=1; account/contact/category=null. Se o user citou um nome de pessoa ('do Weydson', 'pra João'), JOGUE NO `notes` (junto com a frase completa) — NÃO tente cadastrar como contact. Devolve `categories` pro próximo passo.",
      inputSchema: z.object({
        type: z
          .enum(["RECEIVABLE", "PAYABLE"])
          .describe(
            "PAYABLE = despesa/custo (gastei/comprei/insira/retirar). RECEIVABLE = receita (recebi/adicionar/incluir).",
          ),
        amountCents: z
          .number()
          .int()
          .min(1)
          .describe(
            "Valor em CENTAVOS (multiplique reais por 100). Ex: R$ 100 → 10000; R$ 1.250,50 → 125050.",
          ),
        description: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "Descrição curta da operação. Ex: 'Abastecimento', 'Pagamento de freelancer'.",
          ),
        notes: z
          .string()
          .optional()
          .describe(
            "Frase completa do user com todos os detalhes (fornecedor, contexto). Ex: '100 reais de abastecimento no Posto Coruja'.",
          ),
        dueDateIso: z
          .string()
          .optional()
          .describe(
            "ISO 8601. Sem isso = agora (now). Aceita 'hoje', 'amanhã' também.",
          ),
      }),
      execute: async ({
        type,
        amountCents,
        description,
        notes,
        dueDateIso,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // Resolve dueDate
        let dueDate: Date;
        if (!dueDateIso) {
          dueDate = new Date();
        } else {
          const lower = dueDateIso.toLowerCase().trim();
          if (lower === "hoje" || lower === "today") dueDate = new Date();
          else if (
            lower === "amanhã" ||
            lower === "amanha" ||
            lower === "tomorrow"
          ) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            dueDate = d;
          } else {
            const parsed = new Date(dueDateIso);
            if (Number.isNaN(parsed.getTime())) {
              return {
                error: `Data inválida: "${dueDateIso}". Use ISO ('2026-05-17T10:00:00-03:00'), 'hoje' ou 'amanhã'.`,
              };
            }
            dueDate = parsed;
          }
        }

        // Document number auto-gerado (timestamp-based + counter via length).
        // Padrão: "AST-{YYYYMMDD}-{random4}"
        const today = dueDate;
        const ymd =
          `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const documentNumber = `AST-${ymd}-${rand}`;

        try {
          const entry = await prisma.paymentEntry.create({
            data: {
              organizationId: ctx.organizationId,
              type,
              status: "PAID", // user disse "gastei" / "recebi" = já pago/recebido
              description,
              amount: amountCents,
              paidAmount: amountCents,
              dueDate,
              paidAt: new Date(),
              documentNumber,
              notes: notes ?? null,
              installmentTotal: 1,
              installmentCurrent: 1,
              createdById: ctx.userId,
            },
            select: {
              id: true,
              description: true,
              amount: true,
              type: true,
            },
          });

          // Busca categorias disponíveis pra o user escolher depois.
          const categoryType =
            type === "RECEIVABLE" ? "REVENUE" : "EXPENSE";
          const categories = await prisma.paymentCategory.findMany({
            where: {
              organizationId: ctx.organizationId,
              isActive: true,
              type: { in: [categoryType, "COST"] }, // COST cobre ambos
            },
            select: { id: true, name: true, color: true, type: true },
            orderBy: { name: "asc" },
            take: 30,
          });

          return {
            success: true,
            entryId: entry.id,
            summary:
              type === "PAYABLE"
                ? `Despesa de R$ ${(entry.amount / 100).toFixed(2)} criada (${entry.description}).`
                : `Receita de R$ ${(entry.amount / 100).toFixed(2)} criada (${entry.description}).`,
            // Categorias retornadas pro Astro mostrar como opção clicável
            // (frontend renderiza via list_payment_categories se o user
            // pedir, ou Astro cita as opções em texto).
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
            })),
          };
        } catch (err) {
          console.error("[astro/create_payment_entry] prisma:", err);
          return {
            error:
              err instanceof Error
                ? `Falha ao gravar: ${err.message}`
                : "Erro ao criar lançamento",
          };
        }
      },
    }),

    create_payment_category: tool({
      description:
        "Cria uma categoria FINANCEIRA (PaymentCategory) — distinto de tag. Use quando o user mencionar uma categoria nova após criar um lançamento (ex: depois de 'criei despesa de R$100' o user diz 'Abastecimento' → essa é a categoria financeira, NÃO uma tag). Tipo OBRIGATÓRIO: REVENUE (receita), EXPENSE (despesa), COST (custo).",
      inputSchema: z.object({
        name: z.string().min(1).max(60),
        type: z.enum(["REVENUE", "EXPENSE", "COST"]),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe("Cor hex. Default: azul #1E90FF."),
      }),
      execute: async ({ name, type, color }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        try {
          const cat = await prisma.paymentCategory.create({
            data: {
              name,
              type,
              color: color ?? "#1E90FF",
              organizationId: ctx.organizationId,
            },
            select: { id: true, name: true, type: true },
          });
          return {
            success: true,
            categoryId: cat.id,
            summary: `Categoria "${cat.name}" (${cat.type === "EXPENSE" ? "despesa" : cat.type === "REVENUE" ? "receita" : "custo"}) criada.`,
          };
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? `Falha ao criar categoria: ${err.message}`
                : "Erro ao criar categoria",
          };
        }
      },
    }),

    update_payment_entry: tool({
      description:
        "Atualiza campos de um PaymentEntry. ⚠️ ATENÇÃO AOS CAMPOS — NÃO CONFUNDA:\n" +
        "• `categoryId` = ID de PaymentCategory (categoria financeira tipo 'Abastecimento', 'Marketing'). Vem de create_payment_category ou list_payment_categories.\n" +
        "• `contactId` = ID de PaymentContact (FORNECEDOR/CLIENTE — pessoa/empresa). Vem de search_entities ou create_payment_contact.\n" +
        "• `accountId` = ID de PaymentBankAccount (conta bancária — 'Itaú', 'Nubank').\n" +
        "NUNCA passe o ID de uma categoria no campo contactId — vai falhar com FK error. Pra ligar categoria, use SEMPRE categoryId.",
      inputSchema: z.object({
        entryId: z.string(),
        categoryId: z
          .string()
          .optional()
          .describe(
            "ID de PaymentCategory (categoria financeira). NUNCA o ID de tag/contact.",
          ),
        contactId: z
          .string()
          .optional()
          .describe(
            "ID de PaymentContact (fornecedor/cliente). NUNCA o ID de categoria.",
          ),
        accountId: z
          .string()
          .optional()
          .describe("ID de PaymentBankAccount."),
        notes: z.string().optional(),
        description: z.string().optional(),
        installmentTotal: z.number().int().min(1).max(60).optional(),
      }),
      execute: async ({
        entryId,
        categoryId,
        contactId,
        accountId,
        notes,
        description,
        installmentTotal,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        const entry = await prisma.paymentEntry.findUnique({
          where: { id: entryId },
          select: { organizationId: true },
        });
        if (!entry || entry.organizationId !== ctx.organizationId) {
          return { error: "Lançamento não encontrado nessa organização" };
        }

        // ── Validação defensiva contra IDs trocados ──
        // O LLM às vezes passa um categoryId no campo contactId (FK
        // tem texto similar). Aqui rejeitamos antes do Prisma reclamar
        // com erro genérico, e devolvemos mensagem clara pro Astro
        // corrigir ao invés de entrar em loop.
        if (categoryId) {
          const cat = await prisma.paymentCategory.findFirst({
            where: { id: categoryId, organizationId: ctx.organizationId },
            select: { id: true },
          });
          if (!cat) {
            return {
              error: `categoryId "${categoryId}" não é uma PaymentCategory válida. Use create_payment_category ou list_payment_categories pra obter um ID correto.`,
            };
          }
        }
        if (contactId) {
          const ct = await prisma.paymentContact.findFirst({
            where: { id: contactId, organizationId: ctx.organizationId },
            select: { id: true },
          });
          if (!ct) {
            return {
              error: `contactId "${contactId}" não é um PaymentContact válido. Você passou ID de categoria por engano? Pra ligar categoria use o campo \`categoryId\`. Pra criar fornecedor novo, peça pro user (fornecedor é opcional — pode deixar vazio).`,
            };
          }
        }
        if (accountId) {
          const ac = await prisma.paymentBankAccount.findFirst({
            where: { id: accountId, organizationId: ctx.organizationId },
            select: { id: true },
          });
          if (!ac) {
            return {
              error: `accountId "${accountId}" não é uma PaymentBankAccount válida.`,
            };
          }
        }

        const data: Record<string, unknown> = {};
        if (categoryId !== undefined) data.categoryId = categoryId;
        if (contactId !== undefined) data.contactId = contactId;
        if (accountId !== undefined) data.accountId = accountId;
        if (notes !== undefined) data.notes = notes;
        if (description !== undefined) data.description = description;
        if (installmentTotal !== undefined)
          data.installmentTotal = installmentTotal;

        if (Object.keys(data).length === 0) {
          return { error: "Nada pra atualizar — informe ao menos um campo." };
        }

        const updated = await prisma.paymentEntry.update({
          where: { id: entryId },
          data,
          select: { id: true, description: true, categoryId: true },
        });

        return {
          success: true,
          summary: `Lançamento atualizado.`,
          entry: updated,
        };
      },
    }),

    send_whatsapp_to_number: tool({
      description:
        "Envia mensagem de WhatsApp pra um número arbitrário (não precisa ser lead cadastrado). USE pra mandar o link público de agendamento pro WhatsApp do PRÓPRIO usuário, ou pra qualquer contato externo. Resolve a instância automaticamente: prefere a do `trackingId` passado; senão, usa a primeira instância CONNECTED da org. Aceita números nos formatos: '11999998888', '(11) 99999-8888', '+5511999998888' — normaliza pra E.164 BR antes de enviar.",
      inputSchema: z.object({
        phone: z
          .string()
          .min(8)
          .max(20)
          .describe(
            "Número com ou sem DDI/DDD/máscara. Ex: '11999998888' ou '(11) 99999-8888'.",
          ),
        text: z.string().min(1).max(1500),
        trackingId: z
          .string()
          .optional()
          .describe(
            "Opcional. Usa a instância WhatsApp desse tracking. Sem isso, pega a primeira CONNECTED da org.",
          ),
      }),
      execute: async ({ phone, text, trackingId }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // ── Normaliza número pra E.164 BR (apenas dígitos, com DDI 55) ──
        // Aceita: '11999998888', '(11) 99999-8888', '+5511999998888'.
        // Regra BR: 10 (fixo) ou 11 (celular) dígitos sem DDI → prepend "55".
        const digits = phone.replace(/\D/g, "");
        let normalized: string;
        if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
          normalized = digits;
        } else if (digits.length === 10 || digits.length === 11) {
          normalized = `55${digits}`;
        } else {
          return {
            error: `Número inválido: "${phone}". Use DDD + número (ex: 11 99999-8888) ou com DDI (+55 11 99999-8888).`,
          };
        }

        // ── Resolve a instância WhatsApp ──
        // 1) Se trackingId foi passado, tenta a instância dele.
        // 2) Senão (ou se a dele não tá CONNECTED), pega a primeira
        //    instância CONNECTED de qualquer tracking da org.
        let inst: {
          apiKey: string;
          baseUrl: string;
          status: string;
        } | null = null;
        if (trackingId) {
          const tk = await prisma.tracking.findFirst({
            where: { id: trackingId, organizationId: ctx.organizationId },
            select: {
              whatsappInstance: {
                select: { apiKey: true, baseUrl: true, status: true },
              },
            },
          });
          if (tk?.whatsappInstance?.status === "CONNECTED") {
            inst = tk.whatsappInstance;
          }
        }
        if (!inst) {
          const fallback = await prisma.whatsAppInstance.findFirst({
            where: {
              status: "CONNECTED",
              organizationId: ctx.organizationId,
            },
            select: { apiKey: true, baseUrl: true, status: true },
          });
          inst = fallback;
        }
        if (!inst || inst.status !== "CONNECTED") {
          return {
            error:
              "Nenhuma instância WhatsApp conectada na organização. Conecte uma em [Integrações](/integracoes).",
          };
        }

        try {
          await sendText(inst.apiKey, { number: normalized, text }, inst.baseUrl);
          return {
            success: true,
            summary: `Mensagem enviada pro WhatsApp ${normalized}.`,
            normalizedPhone: normalized,
          };
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? `Falha no envio: ${err.message}`
                : "Erro ao enviar WhatsApp",
          };
        }
      },
    }),

    send_whatsapp_message: tool({
      description:
        "Envia mensagem de WhatsApp pro lead via instância conectada da org. Usa o telefone do lead. CONFIRME O TEXTO COM O USUÁRIO ANTES — mensagem cai direto pro cliente.",
      inputSchema: z.object({
        leadId: z.string(),
        text: z.string().min(1).max(1500),
      }),
      execute: async ({ leadId, text }) => {
        if (!(await userCanAccessLead(ctx.userId, leadId))) {
          return { error: "Sem acesso a esse lead" };
        }
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            name: true,
            phone: true,
            tracking: {
              select: {
                organizationId: true,
                whatsappInstance: {
                  select: { apiKey: true, baseUrl: true, status: true },
                },
              },
            },
          },
        });
        if (!lead) return { error: "Lead não encontrado" };
        if (!lead.phone) {
          return { error: `"${lead.name}" não tem telefone cadastrado.` };
        }
        const inst = lead.tracking?.whatsappInstance;
        if (!inst || inst.status !== "CONNECTED") {
          return {
            error:
              "WhatsApp não está conectado no tracking desse lead. Conecte em /integrations e tente de novo.",
          };
        }
        try {
          await sendText(
            inst.apiKey,
            { number: lead.phone, text },
            inst.baseUrl,
          );
          return {
            success: true,
            summary: `Mensagem enviada pro WhatsApp de "${lead.name}".`,
          };
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? `Falha no envio: ${err.message}`
                : "Erro ao enviar WhatsApp",
          };
        }
      },
    }),

    create_appointment: tool({
      description:
        "Cria um agendamento (Appointment) em uma agenda. TODOS os campos exceto startsAt podem ser omitidos — defaults preenchem: agenda ausente = mais usada pelo user; título ausente = 'Novo agendamento de {nome do user}'; startsAt ausente = hoje 10:00 fuso SP. NÃO peça pra o user confirmar agenda/título se ele não mencionou — chame direto com defaults.",
      inputSchema: z.object({
        agendaId: z
          .string()
          .optional()
          .describe(
            "Opcional. Sem isso, usa a agenda mais usada pelo user (com mais appointments criados por ele).",
          ),
        startsAt: z
          .string()
          .optional()
          .describe(
            "ISO 8601 (ex: '2026-05-16T10:00:00-03:00'). Sem isso, default = hoje 10:00 (fuso SP).",
          ),
        durationMinutes: z.number().int().min(5).max(720).default(60),
        title: z
          .string()
          .optional()
          .describe("Opcional. Sem isso, 'Novo agendamento de {nome do user}'."),
        notes: z.string().optional(),
        leadId: z.string().optional(),
        meetingType: z.enum(["ONLINE", "IN_PERSON"]).default("ONLINE"),
      }),
      execute: async ({
        agendaId,
        startsAt,
        durationMinutes,
        title,
        notes,
        leadId,
        meetingType,
      }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }

        // ── Resolve agenda (default = mais usada pelo user) ──
        let resolvedAgendaId = agendaId;
        if (!resolvedAgendaId) {
          const grouped = await prisma.appointment.groupBy({
            by: ["agendaId"],
            where: {
              userId: ctx.userId,
              agenda: { organizationId: ctx.organizationId },
            },
            _count: { _all: true },
            orderBy: { _count: { agendaId: "desc" } },
            take: 1,
          });
          if (grouped[0]) {
            resolvedAgendaId = grouped[0].agendaId;
          } else {
            const fallback = await prisma.agenda.findFirst({
              where: { organizationId: ctx.organizationId, isActive: true },
              orderBy: { updatedAt: "desc" },
              select: { id: true },
            });
            if (!fallback) {
              return {
                error:
                  "Sem agenda disponível pra criar o agendamento — crie uma primeiro em /agendas.",
              };
            }
            resolvedAgendaId = fallback.id;
          }
        }

        const agenda = await prisma.agenda.findFirst({
          where: { id: resolvedAgendaId, organizationId: ctx.organizationId },
          select: { id: true, name: true },
        });
        if (!agenda) {
          return { error: `Agenda ${resolvedAgendaId} não encontrada.` };
        }

        // ── Resolve startsAt (default = hoje 10:00 fuso SP) ──
        let start: Date;
        if (startsAt) {
          start = new Date(startsAt);
          if (Number.isNaN(start.getTime())) {
            return {
              error: `Data inválida: "${startsAt}". Use formato ISO (ex: 2026-05-16T10:00:00-03:00).`,
            };
          }
        } else {
          // Hoje 10h fuso de São Paulo (-03:00).
          const now = new Date();
          start = new Date(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T10:00:00-03:00`,
          );
        }
        const end = new Date(start.getTime() + durationMinutes * 60_000);

        // ── Resolve título ──
        let resolvedTitle = title?.trim();
        if (!resolvedTitle) {
          const u = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { name: true },
          });
          const userName = u?.name?.trim() || "usuário";
          resolvedTitle = `Novo agendamento de ${userName}`;
        }

        // ── Check de conflito de horário na mesma agenda ──
        // Procura appointments que sobrepõem o intervalo proposto.
        // Critério: appointment ativo (não cancelled) cujo intervalo
        // intersecta [start, end). Inclui PENDING + CONFIRMED + DONE.
        const conflicting = await prisma.appointment.findFirst({
          where: {
            agendaId: agenda.id,
            status: { in: ["PENDING", "CONFIRMED", "DONE"] },
            startsAt: { lt: end },
            endsAt: { gt: start },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            lead: { select: { name: true } },
          },
        });
        if (conflicting) {
          return {
            error: `Esse horário (${start.toLocaleString("pt-BR")}) já tem compromisso "${conflicting.title ?? "Sem título"}"${conflicting.lead ? ` com ${conflicting.lead.name}` : ""} agendado das ${conflicting.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${conflicting.endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Escolha outro horário.`,
            conflict: {
              appointmentId: conflicting.id,
              title: conflicting.title,
              startsAt: conflicting.startsAt.toISOString(),
              endsAt: conflicting.endsAt.toISOString(),
            },
          };
        }

        const appointment = await prisma.appointment.create({
          data: {
            agendaId: agenda.id,
            startsAt: start,
            endsAt: end,
            title: resolvedTitle,
            notes: notes ?? null,
            leadId: leadId ?? null,
            userId: ctx.userId,
            meetingType,
            status: "PENDING",
          },
          select: { id: true, title: true, startsAt: true },
        });

        // Verifica se o tracking da agenda tem WhatsApp ativo —
        // útil pra o Astro decidir se oferece compartilhar via WA.
        const tracking = await prisma.tracking.findFirst({
          where: { agendas: { some: { id: agenda.id } } },
          select: {
            whatsappInstance: { select: { status: true } },
          },
        });
        const hasActiveWhatsApp =
          tracking?.whatsappInstance?.status === "CONNECTED";

        return {
          success: true,
          appointmentId: appointment.id,
          summary: `Agendamento criado pra ${start.toLocaleString("pt-BR")} na agenda "${agenda.name}".`,
          // Link público de reagendar / cancelar — Astro mostra na resposta.
          publicLink: `/agenda/appointment/${appointment.id}`,
          // Flag pra Astro saber se pode oferecer compartilhar via WhatsApp.
          hasActiveWhatsApp,
          appliedDefaults: {
            agenda: !agendaId,
            startsAt: !startsAt,
            title: !title,
          },
        };
      },
    }),
  };
}
