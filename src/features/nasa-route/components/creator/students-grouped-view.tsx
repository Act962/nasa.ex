"use client";

import { BookOpen, CreditCard, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompletionBadge,
  PaidAmount,
  SourceBadge,
  StudentAvatar,
  type StudentGroup,
  formatBrlCents,
  getPaymentKind,
} from "./students-shared";

export function StudentsGroupedView({ groups, isLoading }: { groups: StudentGroup[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-2 md:gap-3">
        {[1, 2, 3].map((placeholderIndex) => (
          <Skeleton key={placeholderIndex} className="h-24 w-full rounded-[18px]" />
        ))}
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-line p-10 text-center text-sm text-muted-foreground">
        Nenhuma matrícula ainda.
      </div>
    );
  }

  return (
    <div className="grid gap-2 md:gap-3">
      {groups.map((group) => {
        const totalBrl = group.enrollments.reduce((total, enrollment) => total + (enrollment.paidBrlCents ?? 0), 0);
        const stripeCount = group.enrollments.filter((enrollment) => getPaymentKind(enrollment) === "stripe").length;
        const freeCount = group.enrollments.filter((enrollment) => {
          const paymentKind = getPaymentKind(enrollment);
          return paymentKind === "free_access" || paymentKind === "free";
        }).length;
        return (
          <div
            key={group.user.id}
            className="rounded-[18px] border border-line bg-card p-3 transition hover:border-info/60 md:rounded-[20px] md:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <StudentAvatar user={group.user} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{group.user.name ?? "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{group.user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="size-3" />
                  {group.enrollments.length} {group.enrollments.length === 1 ? "curso" : "cursos"}
                </Badge>
                {totalBrl > 0 && (
                  <Badge className="gap-1 border-info/30 bg-info/10 text-info hover:bg-info/10">
                    <CreditCard className="size-3" />
                    {formatBrlCents(totalBrl)} via Stripe
                  </Badge>
                )}
                {freeCount > 0 && stripeCount === 0 && (
                  <Badge className="gap-1 border-success/30 bg-success/10 text-success hover:bg-success/10">
                    <Unlock className="size-3" />
                    Acesso gratuito
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 border-t border-line pt-3">
              {group.enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{enrollment.course.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Matrícula em {new Date(enrollment.enrolledAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge enrollment={enrollment} />
                    <span className="text-right text-xs tabular-nums md:min-w-[5rem]">
                      <PaidAmount enrollment={enrollment} />
                    </span>
                    <CompletionBadge completedAt={enrollment.completedAt} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
