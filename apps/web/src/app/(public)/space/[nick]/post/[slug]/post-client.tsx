"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { NasaFooterPublic } from "@/components/nasa-footer-public";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  nick: string;
  slug: string;
  orgName: string;
  orgLogo: string | null;
  isAuthenticated: boolean;
}

export function PostClient({
  nick,
  slug,
  orgName,
  orgLogo,
  isAuthenticated,
}: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(
    orpc.public.space.getPost.queryOptions({ input: { nick, slug } }),
  );

  const [comment, setComment] = useState("");
  const [authorName, setAuthorName] = useState("");

  const submit = useMutation({
    mutationFn: async () =>
      await client.public.space.submitPostComment({
        nick,
        postSlug: slug,
        content: comment,
        authorName: authorName || undefined,
      }),
    onSuccess: () => {
      toast.success(
        "Comentário enviado! Aguardando aprovação da empresa.",
      );
      setComment("");
      setAuthorName("");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Erro ao enviar comentário."),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-20">
        <div className="mb-6 flex items-center gap-3">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href={`/space/${nick}`}>
              <ArrowLeft className="mr-1 size-3" />
              {orgName}
            </Link>
          </Button>
          {orgLogo && (
            <Image
              src={orgLogo}
              alt={orgName}
              width={32}
              height={32}
              className="rounded-lg"
            />
          )}
        </div>

        {isLoading || !data ? (
          <div className="space-y-3">
            <div className="h-10 w-3/4 animate-pulse rounded bg-white/5" />
            <div className="h-64 animate-pulse rounded bg-white/5" />
          </div>
        ) : (
          <article className="space-y-4">
            {data.post.coverUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={data.post.coverUrl}
                  alt={data.post.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
            <h1 className="text-3xl font-bold md:text-4xl">
              {data.post.title}
            </h1>
            <p className="text-xs text-white/50">
              {data.post.author?.name} ·{" "}
              {data.post.publishedAt
                ? new Date(data.post.publishedAt).toLocaleDateString(
                    "pt-BR",
                  )
                : ""}{" "}
              · {data.post.viewCount} visualizações
            </p>
            {data.post.excerpt && (
              <p className="text-lg text-white/70">{data.post.excerpt}</p>
            )}
            <TipTapView json={data.post.content} />
          </article>
        )}

        {/* Comentários */}
        {data && (
          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold">
              Comentários ({data.comments.length})
            </h2>
            <ul className="space-y-3">
              {data.comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  <p className="text-xs text-white/50">
                    {c.author?.name ?? c.authorName ?? "Anônimo"} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-1 text-sm">{c.content}</p>
                </li>
              ))}
              {data.comments.length === 0 && (
                <p className="text-sm text-white/50">
                  Seja o primeiro a comentar.
                </p>
              )}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                submit.mutate();
              }}
              className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              {!isAuthenticated && (
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  maxLength={60}
                  className="bg-slate-950/40"
                />
              )}
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escreva seu comentário..."
                rows={3}
                maxLength={500}
                className="bg-slate-950/40"
              />
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>
                  Comentários passam por moderação antes de aparecerem.
                </span>
                <Button
                  type="submit"
                  disabled={submit.isPending || !comment.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Enviar
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
      <NasaFooterPublic />
    </div>
  );
}

function TipTapView({ json }: { json: unknown }) {
  // Render básico: extrai texto do TipTap JSON. Uma v2 deveria usar
  // um renderer completo que entenda marks, node types, etc.
  const text = extractText(json);
  return (
    <div className="prose prose-invert max-w-none">
      <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
}

function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  let out = "";
  if (n.text) out += n.text;
  if (Array.isArray(n.content)) {
    for (const c of n.content) out += extractText(c) + "\n";
  }
  return out;
}
