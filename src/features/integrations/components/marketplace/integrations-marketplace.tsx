"use client";

import { useEffect, useRef, useState } from "react";
import { IntegrationGrid } from "./integration-grid";
import { integrations } from "@/data/integrations";
import { Badge } from "@/components/ui/badge";
import { Puzzle, Zap, CheckCircle2 } from "lucide-react";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import {
  PLATFORM_DEFS,
  ConfigDialog,
} from "@/features/integrations/components/integrations-page";
import type { PlatformDef } from "@/features/integrations/components/integrations-page";
import {
  useQueryPlatformIntegrations,
  useUpsertPlatformIntegration,
  useDeletePlatformIntegration,
} from "@/features/integrations/hooks/use-integrations";
import { IntegrationPlatform } from "@/generated/prisma/enums";
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

// ─── Animated stars canvas ───────────────────────────────────────────────────

function StarsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    const stars: { x: number; y: number; r: number; alpha: number; speed: number; twinkle: number }[] = [];

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 120; i++) {
      stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.5 + 0.3, alpha: Math.random(), speed: Math.random() * 0.005 + 0.002, twinkle: Math.random() * Math.PI * 2 });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => { s.twinkle += s.speed; const alpha = 0.3 + Math.abs(Math.sin(s.twinkle)) * 0.7; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(200, 180, 255, ${alpha})`; ctx.fill(); });
      animFrame = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animFrame); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.6 }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegrationsMarketplace() {
  const { installedSlugs } = useMarketplace();
  const { data } = useQueryPlatformIntegrations();
  const upsert = useUpsertPlatformIntegration();
  const remove = useDeletePlatformIntegration();
  const [configuring, setConfiguring] = useState<PlatformDef | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationPlatform | null>(null);

  const connectedMap = new Map(
    (data?.integrations ?? []).map((i) => [i.platform, i.config as Record<string, string>])
  );
  const connectedSet = new Set(connectedMap.keys());
  const statusMap = new Map(
    (data?.integrations ?? []).map((i) => [
      String(i.platform),
      { errorMessage: i.lastErrorMessage, lastSyncAt: i.lastSyncAt },
    ])
  );

  const handleSave = (config: Record<string, string>) => {
    if (!configuring || configuring.platform === "WHATSAPP") return;
    upsert.mutate(
      { platform: configuring.platform as IntegrationPlatform, config, isActive: true },
      { onSuccess: () => setConfiguring(null) }
    );
  };

  const hardcodedInstalled = integrations.filter((i) => i.status === "installed").map((i) => i.slug);
  const installedCount = new Set([...hardcodedInstalled, ...installedSlugs]).size;

  const stats = [
    { label: "Integrações", value: (integrations.length + PLATFORM_DEFS.length).toString(), icon: Puzzle },
    { label: "Instaladas", value: installedCount.toString(), icon: CheckCircle2 },
    { label: "Categorias", value: "26", icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #0d0a1a 0%, #1a0e3a 40%, #0f0729 70%, #060312 100%)" }}>
        <StarsCanvas />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#7C3AED]/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-48 h-48 rounded-full bg-[#a855f7]/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#7C3AED]/30 text-[#c4b5fd] border-[#7C3AED]/40 text-xs gap-1.5">
                  <Zap className="size-3" /> Marketplace
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                Conecte o NASA ao seu<br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-[#c4b5fd] to-[#a78bfa]">ecossistema de vendas</span>
              </h1>
              <p className="text-sm text-white/60 max-w-md leading-relaxed">
                Integre mensageiros, gateways de pagamento, chatbots, e-commerce e muito mais para automatizar sua operação comercial.
              </p>
            </div>

            {/* Stats */}
            <div className="flex md:flex-col gap-3 shrink-0 overflow-x-auto">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2.5 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10">
                  <Icon className="size-4 text-[#a78bfa]" />
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{value}</p>
                    <p className="text-[10px] text-white/50">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Unified grid */}
      <div className="border rounded-2xl p-6 bg-card">
        <IntegrationGrid
          platformDefs={PLATFORM_DEFS}
          connectedPlatforms={connectedSet}
          integrationStatuses={statusMap}
          onConfigurePlatform={setConfiguring}
          onDisconnectPlatform={setDisconnecting}
        />
      </div>

      {/* ConfigDialog */}
      {configuring && configuring.platform !== "WHATSAPP" && (
        <ConfigDialog
          def={configuring}
          existing={connectedMap.get(configuring.platform as IntegrationPlatform) ?? {}}
          open
          onClose={() => setConfiguring(null)}
          onSave={handleSave}
          isSaving={upsert.isPending}
        />
      )}

      {/* Disconnect dialog */}
      <AlertDialog open={!!disconnecting} onOpenChange={(o) => !o && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar integração</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desconectar esta integração? Os dados já coletados serão mantidos, mas novos dados não serão sincronizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (disconnecting) remove.mutate({ platform: disconnecting }, { onSuccess: () => setDisconnecting(null) }); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
