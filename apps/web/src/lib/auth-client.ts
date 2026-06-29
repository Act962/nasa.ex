import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { stripeClient } from "@better-auth/stripe/client";

// baseURL undefined → same-origin (comportamento atual). Quando aponta pro
// backend separado, manda o cookie cross-origin via credentials: "include".
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  baseURL: apiUrl,
  fetchOptions: apiUrl ? { credentials: "include" } : undefined,
  plugins: [
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
  ],
});
