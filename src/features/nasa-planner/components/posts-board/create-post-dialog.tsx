"use client";

import { useState } from "react";
import { PlusIcon, ClockIcon, BuildingIcon, FolderIcon, RocketIcon, XIcon, LinkIcon, MegaphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useActiveOrgProjectsByOrg } from "@/features/org-projects/hooks/use-org-projects";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { POST_NETWORKS } from "../../constants";
import { usePlannerCampaigns } from "../../hooks/use-campaign-planner";
import { useCreatePlannerPost } from "../../hooks/use-nasa-planner";
import { POST_TYPE_OPTIONS, type PostTypeValue } from "./post-type-options";

/** Janela "Novo Post" do quadro: empresa, projeto, campanha, tipo, redes, referências e data. */

const EMPTY_POST_FORM = {
  title: "",
  type: "STATIC" as PostTypeValue,
  networks: [] as string[],
  caption: "",
  orgProjectId: null as string | null,
  clientOrgName: "",
  campaignId: null as string | null,
  referenceLinks: [] as string[],
  scheduledAt: "",
  isAd: false,
};

interface CreatePostDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  plannerId: string;
}

export function CreatePostDialog({ isOpen, onOpenChange, plannerId }: CreatePostDialogProps) {
  const createPost = useCreatePlannerPost();
  const [newPost, setNewPost] = useState(EMPTY_POST_FORM);
  const [newLinkInput, setNewLinkInput] = useState("");
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations } = authClient.useListOrganizations();
  const { projects: orgProjects } = useActiveOrgProjectsByOrg(selectedOrgId);
  const selectedProject = orgProjects.find((project) => project.id === newPost.orgProjectId);
  const { campaigns } = usePlannerCampaigns(plannerId, { enabled: isOpen });
  const selectedCampaign = campaigns.find((campaign) => campaign.id === newPost.campaignId);

  const resetForm = () => {
    setNewPost(EMPTY_POST_FORM);
    setSelectedOrgId(null);
    setNewLinkInput("");
  };

  const addReferenceLink = () => {
    const trimmedLink = newLinkInput.trim();
    if (!trimmedLink) return;
    setNewPost((form) => ({ ...form, referenceLinks: [...form.referenceLinks, trimmedLink] }));
    setNewLinkInput("");
  };

  const removeReferenceLink = (linkIndex: number) =>
    setNewPost((form) => ({ ...form, referenceLinks: form.referenceLinks.filter((_, index) => index !== linkIndex) }));

  const toggleNetwork = (network: string) =>
    setNewPost((form) => ({
      ...form,
      networks: form.networks.includes(network)
        ? form.networks.filter((selectedNetwork) => selectedNetwork !== network)
        : [...form.networks, network],
    }));

  const handleCreatePost = async () => {
    if (!newPost.title.trim()) return;
    await createPost.mutateAsync({
      plannerId,
      title: newPost.title,
      type: newPost.type,
      orgProjectId: newPost.orgProjectId ?? undefined,
      clientOrgName: newPost.clientOrgName || undefined,
      campaignId: newPost.campaignId ?? undefined,
      referenceLinks: newPost.referenceLinks.length ? newPost.referenceLinks : undefined,
      scheduledAt: newPost.scheduledAt || undefined,
      isAd: newPost.isAd,
    });
    onOpenChange(false);
    resetForm();
    emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerPostCreated });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(nextIsOpen) => { onOpenChange(nextIsOpen); if (!nextIsOpen) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[95vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Post</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Empresa */}
          <div className="space-y-1.5">
            <Label>Empresa <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Popover open={orgOpen} onOpenChange={setOrgOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {newPost.clientOrgName ? (
                    <div className="flex items-center gap-2 truncate">
                      <BuildingIcon className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{newPost.clientOrgName}</span>
                    </div>
                  ) : <span className="text-muted-foreground">Selecionar empresa...</span>}
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar empresa..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(organizations ?? []).map((org) => (
                        <CommandItem key={org.id} value={org.name} onSelect={() => {
                          setSelectedOrgId(org.id);
                          setNewPost((f) => ({ ...f, clientOrgName: org.name, orgProjectId: null }));
                          setOrgOpen(false);
                        }}>
                          <BuildingIcon className="size-4 mr-2 opacity-60" />
                          <span className="flex-1 truncate">{org.name}</span>
                          <CheckIcon className={cn("size-4", newPost.clientOrgName === org.name ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Projeto/Cliente */}
          {selectedOrgId && (
            <div className="space-y-1.5">
              <Label>Projeto / Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedProject ? (
                      <div className="flex items-center gap-2 truncate">
                        <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color ?? "#7c3aed" }} />
                        <span className="truncate">{selectedProject.name}</span>
                      </div>
                    ) : <span className="text-muted-foreground">Selecionar projeto/cliente...</span>}
                    <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar projeto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { setNewPost((f) => ({ ...f, orgProjectId: null, clientOrgName: "" })); setProjectOpen(false); }} className="text-muted-foreground">
                          <FolderIcon className="size-4 mr-2 opacity-50" /> Nenhum
                        </CommandItem>
                        {orgProjects.map((p) => (
                          <CommandItem key={p.id} value={p.name} onSelect={() => { setNewPost((f) => ({ ...f, orgProjectId: p.id, clientOrgName: p.name })); setProjectOpen(false); }}>
                            <div className="size-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                            <span className="flex-1 truncate">{p.name}</span>
                            <CheckIcon className={cn("size-4", newPost.orgProjectId === p.id ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Campanha */}
          <div className="space-y-1.5">
            <Label>Campanha <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Popover open={campaignOpen} onOpenChange={setCampaignOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedCampaign ? (
                    <div className="flex items-center gap-2 truncate">
                      <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: selectedCampaign.color ?? "#7c3aed" }} />
                      <span className="truncate">{selectedCampaign.title}</span>
                    </div>
                  ) : <span className="text-muted-foreground">Vincular a uma campanha...</span>}
                  <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar campanha..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma campanha encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__none__" onSelect={() => { setNewPost((f) => ({ ...f, campaignId: null })); setCampaignOpen(false); }} className="text-muted-foreground">
                        <RocketIcon className="size-4 mr-2 opacity-50" /> Nenhuma
                      </CommandItem>
                      {campaigns.map((c) => (
                        <CommandItem key={c.id} value={c.title} onSelect={() => { setNewPost((f) => ({ ...f, campaignId: c.id })); setCampaignOpen(false); }}>
                          <div className="size-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: c.color ?? "#7c3aed" }} />
                          <span className="flex-1 truncate">{c.title}</span>
                          <CheckIcon className={cn("size-4", newPost.campaignId === c.id ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input placeholder="Ex: Post de lançamento do produto X" data-guide={GUIDE_ANCHORS.plannerPostTitle.id} value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPE_OPTIONS.map(({ value, label }) => (
                <Badge key={value} variant={newPost.type === value ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => setNewPost((p) => ({ ...p, type: value }))}>{label}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Redes Sociais</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(POST_NETWORKS).map(([key, label]) => (
                <Badge key={key} variant={newPost.networks.includes(key) ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => toggleNetwork(key)}>{label}</Badge>
              ))}
            </div>
          </div>

          {/* Links de Referência */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="size-3.5 opacity-60" />
              Links de Referência <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">Adicione links de posts do Instagram, Pinterest ou outras redes para usar como inspiração na criação com IA.</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.instagram.com/p/..."
                value={newLinkInput}
                onChange={(e) => setNewLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReferenceLink(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addReferenceLink} disabled={!newLinkInput.trim()}>
                <PlusIcon className="size-3.5" />
              </Button>
            </div>
            {newPost.referenceLinks.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                {newPost.referenceLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                    <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-muted-foreground">{link}</span>
                    <button type="button" onClick={() => removeReferenceLink(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <ClockIcon className="size-3.5 opacity-60" />
              Data e Hora de Publicação <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input
              type="datetime-local"
              value={newPost.scheduledAt}
              onChange={(e) => setNewPost((p) => ({ ...p, scheduledAt: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <MegaphoneIcon className="size-3.5 text-warning" />
                Post para anúncio
              </Label>
              <p className="text-xs text-muted-foreground">Marque se este post será usado como campanha de anúncios pagos.</p>
            </div>
            <Switch
              checked={newPost.isAd}
              onCheckedChange={(v) => setNewPost((p) => ({ ...p, isAd: v }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Legenda (opcional)</Label>
            <Textarea placeholder="Escreva a legenda ou deixe a IA gerar..." rows={3} value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancelar</Button>
          <Button
            onClick={handleCreatePost}
            disabled={!newPost.title.trim() || createPost.isPending}
            data-guide={GUIDE_ANCHORS.plannerPostSubmit.id}
          >
            {createPost.isPending ? "Criando..." : "Criar Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
