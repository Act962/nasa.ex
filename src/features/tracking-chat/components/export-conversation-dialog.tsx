"use client";

import { useState } from "react";
import dayjs from "dayjs";
import type { DateRange } from "react-day-picker";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useExportConversation } from "../hooks/use-export-conversation";
import {
  DEFAULT_EXPORT_OPTIONS,
  downloadConversation,
  type ConversationExport,
  type ExportDateMode,
  type ExportFormat,
  type ExportOptions,
} from "../lib/export-conversation";
import { SelectDateRange } from "./summerize-conversation";

interface Props {
  conversationId: string;
  /** Formato escolhido no submenu "Exportar"; `null` mantém o dialog fechado. */
  format: ExportFormat | null;
  onClose: () => void;
}

type PeriodMode = "all" | "range";

const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: "PDF", txt: "TXT" };

const DATE_MODE_OPTIONS: { value: ExportDateMode; label: string }[] = [
  { value: "datetime", label: "Data e hora" },
  { value: "time", label: "Só a hora" },
  { value: "none", label: "Sem data" },
];

const TOGGLE_OPTIONS: {
  key: "includeMedia" | "hideTeamNames" | "includeHeader";
  label: string;
  hint: string;
}[] = [
  {
    key: "includeMedia",
    label: "Incluir anexos",
    hint: "Mostra [Áudio], [Imagem], [Documento] no lugar dos arquivos.",
  },
  {
    key: "hideTeamNames",
    label: "Ocultar nomes da equipe",
    hint: "Mensagens da empresa saem como \"Atendente\".",
  },
  {
    key: "includeHeader",
    label: "Incluir cabeçalho",
    hint: "Título, empresa e data da exportação no topo.",
  },
];

function defaultDateRange(): DateRange {
  return {
    from: dayjs().subtract(29, "day").startOf("day").toDate(),
    to: dayjs().endOf("day").toDate(),
  };
}

function formatRange(range: DateRange): string {
  if (!range.from || !range.to) return "Escolha as datas";
  const from = dayjs(range.from).format("DD/MM/YYYY");
  const to = dayjs(range.to).format("DD/MM/YYYY");
  return from === to ? from : `${from} a ${to}`;
}

export function ExportConversationDialog({
  conversationId,
  format,
  onClose,
}: Props) {
  // Guarda o último formato para o título não sumir na animação de fechar.
  const [activeFormat, setActiveFormat] = useState<ExportFormat>("pdf");
  if (format && format !== activeFormat) setActiveFormat(format);

  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const exportConversation = useExportConversation();

  const isRangeIncomplete =
    periodMode === "range" && (!dateRange.from || !dateRange.to);

  const updateOption = <Key extends keyof ExportOptions>(
    key: Key,
    value: ExportOptions[Key],
  ) => setOptions((current) => ({ ...current, [key]: value }));

  const handleExport = () => {
    const period =
      periodMode === "range" && dateRange.from && dateRange.to
        ? {
            dateInit: dayjs(dateRange.from).startOf("day").toISOString(),
            dateEnd: dayjs(dateRange.to).endOf("day").toISOString(),
          }
        : {};

    exportConversation.mutate(
      { conversationId, ...period },
      {
        onSuccess: (data) => {
          if (data.total === 0) {
            toast.error(
              periodMode === "range"
                ? "Nenhuma mensagem nesse período."
                : "Esta conversa não tem mensagens para exportar.",
            );
            return;
          }
          downloadConversation(
            data as ConversationExport,
            activeFormat,
            options,
          );
          if (data.truncated) {
            toast.warning(
              `Conversa longa: exportamos as ${data.messages.length} mensagens mais recentes.`,
            );
          } else {
            toast.success("Conversa exportada.");
          }
          onClose();
        },
        onError: (error) => {
          toast.error(error.message || "Falha ao exportar a conversa.");
        },
      },
    );
  };

  return (
    <Dialog
      open={format !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DownloadIcon className="size-5 text-primary" />
            Exportar em {FORMAT_LABEL[activeFormat]}
          </DialogTitle>
          <DialogDescription>
            Escolha o que entra no arquivo.
            {activeFormat === "pdf" &&
              " Emojis não aparecem no PDF; para mantê-los, use TXT."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label>Período</Label>
            <RadioGroup
              value={periodMode}
              onValueChange={(value) => setPeriodMode(value as PeriodMode)}
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="export-period-all" />
                <Label htmlFor="export-period-all" className="font-normal">
                  Conversa inteira
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="range" id="export-period-range" />
                <Label htmlFor="export-period-range" className="font-normal">
                  Só um período
                </Label>
              </div>
            </RadioGroup>
            {periodMode === "range" && (
              <div className="flex items-center gap-2 pl-6">
                <SelectDateRange
                  dateRange={dateRange}
                  onApply={setDateRange}
                />
                <span className="text-sm text-muted-foreground">
                  {formatRange(dateRange)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data e hora das mensagens</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={options.dateMode}
              onValueChange={(value) => {
                if (value) updateOption("dateMode", value as ExportDateMode);
              }}
              className="w-full"
            >
              {DATE_MODE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="flex-1"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-3">
            {TOGGLE_OPTIONS.map((toggle) => (
              <div
                key={toggle.key}
                className="flex items-start justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={`export-${toggle.key}`}>{toggle.label}</Label>
                  <p className="text-xs text-muted-foreground">{toggle.hint}</p>
                </div>
                <Switch
                  id={`export-${toggle.key}`}
                  checked={options[toggle.key]}
                  onCheckedChange={(checked) =>
                    updateOption(toggle.key, checked)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportConversation.isPending || isRangeIncomplete}
            className="gap-2"
          >
            {exportConversation.isPending ? (
              <>
                <OrbitaSpinner className="size-4" />
                Gerando...
              </>
            ) : (
              <>
                <DownloadIcon className="size-4" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
