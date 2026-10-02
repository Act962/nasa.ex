"use client";

import { WhatsappIcon } from "@/components/whatsapp";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarX,
  MoreVertical,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useBroadcast,
  useDeleteBroadcast,
  useReopenBroadcast,
  useScheduleBroadcast,
  useSendBroadcast,
  useUnscheduleBroadcast,
  useUpdateBroadcast,
} from "../hooks/use-broadcasts";
import { BROADCAST_STATUS_LABEL } from "../lib/broadcast-status";
import { RecipientsTable } from "./recipients-table";
import { TemplateConfigTab } from "./template-config-tab";
import { useBroadcastFeeQuote } from "../hooks/use-broadcast-fee";
import { BroadcastCostSummary, isFeeBlocking } from "./self-service/broadcast-cost-summary";

/** Date → valor de `<input type="time">` (HH:mm local). */
function toTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combina a data escolhida no calendário com o horário "HH:mm". */
function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

function formatScheduledAt(value: Date | string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CounterCell({ label, shortLabel, value }: { label: string; shortLabel: string; value: number }) {
  return (
    <div className="min-w-0 px-1.5 py-2.5 text-center sm:px-3 sm:py-3 sm:text-left">
      <p className="truncate text-[10.5px] text-muted-foreground sm:text-xs">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="max-sm:hidden">{label}</span>
      </p>
      <p className="text-lg font-semibold tabular-nums sm:text-xl">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

const PRIMARY_SEND_BUTTON_CLASS =
  "rounded-full bg-brand-whatsapp! font-bold text-brand-whatsapp-deep! hover:bg-brand-whatsapp/90! max-sm:h-11 max-sm:flex-1";

export function BroadcastDetail({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const { data: broadcast, isLoading } = useBroadcast(broadcastId);
  const isSending = broadcast?.status === "SENDING";

  // Atualiza contadores ao vivo enquanto o disparo roda.
  useBroadcast(broadcastId, {
    enabled: isSending,
    refetchInterval: isSending ? 4000 : false,
  });

  const sendBroadcast = useSendBroadcast();
  const scheduleBroadcast = useScheduleBroadcast();
  const unscheduleBroadcast = useUnscheduleBroadcast();
  const updateBroadcast = useUpdateBroadcast();
  const deleteBroadcast = useDeleteBroadcast();
  const reopenBroadcast = useReopenBroadcast();
  const isDraftReady =
    broadcast?.status === "DRAFT" && Boolean(broadcast.templateName) && broadcast.totalRecipients > 0;
  const { data: feeQuote } = useBroadcastFeeQuote(broadcastId, { enabled: isDraftReady });

  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Campanha não encontrada.{" "}
        <Link href="/campanhas?lista=1" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  const number =
    broadcast.tracking.whatsappInstance?.phoneNumber ?? broadcast.tracking.name;

  const isScheduled = broadcast.status === "SCHEDULED";
  const isReady =
    Boolean(broadcast.templateName) && broadcast.totalRecipients > 0;
  const isAwaitingFee = isFeeBlocking(feeQuote);
  const canSend = broadcast.status === "DRAFT" && isReady && !isAwaitingFee;

  function handleSend() {
    sendBroadcast.mutate(
      { broadcastId },
      {
        onSuccess: () => toast.success("Disparo iniciado."),
        onError: (error) => toast.error(error.message ?? "Falha ao disparar."),
      },
    );
  }

  function openSchedule() {
    if (!broadcast) return;
    const suggestion = broadcast.scheduledAt
      ? new Date(broadcast.scheduledAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    setScheduleDate(suggestion);
    setScheduleTime(toTimeValue(suggestion));
    setScheduleOpen(true);
  }

  function handleSchedule() {
    if (!scheduleDate || !scheduleTime) return;
    const scheduledAt = combineDateAndTime(scheduleDate, scheduleTime);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      toast.error("Escolha uma data e hora futura.");
      return;
    }
    scheduleBroadcast.mutate(
      { broadcastId, scheduledAt: scheduledAt.toISOString() },
      {
        onSuccess: () => {
          toast.success("Campanha agendada.");
          setScheduleOpen(false);
        },
        onError: (error) => toast.error(error.message ?? "Falha ao agendar."),
      },
    );
  }

  function handleUnschedule() {
    unscheduleBroadcast.mutate(
      { broadcastId },
      {
        onSuccess: () =>
          toast.success("Agendamento cancelado. A campanha voltou a rascunho."),
        onError: (error) =>
          toast.error(error.message ?? "Falha ao cancelar o agendamento."),
      },
    );
  }

  function openRename() {
    if (!broadcast) return;
    setNameDraft(broadcast.name);
    setRenameOpen(true);
  }

  function handleRename() {
    const name = nameDraft.trim();
    if (!name) return;
    updateBroadcast.mutate(
      { id: broadcastId, name },
      {
        onSuccess: () => {
          toast.success("Campanha renomeada.");
          setRenameOpen(false);
        },
        onError: (error) => toast.error(error.message ?? "Falha ao renomear."),
      },
    );
  }

  function handleDelete() {
    deleteBroadcast.mutate(
      { id: broadcastId },
      {
        onSuccess: () => {
          toast.success("Campanha excluída.");
          router.push("/campanhas?lista=1");
        },
        onError: (error) => toast.error(error.message ?? "Falha ao excluir."),
      },
    );
  }

  function handleReopen() {
    reopenBroadcast.mutate(
      { broadcastId },
      {
        onSuccess: () =>
          toast.success("Campanha reaberta como rascunho. Ajuste e redispare."),
        onError: (error) => toast.error(error.message ?? "Falha ao reabrir."),
      },
    );
  }

  return (
    <div>
      <Link
        href="/campanhas?lista=1"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para campanhas
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 text-xl font-semibold break-words sm:text-2xl">{broadcast.name}</h1>
            <Badge variant="secondary" className="rounded-full">
              {BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <WhatsappIcon className="size-3.5 shrink-0 text-brand-whatsapp" /> {number}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {broadcast.status === "FAILED" && (
            <Button
              variant="outline"
              className="rounded-full max-sm:h-11 max-sm:flex-1"
              onClick={handleReopen}
              disabled={reopenBroadcast.isPending}
            >
              <RotateCcw className="size-4" /> Reabrir
            </Button>
          )}

          {broadcast.status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                className="rounded-full max-sm:h-11 max-sm:flex-1"
                onClick={openSchedule}
                disabled={!canSend || scheduleBroadcast.isPending}
              >
                <CalendarClock className="size-4" /> Agendar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className={PRIMARY_SEND_BUTTON_CLASS} disabled={!canSend || sendBroadcast.isPending}>
                    <Send className="size-4" /> Disparar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disparar campanha?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão enviadas mensagens para {broadcast.totalRecipients}{" "}
                      destinatário(s) usando o modelo{" "}
                      <strong>{broadcast.templateName}</strong>. Esta ação não
                      pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSend}>
                      Disparar agora
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {isScheduled && (
            <>
              <Button
                variant="outline"
                className="rounded-full max-sm:h-11 max-sm:flex-1"
                onClick={handleUnschedule}
                disabled={unscheduleBroadcast.isPending}
              >
                <CalendarX className="size-4" /> Cancelar agendamento
              </Button>
              <Button
                variant="outline"
                className="rounded-full max-sm:h-11 max-sm:flex-1"
                onClick={openSchedule}
                disabled={scheduleBroadcast.isPending}
              >
                <CalendarClock className="size-4" /> Reagendar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className={PRIMARY_SEND_BUTTON_CLASS} disabled={sendBroadcast.isPending}>
                    <Send className="size-4" /> Disparar agora
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disparar agora?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isto antecipa o agendamento e envia já para{" "}
                      {broadcast.totalRecipients} destinatário(s) usando o modelo{" "}
                      <strong>{broadcast.templateName}</strong>. Esta ação não
                      pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSend}>
                      Disparar agora
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {isSending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Enviando...
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 rounded-full max-sm:size-11" aria-label="Mais ações">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openRename}>
                <Pencil className="size-4" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={isSending}
                onSelect={(event) => {
                  event.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {broadcast.status === "DRAFT" && !isReady && (
        <p className="mb-5 rounded-[18px] border border-dashed p-3 text-sm text-muted-foreground sm:mb-6">
          Para disparar: escolha um modelo na aba{" "}
          <span className="font-medium text-foreground">Modelo</span> e adicione
          destinatários.
        </p>
      )}

      {isDraftReady && (
        <div className="mb-6">
          <BroadcastCostSummary broadcastId={broadcastId} />
        </div>
      )}

      {isScheduled && broadcast.scheduledAt && (
        <p className="mb-6 flex items-center gap-2 rounded-[18px] border border-warning/30 bg-warning/10 p-3 text-sm text-warning dark:border-warning dark:bg-warning/15 dark:text-warning">
          <CalendarClock className="size-4 shrink-0" />
          Disparo agendado para{" "}
          <span className="font-medium">
            {formatScheduledAt(broadcast.scheduledAt)}
          </span>
          . O envio inicia automaticamente na hora marcada.
        </p>
      )}

      {broadcast.status === "FAILED" && (
        <p className="mb-6 rounded-[18px] border border-dashed border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive dark:bg-destructive/15 dark:text-destructive">
          O disparo falhou. Clique em{" "}
          <span className="font-medium">Reabrir</span> (ou atrele novos contatos
          em Contatos) para voltar ao rascunho, corrigir e disparar de novo.
        </p>
      )}

      <div className="mb-5 grid grid-cols-5 divide-x divide-line rounded-[20px] border bg-card sm:mb-6">
        <CounterCell label="Destinatários" shortLabel="Contatos" value={broadcast.totalRecipients} />
        <CounterCell label="Enviados" shortLabel="Enviados" value={broadcast.sentCount} />
        <CounterCell label="Entregues" shortLabel="Entregues" value={broadcast.deliveredCount} />
        <CounterCell label="Lidos" shortLabel="Lidos" value={broadcast.readCount} />
        <CounterCell label="Falhas" shortLabel="Falhas" value={broadcast.failedCount} />
      </div>

      <Tabs defaultValue="template">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="template" className="flex-1 sm:flex-none">Modelo</TabsTrigger>
          <TabsTrigger value="recipients" className="flex-1 sm:flex-none">
            Destinatários ({broadcast.totalRecipients})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="template" className="pt-4">
          <TemplateConfigTab
            broadcastId={broadcast.id}
            trackingId={broadcast.trackingId}
            readOnly={broadcast.status !== "DRAFT"}
            attached={{
              templateName: broadcast.templateName,
              templateLanguage: broadcast.templateLanguage,
              templateCategory: broadcast.templateCategory,
              templateVariables: broadcast.templateVariables,
            }}
          />
        </TabsContent>
        <TabsContent value="recipients" className="flex flex-col gap-3 pt-4">
          {broadcast.status === "DRAFT" && (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Para adicionar destinatários, vá em{" "}
              <Link
                href="/campanhas/contatos"
                className="font-medium text-foreground underline"
              >
                Contatos
              </Link>
              , selecione os leads e atrele a esta campanha.
            </p>
          )}
          <RecipientsTable broadcastId={broadcast.id} />
        </TabsContent>
      </Tabs>

      {/* ── Renomear ── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear campanha</DialogTitle>
            <DialogDescription>
              Escolha um novo nome para esta campanha.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="rename-broadcast">Nome</Label>
            <Input
              id="rename-broadcast"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRename}
              disabled={!nameDraft.trim() || updateBroadcast.isPending}
            >
              {updateBroadcast.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Agendar / Reagendar ── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isScheduled ? "Reagendar disparo" : "Agendar disparo"}
            </DialogTitle>
            <DialogDescription>
              A campanha será disparada automaticamente na data e hora
              escolhidas (seu fuso local).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-date">Data e horário</Label>
              <div className="flex gap-2">
                <Popover
                  open={datePopoverOpen}
                  onOpenChange={setDatePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="schedule-date"
                      variant="outline"
                      className="flex-1 justify-start gap-2 font-normal"
                    >
                      <CalendarClock className="size-4 text-muted-foreground" />
                      {scheduleDate ? (
                        scheduleDate.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-muted-foreground">
                          Escolha a data
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={(date) => {
                        setScheduleDate(date);
                        setDatePopoverOpen(false);
                      }}
                      disabled={{
                        before: new Date(new Date().setHours(0, 0, 0, 0)),
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  className="w-32"
                  aria-label="Horário"
                />
              </div>
            </div>
            {scheduleDate && scheduleTime && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                Disparo em{" "}
                <span className="font-medium text-foreground">
                  {formatScheduledAt(
                    combineDateAndTime(scheduleDate, scheduleTime),
                  )}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={
                !scheduleDate || !scheduleTime || scheduleBroadcast.isPending
              }
            >
              {scheduleBroadcast.isPending ? "Salvando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excluir ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>{broadcast.name}</strong> e todos os seus
              destinatários serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteBroadcast.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteBroadcast.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
