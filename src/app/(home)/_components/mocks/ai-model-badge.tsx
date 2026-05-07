export function AiModelBadge({
  name,
  color,
  letter,
}: {
  name: string;
  color: string;
  letter: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
        style={{ background: color }}
      >
        {letter}
      </div>
      <span className="text-white/60 text-xs font-medium">{name}</span>
    </div>
  );
}
