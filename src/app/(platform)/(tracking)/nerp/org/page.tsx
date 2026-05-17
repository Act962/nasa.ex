"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { useNerpOrg } from "../../../../../features/nerp/hooks/use-nerp-org";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-3 last:border-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="col-span-2 text-sm">{value ?? "—"}</div>
    </div>
  );
}

export default function NerpOrgPage() {
  const query = useNerpOrg();

  return (
    <NerpShell
      title="Organização nerp"
      description="Dados da org conectada do lado nerp."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Atualizar
        </Button>
      }
    >
      <NerpConnectionGuard>
        <Card>
          <CardHeader>
            <CardTitle>{query.data?.org.name ?? "Carregando…"}</CardTitle>
            <CardDescription>
              {query.data?.org.id ? `ID: ${query.data.org.id}` : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {query.isLoading && (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin inline mr-2" />
                Buscando dados…
              </div>
            )}
            {query.error && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {(query.error as Error).message}
              </div>
            )}
            {query.data && (
              <div>
                <Field label="Nome" value={query.data.org.name} />
                <Field label="Slug" value={query.data.org.slug} />
                <Field label="Email" value={query.data.org.email} />
                <Field label="Telefone" value={query.data.org.phone} />
                <Field label="Documento" value={query.data.org.document} />
                <Field
                  label="Logo"
                  value={
                    query.data.org.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={query.data.org.logoUrl}
                        alt=""
                        className="size-12 rounded border object-contain"
                      />
                    ) : null
                  }
                />
                <Field label="Criada em" value={query.data.org.createdAt} />
                <Field label="Atualizada em" value={query.data.org.updatedAt} />
              </div>
            )}
          </CardContent>
        </Card>
      </NerpConnectionGuard>
    </NerpShell>
  );
}
