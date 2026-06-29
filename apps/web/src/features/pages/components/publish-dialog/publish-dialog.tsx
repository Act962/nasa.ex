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
  const [registerQuery, setRegisterQuery] = useState("");

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
      else toast.error("DNS ainda não propagado. Tente novamente.");
      qc.invalidateQueries({ queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }) });
    },
  });

  const { data: search, refetch: doSearch, isFetching: searching } = useQuery({
    ...orpc.pages.domainSearch.queryOptions({
      input: { query: registerQuery, tlds: [".com", ".com.br", ".io", ".app", ".site"] },
    }),
    enabled: false,
  });

  const { mutate: startBuy } = useMutation({
    mutationFn: (domainName: string) =>
      client.pages.domainStartPurchase({ id: pageId, domain: domainName }),
    onSuccess: (res) => {
      toast.success("Redirecionando para o checkout do registrador…");
      if (res.purchase.checkoutUrl) window.open(res.purchase.checkoutUrl, "_blank");
      qc.invalidateQueries({ queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Domínio do site</DialogTitle>
          <DialogDescription>
            Publique em um slug NASA, em um domínio próprio ou registre um novo
            diretamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="external" className="mt-2">
          <TabsList>
            <TabsTrigger value="external">Já tenho um domínio</TabsTrigger>
            <TabsTrigger value="register">Registrar domínio</TabsTrigger>
            <TabsTrigger value="nasa">Slug NASA</TabsTrigger>
          </TabsList>

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
              <div className="rounded-md border p-3 text-xs space-y-2">
                <div className="font-semibold">Configure no seu DNS:</div>
                <div className="font-mono">
                  CNAME <b>www</b> → pages.nasaex.com
                </div>
                <div className="font-mono">
                  TXT{" "}
                  <b>_nasa-verify.{page.customDomain}</b> ={" "}
                  <span className="bg-muted px-1 rounded">
                    {page.domainVerifyToken}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <StatusBadge status={page.domainStatus ?? "PENDING"} />
                  <Button size="sm" onClick={() => verify()} disabled={verifying}>
                    {verifying ? "Verificando…" : "Verificar agora"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="register" className="space-y-3">
            <div>
              <Label>Procurar domínio</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="meusite"
                  value={registerQuery}
                  onChange={(e) => setRegisterQuery(e.target.value)}
                />
                <Button
                  onClick={() => doSearch()}
                  disabled={!registerQuery || searching}
                >
                  {searching ? "Buscando…" : "Buscar"}
                </Button>
              </div>
            </div>
            {search?.results && (
              <div className="rounded-md border divide-y">
                {search.results.map((r) => (
                  <div key={r.domain} className="flex items-center justify-between p-2 text-sm">
                    <div>
                      <span className="font-mono">{r.domain}</span>{" "}
                      {r.available ? (
                        <span className="text-emerald-600 text-xs ml-2">disponível</span>
                      ) : (
                        <span className="text-muted-foreground text-xs ml-2">
                          indisponível
                        </span>
                      )}
                    </div>
                    {r.available && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startBuy(r.domain)}
                      >
                        Registrar
                        {r.priceCents
                          ? ` · R$ ${(r.priceCents / 100).toFixed(2)}`
                          : ""}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {page?.domainPurchase && (
              <div className="rounded-md border p-3 text-xs">
                <div className="font-semibold mb-1">Compra em andamento</div>
                <div className="font-mono">{page.domainPurchase.requestedDomain}</div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={page.domainPurchase.status} />
                  {page.domainPurchase.checkoutUrl && (
                    <a
                      href={page.domainPurchase.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline"
                    >
                      Abrir checkout
                    </a>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="nasa" className="space-y-3">
            <div className="rounded-md border p-3 text-xs space-y-2">
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

function StatusBadge({ status }: { status: string }) {
  if (status === "VERIFIED" || status === "ACTIVE" || status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
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
    <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
      <Clock className="size-3" /> {status}
    </span>
  );
}
