"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  nick: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se o viewer não está autenticado, deixa entrar nome manual. */
  isAuthenticated: boolean;
}

/**
 * Dialog para o visitante enviar uma avaliação da empresa. A review entra
 * com `status=PENDING` e precisa ser aprovada pelo admin antes de aparecer
 * publicamente (moderação obrigatória — §7.1).
 */
export function SubmitReviewDialog({
  nick,
  open,
  onOpenChange,
  isAuthenticated,
}: Props) {
  const qc = useQueryClient();
  const [rating, setRating]         = useState(0);
  const [hoverRating, setHoverR]    = useState(0);
  const [title, setTitle]           = useState("");
  const [comment, setComment]       = useState("");
  const [authorName, setAuthorName] = useState("");

  const submit = useMutation(
    orpc.public.space.submitReview.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Avaliação enviada! Aguarde aprovação do admin pra ela aparecer.",
        );
        qc.invalidateQueries({
          queryKey: orpc.public.space.listReviews.queryKey({ input: { nick } }),
        });
        onOpenChange(false);
        // reset
        setRating(0);
        setTitle("");
        setComment("");
        setAuthorName("");
      },
      onError: (err) => toast.error(err.message ?? "Erro ao enviar avaliação."),
    }),
  );

  function handleSubmit() {
    if (rating < 1) {
      toast.error("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    submit.mutate({
      nick,
      rating,
      title:      title.trim()      || undefined,
      comment:    comment.trim()    || undefined,
      authorName: authorName.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar empresa</DialogTitle>
          <DialogDescription>
            Sua avaliação passa por moderação antes de ficar pública.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stars */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sua nota</Label>
            <div
              className="flex gap-1"
              onMouseLeave={() => setHoverR(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverR(n)}
                  className="rounded p-1 transition-transform hover:scale-110"
                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "size-8 transition-colors",
                      (hoverRating || rating) >= n
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="rv-title" className="text-xs">
              Título (opcional)
            </Label>
            <Input
              id="rv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex: Atendimento excelente"
            />
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="rv-comment" className="text-xs">
              Comentário (opcional)
            </Label>
            <Textarea
              id="rv-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Conte sua experiência…"
            />
          </div>

          {!isAuthenticated && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-author" className="text-xs">
                Seu nome (opcional)
              </Label>
              <Input
                id="rv-author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={80}
                placeholder="Pode ficar anônimo"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
