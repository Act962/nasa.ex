"use client";

import { X } from "lucide-react";

/**
 * Modal acionável quando o microfone está negado pra essa origem.
 * Browser não nos deixa "resetar" via JS (regra de segurança), mas
 * podemos mostrar passos claros + deep-link pras configurações do Chrome.
 */
export function MicPermissionGuide({ onClose }: { onClose: () => void }) {
  const isChromium =
    typeof navigator !== "undefined" &&
    /chrome|edge|chromium/i.test(navigator.userAgent) &&
    !/safari\/.*version/i.test(navigator.userAgent.toLowerCase());
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[9100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-200"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <h3 className="text-base font-semibold text-zinc-100">
          Preciso de permissão de microfone
        </h3>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          O Astro precisa ouvir você pra atender quando disser
          <span className="text-violet-300 font-mono"> "ASTRO"</span>. O
          microfone foi bloqueado pra esse site no seu browser e eu não
          consigo resetar por motivo de segurança — você precisa liberar
          manualmente. É rápido.
        </p>

        <ol className="mt-4 space-y-2 text-sm text-zinc-300">
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              1
            </span>
            <span>
              Click no ícone do <strong>cadeado 🔒</strong> (ou
              "Não seguro") do lado esquerdo da URL <code className="text-violet-300 font-mono text-xs">{origin}</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              2
            </span>
            <span>
              Encontre <strong>"Microfone"</strong> e mude pra{" "}
              <span className="text-emerald-300">Permitir</span>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 size-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">
              3
            </span>
            <span>
              Recarregue a página (<kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">⌘R</kbd>) e tente ativar a escuta de novo
            </span>
          </li>
        </ol>

        {isChromium && (
          <p className="mt-4 text-xs text-zinc-500">
            Atalho Chrome/Edge: cole na barra de endereço{" "}
            <code className="text-violet-300 font-mono text-xs">
              chrome://settings/content/microphone
            </code>{" "}
            e libere o site (não é clicável aqui por segurança).
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
