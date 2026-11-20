"use client";

// Tela do sorteio ao vivo (spec 0134): feita para o telão. Nomes passando, revelação com confete,
// tela cheia e, no modo simulação, o mesmo show sem gravar nada.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import confetti from "canvas-confetti";
import { FlaskConical, Maximize2, Minimize2, PartyPopper, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { cn } from "@/lib/utils";
import {
  useDrawNextStarFriendsWinner,
  useInvalidateStarFriendsCampaign,
  useStarFriendsCampaign,
  useStarFriendsDrawPool,
} from "../hooks/use-star-friends-campaign";
import { useStarFriendsPermissions } from "../hooks/use-star-friends-permissions";
import { nextFreePosition } from "../utils/live-draw";
import { CampaignDrawRevokeButton } from "./campaign-draw-revoke-button";

type StageEntry = { code: string; memberKey: string; displayName: string; maskedPhone: string };
type StageWinner = StageEntry & { id: string; position: number; drawnAt: Date | string };
type StagePhase = "idle" | "rolling" | "revealed";

const MIN_ROLL_MS = 4200;
const FAST_TICK_MS = 55;
const SLOWEST_TICK_MS = 420;
const TICK_SLOWDOWN = 1.16;
const DEFAULT_SIMULATED_PRIZES = 15;

const DEMO_NAMES = [
  "Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Alves", "Elaine Costa", "Fábio Rocha", "Gabriela Nunes", "Heitor Dias",
  "Isabela Freitas", "João Pereira", "Karina Moura", "Lucas Barros", "Mariana Lopes", "Natan Ribeiro", "Olívia Castro",
  "Paulo Teixeira", "Quézia Martins", "Rafael Gomes", "Sabrina Melo", "Tiago Cardoso", "Úrsula Pinto", "Vitor Araújo",
  "Wesley Farias", "Yasmin Correia", "Zélia Fernandes", "Antônio Silva", "Beatriz Ramos", "Caio Monteiro", "Débora Prado",
  "Eduardo Viana",
];

function buildDemoEntries(): StageEntry[] {
  return DEMO_NAMES.flatMap((name, nameIndex) =>
    Array.from({ length: 1 + (nameIndex % 3) }, (_, numberIndex) => ({
      code: String(100000 + nameIndex * 7919 + numberIndex * 104729).slice(-6),
      memberKey: `demo-${nameIndex}`,
      displayName: name,
      maskedPhone: `(86) •••••-${String(1000 + nameIndex * 37).slice(-4)}`,
    })),
  );
}

const sleep = (durationMs: number) => new Promise((resolve) => window.setTimeout(resolve, durationMs));

function fireConfetti() {
  const colors = ["#facc15", "#f97316", "#38bdf8", "#a855f7", "#22c55e", "#ffffff"];
  const options = { disableForReducedMotion: true, zIndex: 60, colors };
  confetti({ ...options, particleCount: 160, spread: 100, startVelocity: 55, origin: { y: 0.55 } });
  const endAt = Date.now() + 2200;
  const frame = () => {
    confetti({ ...options, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...options, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < endAt) window.requestAnimationFrame(frame);
  };
  frame();
}

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => ({
        left: `${(index * 37.7) % 100}%`,
        top: `${(index * 61.3) % 100}%`,
        size: 1 + (index % 3),
        delay: `${(index % 10) * 0.35}s`,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, index) => (
        <span
          key={index}
          className="absolute animate-pulse rounded-full bg-white/70"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, animationDelay: star.delay }}
        />
      ))}
      <div className="absolute -top-1/3 left-1/2 size-[70vmax] -translate-x-1/2 rounded-full bg-warning/10 blur-3xl" />
    </div>
  );
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // A página inteira entra em tela cheia (não só o palco) para as janelas de confirmação e os avisos aparecerem.
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => toast.error("O navegador não liberou a tela cheia. Use F11."));
  }, []);
  return { isFullscreen, toggle };
}

const subscribeToNothing = () => () => {};

export function CampaignLiveDraw({ isSimulation }: { isSimulation: boolean }) {
  const isMounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  if (!isMounted) return null;
  return createPortal(<LiveDrawStage isSimulation={isSimulation} />, document.body);
}

