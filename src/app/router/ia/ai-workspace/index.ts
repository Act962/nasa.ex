import { resolveAiFor } from "@/features/ia/server/resolve-ai-for";
import { recordAiUsage } from "@/features/ia/server/record-ai-usage";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { streamToEventIterator } from "@orpc/client";
import { createActionTool } from "./tools/create-action";
import { listWorkspaces } from "./tools/list-workspaces";
import { listColumnsByWorkspace } from "./tools/list-status-by-workspace";
import { findActionTool } from "./tools/find-action-tool";
import { updateActionTool } from "./tools/update-action";
import { getOverdueActionsTool } from "./tools/get-overdue-actions";
import { moveActionToColumnTool } from "./tools/move-action-to-column";
import { getWorkspaceSummaryTool } from "./tools/get-workspace-summary";
import { closeActionTool } from "./tools/close-action";
import { addResponsibleToActionTool } from "./tools/add-responsible-to-action";
import z from "zod";
import prisma from "@/lib/prisma";
import { findUserTool } from "./tools/find-user";
import { listCampaignsForSelectionTool } from "./tools/meta-ads/list-campaigns-for-selection";
import { randomBytes } from "crypto";
import { checkMcpAuthorization } from "@/features/astro-meta-ads/server/authorization";
import { buildMetaMcpAstroTools } from "@/features/astro-meta-ads/server/meta-mcp-tools";

