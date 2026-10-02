"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star, UserPlus, UserCheck, Pencil } from "lucide-react";
import { HeaderMembersHierarchy } from "./header-members-hierarchy";
import { EditSpaceDialog } from "./edit-space-dialog";
import { toast } from "sonner";

interface SpaceHeaderProps {
  orgId: string;
  name: string;
  slug: string | null;
  nick: string;
  logo: string | null;
  bannerUrl: string | null;
  bio: string | null;
  website: string | null;
  isSpacehomePublic: boolean;
  isViewerAdmin?: boolean;
  isViewerMember?: boolean;
  followersCount?: number;
  starsReceived?: number;
}

export function SpaceHeader({
  orgId,
  name,
  nick,
  logo,
  bannerUrl,
  bio,
  website,
  isSpacehomePublic,
  isViewerAdmin,
  followersCount,
  starsReceived,
}: SpaceHeaderProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const [editOpen, setEditOpen] = useState(false);

  // Estado "está seguindo?" — vem de getSpace; mantemos local pra UI rápida
  const { data: space } = useQuery(
    orpc.public.space.getSpace.queryOptions({ input: { nick } }),
  );
  const isFollowing = !!space?.viewer?.isFollowing;

  const toggleFollow = useMutation(
    orpc.public.space.toggleFollow.mutationOptions({
      onSuccess: (res) => {
        toast.success(res.isFollowing ? "Seguindo!" : "Você deixou de seguir.");
        qc.invalidateQueries({
          queryKey: orpc.public.space.getSpace.queryKey({ input: { nick } }),
        });
        qc.invalidateQueries({
          queryKey: orpc.public.space.listFollowers.queryKey({ input: { nick } }),
        });
      },
      onError: (err) => toast.error(err.message ?? "Erro ao atualizar."),
    }),
  );

  function handleFollow() {
    if (!isAuthenticated) {
      toast.message("Faça login pra seguir a empresa.", {
        action: {
          label: "Entrar",
          onClick: () => router.push(`/sign-in?redirect=/space/${nick}`),
        },
      });
      return;
    }
    toggleFollow.mutate({ nick });
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      {/* Banner */}
      <div className="relative h-48 w-full md:h-60">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt={`Banner de ${name}`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-info/25 via-panel to-info/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        {/* Hierarquia de membros sobreposta no canto superior direito */}
        <HeaderMembersHierarchy nick={nick} />
      </div>

      {/* Identidade */}
      <div className="relative -mt-16 px-6 pb-6 md:px-10">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-end md:gap-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-lg md:h-32 md:w-32">
            {logo ? (
              <Image
                src={logo}
                alt={name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-info">
                {name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                {name}
              </h1>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                @{nick}
              </Badge>
              {isSpacehomePublic ? (
                <Badge className="bg-success/15 text-success border-success/30">
                  Pública
                </Badge>
              ) : (
                <Badge className="bg-warning/15 text-warning border-warning/30">
                  Privada
                </Badge>
              )}
            </div>

            {bio && (
              <p className="max-w-3xl text-sm text-foreground/80 md:text-base">
                {bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {typeof followersCount === "number" && (
                <span>{followersCount} seguidores</span>
              )}
              {typeof starsReceived === "number" && (
                <span className="flex items-center gap-1">
                  <Star className="size-3 fill-warning text-warning" />
                  {starsReceived} STARs
                </span>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-info hover:text-info/80"
                >
                  <ExternalLink className="size-3" />
                  Website
                </a>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className={
                isFollowing
                  ? "border-info/30 bg-info/15 text-info hover:bg-info/20"
                  : "border-border bg-muted/50 text-foreground hover:bg-muted"
              }
              onClick={handleFollow}
              disabled={toggleFollow.isPending}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="mr-1 size-4" />
                  Seguindo
                </>
              ) : (
                <>
                  <UserPlus className="mr-1 size-4" />
                  Seguir
                </>
              )}
            </Button>

            <Button
              size="sm"
              className="bg-warning text-primary-foreground hover:bg-warning/90"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.message("Faça login pra enviar STAR.", {
                    action: {
                      label: "Entrar",
                      onClick: () => router.push(`/sign-in?redirect=/space/${nick}`),
                    },
                  });
                  return;
                }
                // O fluxo de STAR completo fica em outra tela; por enquanto
                // dispara o link da carteira/STAR (existente no header de
                // tracking) — quando a página dedicada vier, troca aqui.
                router.push(`/space/${nick}/star`);
              }}
            >
              <Star className="mr-1 size-4 fill-current" />
              Enviar STAR
            </Button>

            {isViewerAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1 size-4" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {isViewerAdmin && (
        <EditSpaceDialog
          orgId={orgId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </section>
  );
}
