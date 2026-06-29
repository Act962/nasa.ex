"use client";

/**
 * ObjectLibrary — Painel direito do editor.
 * Exibe busca, categorias com itens, e zona de upload de imagem.
 *
 * Fluxo de upload:
 *   1. Usuário seleciona / arrasta um arquivo de imagem
 *   2. Abre ImageImportModal (preview + remover fundo + tamanho inicial)
 *   3. Ao confirmar → upload da imagem processada → insere no mapa
 */

import { useRef, useState } from "react";
import Image from "next/image";
import { Search, Upload, X, Check, ChevronDown, ChevronRight } from "lucide-react";
import { LIBRARY, searchLibrary, type LibraryItem } from "./categories";
import { ImageImportModal } from "./image-import-modal";

interface Props {
  onPick: (item: LibraryItem) => void;
  /** Chamado após upload de imagem personalizada confirmado no modal.
   *  Usado pelo MapEditor para trocar automaticamente para a aba "Selecionar". */
  onAfterCustomImport?: () => void;
}

const ALLOWED_MIME = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml|avif)$/;
const MAX_SIZE_MB   = 10;

export function ObjectLibrary({ onPick, onAfterCustomImport }: Props) {
  const [query,      setQuery]      = useState("");
  const [open,       setOpen]       = useState<Record<string, boolean>>({});
  const [customImgs, setCustomImgs] = useState<LibraryItem[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileError,  setFileError]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length > 0;
  const results = isSearching ? searchLibrary(query) : [];

  function toggle(catId: string) {
    setOpen(s => ({ ...s, [catId]: !s[catId] }));
  }

  /** Valida e abre o modal de importação */
  function openImportModal(file: File) {
    setFileError(null);
    if (!file.type.match(ALLOWED_MIME) && !file.name.endsWith(".svg")) {
      setFileError("Formato não suportado (PNG, JPG, GIF, WebP, SVG, AVIF).");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`Arquivo muito grande (máx ${MAX_SIZE_MB} MB).`);
      return;
    }
    setImportFile(file);
  }

  /** Chamado pelo modal ao confirmar; adiciona à galeria e insere no mapa */
  function handleImportConfirm(item: LibraryItem) {
    setCustomImgs(prev => [item, ...prev]);
    onPick(item);           // insere no mapa (pickItem → focus-object → handles)
    setImportFile(null);
    // Troca para a aba "Selecionar" para o inspector de escala aparecer
    onAfterCustomImport?.();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) openImportModal(file);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) openImportModal(f);
    // reset para permitir re-seleção do mesmo arquivo
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Adicionar objeto ao seu mapa
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Arraste um item para o mapa ou clique para colocar no centro.
          </p>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar objetos..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-800/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-800"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {isSearching ? (
            <SearchResults items={results} onPick={onPick} />
          ) : (
            <>
              {/* Uploads customizados (aparecem acima, se existem) */}
              {customImgs.length > 0 && (
                <div className="mb-2">
                  <CategoryHeader
                    label="Suas imagens"
                    count={customImgs.length}
                    open={open.custom ?? true}
                    onToggle={() => toggle("custom")}
                  />
                  {(open.custom ?? true) && (
                    <ItemGrid items={customImgs} onPick={onPick} />
                  )}
                </div>
              )}

              {LIBRARY.map((cat) => (
                <div key={cat.id}>
                  <CategoryHeader
                    label={cat.name}
                    icon={cat.icon}
                    count={cat.items.length}
                    open={open[cat.id] ?? false}
                    onToggle={() => toggle(cat.id)}
                  />
                  {open[cat.id] && (
                    <ItemGrid items={cat.items} onPick={onPick} />
                  )}
                </div>
              ))}

              {/* Upload drop zone */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <h3 className="text-sm font-semibold text-white mb-0.5">
                  Inserir imagem com remoção de fundo
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Envie uma foto ou logo. O fundo pode ser removido automaticamente.
                </p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-colors"
                >
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-xs text-slate-300">Clique ou arraste um arquivo</span>
                  <span className="text-[10px] text-slate-500">PNG · JPG · GIF · WebP · SVG</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif"
                  className="hidden"
                  onChange={onChange}
                />
                {fileError && (
                  <p className="text-xs text-rose-400 mt-2">{fileError}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de configuração de imagem (fora do scroll para não ser clipado) */}
      <ImageImportModal
        file={importFile}
        onClose={() => setImportFile(null)}
        onConfirm={handleImportConfirm}
      />
    </>
  );
}

/* ──────────────── sub-componentes ──────────────── */

function CategoryHeader({
  label, icon, count, open, onToggle,
}: { label: string; icon?: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-center gap-2">
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        }
        {icon && <span className="text-base leading-none">{icon}</span>}
        <span className="text-sm font-medium text-slate-200 group-hover:text-white">{label}</span>
      </div>
      <span className="text-[11px] text-slate-500 tabular-nums">{count}</span>
    </button>
  );
}

function ItemGrid({ items, onPick }: { items: LibraryItem[]; onPick: (it: LibraryItem) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-2 pb-2 pt-1">
      {items.map((it) => (
        <ItemCard key={it.id} item={it} onPick={onPick} />
      ))}
    </div>
  );
}

function SearchResults({ items, onPick }: { items: LibraryItem[]; onPick: (it: LibraryItem) => void }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-slate-500">
        <Search className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Nenhum objeto encontrado</p>
        <p className="text-xs text-slate-600 mt-1">Tente outro termo ou envie sua imagem</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => <ItemCard key={it.id} item={it} onPick={onPick} />)}
    </div>
  );
}

function ItemCard({ item, onPick }: { item: LibraryItem; onPick: (it: LibraryItem) => void }) {
  const [dragging, setDragging] = useState(false);
  const [added,    setAdded]    = useState(false);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    setDragging(true);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/x-map-object", JSON.stringify(item));
    e.dataTransfer.setData("text/plain", item.name);
  }

  function handleClick() {
    onPick(item);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 700);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onClick={handleClick}
      className={`group relative aspect-square rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
        dragging
          ? "border-indigo-500 opacity-50"
          : "border-white/10 bg-slate-800/40 hover:border-indigo-400/60 hover:bg-slate-800"
      }`}
      title={item.name}
    >
      <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
        <Image
          src={item.url}
          alt={item.name}
          width={64} height={64}
          unoptimized
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* hover label */}
      <div className="absolute bottom-0 inset-x-0 py-1 px-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-[9px] text-white truncate text-center">{item.name}</p>
      </div>

      {/* added check */}
      {added && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 animate-in fade-in zoom-in duration-200">
          <Check className="h-6 w-6 text-white" />
        </div>
      )}
    </div>
  );
}
