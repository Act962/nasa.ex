// Define quem está logado no teste. `@/lib/auth` é substituído em setup.ts.

import { vi } from "vitest";
import { auth } from "@/lib/auth";

type SessionUser = { id: string; name: string; email: string };
type SessionOrganization = { id: string; name: string; slug: string };

export function signInAs(input: { user: SessionUser; organization: SessionOrganization }) {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: input.user,
    session: {
      id: `session-${input.user.id}`,
      userId: input.user.id,
      activeOrganizationId: input.organization.id,
    },
  } as never);
  vi.mocked(auth.api.getFullOrganization).mockResolvedValue(input.organization as never);
}

export function signOut() {
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
  vi.mocked(auth.api.getFullOrganization).mockResolvedValue(null as never);
}

/** Contexto mínimo que as procedures oRPC esperam. */
export const procedureContext = { context: { headers: new Headers() } };
