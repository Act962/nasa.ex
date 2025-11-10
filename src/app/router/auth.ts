import { auth } from "@/lib/auth";
import { base } from "../middlewares/base";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const requiredAuthMiddleware = base.middleware(
  async ({ context, next }) => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return redirect("/sign-in");
    }

    return next({
      context: {
        auth: session,
      },
    });
  }
);
