"use client";

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

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

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
        <Link href="/campanhas" className="underline">
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
  const canSend = broadcast.status === "DRAFT" && isReady;

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
          router.push("/campanhas");
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
        href="/campanhas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para campanhas
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{broadcast.name}</h1>
            <Badge variant="secondary">
              {BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Origem: {number}</p>
        </div>

        <div className="flex items-center gap-2">
          {broadcast.status === "FAILED" && (
            <Button
              variant="outline"
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
                onClick={openSchedule}
                disabled={!canSend || scheduleBroadcast.isPending}
              >
                <CalendarClock className="size-4" /> Agendar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!canSend || sendBroadcast.isPending}>
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
                onClick={handleUnschedule}
                disabled={unscheduleBroadcast.isPending}
              >
                <CalendarX className="size-4" /> Cancelar agendamento
              </Button>
              <Button
                variant="outline"
                onClick={openSchedule}
                disabled={scheduleBroadcast.isPending}
              >
                <CalendarClock className="size-4" /> Reagendar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={sendBroadcast.isPending}>
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
              <Button variant="outline" size="icon" aria-label="Mais ações">
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

      {broadcast.status === "DRAFT" && !canSend && (
        <p className="mb-6 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Para disparar: escolha um modelo na aba{" "}
          <span className="font-medium text-foreground">Modelo</span> e adicione
          destinatários.
        </p>
      )}

      {isScheduled && broadcast.scheduledAt && (
        <p className="mb-6 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <CalendarClock className="size-4 shrink-0" />
          Disparo agendado para{" "}
          <span className="font-medium">
            {formatScheduledAt(broadcast.scheduledAt)}
          </span>
          . O envio inicia automaticamente na hora marcada.
        </p>
      )}

      {broadcast.status === "FAILED" && (
        <p className="mb-6 rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          O disparo falhou. Clique em{" "}
          <span className="font-medium">Reabrir</span> (ou atrele novos contatos
          em Contatos) para voltar ao rascunho, corrigir e disparar de novo.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CounterCard label="Destinatários" value={broadcast.totalRecipients} />
        <CounterCard label="Enviados" value={broadcast.sentCount} />
        <CounterCard label="Entregues" value={broadcast.deliveredCount} />
        <CounterCard label="Lidos" value={broadcast.readCount} />
        <CounterCard label="Falhas" value={broadcast.failedCount} />
      </div>

      <Tabs defaultValue="template">
        <TabsList>
          <TabsTrigger value="template">Modelo</TabsTrigger>
          <TabsTrigger value="recipients">
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
