"use client";

/**
 * Modal de promoção manual de usuário a parceiro.
 *
 * Fluxo:
 *   1. Admin busca usuário por nome/e-mail (debounced).
 *   2. Seleciona usuário da lista de resultados.
 *   3. Define tier inicial, status (ativar agora?) e notas.
 *   4. Confirmação chama `admin.partners.promoteUser` e redireciona
 *      para a tela de detalhe do parceiro recém-criado.
 *
 * Substitui o link `?action=promote` da listagem de parceiros — o link
 * antigo só mudava a URL e não tinha UI cabeada.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  X,
  Search,
  UserPlus,
  Loader2,
  Check,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced";

type Tier = "SUITE" | "EARTH" | "GALAXY" | "CONSTELLATION" | "INFINITY";

const TIERS: { value: Tier; label: string; range: string }[] = [
  { value: "SUITE", label: "Suite", range: "10–24 orgs" },
  { value: "EARTH", label: "Earth", range: "25–49 orgs" },
  { value: "GALAXY", label: "Galaxy", range: "50–99 orgs" },
  { value: "CONSTELLATION", label: "Constellation", range: "100–199 orgs" },
  { value: "INFINITY", label: "Infinity", range: "200+ orgs (vitalício)" },
];

interface CandidateUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  alreadyPartner: boolean;
  partnerStatus: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Botão pronto-pra-uso que mostra "+ Tornar Parceiro" e cuida do estado
 * de abertura do dialog. Use em Server Components quando não quiser
 * gerenciar o estado manualmente.
 */
export function PartnerPromoteButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        + Tornar Parceiro
      </button>
      <PartnerPromoteDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Wrapper que monta/desmonta o dialog interno conforme `open` —
 * garante que cada abertura comece com estado limpo (sem precisar
 * de useEffect pra resetar).
 */
export function PartnerPromoteDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <PartnerPromoteDialogInner onClose={onClose} />;
}

function PartnerPromoteDialogInner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selected, setSelected] = useState<CandidateUser | null>(null);
  const [tier, setTier] = useState<Tier>("SUITE");
  const [activate, setActivate] = useState(true);
  const [notes, setNotes] = useState("");

  const trimmed = debouncedSearch.trim();
  const { data: searchResult, isFetching: isSearching } = useQuery({
    ...orpc.admin.partners.searchUsersToPromote.queryOptions({
      input: { search: trimmed },
    }),
    enabled: trimmed.length >= 2 && !selected,
  });

  const promoteMut = useMutation({
    ...orpc.admin.partners.promoteUser.mutationOptions(),
    onSuccess: ({ partnerId }) => {
      toast.success(`${selected?.name ?? "Usuário"} agora é parceiro!`);
      onClose();
      router.push(`/admin/partners/${partnerId}`);
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao promover usuário.");
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => !promoteMut.isPending && onClose()}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-zinc-400 hover:text-white transition-colors"
                disabled={promoteMut.isPending}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              {selected ? "Configurar parceiro" : "Tornar usuário parceiro"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={promoteMut.isPending}
            className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {!selected ? (
            <>
              {/* Search */}
              <label className="text-xs text-zinc-400 block mb-2">
                Buscar usuário por nome ou e-mail
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ex.: João, joao@empresa.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
                />
              </div>

              {/* Hint / state */}
              {trimmed.length === 0 && (
                <p className="text-xs text-zinc-500 mt-3 text-center py-8">
                  Digite ao menos 2 caracteres para buscar.
                </p>
              )}
              {trimmed.length >= 2 && isSearching && (
                <div className="flex items-center justify-center py-8 text-zinc-500 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
                </div>
              )}
              {trimmed.length >= 2 &&
                !isSearching &&
                (searchResult?.users.length ?? 0) === 0 && (
                  <p className="text-xs text-zinc-500 mt-3 text-center py-8">
                    Nenhum usuário encontrado para
                    <span className="text-zinc-400"> &quot;{trimmed}&quot;</span>.
                  </p>
                )}

              {/* Results */}
              {searchResult && searchResult.users.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {searchResult.users.map((u) => {
                    const isActive = u.partnerStatus === "ACTIVE";
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(u)}
                          disabled={isActive}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-800/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-800 disabled:hover:bg-transparent"
                        >
                          <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                            {u.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={u.image}
                                alt={u.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[11px] text-zinc-300 font-semibold">
                                {u.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {u.email}
                            </p>
                          </div>
                          {u.alreadyPartner && (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                isActive
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {isActive ? "Já é parceiro" : "Reajustar nível"}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* Selected user summary */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/60 mb-5">
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {selected.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.image}
                      alt={selected.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-300 font-semibold">
                      {selected.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{selected.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {selected.email}
                  </p>
                </div>
                {selected.alreadyPartner && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shrink-0">
                    {selected.partnerStatus}
                  </span>
                )}
              </div>

              {/* Tier select */}
              <label className="text-xs text-zinc-400 block mb-2">
                Nível inicial
              </label>
              <div className="grid grid-cols-1 gap-1.5 mb-5">
                {TIERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTier(t.value)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      tier === t.value
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "border-zinc-800 hover:border-zinc-700 bg-transparent"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {t.label}
                      </p>
                      <p className="text-[11px] text-zinc-500">{t.range}</p>
                    </div>
                    {tier === t.value && (
                      <Check className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Activate now */}
              <label className="flex items-center gap-2 cursor-pointer mb-5 select-none">
                <input
                  type="checkbox"
                  checked={activate}
                  onChange={(e) => setActivate(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 accent-amber-500"
                />
                <span className="text-sm text-zinc-200">
                  Ativar imediatamente
                </span>
                <span className="text-[11px] text-zinc-500">
                  (libera acesso ao painel <code>/partner</code>)
                </span>
              </label>

              {/* Notes */}
              <label className="text-xs text-zinc-400 block mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Motivo da promoção, contexto, etc."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 resize-none"
              />

              <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Promoção manual seta{" "}
                  <code className="text-amber-300">manualTierOverride</code> —
                  recálculo automático só pode <strong>subir</strong> de nível;
                  nunca rebaixa este parceiro abaixo do nível definido aqui.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selected && (
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={promoteMut.isPending}
              className="text-xs text-zinc-400 hover:text-white px-3 py-2 transition-colors disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() =>
                promoteMut.mutate({
                  userId: selected.id,
                  initialTier: tier,
                  activate,
                  notes: notes.trim() || undefined,
                })
              }
              disabled={promoteMut.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {promoteMut.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {promoteMut.isPending ? "Promovendo..." : "Tornar parceiro"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
