"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  orgId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Dialog completo de edição (owner/admin) — tabs:
 *  - Básico (bio, banner, website, template, toggle público/privado)
 *  - Moderação (reviews + comments pendentes)
 *  - Organograma (stub — drag-drop vem em V2)
 *
 * Respeita §7.1: toggle pública/privada + audit log.
 */
export function EditSpaceDialog({ orgId, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const { data } = useQuery({
    ...orpc.companySpace.getSpaceAdmin.queryOptions({ input: { orgId } }),
    enabled: open,
  });

  const [bio, setBio] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [template, setTemplate] = useState<"default" | "corporate" | "creative">(
    "default",
  );
  const [isPublic, setIsPublic] = useState(false);

  // hidrata quando os dados chegam
  const hydrated = useState(() => false);
  if (!hydrated[0] && data?.org) {
    setBio(data.org.bio ?? "");
    setBannerUrl(data.org.bannerUrl ?? "");
    setWebsite(data.org.website ?? "");
    setTemplate(
      (data.org.spacehomeTemplate as "default" | "corporate" | "creative" | null) ??
        "default",
    );
    setIsPublic(data.org.isSpacehomePublic);
    hydrated[1](true);
  }

  const saveBasic = useMutation({
    mutationFn: async () =>
      await client.companySpace.updateSpace({
        orgId,
        bio: bio || null,
        bannerUrl: bannerUrl || null,
        website: website || null,
        spacehomeTemplate: template,
      }),
    onSuccess: () => {
      toast.success("Spacehome atualizada.");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const togglePublic = useMutation({
    mutationFn: async (next: boolean) =>
      await client.companySpace.togglePublic({
        orgId,
        isSpacehomePublic: next,
      }),
    onSuccess: (res) => {
      setIsPublic(res.isSpacehomePublic);
      toast.success(
        res.isSpacehomePublic
          ? "Spacehome agora é pública."
          : "Spacehome voltou a ser privada.",
      );
      qc.invalidateQueries();
    },
    onError: () => toast.error("Erro ao alterar visibilidade."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Spacehome</DialogTitle>
          <DialogDescription>
            Configure a página pública da sua empresa. Apenas owner/admin
            podem editar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList>
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="moderation">
              Moderação
              {data?.pending &&
                data.pending.reviews + data.pending.comments > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                    {data.pending.reviews + data.pending.comments}
                  </span>
                )}
            </TabsTrigger>
            <TabsTrigger value="organogram">Organograma</TabsTrigger>
          </TabsList>

          {/* Básico */}
          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
              <div>
                <Label className="text-sm font-medium">
                  Spacehome pública
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ligado, qualquer pessoa pode ver sua Spacehome.
                  Quando desligado, só membros logados podem ver.
                </p>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={(v) => togglePublic.mutate(v)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="O que sua empresa faz, em 2 linhas..."
              />
              <p className="text-xs text-muted-foreground">
                {bio.length}/500
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="banner">Banner (URL)</Label>
                <Input
                  id="banner"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://suaempresa.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Template</Label>
              <Select
                value={template}
                onValueChange={(v) =>
                  setTemplate(v as "default" | "corporate" | "creative")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="corporate">Corporativo</SelectItem>
                  <SelectItem value="creative">Criativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Moderação */}
          <TabsContent value="moderation" className="space-y-4 pt-4">
            <ModerationPanel orgId={orgId} />
          </TabsContent>

          {/* Organograma */}
          <TabsContent value="organogram" className="pt-4">
            <p className="text-sm text-muted-foreground">
              Edição do organograma em breve. Por enquanto, gerencie via
              API (`companySpace.upsertRole`, `reorderRoles`).
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => saveBasic.mutate()}
            disabled={saveBasic.isPending}
          >
            {saveBasic.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModerationPanel({ orgId }: { orgId: string }) {
  const { data } = useQuery(
    orpc.companySpace.getSpaceAdmin.queryOptions({ input: { orgId } }),
  );
  if (!data) return null;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">Reviews pendentes</p>
          <p className="text-xs text-muted-foreground">
            Aprove ou oculte avaliações recebidas.
          </p>
        </div>
        <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-700">
          {data.pending.reviews}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">Comentários pendentes</p>
          <p className="text-xs text-muted-foreground">
            Posts precisam de aprovação manual.
          </p>
        </div>
        <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-700">
          {data.pending.comments}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="font-medium">Consents de organograma</p>
          <p className="text-xs text-muted-foreground">
            Membros aguardando confirmação pra aparecer publicamente.
          </p>
        </div>
        <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-700">
          {data.pending.roleConsents}
        </span>
      </div>
    </div>
  );
}
