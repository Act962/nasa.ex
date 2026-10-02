"use client";

import { useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AppType = "tracking" | "workspace" | "forge-proposal" | "forge-contract" | "form";

interface Template {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface PatternsSectionProps {
  appType: AppType;
  redirectPath?: (id: string) => string;
}

const APP_TYPE_LABELS: Record<AppType, string> = {
  tracking: "tracking",
  workspace: "workspace",
  "forge-proposal": "proposta",
  "forge-contract": "contrato",
  form: "formulário",
};

// ─── Thumbnails por tipo ───────────────────────────────────────────────────────

function TrackingThumbnail({ color }: { color?: string }) {
  const accent = color || "var(--info)";
  const stages = ["var(--info)", "var(--warning)", "var(--chart-2)", "var(--success)", "var(--destructive)"];
  return (
    <div className="w-full h-full flex flex-col justify-center items-center gap-2 px-3">
      <div className="flex items-center gap-1 w-full">
        {stages.map((c, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-[6px] rounded-full" style={{ backgroundColor: c, opacity: 0.9 }} />
            <div className="w-4/5 h-[28px] rounded border bg-background/60 border-foreground/10 shadow-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 w-full px-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[6px] rounded-full flex-1 bg-foreground/20" />
        ))}
      </div>
    </div>
  );
}

function WorkspaceThumbnail({ color }: { color?: string }) {
  const cols = [
    { c: "var(--muted-foreground)", items: 2 },
    { c: "var(--warning)", items: 3 },
    { c: "var(--success)", items: 1 },
  ];
  return (
    <div className="w-full h-full flex items-end justify-center gap-1.5 px-3 pb-2 pt-3">
      {cols.map((col, i) => (
        <div key={i} className="flex-1 flex flex-col gap-1">
          <div className="w-full h-[4px] rounded-full mb-1" style={{ backgroundColor: col.c }} />
          {Array.from({ length: col.items }).map((_, j) => (
            <div key={j} className="w-full rounded bg-foreground/15 border border-foreground/10" style={{ height: 22 + j * 4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ForgeThumbnail({ isContract }: { isContract?: boolean }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-28 bg-foreground/10 border border-foreground/20 rounded-lg px-3 py-2 flex flex-col gap-1.5 shadow-sm">
        <div className="w-3/4 h-[5px] rounded bg-info/80" />
        <div className="w-full h-[4px] rounded bg-foreground/30" />
        <div className="w-5/6 h-[4px] rounded bg-foreground/20" />
        <div className="w-4/6 h-[4px] rounded bg-foreground/20" />
        {isContract && (
          <>
            <div className="border-t border-foreground/15 my-0.5" />
            <div className="flex gap-2">
              <div className="flex-1 h-[4px] rounded bg-foreground/30" />
              <div className="flex-1 h-[4px] rounded bg-foreground/30" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PatternThumbnail({ appType, color }: { appType: AppType; color?: string }) {
  if (appType === "tracking") return <TrackingThumbnail color={color} />;
  if (appType === "workspace") return <WorkspaceThumbnail color={color} />;
  if (appType === "forge-contract") return <ForgeThumbnail isContract />;
  if (appType === "forge-proposal") return <ForgeThumbnail />;
  return null;
}

// ─── Card ──────────────────────────────────────────────────────────────────────

function PatternCard({
  t,
  appType,
  duplicating,
  onUse,
}: {
  t: Template;
  appType: AppType;
  duplicating: string | null;
  onUse: (t: Template) => void;
}) {
  const label = t.name || t.title || "Sem nome";
  return (
    <div className="w-full flex flex-col rounded-xl border-2 border-info/40 overflow-hidden hover:border-info/70 transition-colors">
      {/* Thumbnail */}
      <div
        className="relative h-[110px] flex items-center justify-center bg-info/10"
      >
        {t.color && (
          <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
        )}
        <PatternThumbnail appType={appType} color={t.color ?? undefined} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-t border-info/20">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{label}</p>
          {t.description && (
            <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
          )}
        </div>
        <button
          onClick={() => onUse(t)}
          disabled={duplicating === t.id}
          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80 border border-info rounded px-2 py-0.5 bg-background/60 disabled:opacity-50"
        >
          {duplicating === t.id ? <OrbitaSpinner className="w-3 h-3 " /> : <Copy className="w-3 h-3" />}
          Usar
        </button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function PatternsSection({ appType, redirectPath }: PatternsSectionProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null);
  const router = useRouter();

  useEffect(() => {
    const keyMap: Record<AppType, string> = {
      tracking: "tracking",
      workspace: "workspace",
      "forge-proposal": "forgeProposal",
      "forge-contract": "forgeContract",
      form: "form",
    };
    fetch(`/api/admin/app-templates?appType=${appType}`)
      .then((r) => r.json())
      .then((data) => setTemplates(data[keyMap[appType]] ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [appType]);

  if (isLoading || templates.length === 0) return null;

  const handleConfirm = async () => {
    if (!confirmTemplate) return;
    const templateId = confirmTemplate.id;
    const templateName = confirmTemplate.name || confirmTemplate.title || "Padrão";
    setConfirmTemplate(null);
    setDuplicating(templateId);
    try {
      const res = await fetch(`/api/admin/app-template/${appType}/${templateId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro ao usar padrão");
      const created = await res.json();
      toast.success(`"${templateName}" adicionado com sucesso!`);
      if (redirectPath) router.push(redirectPath(created.id));
      else router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao usar padrão");
    } finally {
      setDuplicating(null);
    }
  };

  const templateName = confirmTemplate?.name || confirmTemplate?.title || "Padrão";

  return (
    <>
      <div className="mt-8 border-2 border-info/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-info" />
          <h3 className="text-sm font-semibold text-info uppercase tracking-wide">
            Padrões ÓRBITA disponíveis
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {templates.map((t) => (
            <PatternCard
              key={t.id}
              t={t}
              appType={appType}
              duplicating={duplicating}
              onUse={setConfirmTemplate}
            />
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirmTemplate} onOpenChange={(open) => !open && setConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar padrão "{templateName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso criará um novo {APP_TYPE_LABELS[appType]} com todas as configurações deste padrão. Você poderá editar livremente após a criação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Criar a partir deste padrão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
