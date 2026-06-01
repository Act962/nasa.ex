"use client";

/**
 * Dialog acionado pelo botão "+ → Pesquisar na Web" do composer do chat.
 *
 *  - Operador digita a query
 *  - Roda `agents.webSearch` (Gemini Grounding default / OpenAI fallback)
 *  - Mostra resumo factual + lista de fontes citáveis
 *  - Botões: "Substituir mensagem" (reseta input) ou "Anexar à mensagem"
 *    (concatena) — o resumo vai pro composer pra operador editar antes
 *    de enviar ao lead.
 *
 * Reusa cobrança em Stars do mesmo executor que o nó WEB_SEARCH do canvas
 * usa (2 ★ por busca, configurável em /admin/stars > Regras).
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeIcon, ExternalLinkIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

interface WebSearchDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  /** Callback quando o operador escolhe usar o resultado. */
  onUseResult: (text: string, mode: "replace" | "append") => void;
}

export function WebSearchDialog({
  open,
  onOpenChange,
  organizationId,
  onUseResult,
}: WebSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    summary: string;
    sources: Array<{ title: string; url: string; snippet: string }>;
    provider: string;
    starsSpent: number;
  } | null>(null);

  const search = useMutation(
    orpc.agents.webSearch.mutationOptions({
      onSuccess: (data) => {
        setResult(data);
        toast.success(
          `Resultado pronto (${data.provider}, ${data.starsSpent} ★)`,
        );
      },
      onError: (err) => {
        toast.error(`Busca falhou: ${err.message}`);
      },
    }),
  );

  const handleSearch = () => {
    if (query.trim().length < 2) {
      toast.warning("Digite ao menos 2 caracteres");
      return;
    }
    setResult(null);
    search.mutate({
      query: query.trim(),
      organizationId,
    });
  };

  const handleUse = (mode: "replace" | "append") => {
    if (!result?.summary) return;
    onUseResult(result.summary, mode);
    onOpenChange(false);
    // Reset pro próximo uso
    setQuery("");
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-emerald-600" />
            Pesquisar na Web
          </DialogTitle>
          <DialogDescription>
            IA busca informações atuais e devolve um resumo factual. Você
            edita o texto antes de enviar pro lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>O que pesquisar</Label>
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="ex: preço atual do iPhone 17 no Brasil"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !search.isPending) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} disabled={search.isPending}>
              {search.isPending ? "Buscando…" : "Pesquisar"}
            </Button>
          </div>
        </div>

        {search.isPending && (
          <div className="space-y-2 mt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4 space-y-3 min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <SparklesIcon className="size-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resumo
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {result.provider}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {result.starsSpent} ★
                </Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
                {result.summary}
              </p>
            </div>

            {result.sources.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fontes ({result.sources.length})
                </span>
                <div className="space-y-1">
                  {result.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent transition-colors min-w-0"
                    >
                      <ExternalLinkIcon className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 min-w-0">
                        {src.title || src.url}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {result?.summary && (
            <>
              <Button variant="secondary" onClick={() => handleUse("append")}>
                Anexar à mensagem
              </Button>
              <Button onClick={() => handleUse("replace")}>
                Usar como mensagem
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
