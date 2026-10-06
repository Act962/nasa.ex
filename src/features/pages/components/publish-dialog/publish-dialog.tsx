"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIALOG_AS_MOBILE_BOTTOM_SHEET_CLASSES } from "../../lib/mobile-sheet-classes";
import { usePagesEdgeConfig } from "../../hooks/use-pages";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pageId: string;
}

export function PublishDialog({ open, onOpenChange, pageId }: Props) {
  const qc = useQueryClient();
  const { data } = useQuery({
    ...orpc.pages.getPage.queryOptions({ input: { id: pageId } }),
    enabled: open,
  });
  const page = data?.page;
  const [domain, setDomain] = useState("");
  const { data: edgeConfig } = usePagesEdgeConfig(open);

  const { mutate: setExternal, isPending: savingExt } = useMutation({
    mutationFn: () => client.pages.setCustomDomain({ id: pageId, domain }),
    onSuccess: () => {
      toast.success("Domínio registrado — siga as instruções DNS");
      qc.invalidateQueries({ queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }) });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro"),
  });

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: () => client.pages.verifyCustomDomain({ id: pageId }),
    onSuccess: (res) => {
      if (res.verified) toast.success("Domínio verificado!");
      else if (!res.isOwnershipProven) toast.error("Ainda não encontramos o registro TXT. O DNS pode levar algumas horas para propagar.");
      else toast.error("O TXT está certo, mas o domínio ainda não aponta para a ÓRBITA. Confira o CNAME e o registro A.");
      qc.invalidateQueries({ queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[92dvh] overflow-y-auto sm:max-w-2xl", DIALOG_AS_MOBILE_BOTTOM_SHEET_CLASSES)}>
        <DialogHeader>
          <DialogTitle>Domínio do site</DialogTitle>
          <DialogDescription>
            Use o endereço da ÓRBITA ou um domínio que você já tem.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="external" className="mt-2">
          <div className="scroll-hidden-x -mx-6 overflow-x-auto px-6">
            <TabsList className="w-max">
              <TabsTrigger value="external">Já tenho um domínio</TabsTrigger>
              <TabsTrigger value="nasa">Endereço ÓRBITA</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="external" className="space-y-3">
            <div>
              <Label>Domínio</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="meusite.com"
                  value={domain || page?.customDomain || ""}
                  onChange={(e) => setDomain(e.target.value.toLowerCase())}
                />
                <Button onClick={() => setExternal()} disabled={!domain || savingExt}>
                  Salvar
                </Button>
              </div>
            </div>
            {page?.customDomain && page?.domainVerifyToken && (
              <div className="rounded-[18px] border p-3 text-xs space-y-2">
                <div className="font-semibold">
                  Crie estes registros no painel onde você comprou o domínio:
                </div>
                <DnsRecordsTable
                  customDomain={page.customDomain}
                  verifyToken={page.domainVerifyToken}
                  edgeHost={edgeConfig?.edgeHost ?? null}
                  edgeIp={edgeConfig?.edgeIp ?? null}
                />
                <p className="text-muted-foreground">
                  Depois de salvar no provedor, clique em Verificar. A propagação do DNS pode levar de
                  alguns minutos a algumas horas.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <StatusBadge status={page.domainStatus ?? "PENDING"} />
                  <Button size="sm" onClick={() => verify()} disabled={verifying}>
                    {verifying ? "Verificando…" : "Verificar agora"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="nasa" className="space-y-3">
            <div className="rounded-[18px] border p-3 text-xs space-y-2">
              <div>Seu site fica disponível em:</div>
              <div className="font-mono text-sm">
                {typeof window !== "undefined" ? window.location.origin : ""}
                /s/{page?.slug}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const APEX_RECORD_NAME = "@";
const WWW_PREFIX = "www.";

/** Os três registros que o cliente copia para o provedor do domínio dele. */
function DnsRecordsTable({
  customDomain,
  verifyToken,
  edgeHost,
  edgeIp,
}: {
  customDomain: string;
  verifyToken: string;
  edgeHost: string | null;
  edgeIp: string | null;
}) {
  const apexDomain = customDomain.startsWith(WWW_PREFIX) ? customDomain.slice(WWW_PREFIX.length) : customDomain;
  const dnsRecords = [
    { type: "TXT", name: `_nasa-verify.${customDomain}`, value: verifyToken, purpose: "Prova que o domínio é seu" },
    ...(edgeHost
      ? [{ type: "CNAME", name: `www.${apexDomain}`, value: edgeHost, purpose: "Leva o endereço com www ao seu site" }]
      : []),
    ...(edgeIp
      ? [{ type: "A", name: `${APEX_RECORD_NAME} (${apexDomain})`, value: edgeIp, purpose: "Leva o endereço sem www ao seu site" }]
      : []),
  ];

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-muted/50 text-[10px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-2.5 py-1.5 font-semibold">Tipo</th>
              <th className="px-2.5 py-1.5 font-semibold">Nome</th>
              <th className="px-2.5 py-1.5 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {dnsRecords.map((dnsRecord) => (
              <tr key={dnsRecord.type} className="border-t align-top">
                <td className="px-2.5 py-2 font-mono font-semibold">{dnsRecord.type}</td>
                <td className="px-2.5 py-2 font-mono break-all">{dnsRecord.name}</td>
                <td className="px-2.5 py-2">
                  <div className="font-mono break-all">{dnsRecord.value}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{dnsRecord.purpose}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!edgeHost && !edgeIp && (
        <p className="text-warning">
          O apontamento do domínio (CNAME e A) ainda não está configurado neste ambiente. Por enquanto só
          o registro de verificação pode ser criado.
        </p>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "VERIFIED" || status === "ACTIVE" || status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
        <CheckCircle2 className="size-3" /> {status}
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
        <AlertTriangle className="size-3" /> {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
      <Clock className="size-3" /> {status}
    </span>
  );
}
