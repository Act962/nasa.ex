"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shortcut, SHORTCUTS } from "./shortcuts-data";
import { ExternalLink, Keyboard } from "lucide-react";

// ─── Key component ────────────────────────────────────────────────────────────

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-md text-xs font-mono font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm">
      {label}
    </kbd>
  );
}

// ─── Shortcut row ─────────────────────────────────────────────────────────────

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  const keys = !isMac && shortcut.keysWin ? shortcut.keysWin : shortcut.keys;
  const separator = shortcut.sequence ? "->" : "+";

  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-300">{shortcut.description}</span>
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <Key label={k} />
            {i < keys.length - 1 && (
              <span className="text-zinc-600 text-xs">{separator}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Global shortcut handler ──────────────────────────────────────────────────

// Tecla líder das navegações que o navegador reserva no Ctrl (Ctrl+T/W/J):
// pressiona N e DEPOIS a letra do app. Ctrl+N também é reservado (nova janela),
// por isso o líder é o N sozinho.
const LEADER = "n";
// Tempo (ms) que o líder fica "armado" esperando a segunda tecla.
const LEADER_TIMEOUT = 1500;
// Mapa { 2ª tecla → rota } da sequência líder.
const LEADER_ROUTES: Record<string, string> = {
  t: "/tracking",
  w: "/workspaces",
};

export function useGlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let leaderArmed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => {
      leaderArmed = false;
      if (timer) clearTimeout(timer);
    };
    const inEditable = (t: HTMLElement) =>
      t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.isContentEditable;

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement;

      // ── Chords Ctrl/⌘ (combinações que o navegador deixa interceptar) ──

      // Ctrl/⌘+Shift+A — abrir/fechar ASTRO (funciona em qualquer contexto).
      if (mod && shift && key === "a") {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>("[data-tour='astro-button']")
          ?.click();
        return;
      }

      if (mod && !shift) {
        // Ctrl/⌘+A — abrir NASA Explorer e focar o campo de comando.
        if (key === "a") {
          if (inEditable(target)) return;
          e.preventDefault();
          router.push("/home");
          setTimeout(() => {
            document
              .querySelector<HTMLTextAreaElement>("[data-nasa-command]")
              ?.focus();
          }, 300);
          return;
        }
        // Ctrl/⌘+F — FORGE.
        if (key === "f") {
          if (inEditable(target)) return;
          e.preventDefault();
          router.push("/forge");
          return;
        }
        // Ctrl/⌘+G — Agendas.
        if (key === "g") {
          if (inEditable(target)) return;
          e.preventDefault();
          router.push("/agendas");
          return;
        }
        // Ctrl/⌘+J — Tracking-Chat.
        if (key === "j") {
          if (inEditable(target)) return;
          e.preventDefault();
          router.push("/tracking-chat");
          return;
        }
      }

      // ── Sequência líder N (pros que o navegador rouba no Ctrl: T/W/J) ──

      if (inEditable(target)) {
        disarm();
        return;
      }

      // 2ª tecla da sequência.
      if (leaderArmed) {
        disarm();
        const dest = LEADER_ROUTES[key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      // Arma o líder (N sozinho, sem modificadores).
      if (!mod && !e.altKey && !shift && key === LEADER) {
        e.preventDefault();
        leaderArmed = true;
        timer = setTimeout(() => {
          leaderArmed = false;
        }, LEADER_TIMEOUT);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      disarm();
    };
  }, [router]);
}

// ─── Page component ───────────────────────────────────────────────────────────

export function ShortcutsClient() {
  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
          <Keyboard className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Atalhos de Teclado</h1>
          <p className="text-sm text-zinc-400">
            Navegue pela plataforma NASA com velocidade
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3">
        <ExternalLink className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-zinc-300">
          Os atalhos são globais — funcionam em qualquer página da plataforma
          (exceto quando o cursor está em um campo de texto). Use{" "}
          <Key label="⌘" /> no Mac e <Key label="Ctrl" /> no Windows/Linux. Os
          atalhos com <span className="text-zinc-400">{"->"}</span> são em
          sequência: pressione <Key label="N" /> e <em>depois</em> a letra.
        </p>
      </div>

      {/* Shortcut groups */}
      <div className="space-y-6">
        {categories.map((category) => (
          <div
            key={category}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/50">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {category}
              </h2>
            </div>
            <div className="px-5">
              {SHORTCUTS.filter((s) => s.category === category).map(
                (shortcut, i) => (
                  <ShortcutRow key={i} shortcut={shortcut} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tip */}
      <p className="mt-6 text-xs text-zinc-600 text-center">
        Para adicionar novos atalhos, edite{" "}
        <code className="text-zinc-500">shortcuts-client.tsx</code>
      </p>
    </div>
  );
}
