import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "5s");
    return { message: `Hello ${event.data.email}!` };
  }
);

export const helloWorld2 = inngest.createFunction(
  { id: "hello-world-2" },
  { event: "test/hello.world-2" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "5s");
    return { message: `Hello ${event.data.email}!` };
  }
);
