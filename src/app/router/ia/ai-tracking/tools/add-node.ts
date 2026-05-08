import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import { tool } from "ai";
import { z } from "zod";

const conditionSchema = z.object({
  field: z.enum(["status", "name", "email"]),
  value: z.array(z.string()),
  operator: z.enum(["is", "contains"]),
});

export const addNodeTool = () =>
  tool({
    description: `Adiciona um nó (trigger ou execução) a um workflow existente.

TRIGGERS — informe apenas os campos indicados:
- MANUAL_TRIGGER: sem campos extras
- NEW_LEAD: sem campos extras
- AI_FINISHED: conditions (opcional, padrão [])
- MOVE_LEAD_STATUS: statusId (obrigatório), conditions (opcional)
- LEAD_TAGGED: tagIds[] (obrigatório), conditions (opcional)
- FIRST_CHAT_INTERACTION: sem campos extras

EXECUÇÕES — informe apenas os campos indicados:
- MOVE_LEAD: statusId, trackingId
- SEND_MESSAGE: message (variáveis: {{name}} {{email}} {{phone}} {{status}}), countryCode (padrão "BR")
- WAIT: unit (MINUTES|HOURS|DAYS|WEEKS), value (número)
- WIN_LOSS: winLossType (WIN|LOSS), reason (opcional), observation (opcional)
- TAG: operation (ADD|REMOVE), tagIds[]
- TEMPERATURE: temperature (COLD|WARM|HOT|VERY_HOT)
- RESPONSIBLE: operation (ADD|REMOVE), userId, userName
- FILTER_LEAD: logic (and|or), conditions[]`,
    inputSchema: z.object({
      workflowId: z.string().describe("ID do workflow"),
      name: z.string().describe("Nome descritivo do nó"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .default({ x: 0, y: 0 })
        .describe("Posição no canvas (opcional)"),
      type: z.enum(NodeType).describe("Tipo do nó conforme lista acima"),

      // trigger fields
      statusId: z.string().optional().describe("MOVE_LEAD_STATUS / MOVE_LEAD: ID do status"),
      tagIds: z.array(z.string()).optional().describe("LEAD_TAGGED / TAG: IDs das tags"),
      conditions: z.array(conditionSchema).optional().describe("AI_FINISHED / MOVE_LEAD_STATUS / LEAD_TAGGED / FILTER_LEAD: condições"),

      // execution fields
      trackingId: z.string().optional().describe("MOVE_LEAD: ID do tracking de destino"),
      message: z.string().optional().describe("SEND_MESSAGE: texto da mensagem"),
      countryCode: z.string().optional().describe("SEND_MESSAGE: código do país (padrão BR)"),
      unit: z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS"]).optional().describe("WAIT: unidade de tempo"),
      value: z.number().optional().describe("WAIT: quantidade de tempo"),
      winLossType: z.enum(["WIN", "LOSS"]).optional().describe("WIN_LOSS: ganhou ou perdeu"),
      reason: z.string().optional().describe("WIN_LOSS: ID do motivo (opcional)"),
      observation: z.string().optional().describe("WIN_LOSS: observação (opcional)"),
      operation: z.enum(["ADD", "REMOVE"]).optional().describe("TAG / RESPONSIBLE: adicionar ou remover"),
      temperature: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional().describe("TEMPERATURE: nova temperatura"),
      userId: z.string().optional().describe("RESPONSIBLE: ID do usuário"),
      userName: z.string().optional().describe("RESPONSIBLE: nome do usuário"),
      logic: z.enum(["and", "or"]).optional().describe("FILTER_LEAD: lógica entre condições"),
    }),
    execute: async ({ workflowId, name, position, type, ...fields }) => {
      try {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          select: { id: true },
        });

        if (!workflow) {
          return {
            success: false,
            message: `Workflow "${workflowId}" não encontrado.`,
          };
        }

        let dbData: Prisma.InputJsonValue;

        switch (type) {
          case "MANUAL_TRIGGER":
          case "NEW_LEAD":
          case "FIRST_CHAT_INTERACTION":
            dbData = {};
            break;

          case "AI_FINISHED":
            dbData = { conditions: fields.conditions ?? [] };
            break;

          case "MOVE_LEAD_STATUS":
            dbData = { statusId: fields.statusId, conditions: fields.conditions ?? [] };
            break;

          case "LEAD_TAGGED":
            dbData = { tagIds: fields.tagIds ?? [], conditions: fields.conditions ?? [] };
            break;

          case "MOVE_LEAD":
            dbData = { statusId: fields.statusId, trackingId: fields.trackingId };
            break;

          case "SEND_MESSAGE":
            dbData = {
              action: {
                target: { code: fields.countryCode ?? "BR", sendMode: "LEAD" },
                payload: { type: "TEXT", message: fields.message ?? "" },
              },
            };
            break;

          case "WAIT": {
            const unit = fields.unit ?? "MINUTES";
            dbData = {
              action: { type: unit, [unit.toLowerCase()]: fields.value ?? 0 },
            };
            break;
          }

          case "WIN_LOSS":
            dbData = {
              action: {
                type: fields.winLossType ?? "WIN",
                ...(fields.reason && { reason: fields.reason }),
                ...(fields.observation && { observation: fields.observation }),
              },
            };
            break;

          case "TAG":
            dbData = {
              action: { type: fields.operation ?? "ADD", tagsIds: fields.tagIds ?? [] },
            };
            break;

          case "TEMPERATURE":
            dbData = { action: { temperature: fields.temperature ?? "COLD" } };
            break;

          case "RESPONSIBLE":
            dbData = {
              action: {
                type: fields.operation ?? "ADD",
                responsible: { id: fields.userId ?? "", name: fields.userName ?? "" },
              },
            };
            break;

          case "FILTER_LEAD":
            dbData = {
              action: { logic: fields.logic ?? "and", conditions: fields.conditions ?? [] },
            };
            break;

          default:
            dbData = {};
        }

        const node = await prisma.node.create({
          data: { workflowId, type, name, data: dbData, position },
          select: { id: true, type: true, name: true },
        });

        return {
          success: true,
          message: `Nó "${name}" (${type}) adicionado com sucesso.`,
          nodeId: node.id,
          type: node.type,
          name: node.name,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível adicionar o nó.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
