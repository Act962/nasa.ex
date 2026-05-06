import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
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

export const createActionWithAi = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      messages: z.array(z.custom<UIMessage>()),
      initialWorkspaceId: z.string().optional(),
      initialColumnId: z.string().optional(),
    }),
  )
  .handler(async function* ({ input, context, errors }) {
    try {
      const { messages, initialWorkspaceId, initialColumnId } = input;
      const orgId = context.org.id;
      const userId = context.user.id;

      const member = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        select: { role: true },
      });

      if (!initialWorkspaceId) {
        throw errors.NOT_FOUND;
      }

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
