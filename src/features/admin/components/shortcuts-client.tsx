"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shortcut, SHORTCUTS } from "./shortcuts-data";
import { ExternalLink, Keyboard } from "lucide-react";

// ─── Key component ────────────────────────────────────────────────────────────

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md text-xs font-mono font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm">
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

  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-300">{shortcut.description}</span>
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <Key label={k} />
            {i < keys.length - 1 && (
              <span className="text-zinc-600 text-xs">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Global shortcut handler ──────────────────────────────────────────────────

export function useGlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // ⌘A — open explorer and focus input
      if (mod && !shift && key === "a") {
        // Don't intercept if user is in a text input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/home");
        // Focus the NASA Command textarea after navigation
        setTimeout(() => {
          const ta = document.querySelector<HTMLTextAreaElement>(
            "[data-nasa-command]",
          );
          ta?.focus();
        }, 300);
      }

      // ⌘T — go to tracking
      if (mod && !shift && key === "t") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/tracking");
      }

      // ⌘F — go to FORGE (only when not in input)
      if (mod && !shift && key === "f") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/forge");
      }

      // ⌘W — go to workspace (only when not in input)
      if (mod && !shift && key === "w") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/workspaces");
      }

      // ⌘J — go to chat
      if (mod && !shift && key === "j") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/chat");
      }

      // ⌘G — go to agendas
      if (mod && !shift && key === "g") {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        )
          return;
        e.preventDefault();
        router.push("/agenda");
      }

      // ⌘Shift+A — toggle astro
      if (mod && shift && key === "a") {
        e.preventDefault();
        const astroBtn = document.querySelector<HTMLButtonElement>(
          "[data-tour='astro-button']",
        );
        astroBtn?.click();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
          (exceto quando o cursor está em um campo de texto). No Mac use{" "}
          <Key label="⌘" /> e no Windows/Linux use <Key label="Ctrl" />.
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
