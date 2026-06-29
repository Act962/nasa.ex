"use client";

import { Info } from "lucide-react";

/**
 * Card explicativo mostrado pra formatos com aulas (course/training/mentoring)
 * que ainda não têm módulos cadastrados. Avisa o criador que o próximo passo
 * é montar o conteúdo na tela de edição.
 */
export function LessonsInfoCard({ isEdit }: { isEdit: boolean }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800/40 dark:bg-blue-900/20">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 text-blue-600" />
        <div className="space-y-1 text-blue-900 dark:text-blue-200">
          <p className="font-medium">
            {isEdit
              ? "Adicione módulos e aulas na aba ao lado."
              : "Após criar, você adiciona módulos e aulas na tela de edição."}
          </p>
          <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
            Vídeos podem vir de YouTube ou Vimeo (cole o link da aula). O aluno
            assiste no player do NASA Route com tracking de progresso.
          </p>
        </div>
      </div>
    </div>
  );
}
