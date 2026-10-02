"use client";

import { CheckCircle2, CreditCard, Gift, Sparkles, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StudentEnrollment = {
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

export interface StudentGroup {
  user: StudentEnrollment["user"];
  enrollments: StudentEnrollment[];
  latest: Date;
}

export type PaymentKind = "stripe" | "stars" | "free_access" | "gift" | "free";

export function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getPaymentKind(enrollment: StudentEnrollment): PaymentKind {
  if (enrollment.source === "stripe_purchase" || enrollment.stripeCheckoutSessionId) return "stripe";
  if (enrollment.source === "free_access") return "free_access";
  if (enrollment.source === "gift") return "gift";
  if (enrollment.paidStars > 0) return "stars";
  return "free";
}

export function SourceBadge({ enrollment }: { enrollment: StudentEnrollment }) {
  const paymentKind = getPaymentKind(enrollment);
  if (paymentKind === "stripe") {
    return (
      <Badge className="gap-1 border-info/30 bg-info/10 text-info hover:bg-info/10">
        <CreditCard className="size-3" />
        Stripe
      </Badge>
    );
  }
  if (paymentKind === "stars") {
    return (
      <Badge className="gap-1 border-warning/30 bg-warning/10 text-warning hover:bg-warning/10">
        <Sparkles className="size-3" />
        Stars
      </Badge>
    );
  }
  if (paymentKind === "free_access") {
    return (
      <Badge className="gap-1 border-success/30 bg-success/10 text-success hover:bg-success/10">
        <Unlock className="size-3" />
        Acesso livre
      </Badge>
    );
  }
  if (paymentKind === "gift") {
    return (
      <Badge className="gap-1 border-info/30 bg-info/10 text-info hover:bg-info/10">
        <Gift className="size-3" />
        Presente
      </Badge>
    );
  }
  return <Badge variant="secondary">Grátis</Badge>;
}

export function PaidAmount({ enrollment }: { enrollment: StudentEnrollment }) {
  const paymentKind = getPaymentKind(enrollment);
  if (paymentKind === "stripe" && enrollment.paidBrlCents && enrollment.paidBrlCents > 0) {
    return <span className="font-medium text-info">{formatBrlCents(enrollment.paidBrlCents)}</span>;
  }
  if (paymentKind === "stars" && enrollment.paidStars > 0) {
    return <span className="font-medium text-warning">{enrollment.paidStars.toLocaleString("pt-BR")} ★</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

export function CompletionBadge({ completedAt }: { completedAt: StudentEnrollment["completedAt"] }) {
  return completedAt ? (
    <Badge className="gap-1 bg-warning hover:bg-warning">
      <CheckCircle2 className="size-3" />
      Concluído
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-[11px]">
      Em andamento
    </Badge>
  );
}

export function StudentAvatar({ user, className }: { user: StudentEnrollment["user"]; className?: string }) {
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.image} alt={user.name ?? ""} className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {(user.name ?? user.email).slice(0, 1).toUpperCase()}
    </div>
  );
}
