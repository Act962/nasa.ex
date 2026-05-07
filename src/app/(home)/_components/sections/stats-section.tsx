export function StatsSection() {
  const stats = [
    { value: "2.300+", label: "Empresas ativas", icon: "🏢" },
    { value: "847k+", label: "Leads capturados", icon: "🎯" },
    { value: "89%", label: "Mais conversões", icon: "📈" },
    { value: "200+", label: "Integrações", icon: "⚡" },
  ];
  return (
    <section className="py-14 px-4 border-y border-white/5 nasa-glass">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="text-center"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-3xl md:text-4xl font-black text-white mb-1">
              {s.value}
            </div>
            <div className="text-sm text-white/35">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
