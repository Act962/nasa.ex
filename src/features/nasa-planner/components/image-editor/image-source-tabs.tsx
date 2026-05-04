"use client";

import { useRef } from "react";
import { SparklesIcon, UploadIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { type ImageSourceTab, type ImageQuality } from "./use-image-editor";
import { StarIcon } from "lucide-react";

interface Props {
  tab: ImageSourceTab;
  onTabChange: (t: ImageSourceTab) => void;
  aiPrompt: string;
  onPromptChange: (v: string) => void;
  quality: ImageQuality;
  onQualityChange: (q: ImageQuality) => void;
  urlInput: string;
  onUrlChange: (v: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onFileSelect: (file: File) => void;
  onUrlLoad: () => void;
  hasOpenAI: boolean;
}

export function ImageSourceTabs({
  tab, onTabChange,
  aiPrompt, onPromptChange,
  quality, onQualityChange,
  urlInput, onUrlChange,
  isGenerating, onGenerate,
  onFileSelect, onUrlLoad,
  hasOpenAI,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const starCost = hasOpenAI ? (quality === "hd" ? 5 : 3) : 1;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as ImageSourceTab)}>
      <TabsList className="w-full">
        <TabsTrigger value="ai" className="flex-1 gap-1.5">
          <SparklesIcon className="size-3.5" />Gerar com IA
        </TabsTrigger>
        <TabsTrigger value="upload" className="flex-1 gap-1.5">
          <UploadIcon className="size-3.5" />Upload
        </TabsTrigger>
        <TabsTrigger value="url" className="flex-1 gap-1.5">
          <LinkIcon className="size-3.5" />URL
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ai" className="space-y-3 mt-3">
        <div className="space-y-1.5">
          <Label>Descrição da imagem</Label>
          <textarea
            value={aiPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Ex: foto de uma pessoa sorrindo usando um produto de skincare em um ambiente minimalista branco..."
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {hasOpenAI && (
          <div className="space-y-1.5">
            <Label>Qualidade</Label>
            <RadioGroup
              value={quality}
              onValueChange={(v) => onQualityChange(v as ImageQuality)}
              className="flex gap-3"
            >
              <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors", quality === "standard" ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20" : "border-border hover:border-violet-300")}>
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard" className="cursor-pointer">
                  <span className="font-medium">Standard</span>
                  <span className="ml-1.5 text-xs text-muted-foreground flex items-center gap-0.5 inline-flex">
                    <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />3
                  </span>
                </Label>
              </div>
              <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors", quality === "hd" ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20" : "border-border hover:border-violet-300")}>
                <RadioGroupItem value="hd" id="hd" />
                <Label htmlFor="hd" className="cursor-pointer">
                  <span className="font-medium">HD</span>
                  <span className="ml-1.5 text-xs text-muted-foreground flex items-center gap-0.5 inline-flex">
                    <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />5
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <Button
          className="w-full gap-2"
          onClick={onGenerate}
          disabled={!aiPrompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <><Loader2Icon className="size-4 animate-spin" />Gerando...</>
          ) : (
            <><SparklesIcon className="size-4" />Gerar Imagem
              <span className="ml-auto flex items-center gap-0.5 text-xs opacity-80">
                <StarIcon className="size-3 fill-current" />{starCost}
              </span>
            </>
          )}
        </Button>

        {!hasOpenAI && (
          <p className="text-xs text-muted-foreground text-center">
            Conecte a integração <strong>OpenAI</strong> em{" "}
            <a href="/integrations" className="underline text-violet-500 hover:text-violet-600">Integrações</a>{" "}
            para usar DALL-E 3 (melhor qualidade).
          </p>
        )}
      </TabsContent>

      <TabsContent value="upload" className="space-y-3 mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-violet-400 p-8 transition-colors"
        >
          <div className="size-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <UploadIcon className="size-5 text-violet-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Clique para fazer upload</p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG ou WebP</p>
          </div>
        </button>
      </TabsContent>

      <TabsContent value="url" className="space-y-3 mt-3">
        <div className="space-y-1.5">
          <Label>URL da imagem</Label>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://..."
            />
            <Button variant="outline" onClick={onUrlLoad} disabled={!urlInput.trim()}>
              Carregar
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
