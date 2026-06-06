"use client";

/**
 * Properties panel pro elemento Marketing — 6 seções colapsáveis,
 * cada uma representa uma tática de conversão com toggle + configs
 * próprias.
 *
 * Ordem das seções: alinhada com os widgets reais do `marketing.tsx`
 * pro user mapear visualmente o que está ativando.
 */
import { useState } from "react";
import {
  ChevronDown, ChevronRight, Bell, Timer, Users,
  MousePointerClick, AlertTriangle, MessageCircle, Plus, Trash2,
  CreditCard,
} from "lucide-react";
import { getActiveLayerElements, usePagesBuilderStore } from "../../context/pages-builder-store";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { ElementBase } from "../../types";

interface Props {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

export function MarketingProps({ el, update }: Props) {
  return (
    <>
      <Separator className="my-3" />
      <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
        ✨ Cada tática é independente. Ligue só as que fazem sentido pra
        sua landing — mais não é melhor.
      </p>

      <Section
        icon={Bell}
        title="Toasts de leads (social proof)"
        enabled={(el.toastsEnabled as boolean | undefined) ?? true}
        onToggle={(v) => update({ toastsEnabled: v })}
      >
        <ToastsConfig el={el} update={update} />
      </Section>

      <Section
        icon={CreditCard}
        title="Toasts de compra (planos)"
        enabled={(el.purchaseToastsEnabled as boolean | undefined) ?? false}
        onToggle={(v) => update({ purchaseToastsEnabled: v })}
      >
        <PurchaseToastsConfig el={el} update={update} />
      </Section>

      <Section
        icon={Timer}
        title="Cronômetro de desconto"
        enabled={(el.discountBarEnabled as boolean | undefined) ?? true}
        onToggle={(v) => update({ discountBarEnabled: v })}
      >
        <DiscountConfig el={el} update={update} />
      </Section>

      <Section
        icon={Users}
        title="Visitantes online"
        enabled={(el.visitorsOnlineEnabled as boolean | undefined) ?? false}
        onToggle={(v) => update({ visitorsOnlineEnabled: v })}
      >
        <VisitorsConfig el={el} update={update} />
      </Section>

      <Section
        icon={MousePointerClick}
        title="Barra CTA fixa (rodapé)"
        enabled={(el.stickyCtaEnabled as boolean | undefined) ?? false}
        onToggle={(v) => update({ stickyCtaEnabled: v })}
      >
        <StickyCtaConfig el={el} update={update} />
      </Section>

      <Section
        icon={AlertTriangle}
        title="Estoque escasso"
        enabled={(el.scarcityEnabled as boolean | undefined) ?? false}
        onToggle={(v) => update({ scarcityEnabled: v })}
      >
        <ScarcityConfig el={el} update={update} />
      </Section>

      <Section
        icon={MessageCircle}
        title="Auto-abrir Chat IA"
        enabled={(el.autoOpenChat as boolean | undefined) ?? false}
        onToggle={(v) => update({ autoOpenChat: v })}
      >
        <AutoChatConfig el={el} update={update} />
      </Section>
    </>
  );
}

/* ─── Section wrapper ─────────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(enabled);
  return (
    <div className="border rounded-md mb-2 bg-muted/10 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/30 border-b">
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <Icon
          className={cn("size-3.5 shrink-0", enabled ? "text-purple-500" : "text-muted-foreground")}
        />
        <span className="text-[11px] font-medium flex-1 truncate">{title}</span>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {open && enabled && (
        <div className="p-2 space-y-2">{children}</div>
      )}
    </div>
  );
}

/* ─── 1. Toasts ───────────────────────────────────────────────────── */

function ToastsConfig({ el, update }: Props) {
  const people =
    (el.toastPeople as Array<{ name: string; city: string; state: string }> | undefined) ?? [];
  const setPerson = (
    idx: number,
    patch: Partial<{ name: string; city: string; state: string }>,
  ) => {
    const next = people.slice();
    next[idx] = { ...next[idx], ...patch };
    update({ toastPeople: next });
  };
  const addPerson = () =>
    update({
      toastPeople: [...people, { name: "Novo lead", city: "Cidade", state: "UF" }],
    });
  const removePerson = (idx: number) =>
    update({ toastPeople: people.filter((_, i) => i !== idx) });

  return (
    <>
      <Label className="text-[10px] text-muted-foreground">
        Modelo da mensagem
      </Label>
      <Textarea
        rows={2}
        value={(el.toastMessage as string) ?? ""}
        onChange={(e) => update({ toastMessage: e.target.value })}
        placeholder="{name} acabou de entrar - {city}-{state}"
        className="text-[11px]"
      />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Use <code className="font-mono">{`{name}`}</code>,{" "}
        <code className="font-mono">{`{city}`}</code>,{" "}
        <code className="font-mono">{`{state}`}</code> como variáveis.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Intervalo mín. (s)
          </Label>
          <Input
            type="number"
            min={3}
            max={120}
            value={(el.toastIntervalMinSec as number | undefined) ?? 5}
            onChange={(e) =>
              update({ toastIntervalMinSec: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Máx. (s)
          </Label>
          <Input
            type="number"
            min={3}
            max={300}
            value={(el.toastIntervalMaxSec as number | undefined) ?? 25}
            onChange={(e) =>
              update({ toastIntervalMaxSec: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Posição</Label>
          <select
            value={(el.toastPosition as string) ?? "bottom-left"}
            onChange={(e) => update({ toastPosition: e.target.value })}
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="bottom-left">Inf. esq.</option>
            <option value="bottom-right">Inf. dir.</option>
            <option value="top-left">Sup. esq.</option>
            <option value="top-right">Sup. dir.</option>
          </select>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Sliders de proporção: gênero + cidade local */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">
            Proporção de gênero
          </Label>
          <span className="text-[10px] font-mono text-muted-foreground">
            {(el.toastMalePercent as number | undefined) ?? 50}% M ·{" "}
            {100 - ((el.toastMalePercent as number | undefined) ?? 50)}% F
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={(el.toastMalePercent as number | undefined) ?? 50}
          onChange={(e) =>
            update({ toastMalePercent: Number(e.target.value) })
          }
          className="w-full mt-1 accent-indigo-500"
        />
        <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
          Ex: 80% M = a cada 10 toasts, ~8 têm nome masculino.
        </p>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground">
            % na cidade do visitante
          </Label>
          <span className="text-[10px] font-mono text-muted-foreground">
            {(el.toastLocalCityPercent as number | undefined) ?? 0}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={(el.toastLocalCityPercent as number | undefined) ?? 0}
          onChange={(e) =>
            update({ toastLocalCityPercent: Number(e.target.value) })
          }
          className="w-full mt-1 accent-indigo-500"
        />
        <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
          Detecta cidade via IP (só BR). Quando &gt; 0, a porcentagem dos
          toasts mostra a cidade do visitante (efeito poderoso de
          identificação local).
        </p>
      </div>

      <Separator className="my-2" />

      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">
          Lista própria de leads ({people.length})
        </Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={addPerson}
          className="h-6 text-[10px] gap-1"
        >
          <Plus className="size-3" /> Lead
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Se vazio, sorteia entre 40 nomes BR (20 M + 20 F) + 27 cidades.
        Quando preenchida, ignora os sliders acima.
      </p>
      {people.map((person, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_60px_24px] gap-1 items-end">
          <Input
            value={person.name}
            onChange={(e) => setPerson(idx, { name: e.target.value })}
            placeholder="Nome"
            className="text-[10px] h-7"
          />
          <Input
            value={person.city}
            onChange={(e) => setPerson(idx, { city: e.target.value })}
            placeholder="Cidade"
            className="text-[10px] h-7"
          />
          <Input
            value={person.state}
            onChange={(e) => setPerson(idx, { state: e.target.value })}
            placeholder="UF"
            maxLength={2}
            className="text-[10px] h-7 uppercase"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => removePerson(idx)}
            className="size-7"
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      ))}
    </>
  );
}

/* ─── 2. Discount countdown ───────────────────────────────────────── */

function DiscountConfig({ el, update }: Props) {
  return (
    <>
      <Label className="text-[10px] text-muted-foreground">
        Texto da promoção
      </Label>
      <Textarea
        rows={2}
        value={(el.discountBarText as string) ?? ""}
        onChange={(e) => update({ discountBarText: e.target.value })}
        placeholder="Você conseguiu 10% de desconto, adquirindo qualquer produto em"
        className="text-[11px]"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Duração (segundos)
          </Label>
          <Input
            type="number"
            min={30}
            max={3600}
            value={(el.discountBarDurationSec as number | undefined) ?? 300}
            onChange={(e) =>
              update({ discountBarDurationSec: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Posição</Label>
          <select
            value={(el.discountBarPosition as string) ?? "top"}
            onChange={(e) => update({ discountBarPosition: e.target.value })}
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="top">Topo</option>
            <option value="bottom">Rodapé</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Fundo</Label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={(el.discountBarBg as string) ?? "#7C3AED"}
              onChange={(e) => update({ discountBarBg: e.target.value })}
              className="size-6 rounded border cursor-pointer p-0.5"
            />
            <Input
              value={(el.discountBarBg as string) ?? ""}
              onChange={(e) => update({ discountBarBg: e.target.value })}
              className="text-[10px] font-mono h-7"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Texto</Label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={(el.discountBarFg as string) ?? "#ffffff"}
              onChange={(e) => update({ discountBarFg: e.target.value })}
              className="size-6 rounded border cursor-pointer p-0.5"
            />
            <Input
              value={(el.discountBarFg as string) ?? ""}
              onChange={(e) => update({ discountBarFg: e.target.value })}
              className="text-[10px] font-mono h-7"
            />
          </div>
        </div>
      </div>
      <Label className="text-[10px] text-muted-foreground">
        Botão CTA (opcional)
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={(el.discountBarCtaLabel as string) ?? ""}
          onChange={(e) => update({ discountBarCtaLabel: e.target.value })}
          placeholder="Aproveitar"
          className="text-[11px] h-7"
        />
        <Input
          value={(el.discountBarCtaHref as string) ?? ""}
          onChange={(e) => update({ discountBarCtaHref: e.target.value })}
          placeholder="#oferta"
          className="text-[10px] font-mono h-7"
        />
      </div>
    </>
  );
}

/* ─── 3. Visitors online ──────────────────────────────────────────── */

function VisitorsConfig({ el, update }: Props) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Mín.</Label>
          <Input
            type="number"
            min={1}
            value={(el.visitorsOnlineMin as number | undefined) ?? 30}
            onChange={(e) =>
              update({ visitorsOnlineMin: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Máx.</Label>
          <Input
            type="number"
            min={1}
            value={(el.visitorsOnlineMax as number | undefined) ?? 80}
            onChange={(e) =>
              update({ visitorsOnlineMax: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Posição</Label>
          <select
            value={(el.visitorsOnlinePosition as string) ?? "bottom-right"}
            onChange={(e) => update({ visitorsOnlinePosition: e.target.value })}
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="bottom-right">Inf. dir.</option>
            <option value="bottom-left">Inf. esq.</option>
            <option value="top-right">Sup. dir.</option>
            <option value="top-left">Sup. esq.</option>
          </select>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Número oscila ±2 a cada 8s pra parecer vivo. Use limites realistas.
      </p>
    </>
  );
}

/* ─── 4. Sticky CTA ──────────────────────────────────────────────── */

function StickyCtaConfig({ el, update }: Props) {
  return (
    <>
      <Label className="text-[10px] text-muted-foreground">Texto</Label>
      <Input
        value={(el.stickyCtaText as string) ?? ""}
        onChange={(e) => update({ stickyCtaText: e.target.value })}
        placeholder="Garanta sua vaga com 10% off"
        className="text-[11px]"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Texto do botão
          </Label>
          <Input
            value={(el.stickyCtaLabel as string) ?? ""}
            onChange={(e) => update({ stickyCtaLabel: e.target.value })}
            placeholder="Quero garantir"
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Link</Label>
          <Input
            value={(el.stickyCtaHref as string) ?? ""}
            onChange={(e) => update({ stickyCtaHref: e.target.value })}
            placeholder="#oferta"
            className="text-[10px] font-mono h-7"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Fundo</Label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={(el.stickyCtaBg as string) ?? "#10b981"}
              onChange={(e) => update({ stickyCtaBg: e.target.value })}
              className="size-6 rounded border cursor-pointer p-0.5"
            />
            <Input
              value={(el.stickyCtaBg as string) ?? ""}
              onChange={(e) => update({ stickyCtaBg: e.target.value })}
              className="text-[10px] font-mono h-7"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Texto</Label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={(el.stickyCtaFg as string) ?? "#ffffff"}
              onChange={(e) => update({ stickyCtaFg: e.target.value })}
              className="size-6 rounded border cursor-pointer p-0.5"
            />
            <Input
              value={(el.stickyCtaFg as string) ?? ""}
              onChange={(e) => update({ stickyCtaFg: e.target.value })}
              className="text-[10px] font-mono h-7"
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Aparece só após 25% de scroll — evita poluir logo na entrada.
      </p>
    </>
  );
}

/* ─── 5. Scarcity ────────────────────────────────────────────────── */

function ScarcityConfig({ el, update }: Props) {
  return (
    <>
      <Label className="text-[10px] text-muted-foreground">Texto</Label>
      <Input
        value={(el.scarcityText as string) ?? ""}
        onChange={(e) => update({ scarcityText: e.target.value })}
        placeholder="Apenas 12 vagas restantes"
        className="text-[11px]"
      />
      <Label className="text-[10px] text-muted-foreground">Posição</Label>
      <select
        value={(el.scarcityPosition as string) ?? "top-right"}
        onChange={(e) => update({ scarcityPosition: e.target.value })}
        className="h-7 w-full rounded border bg-background text-[11px] px-1"
      >
        <option value="top-right">Sup. dir.</option>
        <option value="top-left">Sup. esq.</option>
        <option value="bottom-right">Inf. dir.</option>
        <option value="bottom-left">Inf. esq.</option>
      </select>
    </>
  );
}

/* ─── 6. Purchase toasts ──────────────────────────────────────────── */

function PurchaseToastsConfig({ el, update }: Props) {
  // Detecta planos das sections-pricing PRESENTES NA PAGE em tempo
  // real — mostra um chip clicável pra adicionar à lista do user.
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const elements = getActiveLayerElements(layout, activeLayer);
  const detectedPlans: string[] = [];
  for (const element of elements) {
    if (element.type === "section-pricing") {
      const plans = (element.plans as Array<{ name?: string }> | undefined) ?? [];
      for (const plan of plans) {
        if (plan.name && !detectedPlans.includes(plan.name)) {
          detectedPlans.push(plan.name);
        }
      }
    }
  }
  const customPlans = (el.purchasePlans as string[] | undefined) ?? [];
  const setCustomPlan = (idx: number, value: string) => {
    const next = customPlans.slice();
    next[idx] = value;
    update({ purchasePlans: next });
  };
  const addCustomPlan = () =>
    update({ purchasePlans: [...customPlans, "Novo plano"] });
  const removeCustomPlan = (idx: number) =>
    update({ purchasePlans: customPlans.filter((_, i) => i !== idx) });

  const hasDetected = detectedPlans.length > 0;
  const useCustomList = customPlans.length > 0;

  return (
    <>
      <Label className="text-[10px] text-muted-foreground">
        Modelo da mensagem
      </Label>
      <Textarea
        rows={2}
        value={(el.purchaseToastMessage as string) ?? ""}
        onChange={(e) => update({ purchaseToastMessage: e.target.value })}
        placeholder="{name} acabou de adquirir {plan}"
        className="text-[11px]"
      />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Use <code className="font-mono">{`{name}`}</code> e{" "}
        <code className="font-mono">{`{plan}`}</code> como variáveis.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Mín. (s)
          </Label>
          <Input
            type="number"
            min={5}
            max={600}
            value={(el.purchaseToastIntervalMinSec as number | undefined) ?? 15}
            onChange={(e) =>
              update({ purchaseToastIntervalMinSec: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Máx. (s)
          </Label>
          <Input
            type="number"
            min={5}
            max={600}
            value={(el.purchaseToastIntervalMaxSec as number | undefined) ?? 60}
            onChange={(e) =>
              update({ purchaseToastIntervalMaxSec: Number(e.target.value) })
            }
            className="text-[11px] h-7"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Posição</Label>
          <select
            value={(el.purchaseToastPosition as string) ?? "bottom-right"}
            onChange={(e) => update({ purchaseToastPosition: e.target.value })}
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="bottom-right">Inf. dir.</option>
            <option value="bottom-left">Inf. esq.</option>
            <option value="top-right">Sup. dir.</option>
            <option value="top-left">Sup. esq.</option>
          </select>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Planos detectados auto na page */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Planos detectados nesta página
        </Label>
        {hasDetected ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {detectedPlans.map((plan) => (
              <span
                key={plan}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                {plan}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-amber-700 mt-1 leading-snug">
            ⚠ Nenhuma section &quot;Planos / Pricing&quot; nesta página. Adicione
            uma ou defina a lista manual abaixo.
          </p>
        )}
        {hasDetected && !useCustomList && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Esses planos serão sorteados nos toasts automaticamente.
          </p>
        )}
      </div>

      <Separator className="my-2" />

      {/* Override manual */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">
          Lista manual ({customPlans.length})
          {useCustomList && (
            <span className="ml-1 text-emerald-700">— sobrescreve auto</span>
          )}
        </Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={addCustomPlan}
          className="h-6 text-[10px] gap-1"
        >
          <Plus className="size-3" /> Plano
        </Button>
      </div>
      {customPlans.map((plan, idx) => (
        <div key={idx} className="flex gap-1 items-center">
          <Input
            value={plan}
            onChange={(e) => setCustomPlan(idx, e.target.value)}
            placeholder="Nome do plano"
            className="text-[10px] h-7"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => removeCustomPlan(idx)}
            className="size-7"
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      ))}
    </>
  );
}

/* ─── 7. Auto chat ───────────────────────────────────────────────── */

function AutoChatConfig({ el, update }: Props) {
  return (
    <>
      <Label className="text-[10px] text-muted-foreground">
        Abrir após (segundos)
      </Label>
      <Input
        type="number"
        min={0}
        max={60}
        value={(el.autoOpenChatDelaySec as number | undefined) ?? 2}
        onChange={(e) => update({ autoOpenChatDelaySec: Number(e.target.value) })}
        className="text-[11px] h-7"
      />
      <p className="text-[10px] text-muted-foreground leading-snug">
        Dispara o &quot;Abrir chat agora&quot; — funciona em combinação com o
        elemento <strong>Chat IA flutuante</strong>. O chat já abre 1x por
        sessão por padrão; este toggle re-força.
      </p>
    </>
  );
}
