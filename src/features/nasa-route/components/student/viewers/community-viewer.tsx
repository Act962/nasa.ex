"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  ChevronLeft,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import {
  COMMUNITY_TYPE_LABELS,
  type CommunityType,
} from "@/features/nasa-route/lib/formats";

interface Props {
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverUrl: string | null;
    communityType: CommunityType | string | null;
    creatorOrg?: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
    } | null;
    creator?: { id: string; name: string; image: string | null } | null;
  };
}

const TYPE_ICON: Record<string, string> = {
  whatsapp: "💚",
  telegram: "✈️",
  discord: "🎮",
  other: "🔗",
};

const TYPE_BUTTON_LABEL: Record<string, string> = {
  whatsapp: "Entrar no grupo do WhatsApp",
  telegram: "Entrar no Telegram",
  discord: "Entrar no Discord",
  other: "Acessar a comunidade",
};

export function CommunityViewer({ course }: Props) {
  const inviteMutation = useMutation({
    ...orpc.nasaRoute.getCommunityInvite.mutationOptions(),
    onSuccess: (data) => {
      window.open(data.inviteUrl, "_blank", "noopener,noreferrer");
      toast.success("Bem-vindo!", {
        description: "Você foi redirecionado pra comunidade.",
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível abrir o link.");
    },
  });

  const type = (course.communityType ?? "other") as CommunityType;
  const icon = TYPE_ICON[type] ?? TYPE_ICON.other;
  const label = TYPE_BUTTON_LABEL[type] ?? TYPE_BUTTON_LABEL.other;
  const typeLabel = COMMUNITY_TYPE_LABELS[type] ?? "Comunidade";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Voltar */}
      <Link
        href="/nasa-route"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar pra meus produtos
      </Link>

      {/* Card principal */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {course.coverUrl ? (
          <div className="relative aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(course.coverUrl)}
              alt={course.title}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-success/10" />
        )}

        <div className="space-y-5 p-6">
          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">
              💬 {typeLabel}
            </Badge>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.subtitle && (
              <p className="text-muted-foreground">{course.subtitle}</p>
            )}
          </div>

          {course.creatorOrg && (
            <p className="text-xs text-muted-foreground">
              Por <span className="font-medium">{course.creatorOrg.name}</span>
              {course.creator?.name && ` · ${course.creator.name}`}
            </p>
          )}

          {/* Card grande com ícone */}
          <div className="space-y-4 rounded-2xl border-2 border-success/30 bg-success/5 p-6 text-center">
            <div className="text-5xl">{icon}</div>
            <p className="text-sm text-success">
              Sua matrícula está ativa. Clique abaixo pra abrir o convite.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => inviteMutation.mutate({ courseId: course.id })}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <OrbitaSpinner className="mr-2 size-4 " />
                  Abrindo...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 size-5" />
                  {label}
                  <ExternalLink className="ml-2 size-4" />
                </>
              )}
            </Button>
            <p className="text-xs text-success/70">
              Se o link não funcionar, avise o criador. Pode ser um grupo cheio
              ou expirado.
            </p>
          </div>
        </div>
      </div>

      {/* Descrição */}
      {course.description && (
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-3 text-sm font-semibold">Sobre a comunidade</p>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
            {course.description}
          </div>
        </div>
      )}
    </div>
  );
}
