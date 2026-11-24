import { ClockIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NBoxItemType } from "@/generated/prisma/enums";
import { FileTypeIcon, formatBytes } from "./nbox-file-type-icon";

// Página pública da transferência (spec 0148, RF-8 e RF-9). Sem login e sem depender da Spacehome.

interface TransferPublicViewProps {
  token: string;
  transfer: {
    name: string;
    companyName: string;
    companyLogo: string | null;
    expiresAt: Date;
    isExpired: boolean;
    items: Array<{ id: string; name: string; type: NBoxItemType; size: number | null; mimeType: string | null }>;
  };
}

const formatExpiry = (expiresAt: Date) =>
  expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export function TransferPublicView({ token, transfer }: TransferPublicViewProps) {
  const totalBytes = transfer.items.reduce((total, item) => total + (item.size ?? 0), 0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="gap-1">
          <p className="text-sm text-muted-foreground">{transfer.companyName} enviou para você</p>
          <CardTitle className="text-xl">{transfer.name}</CardTitle>
          {!transfer.isExpired && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClockIcon className="size-4" />
              Disponível até {formatExpiry(transfer.expiresAt)}
              {transfer.items.length > 0 && ` · ${transfer.items.length} ${transfer.items.length === 1 ? "arquivo" : "arquivos"} · ${formatBytes(totalBytes)}`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {transfer.isExpired ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Esta transferência expirou. Peça um novo link para quem enviou.
            </p>
          ) : transfer.items.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Os arquivos ainda estão sendo enviados. Atualize a página em alguns minutos.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {transfer.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-3">
                  <FileTypeIcon type={item.type} mimeType={item.mimeType} className="size-5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.size !== null && <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/nbox/transfer/${token}/${item.id}`} download>
                      <DownloadIcon className="size-4" />
                      Baixar
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
