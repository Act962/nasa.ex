"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Command as CmdIcon, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SlashComposer, type DirectIntentPayload } from "./slash-composer";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { orpc } from "@/lib/orpc";
import { NodeType } from "@/generated/prisma/enums";

/**
 * Cmd+K Palette — composer global, acessível de QUALQUER página.
 *
 * Atalho: Ctrl/Cmd + K. Reusa <SlashComposer/> dentro de um Dialog.
 *
 * Submit:
 *   1. Marca a entrada como digitada (não voz) pra TTS não narrar
 *   2. Seta pendingUtterance no store do orb
 *   3. Navega pra /home — NasaCommandCenter consome o pending e auto-submete
 *      no useEffect existente (mesma mecânica do wake word)
 *   4. Fecha o palette
 *
 * Reuso: ZERO código duplicado. Mesmo composer, mesmo pipeline, mesma
 * cobrança Stars. Cmd+K vira só uma "porta de entrada" extra.
 */
export function CmdkPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const setPendingUtterance = useAstroOrbStore((s) => s.setPendingUtterance);
  const setOrbPhase = useAstroOrbStore((s) => s.setPhase);
  const setLastInputWasVoice = useVoiceModeStore(
    (s) => s.setLastInputWasVoice,
  );

  // Captura Ctrl/Cmd+K global.
  // Não conflitar com inputs — se user tem foco em <input> ou <textarea>,
  // o atalho ainda funciona (pattern Linear/Notion). Só pula quando user
  // tá digitando em um contenteditable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "k") return;
      // Permite Ctrl+Shift+K e similares passarem
      if (e.altKey) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = useCallback(
    (prompt: string) => {
      // Marca explicitamente que foi DIGITAÇÃO (não voz) — Astro responde
      // em texto, não chama TTS (a menos que user esteja em modo "audio" sempre).
      setLastInputWasVoice(false);
      // Envia via mesma porta do wake word: pendingUtterance + nav /home.
      setPendingUtterance(prompt);
      setOrbPhase("thinking");
      router.push("/home");
      setOpen(false);
    },
    [router, setPendingUtterance, setOrbPhase, setLastInputWasVoice],
  );

  // Mutations pra "Automatizar" — cria pasta (se for nova) + cria workflow
  // + navega pro editor. Inline aqui ao invés de via hook centralizado pra
  // manter o CmdkPalette auto-contido (qualquer página pode renderizar).
  const queryClient = useQueryClient();
  const createFolder = useMutation(
    orpc.workflowFolder.create.mutationOptions(),
  );
  const createWorkflow = useMutation(orpc.workflow.create.mutationOptions());

  const handleDirectIntent = useCallback(
    async (intent: DirectIntentPayload) => {
      // ── apply_preset: aplica blueprint inteiro (presets agent-mode) ─
      // Backend já tem `applyDefaultAgentPresets` em
      // src/features/workflows/lib/agent-presets/, mas ainda sem oRPC
      // procedure dedicado por preset. Por enquanto, roteamos pro Astro
      // chat com prompt natural — o Astro tem (ou terá) tool que aplica.
      if (intent.type === "apply_preset") {
        const trackingValue = intent.values.tracking;
        const pastaValue = intent.values.pasta;
        const presetSlug = intent.payload?.presetSlug;
        if (!trackingValue?.entityLabel || !presetSlug) {
          toast.error("Preencha o tracking pra aplicar o preset.");
          return;
        }
        // Envia como utterance pro Astro — fluxo idêntico ao /home
        const pastaPart = pastaValue?.entityLabel
          ? ` na pasta "${pastaValue.entityLabel}"`
          : "";
        const prompt = `Aplique o preset "${presetSlug}" no tracking "${trackingValue.entityLabel}"${pastaPart}.`;
        setLastInputWasVoice(false);
        setPendingUtterance(prompt);
        setOrbPhase("thinking");
        router.push("/home");
        setOpen(false);
        return;
      }

      if (intent.type !== "create_workflow") return;

      const trackingValue = intent.values.tracking;
      const nomeValue = intent.values.nome;
      const pastaValue = intent.values.pasta;
      const nodeType = intent.payload?.nodeType;
      const agentMode = intent.payload?.agentMode === "true";

      if (!trackingValue?.entityId || !nomeValue?.raw || !nodeType) {
        toast.error("Preencha tracking + nome pra criar a automação.");
        return;
      }

      const trackingId = trackingValue.entityId;

      try {
        // 1. Resolve folderId — se user pediu pra criar nova, cria primeiro
        let folderId: string | null = null;
        if (pastaValue?.raw) {
          if (pastaValue.raw.startsWith("__create__:")) {
            const newName = pastaValue.raw.replace(/^__create__:/, "");
            const created = await createFolder.mutateAsync({
              trackingId,
              name: newName,
            });
            folderId = created.id;
          } else if (pastaValue.entityId) {
            folderId = pastaValue.entityId;
          }
        }

        // 2. Cria o workflow (já com nome final + pasta + agentMode se IA)
        const workflow = await createWorkflow.mutateAsync({
          name: nomeValue.raw,
          trackingId,
          folderId: folderId ?? undefined,
          agentMode,
        });

        // 3. Invalida caches de list/folders pra próxima navegação trazer
        //    o workflow novo já refletido nas listas.
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({ input: { trackingId } }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.workflowFolder.list.queryKey({
            input: { trackingId },
          }),
        });

        // 4. Navega pro editor — o usuário continua a configurar o node
        //    específico (gatilho, ação ou send-to-app) lá. O nodeType vem
        //    como query param `?addNode=<TYPE>` que o editor consome no
        //    mount pra pré-criar o nó conectado ao INITIAL.
        const nt = nodeType as keyof typeof NodeType;
        toast.success(
          agentMode
            ? `Automação IA "${nomeValue.raw}" criada (Modo Agente ativo)`
            : `Automação "${nomeValue.raw}" criada`,
        );
        router.push(
          `/tracking/${trackingId}/workflows/${workflow.id}?addNode=${nt}`,
        );
        setOpen(false);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Falha ao criar automação";
        toast.error(msg);
      }
    },
    [
      createFolder,
      createWorkflow,
      queryClient,
      router,
      setLastInputWasVoice,
      setPendingUtterance,
      setOrbPhase,
    ],
  );

  const isPending = createFolder.isPending || createWorkflow.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 bg-zinc-950 border-zinc-800">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm text-zinc-200 flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Comando rápido
          </DialogTitle>
          <DialogDescription className="sr-only">
            Monte um comando escolhendo verbo, app e campos. Submit envia ao Astro.
          </DialogDescription>
        </DialogHeader>
        <div className="px-3 pb-3">
          <SlashComposer
            onSubmit={handleSubmit}
            onDirectIntent={handleDirectIntent}
            loading={isPending}
          />
          <p className="mt-2 text-[10px] text-zinc-600 text-center flex items-center justify-center gap-2">
            {isPending && (
              <span className="inline-flex items-center gap-1 text-violet-400">
                <Loader2 className="size-3 animate-spin" /> Criando automação...
              </span>
            )}
            <span>
              <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                <CmdIcon className="inline size-2.5" />K
              </kbd>{" "}
              abre e fecha •{" "}
              <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                Esc
              </kbd>{" "}
              cancela
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
