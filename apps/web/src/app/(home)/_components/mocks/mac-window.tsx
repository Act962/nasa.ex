export function MacWindow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0a0715] shadow-2xl">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8 bg-[#110d20]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="flex-1 text-center text-[10px] text-white/30 truncate">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
