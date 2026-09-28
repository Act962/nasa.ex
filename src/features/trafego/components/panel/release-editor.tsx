"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Globe,
  Instagram,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SOURCE_LABEL,
  type ReleaseSourceKind,
  type TrafegoReleaseContent,
} from "@/features/trafego/lib/release";
import {
  useAddTrafegoReleaseSource,
  useGenerateTrafegoRelease,
  useRemoveTrafegoReleaseSource,
  useSaveTrafegoRelease,
  useTrafegoRelease,
} from "@/features/trafego/hooks/use-trafego-release";
import { TechnicalTerm } from "../technical-term";

const EMPTY_RELEASE: TrafegoReleaseContent = {
  about: "",
  products: [],
  differentials: [],
  audience: "",
  tone: "",
  offers: [],
  doNotSay: [],
};

const SOURCE_ICON: Record<ReleaseSourceKind, React.ReactNode> = {
  site: <Globe className="size-3.5" />,
  pdf: <FileText className="size-3.5" />,
  instagram: <Instagram className="size-3.5" />,
  facebook: <Instagram className="size-3.5" />,
};

/**
 * O Release: material de referência da empresa que alimenta copies e
 * recomendações.
 *
 * O cliente aponta as fontes, o Astro redige e ele revisa. Editar antes de
 * salvar é o ponto: o texto só vira insumo depois que uma pessoa conferiu.
 */
export function ReleaseEditor({ orderId }: { orderId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { data } = useTrafegoRelease(orderId, { poll: isGenerating });
  const addSource = useAddTrafegoReleaseSource();
  const removeSource = useRemoveTrafegoReleaseSource();
  const generate = useGenerateTrafegoRelease();
  const save = useSaveTrafegoRelease();

  const [draft, setDraft] = useState<TrafegoReleaseContent>(EMPTY_RELEASE);
  const [isDirty, setIsDirty] = useState(false);
  const [kind, setKind] = useState<ReleaseSourceKind>("site");
  const [value, setValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const generatedAt = data?.generatedAt ?? null;
  const lastSeenGeneratedAt = useRef<string | null>(null);

  // Só sobrescreve o rascunho quando o servidor traz algo mais novo — e nunca
  // por cima do que o cliente está digitando.
  useEffect(() => {
    if (!data?.release) return;
    const stamp = generatedAt ? String(generatedAt) : "saved";
    if (stamp === lastSeenGeneratedAt.current) return;
    if (isDirty) return;
    lastSeenGeneratedAt.current = stamp;
    setDraft(data.release);
    if (isGenerating && generatedAt) {
      setIsGenerating(false);
      toast.success("Release montado! Revise e salve.");
    }
  }, [data?.release, generatedAt, isDirty, isGenerating]);

  const sources = data?.sources ?? [];
  const hasReadableSource = sources.some(
    (source) => source.kind === "site" || source.kind === "pdf",
  );

  function patch(fields: Partial<TrafegoReleaseContent>) {
    setDraft((current) => ({ ...current, ...fields }));
    setIsDirty(true);
  }

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/s3/upload-direct", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Falha ao enviar o arquivo.");
      const { key } = (await response.json()) as { key: string };
      await addSource.mutateAsync({
        orderId,
        kind: "pdf",
        value: file.name,
        fileKey: key,
      });
      toast.success("PDF adicionado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className="space-y-5">
      <header>
        <h3 className="text-sm font-semibold">
          Release da sua empresa
          <TechnicalTerm term="release" />
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Aponte o site e o catálogo. A gente lê, escreve um resumo da sua
          empresa e usa ele para criar os textos dos anúncios.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <Label className="text-xs">Fontes</Label>

        {sources.length > 0 && (
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li
                key={source.id}
                className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2.5"
              >
                <span className="mt-0.5 text-muted-foreground">
                  {SOURCE_ICON[source.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{source.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {SOURCE_LABEL[source.kind]}
                    {source.extractedAt
                      ? ` · lido (${source.chars ?? 0} caracteres)`
                      : source.note
                        ? ` · ${source.note}`
                        : " · ainda não lido"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() =>
                    removeSource.mutate({ orderId, sourceId: source.id })
                  }
                  aria-label={`Remover ${source.value}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Select
            value={kind}
            onValueChange={(next) => setKind(next as ReleaseSourceKind)}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>

          {kind === "pdf" ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInput.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Escolher PDF
              </Button>
            </>
          ) : (
            <>
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={
                  kind === "site" ? "https://suaempresa.com.br" : "@seuperfil"
                }
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!value.trim()) return;
                  addSource.mutate(
                    { orderId, kind, value: value.trim() },
                    {
                      onSuccess: () => setValue(""),
                      onError: (error) => toast.error(error.message),
                    },
                  );
                }}
                disabled={addSource.isPending || !value.trim()}
              >
                <Plus className="size-4" />
                Adicionar
              </Button>
            </>
          )}
        </div>

        <Button
          className="mt-3 w-full"
          onClick={() => {
            setIsDirty(false);
            setIsGenerating(true);
            generate.mutate(
              { orderId },
              {
                onError: (error) => {
                  setIsGenerating(false);
                  toast.error(error.message);
                },
              },
            );
          }}
          disabled={!hasReadableSource || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isGenerating ? "Lendo suas fontes…" : "Pedir ao Astro para montar"}
        </Button>
        {!hasReadableSource && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Adicione o site ou um PDF — só deles conseguimos ler o conteúdo.
            Links de rede social ficam guardados para a equipe consultar.
          </p>
        )}
      </div>

      <div
        className={cn(
          "space-y-4",
          isGenerating && "pointer-events-none opacity-60",
        )}
      >
        <Field
          label="Sobre a empresa"
          value={draft.about}
          onChange={(next) => patch({ about: next })}
          rows={4}
        />
        <ListField
          label="Produtos e serviços"
          values={draft.products}
          onChange={(next) => patch({ products: next })}
        />
        <ListField
          label="Diferenciais"
          values={draft.differentials}
          onChange={(next) => patch({ differentials: next })}
        />
        <Field
          label="Para quem vocês vendem"
          value={draft.audience}
          onChange={(next) => patch({ audience: next })}
          rows={3}
        />
        <Field
          label="Tom de voz"
          value={draft.tone}
          onChange={(next) => patch({ tone: next })}
          rows={2}
        />
        <ListField
          label="Ofertas e condições"
          values={draft.offers}
          onChange={(next) => patch({ offers: next })}
        />
        <ListField
          label="O que não dizer no anúncio"
          values={draft.doNotSay}
          onChange={(next) => patch({ doNotSay: next })}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {data?.savedAt
              ? "Release salvo — já está sendo usado nas sugestões."
              : "Revise e salve. Só depois de salvo ele vira insumo dos anúncios."}
          </p>
          <Button
            onClick={() =>
              save.mutate(
                { orderId, release: draft },
                {
                  onSuccess: () => {
                    setIsDirty(false);
                    toast.success("Release salvo.");
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
            disabled={save.isPending || !draft.about.trim()}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar Release
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
    </div>
  );
}

/** Uma linha por item — mais simples de editar que chips e vira array direto. */
function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        <span className="ml-1.5 font-normal text-muted-foreground">
          um por linha
        </span>
      </Label>
      <Textarea
        value={values.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }
        rows={Math.max(2, Math.min(values.length + 1, 8))}
      />
    </div>
  );
}
