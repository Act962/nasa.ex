"use client";

/**
 * PlannerPopup — NASA Planner 2.0.
 *
 * Popup ancorado em cards de evento do Workspace (`view-action-modal`)
 * com 4 abas: **Campanhas**, **Posts**, **Mapa Mental**, **Branding**.
 *
 * Substitui o antigo `ActionToPlannerDialog`. Toda a criação de conteúdo
 * acontece dentro deste popup, com:
 *  - Upload OU URL de imagem de referência (ambos funcionais)
 *  - Seleção de modelo IA (Ideogram 3.0 Quality/Balanced/Turbo, DALL-E
 *    3, Pollinations) com STARs visíveis
 *  - Prompt + negative prompt
 *  - Brand kit aplicado automaticamente
 *  - Preview da imagem gerada
 *
 * Quando aberto via "Criar com Planner" no Workspace, o `actionContext`
 * é guardado em estado mas o post NÃO é criado automaticamente. O post
 * só nasce quando o usuário clica em **Gerar imagem** (lazy creation).
 * Antes disso, o popup é apenas uma UI de composição.
 *
 * Layout: ocupa 90vw × 90vh em desktop, full-screen no mobile. Responsivo
 * em todas as larguras.
 */

import { useState } from "react";
import { useNasaPlanners } from "../hooks/use-nasa-planner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Palette, Megaphone, Brain, FileText } from "lucide-react";
import { PopupBrandingTab } from "./planner-popup/popup-branding-tab";
import { PopupPostsTab } from "./planner-popup/popup-posts-tab";
import type { ActionContext } from "./planner-popup/popup-shared";

export type { ActionContext };

interface PlannerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionContext?: ActionContext;
  initialPlannerId?: string;
}

export function PlannerPopup({
  open,
  onOpenChange,
  actionContext,
  initialPlannerId,
}: PlannerPopupProps) {
  const [tab, setTab] = useState<"campaigns" | "posts" | "mindmap" | "branding">(
    actionContext ? "posts" : "campaigns",
  );

  const { planners } = useNasaPlanners({ enabled: open });
  const plannerId = initialPlannerId ?? planners[0]?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          // Mobile: full-screen sem bordas; ≥sm: 90vw × 90vh com margem
          "p-0 gap-0 flex flex-col overflow-hidden",
          "w-screen h-[100dvh] max-w-none rounded-none",
          "sm:w-[90vw] sm:h-[90vh] sm:max-w-[1400px] sm:rounded-xl",
        ].join(" ")}
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="size-4 sm:size-5 text-info shrink-0" />
            <span>ÓRBITA Planner</span>
            {actionContext && (
              <span className="text-xs sm:text-sm font-normal text-muted-foreground truncate">
                — "{actionContext.title}"
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex-1 flex flex-col overflow-hidden min-h-0"
        >
          <div className="px-4 sm:px-6 pt-3 shrink-0 overflow-x-auto">
            <TabsList className="grid grid-cols-4 w-full min-w-[420px] sm:min-w-0 sm:w-auto sm:inline-grid">
              <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm">
                <Megaphone className="size-3.5" />
                <span className="hidden sm:inline">Campanhas</span>
              </TabsTrigger>
              <TabsTrigger value="posts" className="gap-1.5 text-xs sm:text-sm">
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="mindmap" className="gap-1.5 text-xs sm:text-sm">
                <Brain className="size-3.5" />
                <span className="hidden sm:inline">Mapa Mental</span>
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-1.5 text-xs sm:text-sm">
                <Palette className="size-3.5" />
                <span className="hidden sm:inline">Branding</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="posts"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0 data-[state=active]:flex flex-col"
          >
            {plannerId ? (
              <PopupPostsTab
                plannerId={plannerId}
                actionContext={actionContext}
                onBrandingNavigate={() => setTab("branding")}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Carregando planner...
              </p>
            )}
          </TabsContent>

          <TabsContent
            value="campaigns"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <PlaceholderTab
              icon={<Megaphone className="size-8" />}
              title="Campanhas"
              description="Wizard 5W2H + gestão de campanhas. (Reusa CampaignsTab da página standalone — refator em andamento, próximo PR.)"
            />
          </TabsContent>

          <TabsContent
            value="mindmap"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <PlaceholderTab
              icon={<Brain className="size-8" />}
              title="Mapa Mental"
              description="Brainstorm visual de ideias pra campanha. (Reusa MindMapsTab — refator em andamento.)"
            />
          </TabsContent>

          <TabsContent
            value="branding"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <PopupBrandingTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
      <div className="opacity-40 mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-xs max-w-md leading-relaxed">{description}</p>
    </div>
  );
}
