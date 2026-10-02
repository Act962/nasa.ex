"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CompletionBadge,
  PaidAmount,
  SourceBadge,
  StudentAvatar,
  type StudentEnrollment,
} from "./students-shared";

const EMPTY_MESSAGE = "Nenhuma matrícula ainda.";

export function StudentsEnrollmentsList({
  enrollments,
  isLoading,
}: {
  enrollments: StudentEnrollment[];
  isLoading: boolean;
}) {
  return (
    <>
      <div className="md:hidden">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((placeholderIndex) => (
              <Skeleton key={placeholderIndex} className="h-20 rounded-[18px]" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line p-10 text-center text-sm text-muted-foreground">
            {EMPTY_MESSAGE}
          </div>
        ) : (
          <ul className="space-y-2">
            {enrollments.map((enrollment) => (
              <li key={enrollment.id} className="rounded-[18px] border border-line bg-card p-3">
                <div className="flex items-center gap-3">
                  <StudentAvatar user={enrollment.user} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{enrollment.user.name ?? "Sem nome"}</p>
                    <p className="truncate text-xs text-muted-foreground">{enrollment.course.title}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums">
                    <PaidAmount enrollment={enrollment} />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <SourceBadge enrollment={enrollment} />
                  <CompletionBadge completedAt={enrollment.completedAt} />
                  <span>{new Date(enrollment.enrolledAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-[20px] border border-line bg-card max-md:hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Aluno</th>
              <th className="px-4 py-3 text-left font-semibold">Curso</th>
              <th className="px-4 py-3 text-left font-semibold">Pagamento</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Matrícula</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? [1, 2, 3].map((placeholderIndex) => (
                  <tr key={placeholderIndex}>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StudentAvatar user={enrollment.user} className="size-7" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{enrollment.user.name ?? "Sem nome"}</p>
                          <p className="truncate text-xs text-muted-foreground">{enrollment.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{enrollment.course.title}</td>
                    <td className="px-4 py-3">
                      <SourceBadge enrollment={enrollment} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <PaidAmount enrollment={enrollment} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(enrollment.enrolledAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <CompletionBadge completedAt={enrollment.completedAt} />
                    </td>
                  </tr>
                ))}
            {!isLoading && enrollments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {EMPTY_MESSAGE}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
