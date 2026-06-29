"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Repeat,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface Props {
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverUrl: string | null;
    priceStars: number;
    creatorOrg?: { id: string; name: string; slug: string; logo: string | null } | null;
    creator?: { id: string; name: string; image: string | null } | null;
  };
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const STATUS_META: Record<
  string,
  { label: string; tone: "success" | "warning" | "error"; icon: React.ReactNode }
> = {
  active: {
    label: "Ativa",
    tone: "success",
    icon: <CheckCircle2 className="size-5" />,
  },
  past_due: {
    label: "Pagamento atrasado",
    tone: "warning",
    icon: <AlertCircle className="size-5" />,
  },
  cancelled: {
    label: "Cancelada",
    tone: "error",
    icon: <XCircle className="size-5" />,
  },
  expired: {
    label: "Encerrada",
    tone: "error",
    icon: <XCircle className="size-5" />,
  },
};

const TONE_CLASSES: Record<string, string> = {
  success:
    "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200",
  error:
    "border-red-200 bg-red-50/60 text-red-900 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200",
};

export function SubscriptionViewer({ course }: Props) {
  const { data: sub, isLoading } = useQuery({
    ...orpc.nasaRoute.getSubscriptionStatus.queryOptions({
      input: { courseId: course.id },
    }),
  });

  const meta = sub ? STATUS_META[sub.status] ?? STATUS_META.active : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link
        href="/nasa-route"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar pra meus produtos
      </Link>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {course.coverUrl ? (
          <div className="relative aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(course.coverUrl)}
              alt={course.title}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-950/30" />
        )}

        <div className="space-y-5 p-6">
          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">
              🔁 Assinatura
            </Badge>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.subtitle && (
              <p className="text-muted-foreground">{course.subtitle}</p>
            )}
          </div>

          {course.creatorOrg && (
            <p className="text-xs text-muted-foreground">
              Por <span className="font-medium">{course.creatorOrg.name}</span>
              {course.creator?.name && ` · ${course.creator.name}`}
            </p>
          )}

          {/* Status card */}
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando dados da assinatura...
            </div>
          ) : sub && meta ? (
            <div className={`space-y-3 rounded-xl border p-5 ${TONE_CLASSES[meta.tone]}`}>
              <div className="flex items-center gap-2">
                {meta.icon}
                <span className="text-base font-semibold">{meta.label}</span>
              </div>

              {sub.status === "active" && (
                <p className="text-sm">
                  Sua assinatura está em dia. A próxima cobrança de{" "}
                  <strong>{course.priceStars} ★</strong> acontece em{" "}
                  <strong>{formatDate(sub.nextChargeAt)}</strong>.
                </p>
              )}

              {sub.status === "past_due" && (
                <p className="text-sm">
                  Sua última cobrança não passou (saldo insuficiente). Recarregue STARs
                  pra evitar perder o acesso. Tentaremos novamente em{" "}
                  <strong>{formatDate(sub.nextChargeAt)}</strong>. Após 7 falhas seguidas
                  o acesso é encerrado.
                </p>
              )}

              {sub.status === "cancelled" && (
                <p className="text-sm">
                  Sua assinatura foi cancelada em{" "}
                  <strong>{formatDate(sub.cancelledAt)}</strong>.
                  {sub.cancelReason && ` Motivo: ${sub.cancelReason}`}
                </p>
              )}

              {sub.status === "expired" && (
                <p className="text-sm">
                  Sua assinatura foi encerrada por falta de pagamento. Compre novamente
                  pra reativar.
                </p>
              )}

              {/* Detalhes em grid */}
              <dl className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <dt className="opacity-70">Iniciada em</dt>
                  <dd className="font-semibold">{formatDate(sub.startedAt)}</dd>
                </div>
                <div>
                  <dt className="opacity-70">Período atual</dt>
                  <dd className="font-semibold">
                    até {formatDate(sub.currentPeriodEnd)}
                  </dd>
                </div>
                {sub.lastChargedAt && (
                  <div>
                    <dt className="opacity-70">Última cobrança</dt>
                    <dd className="font-semibold">{formatDate(sub.lastChargedAt)}</dd>
                  </div>
                )}
                {sub.failedChargeCount > 0 && (
                  <div>
                    <dt className="opacity-70">Tentativas falhas</dt>
                    <dd className="font-semibold">{sub.failedChargeCount}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : null}

          {/* Como funciona */}
          <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
              <Repeat className="size-4" />
              Como funciona
            </div>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Cobramos <strong>{course.priceStars} ★</strong> por mês automaticamente
                em STARs.
              </li>
              <li>Se faltar saldo, tentamos novamente diariamente até 7 dias.</li>
              <li>Pra cancelar, fale com o suporte (cancelamento self-service em V2).</li>
            </ul>
          </div>
        </div>
      </div>

      {course.description && (
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-3 text-sm font-semibold">Sobre a assinatura</p>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
            {course.description}
          </div>
        </div>
      )}
    </div>
  );
}
