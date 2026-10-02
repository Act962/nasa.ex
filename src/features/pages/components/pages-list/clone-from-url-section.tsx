"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useClonePageFromUrl } from "../../hooks/use-page-templates";

/** Cola a URL de um site público e a ÓRBITA monta uma página parecida para editar. */
export function CloneFromUrlSection({ costStars }: { costStars: number }) {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const { mutate: clonePage, isPending } = useClonePageFromUrl();

  const submitClone = () => {
    if (!sourceUrl.trim()) return;
    clonePage(sourceUrl, {
      onSuccess: ({ page, stats }) => {
        const summary = stats
          ? `${stats.blocksGenerated} blocos · ${stats.faqs} perguntas · ${stats.testimonials} depoimentos · ${stats.pricing} planos · ${stats.imagesFound} imagens`
          : "Página importada";
        toast.success(`${summary}. Edite no editor.`);
        setSourceUrl("");
        router.push(`/pages/${page.id}`);
      },
      onError: (error: Error) => toast.error(error.message ?? "Erro ao importar página"),
    });
  };

  return (
    <section className="rounded-[20px] border border-dashed border-info/40 bg-info/5 p-4 sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-info/15">
          <Link2 className="size-4 text-info" />
        </div>
        <h2 className="text-base font-bold">Criar página parecida com outro site</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Cole o endereço de um site público que você gostou. A ÓRBITA copia a estrutura (títulos, blocos, cores) e você
        ajusta no editor.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitClone();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          type="url"
          required
          placeholder="https://exemplo.com/minha-pagina"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          className="h-11 flex-1 rounded-full"
          disabled={isPending}
        />
        <Button type="submit" disabled={!sourceUrl.trim() || isPending} className="h-11 gap-1.5 rounded-full whitespace-nowrap">
          {isPending ? (
            <>
              <OrbitaSpinner className="size-4" isOnBrandColor />
              Importando…
            </>
          ) : (
            `Importar e criar (${costStars.toLocaleString("pt-BR")} Stars)`
          )}
        </Button>
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Funciona melhor com sites simples; alguns sites bloqueiam a leitura e voltam incompletos.
      </p>
    </section>
  );
}
