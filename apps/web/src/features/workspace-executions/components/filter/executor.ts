import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsFilterChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";
import { loadActionContext } from "../../lib/load-action-context";

type Condition =
  | { field: "column"; operator: "is" | "is_not"; value: string[] }
  | { field: "tag"; operator: "contains" | "not_contains"; value: string[] }
  | {
      field: "participant";
      operator: "contains" | "not_contains";
      value: string[];
    }
  | { field: "isDone"; operator: "is"; value: "true" | "false" | boolean }
  | { field: "name"; operator: "equals" | "contains"; value: string };

type Data = {
  action?: {
    logic: "and" | "or";
    conditions: Condition[];
  };
};

export const wsFilterExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-filter", async () => {
    if (realTime) {
      await publish(wsFilterChannel().status({ nodeId, status: "loading" }));
    }
    try {
      const action = context.action as ActionContext | undefined;
      const cfg = data.action;
      if (!action || !cfg?.conditions?.length) return context;

      const detail = await loadActionContext(action.id);
      if (!detail) {
        throw new NonRetriableError("Action not found");
      }

      const fullAction = await prisma.action.findUnique({
        where: { id: action.id },
        select: { title: true },
      });
      const title = fullAction?.title ?? detail.title ?? "";

      const results = cfg.conditions.map((c) => {
        switch (c.field) {
          case "column": {
            const hit = detail.columnId
              ? c.value.includes(detail.columnId)
              : false;
            return c.operator === "is" ? hit : !hit;
          }
          case "tag": {
            const hit = c.value.some((v) => detail.tagIds.includes(v));
            return c.operator === "contains" ? hit : !hit;
          }
          case "participant": {
            const hit = c.value.some((v) =>
              detail.participantIds.includes(v),
            );
            return c.operator === "contains" ? hit : !hit;
          }
          case "isDone": {
            const expected =
              typeof c.value === "boolean" ? c.value : c.value === "true";
            return detail.isDone === expected;
          }
          case "name": {
            const a = title.toLowerCase().trim();
            const b = String(c.value).toLowerCase().trim();
            return c.operator === "equals" ? a === b : a.includes(b);
          }
          default:
            return true;
        }
      });

      const satisfied =
        cfg.logic === "and"
          ? results.every((r) => r === true)
          : results.some((r) => r === true);

      if (!satisfied) {
        if (realTime) {
          await publish(wsFilterChannel().status({ nodeId, status: "error" }));
        }
        throw new NonRetriableError("Filtro não satisfeito");
      }

      if (realTime) {
        await publish(wsFilterChannel().status({ nodeId, status: "success" }));
      }
      return context;
    } catch (err) {
      if (realTime) {
        await publish(wsFilterChannel().status({ nodeId, status: "error" }));
      }
      throw err;
    }
  });
};
