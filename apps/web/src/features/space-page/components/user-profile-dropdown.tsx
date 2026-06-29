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
      <DialogContent className="max-w-md border-orange-500/20 bg-slate-900 p-0 text-white">
        <DialogTitle className="sr-only">Perfil do membro</DialogTitle>
        <DialogDescription className="sr-only">
          Informações públicas do membro da equipe
        </DialogDescription>

        {isLoading && (
          <div className="m-6 h-48 animate-pulse rounded-lg bg-white/5" />
        )}

        {!isLoading && !data && (
          <div className="p-6 text-sm text-white/60">Perfil não encontrado.</div>
        )}

        {!isLoading && data && (
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-orange-400/40 bg-white/10">
                {data.user.image ? (
                  <Image
                    src={data.user.image}
                    alt={data.user.name ?? ""}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/60">
                    {data.user.name?.[0] ?? "?"}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-semibold text-white">
                  {data.user.name}
                </p>
                {data.card?.headline && (
                  <p className="text-xs text-white/70">{data.card.headline}</p>
                )}
                {data.card?.bio && (
                  <p className="text-xs leading-relaxed text-white/60">
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
                  className="flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1.5 text-blue-300 hover:bg-blue-500/20"
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
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/20"
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
                  className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1.5 text-orange-300 hover:bg-orange-500/20"
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
                  className="flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1.5 text-green-300 hover:bg-green-500/20"
                >
                  <FileText className="size-3" />
                  CV
                </a>
              )}
              {data.card?.email && (
                <a
                  href={`mailto:${data.card.email}`}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/20"
                >
                  <Mail className="size-3" />
                  {data.card.email}
                </a>
              )}
            </div>

            {data.skills.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-white/50">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.skills.map((s) => (
                    <Badge
                      key={s.skill.id}
                      variant="outline"
                      className="border-white/10 text-[10px] text-white/70"
                    >
                      {s.skill.name} · {s.level}/5
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.tools.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-white/50">
                  Ferramentas
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.tools.map((t) => (
                    <Badge
                      key={t.tool.id}
                      variant="outline"
                      className="border-white/10 text-[10px] text-white/70"
                    >
                      {t.tool.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!data.card && (
              <p className="mt-4 text-xs text-white/50">
                Este usuário ainda não publicou o perfil.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-white/20 text-white/80 hover:bg-white/10"
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
