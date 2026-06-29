"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/spinner";
import { useNasaPlanner, useUpdatePlanner } from "../../hooks/use-nasa-planner";

const INITIAL_FORM = {
  brandName: "", brandSlogan: "", website: "", icp: "",
  positioning: "", toneOfVoice: "", keyMessages: "", forbiddenWords: "",
  primaryColors: "", secondaryColors: "", fonts: "", anthropicApiKey: "",
  strengths: "", weaknesses: "", opportunities: "", threats: "",
};

export function SettingsTab({ plannerId }: { plannerId: string }) {
  const { planner, isLoading } = useNasaPlanner(plannerId);
  const updatePlanner = useUpdatePlanner();
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (!planner) return;
    const joinArray = (v: any) => Array.isArray(v) ? v.join(", ") : v ?? "";
    setForm({
      brandName: planner.brandName ?? "",
      brandSlogan: planner.brandSlogan ?? "",
      website: planner.website ?? "",
      icp: planner.icp ?? "",
      positioning: planner.positioning ?? "",
      toneOfVoice: planner.toneOfVoice ?? "",
      keyMessages: joinArray(planner.keyMessages),
      forbiddenWords: joinArray(planner.forbiddenWords),
      primaryColors: joinArray(planner.primaryColors),
      secondaryColors: joinArray(planner.secondaryColors),
      fonts: joinArray(planner.fonts),
      anthropicApiKey: planner.anthropicApiKey ?? "",
      strengths: (planner as any).strengths ?? "",
      weaknesses: (planner as any).weaknesses ?? "",
      opportunities: (planner as any).opportunities ?? "",
      threats: (planner as any).threats ?? "",
    });
  }, [planner]);

  const splitCSV = (v: string) => v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const handleSave = () =>
    updatePlanner.mutateAsync({
      plannerId,
      ...form,
      keyMessages: splitCSV(form.keyMessages),
      forbiddenWords: splitCSV(form.forbiddenWords),
      primaryColors: splitCSV(form.primaryColors),
      secondaryColors: splitCSV(form.secondaryColors),
      fonts: splitCSV(form.fonts),
    });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-6 space-y-8 max-w-2xl">
        {/* Marca */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Marca</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da Marca</Label>
              <Input placeholder="Ex: Minha Empresa" {...field("brandName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Slogan</Label>
              <Input placeholder="Ex: Inovando para o futuro" {...field("brandSlogan")} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input placeholder="https://minhaempresa.com.br" {...field("website")} />
            </div>
          </div>
        </section>

        <Separator />

        {/* ICP & Posicionamento */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">ICP & Posicionamento</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Perfil do Cliente Ideal (ICP)</Label>
              <Textarea placeholder="Descreva o perfil do seu cliente ideal..." rows={3} {...field("icp")} />
            </div>
            <div className="space-y-1.5">
              <Label>Posicionamento</Label>
              <Textarea placeholder="Como sua marca se posiciona no mercado?" rows={3} {...field("positioning")} />
            </div>
          </div>
        </section>

        <Separator />

        {/* Voz & Tom */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Voz & Tom</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tom de Voz</Label>
              <Textarea placeholder="Ex: amigável, profissional, descontraído..." rows={3} {...field("toneOfVoice")} />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagens-chave</Label>
              <Input placeholder="Ex: Qualidade, Inovação, Confiança (separadas por vírgula)" {...field("keyMessages")} />
              <p className="text-xs text-muted-foreground">Separe por vírgula</p>
            </div>
            <div className="space-y-1.5">
              <Label>Palavras Proibidas</Label>
              <Input placeholder="Ex: barato, produto, coisa (separadas por vírgula)" {...field("forbiddenWords")} />
              <p className="text-xs text-muted-foreground">Separe por vírgula</p>
            </div>
          </div>
        </section>

        <Separator />

        {/* Visual */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visual</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cores Primárias</Label>
              <Input placeholder="Ex: #7C3AED, #DB2777 (separadas por vírgula)" {...field("primaryColors")} />
            </div>
            <div className="space-y-1.5">
              <Label>Cores Secundárias</Label>
              <Input placeholder="Ex: #F3F4F6, #1F2937 (separadas por vírgula)" {...field("secondaryColors")} />
            </div>
            <div className="space-y-1.5">
              <Label>Fontes</Label>
              <Input placeholder="Ex: Inter, Poppins (separadas por vírgula)" {...field("fonts")} />
            </div>
          </div>
        </section>

        <Separator />

        {/* IA */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inteligência Artificial</h2>
          <div className="space-y-1.5">
            <Label>Chave de API Anthropic</Label>
            <Input type="password" placeholder="sk-ant-..." {...field("anthropicApiKey")} />
            <p className="text-xs text-muted-foreground">
              Usado para geração de conteúdo com IA. Deixe em branco para usar a chave padrão da plataforma.
            </p>
          </div>
        </section>

        <Separator />

        {/* SWOT */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Análise SWOT</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-green-600 dark:text-green-400 font-medium">Forças (Strengths)</Label>
              <Textarea placeholder="Pontos fortes da sua marca..." rows={4} {...field("strengths")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-red-600 dark:text-red-400 font-medium">Fraquezas (Weaknesses)</Label>
              <Textarea placeholder="Pontos fracos a melhorar..." rows={4} {...field("weaknesses")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-blue-600 dark:text-blue-400 font-medium">Oportunidades (Opportunities)</Label>
              <Textarea placeholder="Oportunidades de mercado..." rows={4} {...field("opportunities")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-orange-600 dark:text-orange-400 font-medium">Ameaças (Threats)</Label>
              <Textarea placeholder="Ameaças e riscos externos..." rows={4} {...field("threats")} />
            </div>
          </div>
        </section>

        <div className="pt-2 pb-8">
          <Button onClick={handleSave} disabled={updatePlanner.isPending} className="w-full sm:w-auto">
            {updatePlanner.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
