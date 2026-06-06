"use client";

/**
 * Editor da URL pública da página — fica no topo da aba "Ajustes".
 *
 * UX:
 *   - Mostra a URL final em destaque (`/s/<slug>` ou `/s/<root>/<sub>`)
 *   - Input edita só o segmento próprio (slug); auto-sugere a partir
 *     do título quando o user clica no botão "↺ do título".
 *   - Salva com debounce manual (botão "Salvar") — não autosave porque
 *     mudar slug invalida URL anterior; melhor confirmação explícita.
 *   - Validação client-side: 2-64 chars, lowercase, hifens — espelha
 *     o `slugSchema` do server.
 *
 * Limitações conhecidas (avisadas ao user):
 *   - Mudar slug invalida a URL antiga (sem redirect 301 ainda).
 *   - Subpages têm slug único só dentro do mesmo site; top-level único
 *     global.
 */
import { useEffect, useState } from "react";
import { Link as LinkIcon, Copy, Check, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { usePage, useUpdatePageSlug } from "../../hooks/use-pages";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function UrlSlugEditor() {
  const pageId = usePagesBuilderStore((s) => s.pageId);
  const { data, isLoading } = usePage(pageId ?? "");
  const { mutate: updateSlug, isPending } = useUpdatePageSlug();

  const page = data?.page;
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  // Sincroniza draft com slug do server quando carrega/troca de page
  useEffect(() => {
    if (page?.slug) setDraft(page.slug);
  }, [page?.slug]);

  if (!pageId || isLoading || !page) {
    return (
      <div className="py-2 px-3 text-xs text-muted-foreground">
        Carregando configurações…
      </div>
    );
  }

  const isSubpage = page.parentPageId != null;
  const rootSlug = (page as unknown as { parent?: { slug: string } }).parent
    ?.slug;
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.nasaagents.com";
  const fullUrl = isSubpage
    ? `${baseUrl}/s/${rootSlug ?? "<root>"}/${draft}`
    : `${baseUrl}/s/${draft}`;

  const isValid = SLUG_REGEX.test(draft) && draft.length >= 2 && draft.length <= 64;
  const isDirty = draft !== page.slug;
  const titleSlug = toSlug(page.title);

  const handleSave = () => {
    if (!isValid || !isDirty) return;
    updateSlug(
      { id: page.id, slug: draft },
      {
        onSuccess: () => {
          toast.success("URL atualizada", {
            description: "A URL antiga não funciona mais. Compartilhe a nova.",
          });
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar — copie manualmente");
    }
  };

  return (
    <div className="py-3 px-3 border-b">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
        URL da página
      </p>

      {/* Preview da URL final */}
      <div className="rounded-md border bg-muted/30 p-2 mb-2.5">
        <div className="flex items-start gap-1.5">
          <LinkIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground mb-0.5">
              URL pública
            </p>
            <p className="text-[11px] font-mono break-all leading-snug">
              {fullUrl}
            </p>
          </div>
          <button
            onClick={handleCopy}
            title="Copiar URL"
            className="shrink-0 p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <a
            href={`/s/${isSubpage ? `${rootSlug}/${draft}` : draft}`}
            target="_blank"
            rel="noreferrer"
            title="Abrir em nova aba"
            className="shrink-0 p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Editor do slug */}
      <Label className="text-[10px] text-muted-foreground">
        {isSubpage ? "Slug desta subpage" : "Slug do site (raiz)"}
      </Label>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
          {isSubpage ? `/s/${rootSlug ?? "…"}/` : "/s/"}
        </span>
        <Input
          value={draft}
          onChange={(e) => setDraft(toSlug(e.target.value))}
          placeholder="meu-site"
          className="text-xs font-mono"
        />
      </div>

      {/* Validação visual */}
      {draft && !isValid && (
        <p className="text-[10px] text-destructive mt-1">
          Slug inválido — 2-64 chars, minúsculas, números e hifens (sem
          acento ou espaço).
        </p>
      )}

      {/* Sugestão a partir do título */}
      {draft !== titleSlug && titleSlug && (
        <button
          onClick={() => setDraft(titleSlug)}
          className="text-[10px] text-indigo-600 hover:underline mt-1 flex items-center gap-1"
        >
          <RotateCcw className="size-3" /> Usar slug do título: {titleSlug}
        </button>
      )}

      {/* Aviso quando dirty */}
      {isDirty && isValid && (
        <p className="text-[10px] text-amber-700 mt-2 leading-snug">
          ⚠️ Salvar muda a URL pública — links antigos vão deixar de
          funcionar.
        </p>
      )}

      <div className="flex gap-1.5 mt-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isValid || !isDirty || isPending}
          className="text-xs flex-1"
        >
          {isPending ? "Salvando…" : "Salvar URL"}
        </Button>
        {isDirty && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDraft(page.slug)}
            className="text-xs"
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
