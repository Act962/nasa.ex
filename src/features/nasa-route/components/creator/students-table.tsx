"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Gift,
  Sparkles,
  Unlock,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

type Enrollment = {
  id: string;
  enrolledAt: string | Date;
  completedAt: string | Date | null;
  source: string;
  paidStars: number;
  paidBrlCents: number | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  course: { id: string; slug: string; title: string };
};

function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function paymentKind(e: Enrollment): "stripe" | "stars" | "free_access" | "gift" | "free" {
  if (e.source === "stripe_purchase" || e.stripeCheckoutSessionId) return "stripe";
  if (e.source === "free_access") return "free_access";
  if (e.source === "gift") return "gift";
  if (e.paidStars > 0) return "stars";
  return "free";
}

function SourceBadge({ enrollment }: { enrollment: Enrollment }) {
  const kind = paymentKind(enrollment);
  if (kind === "stripe") {
    return (
      <Badge className="gap-1 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
        <CreditCard className="size-3" />
        Stripe
      </Badge>
    );
  }
  if (kind === "stars") {
    return (
      <Badge className="gap-1 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
        <Sparkles className="size-3" />
        Stars
      </Badge>
    );
  }
  if (kind === "free_access") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Unlock className="size-3" />
        Acesso livre
      </Badge>
    );
  }
  if (kind === "gift") {
    return (
      <Badge className="gap-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300">
        <Gift className="size-3" />
        Presente
      </Badge>
    );
  }
  return <Badge variant="secondary">Grátis</Badge>;
}

function PaidAmount({ enrollment }: { enrollment: Enrollment }) {
  const kind = paymentKind(enrollment);
  if (kind === "stripe" && enrollment.paidBrlCents && enrollment.paidBrlCents > 0) {
    return (
      <span className="font-medium text-violet-700 dark:text-violet-300">
        {formatBrlCents(enrollment.paidBrlCents)}
      </span>
    );
  }
  if (kind === "stars" && enrollment.paidStars > 0) {
    return (
      <span className="font-medium text-amber-700 dark:text-amber-300">
        {enrollment.paidStars.toLocaleString("pt-BR")} ★
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export function StudentsTable() {
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [view, setView] = useState<"matriculas" | "alunos">("alunos");

  const { data: coursesData } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions(),
  });

  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListStudents.queryOptions({
      input: courseFilter === "all" ? {} : { courseId: courseFilter },
    }),
  });

  const enrollments = (data?.enrollments ?? []) as Enrollment[];

  const stats = useMemo(() => {
    const completed = enrollments.filter((e) => e.completedAt).length;
    const brlGross = enrollments.reduce(
      (acc, e) => acc + (e.paidBrlCents ?? 0),
      0,
    );
    const starsPayout = enrollments.reduce(
      (acc, e) => acc + Math.floor(e.paidStars * 0.9),
      0,
    );
    const stripeCount = enrollments.filter(
      (e) => paymentKind(e) === "stripe",
    ).length;
    const uniqueStudents = new Set(enrollments.map((e) => e.user.id)).size;
    return { completed, brlGross, starsPayout, stripeCount, uniqueStudents };
  }, [enrollments]);

  // Agrupado por aluno
  const groupedByStudent = useMemo(() => {
    const map = new Map<
      string,
      {
        user: Enrollment["user"];
        enrollments: Enrollment[];
        latest: Date;
      }
    >();
    for (const e of enrollments) {
      const prev = map.get(e.user.id);
      const t = new Date(e.enrolledAt);
      if (prev) {
        prev.enrollments.push(e);
        if (t > prev.latest) prev.latest = t;
      } else {
        map.set(e.user.id, {
          user: e.user,
          enrollments: [e],
          latest: t,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.latest.getTime() - a.latest.getTime(),
    );
  }, [enrollments]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/nasa-route/criador"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para o painel
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Alunos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Veja quem está matriculado, como entrou e o que está acessando.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Alunos únicos"
          value={stats.uniqueStudents}
          icon={<Users className="size-5 text-violet-600" />}
        />
        <Stat
          label="Matrículas"
          value={enrollments.length}
          icon={<BookOpen className="size-5 text-violet-600" />}
        />
        <Stat
          label="Concluídos"
          value={stats.completed}
          icon={<CheckCircle2 className="size-5 text-emerald-600" />}
        />
        <Stat
          label="Faturamento Stripe"
          value={formatBrlCents(stats.brlGross)}
          icon={<CreditCard className="size-5 text-violet-600" />}
          subtitle={`${stats.stripeCount} ${stats.stripeCount === 1 ? "venda" : "vendas"}`}
        />
        <Stat
          label="Payout Stars (90%)"
          value={`${stats.starsPayout.toLocaleString("pt-BR")} ★`}
          icon={<Sparkles className="size-5 text-amber-600" />}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {coursesData?.courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "matriculas" | "alunos")}
        >
          <TabsList>
            <TabsTrigger value="alunos">Por aluno</TabsTrigger>
            <TabsTrigger value="matriculas">Por matrícula</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "alunos" ? (
        <GroupedByStudentView
          groups={groupedByStudent}
          isLoading={isLoading}
        />
      ) : (
        <EnrollmentsTable enrollments={enrollments} isLoading={isLoading} />
      )}
    </div>
  );
}

