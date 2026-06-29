export function NasaPagesIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        <linearGradient id="pagesGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#pagesGrad)" />
      <rect
        x="12"
        y="14"
        width="40"
        height="28"
        rx="4"
        fill="#ffffff"
        opacity="0.95"
      />
      <rect x="16" y="18" width="16" height="3" rx="1.5" fill="#6366f1" />
      <rect x="16" y="24" width="24" height="2" rx="1" fill="#c7d2fe" />
      <rect x="16" y="28" width="20" height="2" rx="1" fill="#c7d2fe" />
      <rect x="16" y="34" width="10" height="5" rx="2.5" fill="#8b5cf6" />
      <rect
        x="12"
        y="46"
        width="40"
        height="6"
        rx="2"
        fill="#ffffff"
        opacity="0.4"
      />
    </svg>
  );
}
