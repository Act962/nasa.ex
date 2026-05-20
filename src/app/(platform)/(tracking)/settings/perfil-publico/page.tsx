"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useMyStation } from "@/features/space-station/hooks/use-station";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Globe2,
  Github,
  Linkedin,
  Mail,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * Página de edição do ProfileCard público — é onde o usuário "publica" o
 * próprio perfil que aparece no popup da Spacehome (UserProfileDropdown)
 * e na página `/profile/[userId]`.
 *
 * Toggles granulares: o usuário escolhe cada campo individual que
 * fica público (headline, bio, LinkedIn, GitHub, etc.).
 */
export default function PerfilPublicoPage() {
  const qc = useQueryClient();
  // Station da org ativa — usada pra montar o link "Ver perfil público".
  // O nick é o identifier compartilhado de `/space/<nick>`.
  const { data: myStation } = useMyStation("ORG");
  const stationNick = myStation?.station?.nick ?? null;

  const { data: card, isLoading } = useQuery(
    orpc.profileCard.getMyProfileCard.queryOptions({ input: undefined }),
  );

  /* ─────── Form state (sincroniza com card carregado) ─────── */
  const [headline, setHeadline]         = useState("");
  const [bio, setBio]                   = useState("");
  const [linkedinUrl, setLinkedinUrl]   = useState("");
  const [githubUrl, setGithubUrl]       = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [cvUrl, setCvUrl]               = useState("");
  const [email, setEmail]               = useState("");

  const [isPublic, setIsPublic]         = useState(false);
  const [showHeadline, setShowHeadline] = useState(true);
  const [showBio, setShowBio]           = useState(true);
  const [showLinkedin, setShowLinkedin] = useState(true);
  const [showGithub, setShowGithub]     = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showCv, setShowCv]             = useState(true);
  const [showEmail, setShowEmail]       = useState(false);
  const [showSkills, setShowSkills]     = useState(true);
  const [showTools, setShowTools]       = useState(true);

  useEffect(() => {
    if (!card) return;
    setHeadline(card.headline ?? "");
    setBio(card.bio ?? "");
    setLinkedinUrl(card.linkedinUrl ?? "");
    setGithubUrl(card.githubUrl ?? "");
    setPortfolioUrl(card.portfolioUrl ?? "");
    setCvUrl(card.cvUrl ?? "");
    setEmail(card.email ?? "");
    setIsPublic(card.isPublic);
    setShowHeadline(card.showHeadline);
    setShowBio(card.showBio);
    setShowLinkedin(card.showLinkedin);
    setShowGithub(card.showGithub);
    setShowPortfolio(card.showPortfolio);
    setShowCv(card.showCv);
    setShowEmail(card.showEmail);
    setShowSkills(card.showSkills);
    setShowTools(card.showTools);
  }, [card]);

  /* ─────── Mutations ─────── */
  const upsert = useMutation(
    orpc.profileCard.upsertProfileCard.mutationOptions({
      onSuccess: () => {
        toast.success("Perfil atualizado.");
        qc.invalidateQueries({ queryKey: orpc.profileCard.getMyProfileCard.queryKey() });
      },
      onError: (err) => toast.error(err.message ?? "Erro ao salvar."),
    }),
  );

  function handleSave() {
    upsert.mutate({
      headline:     headline.trim()     || null,
      bio:          bio.trim()          || null,
      linkedinUrl:  linkedinUrl.trim()  || null,
      githubUrl:    githubUrl.trim()    || null,
      portfolioUrl: portfolioUrl.trim() || null,
      cvUrl:        cvUrl.trim()        || null,
      email:        email.trim()        || null,
      isPublic,
      showHeadline,
      showBio,
      showLinkedin,
      showGithub,
      showPortfolio,
      showCv,
      showEmail,
      showSkills,
      showTools,
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Perfil público
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este é o perfil que aparece quando alguém clica no seu avatar na
            Spacehome ou no organograma. Você escolhe o que fica visível.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Link pra Spacehome pública da org ativa — abre em nova aba.
              Só aparece se o usuário tem uma SpaceStation ORG configurada
              (nick definido). */}
          {stationNick && (
            <Button variant="outline" asChild>
              <Link
                href={`/space/${stationNick}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir minha página pública em nova aba"
              >
                <ExternalLink className="mr-2 size-4" />
                Ver perfil público
              </Link>
            </Button>
          )}
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Publicação geral */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {isPublic ? (
              <Eye className="mt-0.5 size-5 text-emerald-500" />
            ) : (
              <EyeOff className="mt-0.5 size-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isPublic ? "Perfil publicado" : "Perfil não publicado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? "Os campos marcados como visíveis abaixo aparecem para qualquer pessoa que abrir seu perfil."
                  : "Enquanto não publicado, ninguém vê seus dados — nem mesmo seus colegas."}
              </p>
            </div>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
      </section>

      {/* Informações básicas */}
      <section className="mt-6 rounded-lg border bg-card p-5 space-y-4">
        <h2 className="font-medium">Apresentação</h2>

        <div className="space-y-2">
          <FieldWithToggle
            label="Headline (cargo / tagline)"
            visible={showHeadline}
            onVisibleChange={setShowHeadline}
          >
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder="Ex: Engenheira de Software · Foco em IA"
            />
          </FieldWithToggle>

          <FieldWithToggle
            label="Bio"
            visible={showBio}
            onVisibleChange={setShowBio}
          >
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Conta um pouco sobre você (até 500 caracteres)."
            />
          </FieldWithToggle>
        </div>
      </section>

      {/* Links */}
      <section className="mt-6 rounded-lg border bg-card p-5 space-y-3">
        <h2 className="font-medium">Links</h2>

        <FieldWithToggle
          icon={<Linkedin className="size-4 text-blue-500" />}
          label="LinkedIn"
          visible={showLinkedin}
          onVisibleChange={setShowLinkedin}
        >
          <Input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/seu-usuario"
          />
        </FieldWithToggle>

        <FieldWithToggle
          icon={<Github className="size-4" />}
          label="GitHub"
          visible={showGithub}
          onVisibleChange={setShowGithub}
        >
          <Input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/seu-usuario"
          />
        </FieldWithToggle>

        <FieldWithToggle
          icon={<ExternalLink className="size-4 text-orange-500" />}
          label="Portfólio"
          visible={showPortfolio}
          onVisibleChange={setShowPortfolio}
        >
          <Input
            type="url"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://seu-portfolio.com"
          />
        </FieldWithToggle>

        <FieldWithToggle
          icon={<FileText className="size-4 text-emerald-500" />}
          label="Currículo (CV)"
          visible={showCv}
          onVisibleChange={setShowCv}
        >
          <Input
            type="url"
            value={cvUrl}
            onChange={(e) => setCvUrl(e.target.value)}
            placeholder="https://link-do-seu-cv.pdf"
          />
        </FieldWithToggle>

        <FieldWithToggle
          icon={<Mail className="size-4" />}
          label="Email de contato público"
          visible={showEmail}
          onVisibleChange={setShowEmail}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contato@seudominio.com"
          />
        </FieldWithToggle>
      </section>

      {/* Skills */}
      <SkillsSection
        cardSkills={card?.skills ?? []}
        showSkills={showSkills}
        onVisibleChange={setShowSkills}
      />

      {/* Tools */}
      <ToolsSection
        cardTools={card?.tools ?? []}
        showTools={showTools}
        onVisibleChange={setShowTools}
      />

      <div className="sticky bottom-4 mt-8 flex justify-end gap-2">
        <Button onClick={handleSave} disabled={upsert.isPending} size="lg">
          {upsert.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Field com toggle de visibilidade — replica o padrão dos
   toggles granulares (§7.1) sem deixar o usuário esquecer que
   pode esconder campos individuais mesmo com perfil público.
   ────────────────────────────────────────────────────────────── */
function FieldWithToggle({
  label,
  icon,
  visible,
  onVisibleChange,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  visible: boolean;
  onVisibleChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-xs font-medium">
          {icon}
          {label}
        </Label>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {visible ? "Visível" : "Oculto"}
          <Switch
            checked={visible}
            onCheckedChange={onVisibleChange}
            className="h-4 w-7 [&_span]:size-3"
          />
        </div>
      </div>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Skills section
   ────────────────────────────────────────────────────────────── */
function SkillsSection({
  cardSkills,
  showSkills,
  onVisibleChange,
}: {
  cardSkills: Array<{ level: number; skill: { id: string; name: string } }>;
  showSkills: boolean;
  onVisibleChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: catalog = [] } = useQuery(
    orpc.profileCard.listSkillCatalog.queryOptions({
      input: { query: query || undefined, limit: 50 },
    }),
  );

  const addedIds = useMemo(
    () => new Set(cardSkills.map((s) => s.skill.id)),
    [cardSkills],
  );

  const addMut = useMutation(
    orpc.profileCard.addSkill.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.profileCard.getMyProfileCard.queryKey() });
      },
      onError: (err) => toast.error(err.message ?? "Erro ao adicionar skill."),
    }),
  );
  const rmMut = useMutation(
    orpc.profileCard.removeSkill.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.profileCard.getMyProfileCard.queryKey() });
      },
    }),
  );

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Skills</h2>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {showSkills ? "Visível" : "Oculto"}
          <Switch
            checked={showSkills}
            onCheckedChange={onVisibleChange}
            className="h-4 w-7 [&_span]:size-3"
          />
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Adicione as habilidades que você quer destacar no seu card público.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {cardSkills.map((s) => (
          <Badge
            key={s.skill.id}
            variant="secondary"
            className="gap-1.5 py-1.5 pl-3 pr-1.5 text-xs"
          >
            {s.skill.name} · {s.level}/5
            <button
              type="button"
              onClick={() => rmMut.mutate({ skillId: s.skill.id })}
              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remover ${s.skill.name}`}
            >
              <Trash2 className="size-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Plus className="size-3" />
              Adicionar skill
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput
                placeholder="Buscar skill..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>Nenhuma skill encontrada.</CommandEmpty>
                <CommandGroup>
                  {catalog
                    .filter((s) => !addedIds.has(s.id))
                    .slice(0, 30)
                    .map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.name}
                        onSelect={() => {
                          addMut.mutate({ skillId: s.id, level: 3 });
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        {s.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tools section (similar a Skills)
   ────────────────────────────────────────────────────────────── */
function ToolsSection({
  cardTools,
  showTools,
  onVisibleChange,
}: {
  cardTools: Array<{ proficiency: number; tool: { id: string; name: string } }>;
  showTools: boolean;
  onVisibleChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: catalog = [] } = useQuery(
    orpc.profileCard.listToolCatalog.queryOptions({
      input: { query: query || undefined, limit: 50 },
    }),
  );

  const addedIds = useMemo(
    () => new Set(cardTools.map((t) => t.tool.id)),
    [cardTools],
  );

  const addMut = useMutation(
    orpc.profileCard.addTool.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.profileCard.getMyProfileCard.queryKey() });
      },
      onError: (err) => toast.error(err.message ?? "Erro ao adicionar ferramenta."),
    }),
  );
  const rmMut = useMutation(
    orpc.profileCard.removeTool.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.profileCard.getMyProfileCard.queryKey() });
      },
    }),
  );

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Ferramentas</h2>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {showTools ? "Visível" : "Oculto"}
          <Switch
            checked={showTools}
            onCheckedChange={onVisibleChange}
            className="h-4 w-7 [&_span]:size-3"
          />
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        IDEs, ferramentas de design, plataformas — o que você usa no dia a dia.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {cardTools.map((t) => (
          <Badge
            key={t.tool.id}
            variant="secondary"
            className="gap-1.5 py-1.5 pl-3 pr-1.5 text-xs"
          >
            {t.tool.name}
            <button
              type="button"
              onClick={() => rmMut.mutate({ toolId: t.tool.id })}
              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remover ${t.tool.name}`}
            >
              <Trash2 className="size-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Plus className="size-3" />
              Adicionar ferramenta
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput
                placeholder="Buscar ferramenta..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>Nenhuma ferramenta encontrada.</CommandEmpty>
                <CommandGroup>
                  {catalog
                    .filter((t) => !addedIds.has(t.id))
                    .slice(0, 30)
                    .map((t) => (
                      <CommandItem
                        key={t.id}
                        value={t.name}
                        onSelect={() => {
                          addMut.mutate({ toolId: t.id, proficiency: 3 });
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        {t.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
