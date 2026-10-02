"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Github,
  Linkedin,
  Mail,
  FileText,
  ExternalLink,
} from "lucide-react";

/**
 * Popup do perfil de um membro — aberto a partir da tripulação no header
 * da Spacehome (HeaderMembersHierarchy). Renderiza em modal centralizado
 * via Radix Dialog (portal), garantindo que apareça acima do header e
 * fique visível independente do scroll/posição na página.
 *
 * Mantemos o nome `UserProfileDropdown` por compatibilidade com callers
 * existentes — o comportamento agora é popup, não dropdown inline.
 */
interface Props {
  userId: string;
  onClose?: () => void;
}

export function UserProfileDropdown({ userId, onClose }: Props) {
  const { data, isLoading } = useQuery(
    orpc.public.space.getUserProfileCard.queryOptions({ input: { userId } }),
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogContent className="dark max-w-md bg-card p-0 text-foreground">
        <DialogTitle className="sr-only">Perfil do membro</DialogTitle>
        <DialogDescription className="sr-only">
          Informações públicas do membro da equipe
        </DialogDescription>

        {isLoading && (
          <div className="m-6 h-48 animate-pulse rounded-lg bg-muted/50" />
        )}

        {!isLoading && !data && (
          <div className="p-6 text-sm text-muted-foreground">Perfil não encontrado.</div>
        )}

        {!isLoading && data && (
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-info/30 bg-muted">
                {data.user.image ? (
                  <Image
                    src={data.user.image}
                    alt={data.user.name ?? ""}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {data.user.name?.[0] ?? "?"}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {data.user.name}
                </p>
                {data.card?.headline && (
                  <p className="text-xs text-muted-foreground">{data.card.headline}</p>
                )}
                {data.card?.bio && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {data.card.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {data.card?.linkedinUrl && (
                <a
                  href={data.card.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-info/15 px-3 py-1.5 text-info hover:bg-info/20"
                >
                  <Linkedin className="size-3" />
                  LinkedIn
                </a>
              )}
              {data.card?.githubUrl && (
                <a
                  href={data.card.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-foreground/80 hover:bg-muted/80"
                >
                  <Github className="size-3" />
                  GitHub
                </a>
              )}
              {data.card?.portfolioUrl && (
                <a
                  href={data.card.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-info/15 px-3 py-1.5 text-info hover:bg-info/20"
                >
                  <ExternalLink className="size-3" />
                  Portfólio
                </a>
              )}
              {data.card?.cvUrl && (
                <a
                  href={data.card.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-success/15 px-3 py-1.5 text-success hover:bg-success/15"
                >
                  <FileText className="size-3" />
                  CV
                </a>
              )}
              {data.card?.email && (
                <a
                  href={`mailto:${data.card.email}`}
                  className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-foreground/80 hover:bg-muted/80"
                >
                  <Mail className="size-3" />
                  {data.card.email}
                </a>
              )}
            </div>

            {data.skills.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.skills.map((s) => (
                    <Badge
                      key={s.skill.id}
                      variant="outline"
                      className="border-border text-[10px] text-muted-foreground"
                    >
                      {s.skill.name} · {s.level}/5
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.tools.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ferramentas
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.tools.map((t) => (
                    <Badge
                      key={t.tool.id}
                      variant="outline"
                      className="border-border text-[10px] text-muted-foreground"
                    >
                      {t.tool.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!data.card && (
              <p className="mt-4 text-xs text-muted-foreground">
                Este usuário ainda não publicou o perfil.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border text-foreground/80 hover:bg-muted"
              >
                <a href={`/profile/${userId}`} target="_blank" rel="noreferrer">
                  Ver perfil completo
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
