"use client";

/**
 * RoomConfig — "Configurar minha sala".
 * Nome, cor do piso, grade/snap, trilha sonora, descrição, lock.
 */

import { Lock, Unlock, Grid3x3, Music, Palette, Info } from "lucide-react";
import type { MapRoomConfig } from "../../../types";

interface Props {
  value:    MapRoomConfig;
  onChange: (patch: Partial<MapRoomConfig>) => void;
}

const FLOOR_PRESETS = [
  "#1e293b", "#0f172a", "#312e81", "#1e3a8a", "#064e3b",
  "#422006", "#3b0764", "#7c2d12", "#111827", "#1f2937",
];

export function RoomConfig({ value, onChange }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white tracking-tight">Configurar minha sala</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Detalhes globais: nome, piso, grade, música ambiente.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* ── Identidade ─────────────────────────── */}
        <Section icon={<Info className="h-3.5 w-3.5" />} title="Identidade">
          <Field label="Nome da sala">
            <input
              value={value.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Ex: Sala de missão Artemis"
              className="w-full px-2.5 py-2 rounded-md bg-slate-800/60 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={value.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Uma breve explicação exibida ao visitante…"
              rows={3}
              className="w-full px-2.5 py-2 rounded-md bg-slate-800/60 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </Field>
        </Section>

        {/* ── Aparência ──────────────────────────── */}
        <Section icon={<Palette className="h-3.5 w-3.5" />} title="Aparência">
          <Field label="Cor base do piso">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.floorColor ?? "#1e293b"}
                onChange={(e) => onChange({ floorColor: e.target.value })}
                className="w-10 h-9 rounded-md bg-transparent border border-white/10 cursor-pointer"
              />
              <input
                value={value.floorColor ?? "#1e293b"}
                onChange={(e) => onChange({ floorColor: e.target.value })}
                className="flex-1 px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="grid grid-cols-10 gap-1 mt-2">
              {FLOOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => onChange({ floorColor: c })}
                  title={c}
                  className={`h-6 rounded border transition-transform hover:scale-110 ${
                    value.floorColor === c ? "border-white ring-2 ring-indigo-400/60" : "border-white/10"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
        </Section>

        {/* ── Grade & snap ───────────────────────── */}
        <Section icon={<Grid3x3 className="h-3.5 w-3.5" />} title="Grade & snap">
          <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <span className="flex-1">Exibir grade no editor</span>
            <input
              type="checkbox"
              checked={value.showGrid ?? false}
              onChange={(e) => onChange({ showGrid: e.target.checked })}
              className="accent-indigo-500"
            />
          </label>
          <Field label={`Snap-to-grid (${value.gridSize ?? 0}px) — 0 desliga`}>
            <input
              type="range" min={0} max={64} step={4}
              value={value.gridSize ?? 0}
              onChange={(e) => onChange({ gridSize: parseInt(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </Field>
        </Section>

        {/* ── Áudio ──────────────────────────────── */}
        <Section icon={<Music className="h-3.5 w-3.5" />} title="Trilha ambiente">
          <Field label="URL da música (mp3/ogg)">
            <input
              value={value.bgMusicUrl ?? ""}
              onChange={(e) => onChange({ bgMusicUrl: e.target.value })}
              placeholder="https://.../ambient.mp3"
              className="w-full px-2.5 py-2 rounded-md bg-slate-800/60 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </Field>
        </Section>

        {/* ── Permissões ─────────────────────────── */}
        <Section icon={value.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />} title="Permissões">
          <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value.locked ?? false}
              onChange={(e) => onChange({ locked: e.target.checked })}
              className="mt-0.5 accent-indigo-500"
            />
            <div>
              <div className="font-medium text-white">Bloquear edição por colaboradores</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Apenas você poderá editar o mapa enquanto estiver travado.
              </div>
            </div>
          </label>
        </Section>
      </div>
    </div>
  );
}

/* ─────────── building blocks ─────────── */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <span className="text-indigo-400">{icon}</span>
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}
