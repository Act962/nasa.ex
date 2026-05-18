"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, RefreshCw, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import {
  useCommentsPosts,
  useRefreshCommentsTokens,
  useUpdateCommentsProfile,
} from "@/features/comments/hooks/use-comments-user";

type Post = {
  id: string;
  caption?: string | null;
  media?: string | null;
  mediaUrl?: string | null;
  permalink?: string | null;
  mediaType?: string | null;
};

export default function CommentsProfilePage() {
  return (
    <CommentsShell
      title="Perfil"
      description="Dados do usuário comments e posts do Instagram conectado."
    >
      <CommentsConnectionGuard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileForm />
          <PostsList />
        </div>
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function ProfileForm() {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const update = useUpdateCommentsProfile();
  const refresh = useRefreshCommentsTokens();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="size-4" />
          Dados do usuário
        </CardTitle>
        <CardDescription>
          Atualize o nome e avatar exibidos no comments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Nome</Label>
          <Input
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Imagem (URL)</Label>
          <Input
            placeholder="https://…"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() =>
              refresh.mutate(undefined, {
                onSuccess: () => toast.success("Tokens atualizados"),
                onError: (err: { message?: string }) =>
                  toast.error(err?.message ?? "Falha"),
              })
            }
            disabled={refresh.isPending}
          >
            {refresh.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Renovar tokens
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Informe um nome");
                return;
              }
              update.mutate(
                { name: name.trim(), image: image.trim() || undefined },
                {
                  onSuccess: () => toast.success("Perfil atualizado"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falha ao atualizar"),
                },
              );
            }}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PostsList() {
  const { data, isLoading, isError, error, refetch } = useCommentsPosts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4" /> Posts
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" /> Carregando…
            </span>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Erro ao carregar posts</CardTitle>
          <CardDescription className="text-destructive">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const raw = (data ?? {}) as { data?: Post[] } | Post[];
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4" /> Posts
        </CardTitle>
        <CardDescription>
          Últimos posts publicados no Instagram conectado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <div className="text-sm text-muted-foreground">Nenhum post.</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {items.map((p) => {
              const url = p.mediaUrl ?? p.media ?? "";
              return (
                <a
                  key={p.id}
                  href={p.permalink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={p.caption ?? p.id}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