export const createActionWithAi = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      messages: z.array(z.any()),
      initialWorkspaceId: z.string().optional(),
      initialColumnId: z.string().optional(),
      // Contexto Meta Ads opcional — passado pelos surfaces que usam Astro
      // pra gestão de Meta Ads (insights/relatorios, planner, NASA Explorer,
      // Astro overlay). Define a campanha em foco no chat.
      activeMetaCampaignId: z.string().optional(),
      activeMetaCampaignName: z.string().optional(),
    }),
  )
  .handler(async function* ({ input, context, errors }) {
    try {
      const {
        messages,
        initialWorkspaceId,
        initialColumnId,
        activeMetaCampaignId,
        activeMetaCampaignName,
      } = input;
      const orgId = context.org.id;
      const userId = context.user.id;

      const member = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        select: { role: true },
      });

      // Decide se registra tools Meta MCP nesta sessão.
      // Critério: MCP habilitado na org + user autorizado.
      const metaMcpAuth = await checkMcpAuthorization(userId, orgId);
      // Id da conversa exigido pelo MCP da Meta: 20 letras e números, nunca ids nossos.
      const metaConversationId = randomBytes(15).toString("base64").replace(/[^A-Za-z0-9]/g, "").padEnd(20, "x").slice(0, 20);
      const metaMcpTools = metaMcpAuth.authorized
        ? await buildMetaMcpAstroTools({ organizationId: orgId, userId, conversationId: metaConversationId })
        : {};
      // Sem ferramentas (conta sem MCP liberado, token sem permissão), o Astro não oferece Meta.
      const metaMcpEnabled = Object.keys(metaMcpTools).length > 0;

      // Sem workspace, só registramos tools Meta (não bloqueia).
      const hasWorkspace = !!initialWorkspaceId;

      const systemPrompt = [
        'Você é o "ASTRO", o assistente inteligente da ÓRBITA.ex.',
        "SUA PERSONA E FORMATAÇÃO:",
        "- Profissional, focado e organizado.",
        "- **RETORNO DE EVENTO**: Ao criar uma ação, retorne APENAS o nome do evento acompanhado do botão no formato: [VIEW_ACTION:Nome da Ação|ID_DA_AÇÃO]. Não adicione descrições longas ou resumos a menos que solicitado.",
        "- **MARCADO (MARKDOWN)**: Use Markdown para toda a sua resposta.",
        "- Responda em Português do Brasil.",

        "REGRAS DE RESPOSTA E FLUXO:",
        `- PRIORIDADE DE DESTINO: Use Workspace (${initialWorkspaceId}) e Coluna (${initialColumnId}) por padrão.`,
        "- **BUSCA E GESTÃO**: Utilize `findAction` para localizar tarefas. Para edições, use `updateAction`, `moveActionToColumn` ou `closeAction` conforme necessário.",
        "- **RESUMOS E ALERTAS**: Se o usuário pedir um status do projeto ou workspace, use `getWorkspaceSummary`. Para follow-ups de prazos, use `getOverdueActions`.",
        "- **DELEGAÇÃO**: Utilize `addResponsibleToAction` para atribuir responsáveis às tarefas.",
        "- Retorne a resposta final consolidada apenas após concluir todas as ferramentas.",
        "- Utilize duas quebras de linha (\\n\\n) entre blocos de informação.",
        "- **BUSCA POR PESSOA**: Quando o usuário mencionar o nome de alguém, chame PRIMEIRO `findUser` para obter o userId desse membro dentro do workspace, depois passe o userId para `findAction` nos campos `participantUserId` ou `responsibleUserId`.",
        "- Se `findUser` retornar mais de um membro com nomes parecidos, liste-os e pergunte ao usuário qual deseja antes de continuar.",
        "- Se `findUser` retornar lista vazia, informe que a pessoa não é membro deste workspace.",

        "TRATAMENTO DE ERROS E ESCOPO:",
        "- **NUNCA** exiba erros técnicos, IDs internos, stack traces ou mensagens de sistema ao usuário.",
        "- Se uma tool retornar erro ou nenhum resultado, reformule em linguagem natural e amigável. Ex: 'Não encontrei nenhuma tarefa com esse critério. Pode me dar mais detalhes?'",
        "- Se o usuário pedir algo fora do seu escopo (falar sobre clima, fazer piada, responder perguntas gerais), responda de forma simpática que você é especializado em gestão de tarefas e projetos, e pergunte como pode ajudar nesse contexto.",
        "- Se o usuário fizer uma busca sem fornecer nenhum critério específico (ex: 'mostre ações'), chame `findAction` sem filtros e apresente os resultados de forma organizada.",
        "- Se `findAction` retornar lista vazia, diga algo como: 'Não encontrei tarefas com esses critérios. Deseja criar uma nova ou ajustar os filtros?'",
        "- Se o usuário não fornecer parâmetros suficientes para criar uma ação, pergunte apenas o que é estritamente necessário (título no mínimo).",
        "- Nunca invente dados. Se não souber, pergunte.",

        "Contexto Atual:",
        `- Organização ID: ${orgId}`,
        `- Usuário ID: ${userId}`,
        ...(metaMcpEnabled
          ? [
              "",
              "META ADS (Astro IA):",
              "- Você TEM acesso às ferramentas oficiais da Meta (`meta_ads_*`) para a conta de anúncios desta empresa. A conta já vem preenchida: nunca peça nem invente ad_account_id.",
              activeMetaCampaignId
                ? `- CAMPANHA EM FOCO: ${activeMetaCampaignName ?? activeMetaCampaignId} (id: ${activeMetaCampaignId}). Use esse id nas ferramentas de gestão.`
                : "- NENHUMA campanha selecionada. Quando o usuário pedir ação focada (pausar, editar, diagnóstico), CHAME PRIMEIRO `metaListCampaignsForSelection` para o frontend mostrar o seletor. NÃO INVENTE ids.",
              "- Ferramentas marcadas [ESCRITA] NÃO executam: só preparam um cartão. O usuário confirma clicando 'Confirmar'. Nunca diga que algo foi feito antes da confirmação.",
              "- Criações nascem pausadas. Para colocar no ar use `meta_ads_activate_entity`, que também pede confirmação e mostra a verba.",
              "- Para números e diagnóstico use `meta_ads_get_ad_entities` (com fields e date_preset) e as de insights e oportunidade.",
              "- Se uma ferramenta Meta devolver `ok: false`, repasse a `message` em linguagem amigável e PARE: não tente outra ferramenta Meta.",
            ]
          : [
              "",
              "META ADS:",
              "- Astro IA Meta Ads NÃO está habilitado/autorizado nesta sessão. Se o usuário pedir ação Meta Ads, oriente: 'Peça ao Master ou Moderador da organização pra liberar o uso do Astro Meta Ads em Integrações → Meta → Astro + IA'.",
            ]),
      ];
      const resolvedAi = await resolveAiFor({ resourceId: "workspace.assistant", organizationId: orgId, provider: "openai", modelId: "gpt-4.1-nano" });
      const result = streamText({
        model: resolvedAi.model,
        onFinish: ({ totalUsage }) =>
          recordAiUsage({ resourceId: "workspace.assistant", organizationId: orgId, userId, provider: "openai", modelId: resolvedAi.modelId, keySource: resolvedAi.keySource, usage: totalUsage }),
        messages: [
          {
            role: "system",
            content: systemPrompt.join("\n"),
          },

          ...(await convertToModelMessages(messages)),
        ],
        stopWhen: stepCountIs(4),
        toolChoice: "auto",

        tools: {
          // Workspace tools — só registradas quando há workspace context
          ...(hasWorkspace
            ? {
                createAction: createActionTool(userId, orgId),
                listWorkspaces: listWorkspaces(userId),
                listColumnsByWorkspace: listColumnsByWorkspace(
                  userId,
                  initialWorkspaceId!,
                ),
                findAction: findActionTool(userId, initialWorkspaceId!, orgId),
                updateAction: updateActionTool(userId),
                getOverdueActions: getOverdueActionsTool(userId),
                moveActionToColumn: moveActionToColumnTool(userId),
                getWorkspaceSummary: getWorkspaceSummaryTool(userId),
                closeAction: closeActionTool(userId),
                addResponsibleToAction: addResponsibleToActionTool(userId),
                findUser: findUserTool(initialWorkspaceId!),
              }
            : {}),
          // Meta Ads MCP tools — registradas só quando MCP autorizado
          ...(metaMcpEnabled
            ? {
                metaListCampaignsForSelection: listCampaignsForSelectionTool(userId, orgId, metaConversationId),
                ...metaMcpTools,
              }
            : {}),
        },
      });

      yield* streamToEventIterator(result.toUIMessageStream());
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
