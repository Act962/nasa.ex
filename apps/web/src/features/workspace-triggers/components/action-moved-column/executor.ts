import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import { actionContext } from "@/features/workspace-executions/schemas";
import { loadActionContext } from "@/features/workspace-executions/lib/load-action-context";

type Data = {
  action?: { columnId?: string };
};

export const wsActionMovedColumnExecutor: NodeExecutor<Data> = async ({
  data,
  context,
  step,
}) => {
  return step.run("ws-action-moved-column-trigger", async () => {
    const parsed = actionContext.safeParse((context as any).action);
    if (!parsed.success) {
      throw new NonRetriableError("Invalid action data on context");
    }
    const expectedColumnId = data.action?.columnId;
    if (!expectedColumnId) {
      throw new NonRetriableError("Trigger sem coluna configurada");
    }

    const eventColumnId = (context as any).columnId as string | undefined;
    const matchedColumnId =
      eventColumnId ?? (await loadActionContext(parsed.data.id))?.columnId;

    if (matchedColumnId !== expectedColumnId) {
      throw new NonRetriableError("Column does not match trigger config");
    }

    return { ...context, action: { id: parsed.data.id }, realTime: false };
  });
};
