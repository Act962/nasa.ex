import { requireAdminSession } from "@/lib/admin-utils";
import { Keyboard, ExternalLink } from "lucide-react";
import { SHORTCUTS } from "@/features/admin/components/shortcuts-data";

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md text-xs font-mono font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm">
      {label}
    </kbd>
  );
}

export default async function AdminShortcutsPage() {
  await requireAdminSession();

  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-violet-400" /> Atalhos de Teclado
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Navegue pela plataforma NASA com velocidade usando atalhos globais.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-violet-600/10 border border-violet-500/20 rounded-xl px-4 py-3">
        <ExternalLink className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-zinc-300">
          Os atalhos são globais — funcionam em qualquer página da plataforma (exceto quando o cursor está em um campo de texto).
          No Mac use <Key label="⌘" /> e no Windows/Linux use <Key label="Ctrl" />.
        </p>
      </div>

      {/* Shortcut groups */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/50">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{category}</h2>
            </div>
            <div className="px-5">
              {SHORTCUTS.filter((s) => s.category === category).map((shortcut, i) => {
                const keys = shortcut.keys;
                const keysWin = shortcut.keysWin ?? shortcut.keys;
                return (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                    <span className="text-sm text-zinc-300">{shortcut.description}</span>
                    <div className="flex items-center gap-6 shrink-0 ml-4">
                      {/* Mac */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-600 mr-1.5">Mac</span>
                        {keys.map((k, j) => (
                          <span key={j} className="flex items-center gap-1">
                            <Key label={k} />
                            {j < keys.length - 1 && <span className="text-zinc-600 text-xs">+</span>}
                          </span>
                        ))}
                      </div>
                      {/* Win */}
                      {shortcut.keysWin && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-600 mr-1.5">Win</span>
                          {keysWin.map((k, j) => (
                            <span key={j} className="flex items-center gap-1">
                              <Key label={k} />
                              {j < keysWin.length - 1 && <span className="text-zinc-600 text-xs">+</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
