import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { WaitFormValues } from "./dialog";
import { waitChannel } from "@/inngest/channels/wait";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

type WaitNodeData = {
  action?: WaitFormValues;
};

export const waitExecutor: NodeExecutor<WaitNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  if (realTime) {
    await publish(
      waitChannel().status({
        nodeId,
        status: "loading",
      }),
    );
  }

  const action = data.action;

  if (!action) {
    if (realTime) {
      await publish(
        waitChannel().status({
          nodeId,
          status: "error",
        }),
      );
    }

    throw new NonRetriableError("Wait action is not defined");
  }

  if (action.type === "MINUTES" || action.type === "HOURS") {
    const waitTime =
      action.type === "MINUTES" ? action.minutes + "m" : action.hours + "h";
    await step.sleep("wait", waitTime);
  } else {
    // Para DIAS, SEMANAS e MESES, calculamos a data exata com o horário desejado
    const now = dayjs().tz(TIMEZONE);
    let targetDate = now;

    if (action.type === "DAYS") {
      targetDate = targetDate.add(action.days, "day");
    } else if (action.type === "WEEKS") {
      targetDate = targetDate.add(action.weeks, "week");
    } else if (action.type === "MONTHS") {
      targetDate = targetDate.add(action.months, "month");
    }

    // Ajusta para o horário e minuto selecionados no fuso horário do sistema
    targetDate = targetDate
      .set("hour", action.hours)
      .set("minute", action.minutes)
      .set("second", 0)
      .set("millisecond", 0);

    await step.sleepUntil("wait", targetDate.toDate());
  }

  if (realTime) {
    await publish(
      waitChannel().status({
        nodeId,
        status: "success",
      }),
    );
  }

  return context;
};