function GroupedByStudentView({
  groups,
  isLoading,
}: {
  groups: Array<{
    user: Enrollment["user"];
    enrollments: Enrollment[];
    latest: Date;
  }>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-4 grid gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Nenhuma matrícula ainda.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {groups.map((g) => {
        const totalBrl = g.enrollments.reduce(
          (acc, e) => acc + (e.paidBrlCents ?? 0),
          0,
        );
        const stripeCount = g.enrollments.filter(
          (e) => paymentKind(e) === "stripe",
        ).length;
        const freeCount = g.enrollments.filter((e) => {
          const k = paymentKind(e);
          return k === "free_access" || k === "free";
        }).length;
        return (
          <div
            key={g.user.id}
            className="rounded-2xl border border-border bg-card p-4 transition hover:border-violet-300/60 dark:hover:border-violet-700/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {g.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.user.image}
                    alt={g.user.name ?? ""}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {(g.user.name ?? g.user.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold">{g.user.name ?? "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{g.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="size-3" />
                  {g.enrollments.length}{" "}
                  {g.enrollments.length === 1 ? "curso" : "cursos"}
                </Badge>
                {totalBrl > 0 && (
                  <Badge className="gap-1 border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300">
                    <CreditCard className="size-3" />
                    {formatBrlCents(totalBrl)} via Stripe
                  </Badge>
                )}
                {freeCount > 0 && stripeCount === 0 && (
                  <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Unlock className="size-3" />
                    Acesso gratuito
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 border-t border-border pt-3">
              {g.enrollments.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.course.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Matrícula em{" "}
                      {new Date(e.enrolledAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SourceBadge enrollment={e} />
                    <span className="min-w-[5rem] text-right text-xs tabular-nums">
                      <PaidAmount enrollment={e} />
                    </span>
                    {e.completedAt ? (
                      <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
                        <CheckCircle2 className="size-3" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">
                        Em andamento
                      </Badge>
                    )}
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

function EnrollmentsTable({
  enrollments,
  isLoading,
}: {
  enrollments: Enrollment[];
  isLoading: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
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
            ? [1, 2, 3].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            : enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {e.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.user.image}
                          alt={e.user.name ?? ""}
                          className="size-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-7 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {e.user.name ?? "Sem nome"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {e.course.title}
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadge enrollment={e} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <PaidAmount enrollment={e} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(e.enrolledAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    {e.completedAt ? (
                      <Badge className="bg-amber-500 hover:bg-amber-500">
                        <CheckCircle2 className="mr-1 size-3" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Em andamento</Badge>
                    )}
                  </td>
                </tr>
              ))}
          {!isLoading && enrollments.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-sm text-muted-foreground"
              >
                Nenhuma matrícula ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
