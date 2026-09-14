"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const SCOPE_HOME: Record<string, string> = {
  trafego: "/trafego/painel",
};

/**
 * Mantém uma organização de escopo restrito dentro do próprio app.
 *
 * Isto é navegação, não autorização: as procedures dos outros domínios seguem
 * alcançáveis via `/api/rpc`. Na v1 isso é aceitável porque o cliente é dono da
 * própria organização e só alcançaria dados dele mesmo — ver spec 0008 §CB-9.
 */
export function TrafegoScopeGuard({ appScope }: { appScope: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!appScope) return;
    const home = SCOPE_HOME[appScope];
    if (!home) return;

    const scopeRoot = `/${appScope}`;
    if (pathname === scopeRoot || pathname.startsWith(`${scopeRoot}/`)) return;

    router.replace(home);
  }, [appScope, pathname, router]);

  return null;
}
