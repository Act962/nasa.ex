import { NodeExecutor } from "@/features/executions/types";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import ky, { type Options as KyOptions } from "ky";

type HttpRequestData = {
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
};

export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    httpRequestChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  // TODO: Publish "loading" state for manual trigger
  if (!data.endpoint) {
    // Todo: Publish "error" state for manual trigger
    await publish(
      httpRequestChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Endpoint is required");
  }

  const result = await step.run("http-request", async () => {
    try {
      const endpoint = data.endpoint!;
      const method = data.method || "GET";

      const options: KyOptions = { method };

      if (["POST", "PUT", "PATCH"].includes(method)) {
        options.body = data.body;
      }

      const response = await ky(endpoint, options);
      const contentType = response.headers.get("content-type");
      const responseData = contentType?.includes("application/json")
        ? await response.json()
        : await response.text();

      await publish(
        httpRequestChannel().status({
          nodeId,
          status: "success",
        }),
      );

      return {
        ...context,
        httpResponse: {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        },
      };
    } catch (error) {
      await publish(
        httpRequestChannel().status({
          nodeId,
          status: "error",
        }),
      );
      throw error;
    }
  });

  return result;
};
