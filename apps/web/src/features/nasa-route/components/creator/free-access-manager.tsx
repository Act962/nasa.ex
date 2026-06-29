"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Plus,
  Trash2,
  UserPlus,
  Gift,
  Globe,
  BookOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  /** Se passado, apenas mostra/grant para este curso. Sem isso, gerencia tudo da org. */
  scope?: { courseId?: string };
}

export function FreeAccessManager({ scope }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [scopeChoice, setScopeChoice] = useState<"org" | "course">(
    scope?.courseId ? "course" : "org",
  );
  const [chosenCourseId, setChosenCourseId] = useState<string>(scope?.courseId ?? "");
  const [note, setNote] = useState("");

  const { data: coursesData } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions(),
    enabled: !scope?.courseId,
  });

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.freeAccessList.queryOptions({
      input: scope?.courseId ? { courseId: scope.courseId } : {},
    }),
  });

  const grant = useMutation({
    ...orpc.nasaRoute.freeAccessGrant.mutationOptions(),
    onSuccess: () => {
      toast.success("Acesso liberado!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.freeAccessList.queryKey({
          input: scope?.courseId ? { courseId: scope.courseId } : {},
        }),
      });
      setOpen(false);
      setEmail("");
      setNote("");
      if (!scope?.courseId) setChosenCourseId("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Não foi possível conceder."),
  });

  const revoke = useMutation({
    ...orpc.nasaRoute.freeAccessRevoke.mutationOptions(),
    onSuccess: () => {
      toast.success("Acesso revogado");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.freeAccessList.queryKey({
          input: scope?.courseId ? { courseId: scope.courseId } : {},
        }),
      });
    },
    onError: (err: any) => toast.error(err?.message ?? "Não foi possível revogar."),
  });

  function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe o email do usuário.");
      return;
    }
    grant.mutate({
      email: email.trim(),
      courseId: scopeChoice === "course" ? chosenCourseId || null : null,
      note: note.trim() || null,
    });
  }

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Acesso livre</h2>
          <p className="text-sm text-muted-foreground">
            Usuários nesta lista têm acesso gratuito automático aos cursos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <UserPlus className="size-4" />
          Adicionar usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <Gift className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhum usuário com acesso livre</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use esta lista para liberar cursos a alunos VIP, parceiros, beta-testers, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              {e.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.user.image}
                  alt={e.user.name ?? ""}
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <div className="size-8 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.user.name ?? "Sem nome"}</p>
                <p className="truncate text-xs text-muted-foreground">{e.user.email}</p>
              </div>
              <div className="text-xs">
                {e.course ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <BookOpen className="size-3" />
                    {e.course.title}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                    <Globe className="size-3" />
                    Todos os cursos
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => revoke.mutate({ id: e.id })}
                disabled={revoke.isPending}
              >
                <Trash2 className="size-4 text-rose-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar acesso</DialogTitle>
            <DialogDescription>
              O usuário precisa já estar cadastrado na plataforma. Ele entrará no(s)
              curso(s) sem pagar STARs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGrant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fa-email">Email do usuário *</Label>
              <Input
                id="fa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                required
              />
            </div>

            {!scope?.courseId && (
              <>
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <Select
                    value={scopeChoice}
                    onValueChange={(v) => setScopeChoice(v as "org" | "course")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org">Todos os cursos da organização</SelectItem>
                      <SelectItem value="course">Curso específico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scopeChoice === "course" && (
                  <div className="space-y-2">
                    <Label htmlFor="fa-course">Curso</Label>
                    <Select value={chosenCourseId} onValueChange={setChosenCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {coursesData?.courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="fa-note">Nota interna (opcional)</Label>
              <Input
                id="fa-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: parceiro, aluno bolsista, beta-tester…"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={grant.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={grant.isPending} className="gap-1.5">
                {grant.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Liberar acesso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
