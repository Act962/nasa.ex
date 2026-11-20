"use client";

import { useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { useForgeProposals } from "@/features/forge/hooks/use-forge";
import { useScripts } from "../../hooks/use-scripts";
import { resolveScriptVariables } from "../../utils/resolve-script-variables";
import { SHORTCUT_APPS, detectShortcutToken, normalizeShortcutQuery, type ShortcutToken } from "./detect-shortcut-token";

/** A lista mostra ~8 por vez e rola; acima disso, refinar a busca. */
const MAX_ITEMS = 30;

export interface ShortcutItem {
  id: string;
  label: string;
  hint?: string;
  /** Texto que entra no lugar do atalho; `null` quando a escolha abre algo (recibo). */
  replacement: string | null;
  /** Mantém a lista aberta depois de escolher (ex.: escolher o app abre os itens dele). */
  keepOpen?: boolean;
  onPick?: () => void;
}

interface UseComposerShortcutsInput {
  message: string;
  setMessage: (message: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  trackingId: string;
  lead: { id: string; name: string; phone: string | null };
  responsibleName?: string | null;
  onOpenReceipt: () => void;
}

const matches = (label: string, query: string) => {
  const normalizedQuery = normalizeShortcutQuery(query);
  return !normalizedQuery || normalizeShortcutQuery(label).includes(normalizedQuery);
};

/** "@app/item" e "/script" no campo de mensagem (spec 0151, RF-14): detecta o atalho, lista e aplica a escolha. */
export function useComposerShortcuts({ message, setMessage, textareaRef, trackingId, lead, responsibleName, onOpenReceipt }: UseComposerShortcutsInput) {
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  const token: ShortcutToken | null = useMemo(() => detectShortcutToken(message, Math.min(caret, message.length)), [message, caret]);
  const tokenSignature = token ? `${token.start}:${message.slice(token.start, token.end)}` : null;
  const isDismissed = tokenSignature !== null && tokenSignature === dismissedAt;

  const wantsForms = token?.kind === "app-item" && token.app === "formulario";
  const wantsProposals = token?.kind === "app-item" && token.app === "proposta";
  const { forms } = useQueryListForms({ enabled: wantsForms });
  const proposalsQuery = useForgeProposals({}, { enabled: wantsProposals });
  const { data: scripts = [] } = useScripts(trackingId);

  const items: ShortcutItem[] = useMemo(() => {
    if (!token) return [];
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    if (token.kind === "pick-app") {
      return SHORTCUT_APPS.filter((app) => matches(app.key, token.query) || matches(app.label, token.query)).map((app) => ({
        id: app.key,
        label: `@${app.key}`,
        hint: app.hint,
        replacement: `@${app.key}/`,
        keepOpen: true,
      }));
    }
    if (token.kind === "script") {
      return scripts
        .filter((script) => matches(script.name, token.query))
                .map((script) => ({
          id: script.id,
          label: script.name,
          hint: script.content.slice(0, 80),
          replacement: resolveScriptVariables(script.content, { leadName: lead.name, leadPhone: lead.phone, responsibleName }),
        }));
    }
    if (token.app === "recibo") {
      return matches(lead.name, token.query)
        ? [{ id: lead.id, label: lead.name, hint: "Abrir o recibo deste cliente", replacement: null, onPick: onOpenReceipt }]
        : [];
    }
    if (token.app === "formulario") {
      return forms
        .filter((form) => matches(form.name, token.query))
        .map((form) => ({ id: form.id, label: form.name, replacement: `${origin}/submit-form/${form.id} ` }));
    }
    const proposals = [...(proposalsQuery.data?.proposals ?? [])].sort(
      (first, second) => Number(second.clientId === lead.id) - Number(first.clientId === lead.id),
    );
    return proposals
      .filter((proposal) => matches(`${proposal.title} ${proposal.number}`, token.query))
      .map((proposal) => ({
        id: proposal.id,
        label: proposal.title,
        hint: `Nº ${String(proposal.number).padStart(4, "0")}${proposal.clientId === lead.id ? " · deste cliente" : ""}`,
        replacement: `${origin}/proposta/${proposal.publicToken} `,
      }));
  }, [token, scripts, forms, proposalsQuery.data, lead, responsibleName, onOpenReceipt]).slice(0, MAX_ITEMS);

  const isOpen = Boolean(token) && !isDismissed && items.length > 0;
  const safeActiveIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const placeCaret = (position: number) => {
    setCaret(position);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  };

  const pick = (item: ShortcutItem) => {
    if (!token) return;
    const before = message.slice(0, token.start);
    const after = message.slice(token.end);
    const replacement = item.replacement ?? "";
    setMessage(`${before}${replacement}${after}`);
    placeCaret(before.length + replacement.length);
    setActiveIndex(0);
    item.onPick?.();
  };

  /** Devolve `true` quando a tecla foi usada pela lista (o campo não deve enviar a mensagem). */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isOpen) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((safeActiveIndex + step + items.length) % items.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(items[safeActiveIndex]);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAt(tokenSignature);
      return true;
    }
    return false;
  };

  const syncCaret = (position: number | null | undefined) => {
    const nextCaret = position ?? 0;
    if (nextCaret === caret) return;
    setCaret(nextCaret);
    setActiveIndex(0);
  };

  return {
    isOpen,
    items: isOpen ? items : [],
    activeIndex: safeActiveIndex,
    setActiveIndex,
    pick,
    handleKeyDown,
    syncCaret,
    highlight: token && !isDismissed ? { start: token.start, end: token.highlightEnd } : null,
  };
}
