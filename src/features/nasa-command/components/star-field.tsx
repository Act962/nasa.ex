import { STARS } from "../data/constants";

export function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {STARS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r * 2,
            height: s.r * 2,
            opacity: s.o,
          }}
        />
      ))}
    </div>
  );
}
