"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Link2, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";

/**
 * "Quick add" via link OU imagem. Dois caminhos:
 *
 *  1. **Link**: user cola URL → server parsea HTML (JSON-LD/OG/regex
 *     de data em texto livre) → cria Action.
 *  2. **Imagem**: user envia flyer/banner → Claude Vision extrai
 *     título, datas, local, categoria → cria Action com a imagem
 *     como cover.
 *
 * Em AMBOS os casos, após criar:
 *  - Toast resume o que foi importado
 *  - Lista `missingFields` (datas, categoria, endereço, imagem) é
 *    mostrada em alerta amarelo "Antes de publicar, complete: ..."
 *  - Calendário é invalidado pra puxar o evento novo
 */
export function QuickAddFromLink() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<"link" | "imagem">("link");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mutation do fluxo de URL (oRPC procedure existente)
  const linkMutation = useMutation(
    orpc.public.calendar.quickCreateFromLink.mutationOptions({
      onSuccess: (data) => {
        const d = data as {
          event?: { title?: string };
          missingFields?: string[];
        };
        showCreatedToast(d.event?.title ?? "novo", d.missingFields ?? []);
        setUrl("");
        setOpen(false);
        queryClient.invalidateQueries({
          queryKey: orpc.public.calendar.listPublic.queryKey(),
        });
      },
      onError: (err) => {
        const msg =
          (err as { message?: string })?.message ?? "Falha ao importar link";
        toast.error(msg);
      },
    }),
  );

  function showCreatedToast(title: string, missing: string[]) {
    if (missing.length === 0) {
      toast.success(`Evento "${title}" criado`, {
        description: "Tudo importado — pronto pra publicar.",
      });
      return;
    }
    toast.warning(`Evento "${title}" criado, mas falta info`, {
      description: `Antes de publicar, complete: ${missing.join(", ")}.`,
      duration: 10_000,
    });
  }

  // Submissão por imagem: chama o route handler /api/public-calendar/quick-create-from-image
  async function submitImage() {
    if (!imageFile) return;
    if (!session?.user) {
      router.push("/sign-up?callbackUrl=/calendario");
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await fetch("/api/public-calendar/quick-create-from-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao analisar imagem");
        return;
      }
      showCreatedToast(
        data?.event?.title ?? "novo",
        data?.missingFields ?? [],
      );
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOpen(false);
      queryClient.invalidateQueries({
        queryKey: orpc.public.calendar.listPublic.queryKey(),
      });
    } catch {
      toast.error("Erro inesperado ao processar imagem");
    } finally {
      setImageUploading(false);
    }
  }

  function submitLink() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!session?.user) {
      router.push("/sign-up?callbackUrl=/calendario");
      return;
    }
    linkMutation.mutate({ url: trimmed });
  }

  if (sessionLoading) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          title="Cole o link de um evento OU envie o flyer/banner e o sistema importa automaticamente"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Importar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-3" align="end">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-xs font-semibold">
            Importar evento automaticamente
          </span>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "imagem")}>
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="link" className="text-xs gap-1.5">
              <Link2 className="size-3" />
              Link
            </TabsTrigger>
            <TabsTrigger value="imagem" className="text-xs gap-1.5">
              <ImageIcon className="size-3" />
              Imagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-2 mt-3">
            <p className="text-[11px] text-muted-foreground leading-tight">
              Cole o link de qualquer página de evento. Vou puxar título,
              data, descrição, imagem, local e categoria automaticamente.
            </p>
            <div className="flex gap-1.5">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitLink();
                  }
                }}
                placeholder="https://..."
                className="h-8 text-xs"
                disabled={linkMutation.isPending}
                autoFocus
              />
              <Button
                size="sm"
                onClick={submitLink}
                disabled={!url.trim() || linkMutation.isPending}
                className="h-8 px-3 text-xs gap-1"
              >
                {linkMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Criar
              </Button>
            </div>
            {linkMutation.isPending && (
              <p className="text-[10px] text-muted-foreground">
                Buscando dados do evento...
              </p>
            )}
          </TabsContent>

          <TabsContent value="imagem" className="space-y-2 mt-3">
            <p className="text-[11px] text-muted-foreground leading-tight">
              Envie o flyer/banner do evento. IA vai ler título, datas,
              local e categoria. A imagem vira a capa.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              disabled={imageUploading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="h-8 w-full text-xs gap-1.5"
            >
              <ImageIcon className="size-3" />
              {imageFile ? imageFile.name : "Selecionar imagem"}
            </Button>
            {imageFile && (
              <Button
                size="sm"
                onClick={submitImage}
                disabled={imageUploading}
                className="h-8 w-full text-xs gap-1"
              >
                {imageUploading ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Analisando imagem... pode levar alguns segundos
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3" />
                    Importar via IA
                  </>
                )}
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground leading-tight flex items-start gap-1">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              Funciona melhor com flyers que mostram título, data e local
              de forma clara.
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
