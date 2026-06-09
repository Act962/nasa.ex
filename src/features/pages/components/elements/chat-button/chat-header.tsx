/**
 * Header do popover (estilo /whatsapp/[slug]): avatar circular + nome +
 * status. O conteúdo é resolvido no hook e trocado dinamicamente entre
 * org (logo+nome) e atendente (foto+nome) ao primeiro respondê-lo. Mantém
 * a barra colorida `bg`/`fg` do element pra respeitar a customização do
 * dono da page. Componente puramente visual.
 */

export function ChatHeader({
  name,
  image,
  subtitle,
  bg,
  fg,
}: {
  name: string;
  image: string | null;
  subtitle: string;
  bg: string;
  fg: string;
}) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-3 border-b shrink-0"
      style={{ background: bg, color: fg }}
    >
      {image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt={name}
          className="size-10 rounded-full object-cover ring-2 ring-white/30 shrink-0"
        />
      ) : (
        <div className="size-10 rounded-full bg-white/25 flex items-center justify-center text-sm font-extrabold ring-2 ring-white/30 shrink-0">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate leading-tight">{name}</p>
        <p className="text-[11px] opacity-80 truncate flex items-center gap-1.5">
          <span
            className="inline-block size-1.5 rounded-full bg-emerald-400"
            aria-hidden
          />
          {subtitle}
        </p>
      </div>
    </div>
  );
}
