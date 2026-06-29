"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings as SettingsIcon,
  UserMinus,
  CalendarX,
  TimerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useInsightsStore } from "@/features/insights/context/use-insights";

interface RescueRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  responsible: { id: string; name: string; image: string | null } | null;
  status: { id: string; name: string; color: string | null } | null;
  tracking: { id: string; name: string; organizationId: string } | null;
  lastInboundAt: string | Date | null;
  firstResponseAt: string | Date | null;
  slaHoursLeft: number | null;
  daysInStage: number | null;
}

const TAB_META: Record<
  "noResponse" | "unassigned" | "stuckInStage" | "noShow",
  { label: string; description: string; icon: typeof Clock; color: string }
> = {
  noResponse: {
    label: "Sem resposta (SLA)",
    description: "Lead mandou mensagem e ainda não recebeu resposta dentro do prazo.",
    icon: TimerOff,
    color: "text-rose-600 bg-rose-50",
  },
  unassigned: {
    label: "Sem responsável",
    description: "Lead criado mas ninguém foi atribuído.",
    icon: UserMinus,
    color: "text-amber-600 bg-amber-50",
  },
  stuckInStage: {
    label: "Parado em etapa",
    description: "Lead há muitos dias na mesma coluna sem movimento.",
    icon: Clock,
    color: "text-blue-600 bg-blue-50",
  },
  noShow: {
    label: "No-show",
    description: "Lead faltou ao agendamento e não foi cobrado.",
    icon: CalendarX,
    color: "text-purple-600 bg-purple-50",
  },
};

interface RescuePanelProps {
  organizationIds?: string[];
  trackingId?: string;
}

export function RescuePanel({ organizationIds, trackingId }: RescuePanelProps) {
  const slaHours = useInsightsStore((s) => s.rescueSlaHours ?? 24);
  const stuckDays = useInsightsStore((s) => s.rescueStuckDays ?? 7);
  const setRescueConfig = useInsightsStore((s) => s.setRescueConfig);

  const [activeTab, setActiveTab] = useState<keyof typeof TAB_META>("noResponse");

  const { data, isLoading } = useQuery({
    ...orpc.insights.listLeadRescue.queryOptions({
      input: {
        organizationIds,
        trackingId: trackingId || undefined,
        slaHours,
        stuckDays,
      },
    }),
    refetchInterval: 60_000,
  });

  const rows: RescueRow[] = useMemo(() => {
    if (!data) return [];
    return (data.buckets[activeTab] ?? []) as unknown as RescueRow[];
  }, [data, activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Para Resgatar
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Leads que precisam da sua atenção agora — para você cobrar a equipe ou agir.
          </p>
        </div>
        <ThresholdSettings
          slaHours={slaHours}
          stuckDays={stuckDays}
          onSave={({ slaHours: s, stuckDays: d }) =>
            setRescueConfig({ slaHours: s, stuckDays: d })
          }
        />
      </div>

      {/* Cards de contagem */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(TAB_META) as Array<keyof typeof TAB_META>).map((key) => {
          const meta = TAB_META[key];
          const count = data?.counts?.[key] ?? 0;
          const Icon = meta.icon;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left transition-all hover:shadow-sm",
                isActive && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-start justify-between">
                <div className={cn("size-9 rounded-full flex items-center justify-center", meta.color)}>
                  <Icon className="size-4" />
                </div>
                <span className="text-2xl font-bold tabular-nums">{count}</span>
              </div>
              <div className="mt-2 text-sm font-medium">{meta.label}</div>
            </button>
          );
        })}
      </div>

      {/* Lista da aba ativa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{TAB_META[activeTab].label}</CardTitle>
          <p className="text-sm text-muted-foreground">{TAB_META[activeTab].description}</p>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
              <p className="text-sm font-medium">Nenhum lead nesse bucket</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tudo em ordem por aqui!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => (
                <RescueRowItem key={row.id} row={row} bucket={activeTab} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RescueRowItem({
  row,
  bucket,
}: {
  row: RescueRow;
  bucket: keyof typeof TAB_META;
}) {
  const initials = row.name?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
      <Avatar className="size-9">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{row.name}</span>
          {row.status?.name && (
            <Badge
              variant="outline"
              style={{
                color: row.status.color ?? undefined,
                borderColor: row.status.color ?? undefined,
              }}
              className="text-[10px] py-0 h-4"
            >
              {row.status.name}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {row.phone ?? row.email ?? "—"} · {row.tracking?.name ?? ""}
        </div>
      </div>
      <div className="text-right text-xs">
        {bucket === "noResponse" && row.lastInboundAt ? (
          <>
            <div className="font-medium">
              {row.slaHoursLeft != null && row.slaHoursLeft < 0
                ? `${Math.abs(Math.round(row.slaHoursLeft))}h atrasado`
                : `${Math.round(row.slaHoursLeft ?? 0)}h restantes`}
            </div>
            <div className="text-muted-foreground">
              Inbound {dayjs(row.lastInboundAt).fromNow()}
            </div>
          </>
        ) : bucket === "stuckInStage" && row.daysInStage != null ? (
          <div className="font-medium">{row.daysInStage}d na etapa</div>
        ) : (
          row.responsible?.name && (
            <div className="text-muted-foreground">
              {row.responsible.name}
            </div>
          )
        )}
      </div>
      <Button asChild size="sm" variant="outline" className="ml-2">
        <a href={`/tracking/${row.tracking?.id}?leadId=${row.id}`}>Ver</a>
      </Button>
    </div>
  );
}

function ThresholdSettings({
  slaHours,
  stuckDays,
  onSave,
}: {
  slaHours: number;
  stuckDays: number;
  onSave: (v: { slaHours: number; stuckDays: number }) => void;
}) {
  const [sla, setSla] = useState(slaHours);
  const [stuck, setStuck] = useState(stuckDays);
  const [open, setOpen] = useState(false);

  // Reseta drafts quando o dialog abre — evita "dirty state" depois de
  // Cancelar e voltar a abrir.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setSla(slaHours);
      setStuck(stuckDays);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SettingsIcon className="size-4 mr-2" /> Configurar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limites de resgate</DialogTitle>
          <DialogDescription>
            Configure quando um lead entra para os buckets "Sem resposta" e
            "Parado em etapa". Vale para a sua sessão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="sla">SLA de resposta (horas)</Label>
            <Input
              id="sla"
              type="number"
              min={1}
              value={sla}
              onChange={(e) => setSla(Number(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              Lead que mandou inbound há mais de {sla}h sem resposta entra no bucket.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stuck">Tempo parado em etapa (dias)</Label>
            <Input
              id="stuck"
              type="number"
              min={1}
              value={stuck}
              onChange={(e) => setStuck(Number(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              Lead na mesma coluna por mais de {stuck} dias entra no bucket.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave({ slaHours: sla, stuckDays: stuck });
              setOpen(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
