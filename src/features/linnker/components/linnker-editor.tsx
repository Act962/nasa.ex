"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock, type OrbitDockConfig } from "@/components/orbit-dock/orbit-dock-store";
import { LinnkerLinksEditor } from "./linnker-links-editor";
import { LinnkerAppearanceEditor } from "./linnker-appearance-editor";
import { LinnkerQRCode } from "./linnker-qrcode";
import { LinnkerScans } from "./linnker-scans";
import { LinnkerPreview } from "./linnker-preview";
import { LinnkerEditorHeader } from "./editor/linnker-editor-header";
import { LinnkerPreviewDialog } from "./editor/linnker-preview-dialog";
import {
  LINNKER_EDITOR_SECTIONS,
  LINNKER_EDITOR_SECTION_ORDER,
  isLinnkerEditorSection,
  type LinnkerEditorSection,
} from "./editor/linnker-editor-sections";
import type { LinnkerPage } from "../types";

interface Props {
  pageId: string;
}

export function LinnkerEditor({ pageId }: Props) {
  const { data, isLoading, refetch } = useQuery(
    orpc.linnker.getPage.queryOptions({ input: { id: pageId } }),
  );

  const page = data?.page as LinnkerPage | undefined;
  const [previewOverride, setPreviewOverride] = useState<Partial<LinnkerPage>>({});
  const previewPage = page ? { ...page, ...previewOverride } : undefined;
  const [activeSection, setActiveSection] = useState<LinnkerEditorSection>("links");
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const saveAppearanceRef = useRef<(() => void) | null>(null);

  const { mutate: togglePublish, isPending: isTogglingPublish } = useMutation({
    mutationFn: () =>
      client.linnker.updatePage({ id: pageId, isPublished: !page?.isPublished }),
    onSuccess: () => {
      toast.success(page?.isPublished ? "Página despublicada" : "Página publicada!");
      refetch();
    },
  });

  const toDockItem = (section: LinnkerEditorSection) => {
    const SectionIcon = LINNKER_EDITOR_SECTIONS[section].icon;
    return {
      label: LINNKER_EDITOR_SECTIONS[section].label,
      icon: <SectionIcon />,
      onSelect: () => setActiveSection(section),
      isActive: activeSection === section,
    };
  };

  // Botão central = a ação da seção: novo link em Links, salvar em Aparência; nas demais, o ASTRO.
  const centerActionBySection: Partial<Record<LinnkerEditorSection, OrbitDockConfig["centerAction"]>> = {
    links: { label: "Novo link", icon: <Plus />, onSelect: () => setIsAddLinkOpen(true) },
    appearance: { label: "Salvar", icon: <CheckIcon />, onSelect: () => saveAppearanceRef.current?.() },
  };

  useRegisterOrbitDock({
    leftItems: [toDockItem("links"), toDockItem("appearance")],
    rightItems: [toDockItem("qrcode"), toDockItem("scans")],
    centerAction: page ? centerActionBySection[activeSection] : undefined,
  });

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-24">
        <OrbitaSpinner className="size-8" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="w-full px-4 pb-[150px] md:px-0 lg:pb-10">
      <LinnkerEditorHeader
        page={page}
        activeSection={activeSection}
        onTogglePublish={() => togglePublish()}
        isTogglingPublish={isTogglingPublish}
        onOpenPreview={() => setIsPreviewOpen(true)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Tabs
            value={activeSection}
            onValueChange={(value) => isLinnkerEditorSection(value) && setActiveSection(value)}
          >
            {/* No celular as seções ficam no menu de baixo; as abas ficam só no computador. */}
            <div className="mb-4 overflow-x-auto max-md:sr-only">
              <TabsList className="h-10 w-max">
                {LINNKER_EDITOR_SECTION_ORDER.map((section) => {
                  const SectionIcon = LINNKER_EDITOR_SECTIONS[section].icon;
                  return (
                    <TabsTrigger key={section} value={section} className="gap-1.5 text-xs">
                      <SectionIcon className="size-3.5" /> {LINNKER_EDITOR_SECTIONS[section].label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="links">
              <LinnkerLinksEditor
                page={page}
                onRefetch={refetch}
                isAddLinkOpen={isAddLinkOpen}
                onAddLinkOpenChange={setIsAddLinkOpen}
              />
            </TabsContent>

            <TabsContent value="appearance">
              <LinnkerAppearanceEditor
                page={page}
                onRefetch={refetch}
                onPreviewChange={setPreviewOverride}
                saveActionRef={saveAppearanceRef}
              />
            </TabsContent>

            <TabsContent value="qrcode">
              <LinnkerQRCode page={page} />
            </TabsContent>

            <TabsContent value="scans">
              <LinnkerScans pageId={pageId} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-20">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Prévia</p>
            <LinnkerPreview page={previewPage} />
          </div>
        </div>
      </div>

      <LinnkerPreviewDialog page={previewPage} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
    </div>
  );
}
