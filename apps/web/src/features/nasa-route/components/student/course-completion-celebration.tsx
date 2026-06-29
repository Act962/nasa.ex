"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Award, GraduationCap, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  courseTitle?: string;
  spAwarded?: number;
  bonusSp?: number;
  certificateCode?: string | null;
  onClose: () => void;
}

export function CourseCompletionCelebration({
  courseTitle,
  spAwarded = 0,
  bonusSp = 0,
  certificateCode,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalSp = spAwarded + bonusSp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 p-8 text-white text-center">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,#fff,transparent_50%),radial-gradient(circle_at_70%_70%,#fff,transparent_40%)]" />
          <div className="relative">
            <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
              <Trophy className="size-12" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">Curso concluído!</h2>
            {courseTitle && <p className="mt-1 text-sm text-white/90">{courseTitle}</p>}
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
            <GraduationCap className="size-6 mx-auto text-violet-600" />
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Você acaba de concluir
            </p>
            <p className="mt-1 text-base font-bold">{courseTitle ?? "este curso"}</p>
          </div>

          {bonusSp > 0 && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800/40 dark:bg-violet-900/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-violet-600 text-white">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                    Bônus de conclusão
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-300">
                    +{bonusSp} Space Points pelo curso completo
                  </p>
                </div>
              </div>
            </div>
          )}

          {totalSp > 0 && (
            <div className="rounded-xl border border-border bg-violet-500/5 p-4 text-center">
              <Sparkles className="size-5 mx-auto text-violet-600" />
              <p className="mt-1 text-3xl font-bold tabular-nums">+{totalSp}</p>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wider">
                Total de Space Points ganhos
              </p>
            </div>
          )}

          {certificateCode && (
            <Button asChild className="w-full gap-2" variant="default">
              <Link href={`/nasa-route/certificados/${certificateCode}`}>
                <Award className="size-4" />
                Ver meu certificado
              </Link>
            </Button>
          )}

          <Button
            onClick={onClose}
            variant={certificateCode ? "outline" : "default"}
            className="w-full mt-2"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
