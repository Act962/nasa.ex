"use client";

import { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNerpConnection } from "@/features/nerp/hooks/use-nerp-connection";

export function NerpConnectionGuard({ children }: { children: ReactNode }) {
  const conn = useNerpConnection();

  if (conn.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Verificando conexão com nerp…
      </div>
    );
  }

  if (!conn.connected || !conn.isActive) {
    return (
      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle>Integração nerp não conectada</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 mt-2">
          <span>
            Conecte sua organização ao nerp pra acessar produtos, vendas,
            clientes e dashboards direto do NASA.
          </span>
          <Button asChild size="sm" className="w-fit">
            <Link href="/settings/integration?from=nerp">Ir para conexão</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
