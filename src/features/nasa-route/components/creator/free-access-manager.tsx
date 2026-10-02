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
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BOTTOM_SHEET_ACTION_CLASS,
  BOTTOM_SHEET_BODY_CLASS,
  BOTTOM_SHEET_DIALOG_CLASS,
  BOTTOM_SHEET_FOOTER_CLASS,
  BOTTOM_SHEET_HANDLE_CLASS,
  BOTTOM_SHEET_HEADER_CLASS,
} from "../../lib/bottom-sheet-dialog";
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
  /** A página já mostra o título "Acesso livre": fica só o botão de adicionar. */
  isTitleHidden?: boolean;
}

const SCOPE_OPTIONS: { value: "org" | "course"; label: string }[] = [
  { value: "org", label: "Todos os cursos" },
  { value: "course", label: "Curso específico" },
];

export function FreeAccessManager({ scope, isTitleHidden = false }: Props) {
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
    onError: (error) => toast.error(error.message || "Não foi possível conceder."),
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
    onError: (error) => toast.error(error.message || "Não foi possível revogar."),
  });

  function handleGrant(event: React.FormEvent) {
    event.preventDefault();
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
        {isTitleHidden ? (
          <p className="text-sm text-muted-foreground max-md:hidden">
            Quem está nesta lista entra nos cursos sem pagar.
          </p>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">Acesso livre</h2>
            <p className="text-sm text-muted-foreground">
              Usuários nesta lista têm acesso gratuito automático aos cursos.
            </p>
          </div>
        )}
        <Button onClick={() => setOpen(true)} className="h-11 w-full gap-1.5 rounded-full md:h-9 md:w-auto">
          <UserPlus className="size-4" />
          Adicionar usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-[18px]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <Gift className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhum usuário com acesso livre</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use esta lista para liberar cursos a alunos VIP, parceiros, beta-testers, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3"
            >
              {entry.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.user.image}
                  alt={entry.user.name ?? ""}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="size-9 shrink-0 rounded-full bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.user.name ?? "Sem nome"}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.user.email}</p>
                <div className="mt-1 text-xs md:hidden">
                  <FreeAccessScopeChip courseTitle={entry.course?.title ?? null} />
                </div>
              </div>
              <div className="text-xs max-md:hidden">
                {entry.course ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <BookOpen className="size-3" />
                    {entry.course.title}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-1 text-info">
                    <Globe className="size-3" />
                    Todos os cursos
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                onClick={() => revoke.mutate({ id: entry.id })}
                disabled={revoke.isPending}
                aria-label="Revogar acesso"
                title="Revogar acesso"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn(BOTTOM_SHEET_DIALOG_CLASS, "sm:max-w-md")}>
          <div aria-hidden className={BOTTOM_SHEET_HANDLE_CLASS} />
          <DialogHeader className={BOTTOM_SHEET_HEADER_CLASS}>
            <DialogTitle>Liberar acesso</DialogTitle>
            <DialogDescription>
              O usuário precisa já estar cadastrado na plataforma. Ele entrará no(s)
              curso(s) sem pagar STARs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGrant} className="flex min-h-0 flex-1 flex-col">
            <div className={BOTTOM_SHEET_BODY_CLASS}>
            <div className="space-y-2">
              <Label htmlFor="fa-email">Email do usuário *</Label>
              <Input
                id="fa-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@exemplo.com"
                required
              />
            </div>

            {!scope?.courseId && (
              <>
                <div className="space-y-2">
                  <Label>Vale para</Label>
                  <div className="flex rounded-full bg-muted p-1" role="radiogroup" aria-label="Vale para">
                    {SCOPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={scopeChoice === option.value}
                        onClick={() => setScopeChoice(option.value)}
                        className={cn(
                          "h-9 flex-1 rounded-full px-3 text-xs font-medium transition",
                          scopeChoice === option.value
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {scopeChoice === "course" && (
                  <div className="space-y-2">
                    <Label htmlFor="fa-course">Curso</Label>
                    <Select value={chosenCourseId} onValueChange={setChosenCourseId}>
                      <SelectTrigger className="h-11 w-full sm:h-9">
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {coursesData?.courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
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
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex.: parceiro, aluno bolsista, beta-tester…"
              />
            </div>
            </div>

            <DialogFooter className={BOTTOM_SHEET_FOOTER_CLASS}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={grant.isPending}
                className="max-sm:hidden"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={grant.isPending} className={cn(BOTTOM_SHEET_ACTION_CLASS, "gap-1.5")}>
                {grant.isPending ? (
                  <OrbitaSpinner className="size-4 " />
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

function FreeAccessScopeChip({ courseTitle }: { courseTitle: string | null }) {
  if (courseTitle) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5">
        <BookOpen className="size-3 shrink-0" />
        <span className="truncate">{courseTitle}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info">
      <Globe className="size-3" />
      Todos os cursos
    </span>
  );
}