function LiveDrawStage({ isSimulation }: { isSimulation: boolean }) {
  const permissions = useStarFriendsPermissions();
  const campaignQuery = useStarFriendsCampaign();
  const campaign = campaignQuery.data?.campaign ?? null;
  const stats = campaignQuery.data?.stats ?? null;
  const poolQuery = useStarFriendsDrawPool(campaign?.id);
  const drawNext = useDrawNextStarFriendsWinner({ invalidateOnSuccess: false });
  const invalidateCampaign = useInvalidateStarFriendsCampaign();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [phase, setPhase] = useState<StagePhase>("idle");
  const [shownEntry, setShownEntry] = useState<StageEntry | null>(null);
  const [lastWinner, setLastWinner] = useState<StageWinner | null>(null);
  const [simulatedWinners, setSimulatedWinners] = useState<StageWinner[]>([]);
  const [simulatedPrizeCount, setSimulatedPrizeCount] = useState<number | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isUnmountedRef = useRef(false);
  // Liga de novo na montagem: o modo estrito do React desmonta e monta uma vez em desenvolvimento.
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const realEntries = useMemo(() => poolQuery.data?.entries ?? [], [poolQuery.data]);
  const isDemoPool = isSimulation && !poolQuery.isLoading && realEntries.length === 0;
  const entries: StageEntry[] = useMemo(() => (isDemoPool ? buildDemoEntries() : realEntries), [isDemoPool, realEntries]);

  const realWinners: StageWinner[] = useMemo(
    () =>
      (campaignQuery.data?.draws ?? [])
        .filter((draw) => !draw.revokedAt)
        .sort((first, second) => first.position - second.position)
        .map((draw) => ({ id: draw.id, position: draw.position, code: draw.code, memberKey: draw.id, displayName: draw.displayName, maskedPhone: draw.maskedPhone, drawnAt: draw.drawnAt })),
    [campaignQuery.data?.draws],
  );
  const prizeCount = isSimulation ? (simulatedPrizeCount ?? campaign?.prizeCount ?? DEFAULT_SIMULATED_PRIZES) : (campaign?.prizeCount ?? 0);
  const winners = isSimulation ? simulatedWinners : realWinners;
  const nextPosition = nextFreePosition(
    winners.map((winner) => winner.position),
    prizeCount,
  );

  const blockReason = (() => {
    if (isSimulation) return entries.length === 0 ? "Sem nomes para simular." : null;
    if (!campaign || !stats) return "Nenhuma campanha criada.";
    if (campaign.mode === "POINTS") return "A campanha atual é de pontos de fidelidade: não tem sorteio.";
    if (!permissions.canApproveRedemptions) return "Seu papel não tem a permissão de Aprovar do STAR FRIENDS, que libera o sorteio.";
    if (nextPosition === null) return null;
    if (stats.pendingReceipts > 0) return `Há ${stats.pendingReceipts} cupom(ns) em conferência. Aprove ou recuse antes de sortear.`;
    if (!campaign.lastSweepAt || stats.receiptsAfterSweep > 0) return "Faça a varredura de duplicados na aba Campanha antes de sortear.";
    if (stats.validNumbers === 0) return "Não há números válidos para sortear.";
    return null;
  })();
  const isComplete = nextPosition === null;
  const canDraw = phase !== "rolling" && !isComplete && !blockReason;

  const pickRandomEntry = useCallback(() => entries[Math.floor(Math.random() * entries.length)] ?? null, [entries]);

  const roll = useCallback(
    async (resolveWinner: Promise<StageWinner>) => {
      setPhase("rolling");
      setLastWinner(null);
      let resolvedWinner: StageWinner | null = null;
      let failure: unknown = null;
      void resolveWinner.then(
        (winner) => (resolvedWinner = winner),
        (error: unknown) => (failure = error ?? new Error("Falha no sorteio")),
      );
      const startedAt = performance.now();
      let tickMs = FAST_TICK_MS;
      while (!isUnmountedRef.current) {
        if (failure) break;
        const elapsedMs = performance.now() - startedAt;
        if (elapsedMs > MIN_ROLL_MS * 0.55) tickMs = Math.min(SLOWEST_TICK_MS, tickMs * TICK_SLOWDOWN);
        if (resolvedWinner && elapsedMs >= MIN_ROLL_MS && tickMs >= SLOWEST_TICK_MS) break;
        setShownEntry(pickRandomEntry());
        await sleep(tickMs);
      }
      if (isUnmountedRef.current) return;
      if (failure || !resolvedWinner) {
        if (!isSimulation) void invalidateCampaign();
        setPhase(lastWinner ? "revealed" : "idle");
        setShownEntry(null);
        toast.error(failure instanceof Error ? failure.message : "Não foi possível sortear.");
        return;
      }
      const winner: StageWinner = resolvedWinner;
      setShownEntry(winner);
      setLastWinner(winner);
      setPhase("revealed");
      fireConfetti();
      if (!isSimulation) void invalidateCampaign();
    },
    [lastWinner, pickRandomEntry, isSimulation, invalidateCampaign],
  );

  const startDraw = useCallback(() => {
    if (!canDraw || nextPosition === null) return;
    if (isSimulation) {
      const takenKeys = new Set(simulatedWinners.map((winner) => winner.memberKey));
      const candidates = entries.filter((entry) => !takenKeys.has(entry.memberKey));
      if (candidates.length === 0) {
        toast.error("Todos os participantes já foram sorteados nesta simulação.");
        return;
      }
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      const winner: StageWinner = { ...picked, id: `sim-${nextPosition}-${picked.code}`, position: nextPosition, drawnAt: new Date() };
      void roll(Promise.resolve(winner)).then(() => setSimulatedWinners((current) => [...current, winner]));
      return;
    }
    if (!campaign) return;
    const winnerPromise = drawNext.mutateAsync({ campaignId: campaign.id }).then((result) => ({
      id: result.draw.id,
      position: result.draw.position,
      code: result.draw.code,
      memberKey: result.draw.id,
      displayName: result.draw.displayName,
      maskedPhone: result.draw.maskedPhone,
      drawnAt: result.draw.drawnAt,
    }));
    void roll(winnerPromise);
  }, [canDraw, nextPosition, isSimulation, campaign, drawNext, roll, simulatedWinners, entries]);

  const requestDraw = useCallback(() => {
    if (!canDraw) return;
    if (!isSimulation && realWinners.length === 0) setIsConfirmOpen(true);
    else startDraw();
  }, [canDraw, isSimulation, realWinners.length, startDraw]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isConfirmOpen || document.querySelector("[role='alertdialog']")) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        requestDraw();
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfirmOpen, requestDraw, toggleFullscreen]);

  const resetSimulation = () => {
    setSimulatedWinners([]);
    setLastWinner(null);
    setShownEntry(null);
    setPhase("idle");
  };

  // Ganhador revogado (aqui ou na aba Campanha) sai do palco.
  const isShownWinnerRevoked =
    !isSimulation && Boolean(lastWinner) && (campaignQuery.data?.draws ?? []).some((draw) => draw.id === lastWinner?.id && draw.revokedAt);
  const stagePhase: StagePhase = isShownWinnerRevoked ? "idle" : phase;
  const stageEntry = isShownWinnerRevoked ? null : shownEntry;
  const headlinePosition = stagePhase === "revealed" && lastWinner ? lastWinner.position : nextPosition;
  const isLoading = campaignQuery.isLoading || permissions.isLoading || (Boolean(campaign) && poolQuery.isLoading);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#1e1b4b_0%,#0b0a1f_55%,#05050d_100%)] text-white">
      <StarField />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-white/50 uppercase">Sorteio</p>
            <h1 className="truncate text-base font-bold md:text-xl">{campaign?.name ?? (isSimulation ? "Simulação de sorteio" : "Campanha")}</h1>
          </div>
        </div>
        {isSimulation && (
          <span className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-[11px] font-bold tracking-wider text-warning uppercase max-sm:hidden">
            <FlaskConical className="size-3.5" /> Simulação · nada é gravado
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-white hover:bg-white/10 hover:text-white"
            aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-10 rounded-full text-white hover:bg-white/10 hover:text-white" aria-label="Sair do sorteio">
            <Link href="/star-friends?tab=campaign" onClick={() => document.fullscreenElement && void document.exitFullscreen()}>
              <X className="size-5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 text-center md:gap-8">
        {isLoading ? (
          <OrbitaSpinner className="size-8" />
        ) : (
          <>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-semibold tracking-[0.3em] text-warning/90 uppercase md:text-base">
                {isComplete && stagePhase !== "revealed" ? "Sorteio concluído" : headlinePosition ? `${headlinePosition}º prêmio` : "Prêmio"}
              </p>
              <p className="text-xs text-white/50 md:text-sm">
                {winners.length} de {prizeCount} sorteado{prizeCount === 1 ? "" : "s"}
                {isDemoPool ? " · nomes fictícios" : poolQuery.data ? ` · ${poolQuery.data.totalNumbers} números de ${poolQuery.data.totalParticipants} participantes` : ""}
              </p>
            </div>

            <div
              className={cn(
                "relative flex min-h-[38vh] w-full max-w-5xl flex-col items-center justify-center gap-3 rounded-[32px] border bg-white/[0.04] px-6 py-8 shadow-2xl backdrop-blur-sm transition-all duration-500 md:px-10",
                stagePhase === "revealed" ? "scale-[1.02] border-warning/70 shadow-warning/30" : "border-white/10",
              )}
            >
              {stagePhase === "revealed" && (
                <span className="flex items-center gap-2 rounded-full bg-warning px-4 py-1 text-sm font-black tracking-wider text-black uppercase animate-in zoom-in-50 fade-in duration-500">
                  <PartyPopper className="size-4" /> Parabéns!
                </span>
              )}
              {stageEntry ? (
                <>
                  <p
                    key={stagePhase === "revealed" ? `winner-${stageEntry.code}` : undefined}
                    className={cn(
                      "max-w-full truncate leading-tight font-black tracking-tight",
                      stagePhase === "revealed"
                        ? "bg-gradient-to-b from-white to-warning bg-clip-text text-5xl text-transparent animate-in zoom-in-75 fade-in duration-700 md:text-8xl"
                        : "text-4xl text-white/90 md:text-7xl",
                    )}
                  >
                    {stageEntry.displayName}
                  </p>
                  <p className={cn("font-mono font-bold tracking-[0.2em] tabular-nums", stagePhase === "revealed" ? "text-3xl text-white md:text-5xl" : "text-2xl text-white/60 md:text-4xl")}>
                    Nº {stageEntry.code}
                  </p>
                  <p className="text-sm text-white/50 md:text-lg">{stageEntry.maskedPhone}</p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <Trophy className="size-14 text-warning/80 md:size-20" />
                  <p className="text-lg md:text-2xl">{isComplete ? "Todos os prêmios foram sorteados." : "Quem será o próximo ganhador?"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              {!isComplete && (
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-warning px-10 text-lg font-bold text-black shadow-lg shadow-warning/30 hover:bg-warning/90 disabled:opacity-40 md:h-16 md:px-14 md:text-xl"
                  disabled={!canDraw}
                  onClick={requestDraw}
                  data-guide={GUIDE_ANCHORS.starFriendsDrawNext.id}
                >
                  {phase === "rolling" ? (
                    <>
                      <OrbitaSpinner className="size-5" /> Sorteando…
                    </>
                  ) : (
                    <>
                      <Trophy className="size-5" /> Sortear {nextPosition}º prêmio
                    </>
                  )}
                </Button>
              )}
              {blockReason && <p className="max-w-md text-sm text-warning/90">{blockReason}</p>}
              {!blockReason && !isComplete && phase !== "rolling" && <p className="text-xs text-white/40">Espaço ou Enter sorteia · F liga a tela cheia</p>}
              {isSimulation && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
                  <label className="flex items-center gap-2">
                    Prêmios na simulação
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={prizeCount}
                      disabled={phase === "rolling"}
                      onChange={(event) => setSimulatedPrizeCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
                      className="h-8 w-20 rounded-full border-white/20 bg-white/10 text-center text-white"
                    />
                  </label>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full text-white/80 hover:bg-white/10 hover:text-white" onClick={resetSimulation} disabled={phase === "rolling"}>
                    <RotateCcw className="size-3.5" /> Recomeçar
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {winners.length > 0 && (
        <footer className="relative z-10 border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur md:px-8">
          <ol className="scroll-hidden-x flex gap-2 overflow-x-auto pb-1">
            {winners.map((winner) => (
              <li
                key={winner.id}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2 text-left",
                  lastWinner?.id === winner.id ? "border-warning/60 bg-warning/15" : "border-white/10 bg-white/5",
                )}
              >
                <span className="grid size-8 place-items-center rounded-full bg-warning text-sm font-black text-black">{winner.position}º</span>
                <div className="min-w-0">
                  <p className="max-w-48 truncate text-sm font-semibold">{winner.displayName}</p>
                  <p className="font-mono text-xs text-white/60">Nº {winner.code}</p>
                </div>
                {!isSimulation && permissions.canApproveRedemptions && (
                  <CampaignDrawRevokeButton variant="stage" draw={winner} />
                )}
              </li>
            ))}
          </ol>
        </footer>
      )}

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Começar o sorteio de verdade?</AlertDialogTitle>
            <AlertDialogDescription>
              O resultado fica gravado. A campanha deixa de receber cupons e a varredura não roda mais. Cada ganhador pode ser revogado em até 30
              minutos. Para só testar, use o simulador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsConfirmOpen(false);
                startDraw();
              }}
            >
              Começar o sorteio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
