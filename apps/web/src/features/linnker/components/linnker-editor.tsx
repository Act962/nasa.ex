"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinnkerLinksEditor } from "./linnker-links-editor";
import { LinnkerAppearanceEditor } from "./linnker-appearance-editor";
import { LinnkerQRCode } from "./linnker-qrcode";
import { LinnkerScans } from "./linnker-scans";
import { LinnkerPreview } from "./linnker-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { toast } from "sonner";
import Link from "next/link";
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

  const { mutate: togglePublish, isPending: toggling } = useMutation({
    mutationFn: () =>
      client.linnker.updatePage({ id: pageId, isPublished: !page?.isPublished }),
    onSuccess: () => {
      toast.success(page?.isPublished ? "Página despublicada" : "Página publicada!");
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!page) return null;

  const publicUrl = `/l/${page.slug}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between py-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/linnker"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{page.title}</h1>
              <Badge variant={page.isPublished ? "default" : "secondary"} className="text-xs">
                {page.isPublished ? "Publicado" : "Rascunho"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">/l/{page.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4 mr-2" /> Ver página
            </a>
          </Button>
          <Button
            variant={page.isPublished ? "outline" : "default"}
            size="sm"
            onClick={() => togglePublish()}
            disabled={toggling}
          >
            {page.isPublished ? (
              <><EyeOff className="size-4 mr-2" /> Despublicar</>
            ) : (
              <><Eye className="size-4 mr-2" /> Publicar</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor panel */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="links">
            <TabsList className="mb-4">
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="appearance">Aparência</TabsTrigger>
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              <TabsTrigger value="scans">Scans</TabsTrigger>
            </TabsList>

            <TabsContent value="links">
              <LinnkerLinksEditor page={page} onRefetch={refetch} />
            </TabsContent>

            <TabsContent value="appearance">
              <LinnkerAppearanceEditor page={page} onRefetch={refetch} onPreviewChange={setPreviewOverride} />
            </TabsContent>

            <TabsContent value="qrcode">
              <LinnkerQRCode page={page} />
            </TabsContent>

            <TabsContent value="scans">
              <LinnkerScans pageId={pageId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview panel */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Preview</p>
            <LinnkerPreview page={previewPage} />
          </div>
        </div>
      </div>
    </div>
  );
}
