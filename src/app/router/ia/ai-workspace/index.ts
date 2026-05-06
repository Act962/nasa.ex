import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
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
import {
  getAccountOverviewTool,
  getInsightsTool,
  getDiagnosticsTool,
  listCatalogsTool,
} from "./tools/meta-ads/read-tools";
import {
  proposePauseCampaignTool,
  proposeResumeCampaignTool,
  proposeUpdateCampaignTool,
  proposeCreateCampaignTool,
  proposeCreateAdTool,
} from "./tools/meta-ads/propose-tools";
import { checkMcpAuthorization } from "@/lib/meta-mcp/authorization";

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
      const metaMcpEnabled = metaMcpAuth.authorized;

      // Sem workspace, só registramos tools Meta (não bloqueia).
      const hasWorkspace = !!initialWorkspaceId;

      const systemPrompt = [
        'Você é o "ASTRO", o assistente inteligente da NASA.ex.',
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
              "- Você TEM acesso a tools Meta Ads (listar, insights, diagnósticos, propor pause/resume/criar/editar campanhas).",
              activeMetaCampaignId
                ? `- CAMPANHA EM FOCO: ${activeMetaCampaignName ?? activeMetaCampaignId} (id: ${activeMetaCampaignId}). Use esse campaignId em tools de gestão.`
                : "- NENHUMA campanha selecionada. Quando o usuário pedir ação focada (pausar, editar, diagnóstico), CHAME PRIMEIRO `metaListCampaignsForSelection` para listar e o frontend renderizar o picker. NÃO INVENTE campaignIds.",
              "- Tools `metaPropose*` NÃO executam nada — só preparam confirmação. O usuário tem que clicar 'Confirmar' no card que aparece no chat.",
              "- Se uma tool Meta retornar `error: \"unauthorized\"` ou `error: \"operation_not_allowed\"`, repasse a `message` ao usuário em linguagem amigável e PARE — não tente outra tool Meta.",
              "- Use `metaGetAccountOverview` para visão geral, `metaGetInsights` para detalhes (com ou sem campaignId), `metaGetDiagnostics` para problemas/recomendações.",
            ]
          : [
              "",
              "META ADS:",
              "- Astro IA Meta Ads NÃO está habilitado/autorizado nesta sessão. Se o usuário pedir ação Meta Ads, oriente: 'Peça ao Master ou Moderador da organização pra liberar o uso do Astro Meta Ads em Integrações → Meta → Astro + IA'.",
            ]),
      ];
      const result = streamText({
        model: openai("gpt-4.1-nano"),
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
                createAction: createActionTool(userId),
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
                metaListCampaignsForSelection: listCampaignsForSelectionTool(
                  userId,
                  orgId,
                ),
                metaGetAccountOverview: getAccountOverviewTool(userId, orgId),
                metaGetInsights: getInsightsTool(userId, orgId),
                metaGetDiagnostics: getDiagnosticsTool(userId, orgId),
                metaListCatalogs: listCatalogsTool(userId, orgId),
                metaProposePauseCampaign: proposePauseCampaignTool(userId, orgId),
                metaProposeResumeCampaign: proposeResumeCampaignTool(userId, orgId),
                metaProposeUpdateCampaign: proposeUpdateCampaignTool(userId, orgId),
                metaProposeCreateCampaign: proposeCreateCampaignTool(userId, orgId),
                metaProposeCreateAd: proposeCreateAdTool(userId, orgId),
              }
            : {}),
          createAction: createActionTool(userId, orgId),
          listWorkspaces: listWorkspaces(userId),
          listColumnsByWorkspace: listColumnsByWorkspace(
            userId,
            initialWorkspaceId,
          ),
          findAction: findActionTool(userId, initialWorkspaceId, orgId),
          updateAction: updateActionTool(userId),
          getOverdueActions: getOverdueActionsTool(userId),
          moveActionToColumn: moveActionToColumnTool(userId),
          getWorkspaceSummary: getWorkspaceSummaryTool(userId),
          closeAction: closeActionTool(userId),
          addResponsibleToAction: addResponsibleToActionTool(userId),
          findUser: findUserTool(initialWorkspaceId),
        },
      });

      yield* streamToEventIterator(result.toUIMessageStream());
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
