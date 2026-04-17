import React, { useState, useCallback } from "react";
import { CheckCircle2, Copy, ExternalLink, FileText, PencilLine, Sparkles, Users, X } from "lucide-react";
import { ResultData } from "../types";
import {
  EntitySearchField,
  PlainField,
  DateTimePickerField,
  TextareaField,
  DatePickerField,
  getEntityType,
} from "./entity-search-field";

export interface ResponseCardProps {
  result: ResultData;
  onClose: () => void;
  onContinue?: (extra: string) => void;
  onConfirm?: (key: string, partialContext: Record<string, unknown>) => void;
  onExplorerCmd?: (cmd: string) => void;
}

export function ResponseCard({
  result,
  onClose,
  onContinue,
  onConfirm,
  onExplorerCmd,
}: ResponseCardProps) {
  const [copied, setCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);
  // Stores both the id (for DB lookup) and the display label per field
  const [missingValues, setMissingValues] = useState<Record<string, string>>(
    {},
  );
  const [missingLabels, setMissingLabels] = useState<Record<string, string>>(
    {},
  );

  const setFieldValue = useCallback(
    (key: string, id: string, label: string) => {
      setMissingValues((prev) => ({ ...prev, [key]: id || label }));
      setMissingLabels((prev) => ({ ...prev, [key]: label }));
    },
    [],
  );
  const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${result.url ?? ""}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyContent = () => {
    if (!result.content) return;
    navigator.clipboard.writeText(result.content).then(() => {
      setContentCopied(true);
      setTimeout(() => setContentCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!result.content) return;
    const blob = new Blob([result.content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "post-gerado.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    if (!onContinue) return;
    const extras = Object.entries(missingValues)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => {
        // Use the human-readable label in the command so AI/rules can parse it
        const display = missingLabels[k] ?? v;
        return `/"${k}"="${display}"`;
      })
      .join(" ");
    onContinue(extras);
  };

  const handleConfirmOption = (key: string) => {
    if (onConfirm) {
      onConfirm(key, result.partialContext ?? {});
    }
  };

  const isNeedsInput = result.type === "needs_input";
  const isPostGenerated = result.type === "post_generated";
  const isError = result.type === "error";
  const isConfirmationNeeded = result.type === "confirmation_needed";

  const iconEl = isError ? (
    <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
      <X className="w-4 h-4 text-red-400" />
    </div>
  ) : isNeedsInput ? (
    <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
      <Sparkles className="w-4 h-4 text-amber-400" />
    </div>
  ) : isConfirmationNeeded ? (
    <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
      <Users className="w-4 h-4 text-violet-400" />
    </div>
  ) : (
    <div className="w-9 h-9 rounded-full bg-linear-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );

  return (
    <div className="flex items-start gap-3 py-2">
      {iconEl}
      <div className="flex-1 min-w-0 bg-zinc-900/80 border border-zinc-700/60 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            {isNeedsInput ? (
              <span className="text-amber-400 text-sm">⚠️</span>
            ) : isError ? (
              <span className="text-red-400 text-sm">✗</span>
            ) : isConfirmationNeeded ? (
              <span className="text-violet-400 text-sm">?</span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-sm font-semibold text-white">
              {result.title}
            </span>
            {(result.starsSpent ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                −{result.starsSpent} ⭐
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">
            {result.description}
          </p>

          {/* result_links: lista de itens clicáveis (ex: propostas, reuniões, leads) */}
          {result.resultLinks && result.resultLinks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {result.resultLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-1.5 group">
                  <a
                    href={link.url}
                    className="flex items-center justify-between gap-2 flex-1 min-w-0 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-lg px-3 py-2 transition-all"
                  >
                    <span className="text-xs text-zinc-300 group-hover:text-white truncate">
                      {link.label}
                    </span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 shrink-0 transition-colors" />
                  </a>
                  {link.explorerCmd && onExplorerCmd && (
                    <button
                      type="button"
                      title="Editar no Explorer"
                      onClick={() => onExplorerCmd(link.explorerCmd!)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800/60 hover:bg-violet-600/30 border border-zinc-700/50 hover:border-violet-500/60 text-zinc-500 hover:text-violet-400 transition-all shrink-0"
                    >
                      <PencilLine className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* needs_input: smart search fields for each missing field */}
          {isNeedsInput &&
            result.missingFields &&
            result.missingFields.length > 0 && (
              <div className="mt-4 space-y-3">
                 {result.missingFields.map((field) => {
                  const entityType = getEntityType(field.key);
                  const isDatetime = field.key === "datetime";
                  const isDateOnly =
                    field.key === "startdate" || field.key === "duedate";
                  const isTextarea =
                    field.key === "descricao" || field.key === "description";
                  // workspaceColumn needs the selected workspace id as parentId
                  const parentId =
                    field.key === "coluna" || field.key === "column"
                      ? (missingValues["workspace"] ?? undefined)
                      : undefined;
                  return (
                    <div key={field.key}>
                      <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                        {field.label}
                      </label>
                      {isDatetime ? (
                        <DateTimePickerField
                          value={missingValues[field.key] ?? ""}
                          onChange={(v) => setFieldValue(field.key, "", v)}
                          onConfirm={handleContinue}
                        />
                      ) : isDateOnly ? (
                        <DatePickerField
                          value={missingValues[field.key] ?? ""}
                          onChange={(v) => setFieldValue(field.key, "", v)}
                        />
                      ) : isTextarea ? (
                        <TextareaField
                          label={field.label}
                          value={missingValues[field.key] ?? ""}
                          onChange={(v) => setFieldValue(field.key, "", v)}
                        />
                      ) : entityType ? (
                        <EntitySearchField
                          fieldKey={field.key}
                          label={field.label}
                          entityType={entityType}
                          parentId={parentId}
                          value={missingValues[field.key] ?? ""}
                          onChange={(id, label) =>
                            setFieldValue(field.key, id, label)
                          }
                        />
                      ) : (
                        <PlainField
                          label={field.label}
                          value={missingValues[field.key] ?? ""}
                          onChange={(v) => setFieldValue(field.key, "", v)}
                          onEnter={handleContinue}
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors mt-1"
                >
                  Continuar →
                </button>
              </div>
            )}

          {/* confirmation_needed: show option buttons */}
          {isConfirmationNeeded &&
            result.confirmOptions &&
            result.confirmOptions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.confirmOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleConfirmOption(opt.key)}
                    className="flex items-center gap-1.5 bg-transparent border border-violet-500/60 text-violet-300 hover:bg-violet-500/10 hover:border-violet-400 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

          {/* post_generated: show formatted content */}
          {isPostGenerated && result.content && (
            <div className="mt-4">
              <pre className="bg-zinc-800/80 border border-zinc-700/60 rounded-xl px-4 py-3 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono overflow-auto max-h-64">
                {result.content}
              </pre>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleCopyContent}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-zinc-700/50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {contentCopied ? "Copiado!" : "Copiar"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors border border-zinc-700/50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Baixar .txt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isNeedsInput && !isConfirmationNeeded && result.url && (
          <div className="flex items-center gap-2 px-5 pb-4">
            <a
              href={result.url}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir no {result.appName}
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded-lg transition-colors border border-zinc-700/50"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
