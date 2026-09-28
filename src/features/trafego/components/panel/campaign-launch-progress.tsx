import { Check, CircleDashed } from "lucide-react";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";

interface CampaignLaunchProgressProps {
  status: TrafegoOrderStatus;
  hasMaterials: boolean;
  hasSelectedCopy: boolean;
  hasDestination: boolean;
  hasRelease: boolean;
}

const ACCOUNT_READY_STATUSES = new Set<TrafegoOrderStatus>([
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const TEAM_QUEUE_STATUSES = new Set<TrafegoOrderStatus>([
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const APPROVED_STATUSES = new Set<TrafegoOrderStatus>([
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const LIVE_STATUSES = new Set<TrafegoOrderStatus>([
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

export function CampaignLaunchProgress({
  status,
  hasMaterials,
  hasSelectedCopy,
  hasDestination,
  hasRelease,
}: CampaignLaunchProgressProps) {
  const checkpoints: Array<{
    label: string;
    done: boolean;
    term?: TechnicalTermKey;
  }> = [
    { label: "Pagamento confirmado", done: true },
    { label: "Materiais informados", done: hasMaterials, term: "creative" },
    { label: "Copy selecionada", done: hasSelectedCopy, term: "copy" },
    {
      label: "Destino definido",
      done: hasDestination,
      term: "destinationLink",
    },
    { label: "Release salvo", done: hasRelease, term: "release" },
    {
      label: "Conta de anúncios liberada",
      done: ACCOUNT_READY_STATUSES.has(status),
      term: "adAccount",
    },
    {
      label: "Campanha enviada à equipe",
      done: TEAM_QUEUE_STATUSES.has(status),
      term: "campaign",
    },
    {
      label: "Campanha aprovada e agendada",
      done: APPROVED_STATUSES.has(status),
      term: "campaign",
    },
    {
      label: "Campanha no ar",
      done: LIVE_STATUSES.has(status),
      term: "campaign",
    },
  ];
  const completed = checkpoints.filter((checkpoint) => checkpoint.done).length;
  const total = checkpoints.length;
  const remaining = total - completed;
  const percentage = Math.round((completed / total) * 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progressLength = (percentage / 100) * circumference;

  return (
    <Card className="overflow-hidden py-0">
      <div className="grid md:grid-cols-[190px_1fr]">
        <div className="flex items-center justify-center border-b bg-muted/30 px-6 py-6 md:border-r md:border-b-0">
          <div
            className="relative size-36"
            role="img"
            aria-label={`${completed} de ${total} etapas concluídas, ${percentage}%`}
          >
            <svg
              className="size-full -rotate-90"
              viewBox="0 0 120 120"
              aria-hidden="true"
            >
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="10"
                className="stroke-muted"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className="stroke-primary transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
                style={{
                  strokeDasharray: `${progressLength} ${circumference}`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-semibold tabular-nums leading-none">
                {completed}/{total}
              </span>
              <span className="mt-1 text-sm font-medium text-primary">
                {percentage}%
              </span>
            </div>
          </div>
        </div>

        <div>
          <CardHeader className="pb-4">
            <CardTitle>Prontidão para lançamento</CardTitle>
            <CardDescription>
              {remaining === 0
                ? "Todos os marcos foram concluídos. A campanha está no ar."
                : `Faltam ${remaining} ${remaining === 1 ? "etapa" : "etapas"} para a campanha entrar no ar.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <ol className="grid gap-2 sm:grid-cols-2">
              {checkpoints.map((checkpoint) => (
                <li
                  key={checkpoint.label}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  {checkpoint.done ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  ) : (
                    <CircleDashed
                      className="size-5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={checkpoint.done ? "text-foreground" : undefined}
                  >
                    {checkpoint.label}
                    {checkpoint.term && (
                      <TechnicalTerm term={checkpoint.term} />
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
