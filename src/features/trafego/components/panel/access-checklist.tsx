"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ACCESS_CHECKLIST_ITEMS } from "@/features/trafego/lib/release";
import {
  useTrafegoRelease,
  useUpdateTrafegoAccessChecklist,
} from "@/features/trafego/hooks/use-trafego-release";

/**
 * Os acessos que a equipe precisa para publicar.
 *
 * Nunca pedimos senha — a Meta proíbe e não é necessário. O mecanismo é
 * acesso de parceiro: o cliente adiciona o Business ID da agência na BM dele
 * e mantém a propriedade da conta.
 */
export function AccessChecklist({ orderId }: { orderId: string }) {
  const { data } = useTrafegoRelease(orderId);
  const partnerBusinessId = data?.partnerBusinessId ?? null;
  const supportWhatsapp = data?.supportWhatsapp ?? null;
  const update = useUpdateTrafegoAccessChecklist();
  const [items, setItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.accessChecklist) setItems(data.accessChecklist);
  }, [data?.accessChecklist]);

  function toggle(id: string, checked: boolean) {
    const next = { ...items, [id]: checked };
    setItems(next);
    update.mutate(
      { orderId, items: next },
      { onError: () => setItems(items) },
    );
  }

  const done = ACCESS_CHECKLIST_ITEMS.filter((item) => items[item.id]).length;

  return (
    <section className="space-y-5">
      <header>
        <h3 className="text-sm font-semibold">Acessos</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {done} de {ACCESS_CHECKLIST_ITEMS.length} liberados. Sem eles a campanha não
          sai do lugar — nunca pedimos sua senha.
        </p>
      </header>

      <ul className="space-y-1">
        {ACCESS_CHECKLIST_ITEMS.map((item) => (
          <li key={item.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition hover:bg-muted/50",
                items[item.id] && "text-muted-foreground",
              )}
            >
              <Checkbox
                checked={items[item.id] === true}
                onCheckedChange={(checked) => toggle(item.id, checked === true)}
              />
              <span className={cn(items[item.id] && "line-through")}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {partnerBusinessId && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-xs font-semibold">Como nos dar acesso à sua conta</h4>
          <ol className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <li>1. Abra o Gerenciador de Negócios da Meta.</li>
            <li>2. Vá em Configurações do negócio → Parceiros.</li>
            <li>3. Clique em Adicionar e escolha “Dar acesso a um parceiro”.</li>
            <li>4. Cole o ID abaixo e conceda acesso à conta de anúncios e à página.</li>
          </ol>

          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm">
              {partnerBusinessId}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void navigator.clipboard.writeText(partnerBusinessId);
                toast.success("ID copiado.");
              }}
              aria-label="Copiar Business ID"
            >
              <Copy className="size-4" />
            </Button>
          </div>

          <a
            href="https://business.facebook.com/settings/partners"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Abrir o Gerenciador de Negócios
            <ExternalLink className="size-3" />
          </a>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Não tem conta de anúncios? Sem problema — nós criamos para você, já incluso
            no setup.
          </p>
        </div>
      )}

      {supportWhatsapp && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
          <Palette className="mt-0.5 size-4 shrink-0 text-violet-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Precisa de criativo?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A criação de imagem e vídeo é um serviço à parte. Fale com a equipe e
              montamos um orçamento.
            </p>
            <a
              href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                "Olá! Quero um orçamento de criativo para a minha campanha.",
              )}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Pedir orçamento
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

/** Usado no resumo do topo do painel. */
export function accessChecklistProgress(items: Record<string, boolean>) {
  const done = ACCESS_CHECKLIST_ITEMS.filter((item) => items[item.id]).length;
  return { done, total: ACCESS_CHECKLIST_ITEMS.length, complete: done === ACCESS_CHECKLIST_ITEMS.length };
}
