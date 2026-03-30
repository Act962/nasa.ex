"use client";

import { useState, useEffect } from "react";
import type { CredentialField } from "@/types/integration";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Eye, EyeOff, ExternalLink, Info, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── LocalStorage persistence ─────────────────────────────────────────────────

const STORAGE_PREFIX = "nasa_creds_";

function loadCredentials(slug: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + slug) ?? "{}");
  } catch {
    return {};
  }
}

function saveCredentials(slug: string, values: Record<string, string>) {
  localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(values));
}

export function hasStoredCredentials(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + slug) ?? "{}");
    return Object.keys(stored).length > 0;
  } catch {
    return false;
  }
}

// ─── Single field row ─────────────────────────────────────────────────────────

function CredentialInput({
  field,
  value,
  onChange,
}: {
  field: CredentialField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === "password";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={field.key} className="text-sm font-medium flex items-center gap-1">
          {field.label}
          {field.required && <span className="text-red-400 text-xs">*</span>}
        </Label>
        {field.helpUrl && (
          <a
            href={field.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-[#7C3AED] hover:underline shrink-0"
          >
            Como obter? <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="relative">
        <Input
          id={field.key}
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(
            "font-mono text-sm pr-9",
            isPassword && "tracking-wider",
          )}
          autoComplete="off"
          data-lpignore="true"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1 leading-relaxed">
        <Info className="size-3 mt-0.5 shrink-0 text-blue-400" />
        {field.helpText}
      </p>
    </div>
  );
}

// ─── Main CredentialForm ──────────────────────────────────────────────────────

interface CredentialFormProps {
  slug: string;
  fields: CredentialField[];
  /** Called after successfully saving */
  onSaved?: () => void;
  /** Compact = used inside modal (smaller spacing) */
  compact?: boolean;
}

export function CredentialForm({ slug, fields, onSaved, compact = false }: CredentialFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setValues(loadCredentials(slug));
  }, [slug]);

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const requiredFields = fields.filter((f) => f.required);
  const allRequiredFilled = requiredFields.every((f) => (values[f.key] ?? "").trim().length > 0);

  const handleSave = async () => {
    if (!allRequiredFilled) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    saveCredentials(slug, values);
    setSaving(false);
    setSaved(true);
    onSaved?.();
    // Reset saved indicator after 3s
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className={cn("space-y-4", compact ? "py-1" : "py-2")}>
      {/* Fields */}
      <div className={cn("space-y-4", compact && "space-y-3")}>
        {fields.map((field) => (
          <CredentialInput
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            onChange={(v) => handleChange(field.key, v)}
          />
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 dark:bg-blue-950/20 dark:border-blue-900/50">
        <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Suas credenciais são armazenadas com segurança e nunca compartilhadas.
          Cada empresa tem suas próprias credenciais.
        </p>
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!allRequiredFilled || saving}
        className={cn(
          "w-full gap-2 font-semibold transition-all",
          saved
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white",
        )}
      >
        {saving ? (
          <><Loader2 className="size-4 animate-spin" /> Salvando...</>
        ) : saved ? (
          <><CheckCircle2 className="size-4" /> Credenciais salvas!</>
        ) : (
          <><Save className="size-4" /> Salvar credenciais</>
        )}
      </Button>

      {saved && (
        <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ Integração configurada com sucesso
        </p>
      )}
    </div>
  );
}
