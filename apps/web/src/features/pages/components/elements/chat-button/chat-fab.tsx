/**
 * Botão flutuante (FAB) no canto inferior direito que abre/fecha o
 * popover do chat. Componente puramente visual: alterna entre o ícone de
 * balão e o "✕" conforme `open` e exibe a bolinha vermelha de não-lida.
 */

export function ChatFab({
  open,
  hasUnread,
  label,
  bg,
  fg,
  onToggle,
}: {
  open: boolean;
  hasUnread: boolean;
  label: string;
  bg: string;
  fg: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 relative"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        top: "auto",
        left: "auto",
        zIndex: 9999,
        width: "56px",
        height: "56px",
        background: bg,
        color: fg,
      }}
      aria-label={label}
    >
      {open ? (
        <span className="text-2xl">✕</span>
      ) : (
        <svg className="size-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
        </svg>
      )}
      {hasUnread && !open && (
        <span
          aria-label="Nova mensagem"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#ef4444",
            border: "2px solid #ffffff",
            boxShadow: "0 0 0 2px rgba(239,68,68,0.3)",
          }}
        />
      )}
    </button>
  );
}
