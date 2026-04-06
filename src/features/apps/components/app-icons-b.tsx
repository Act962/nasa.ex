"use client";

// Icons B: DemandIcon, AstroIcon, TaskIcon, NBoxIcon, TrackingIcon, NasaPlannerIcon

const S = "w-full h-full";

export const DemandIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect x="10" y="10" width="12" height="12" rx="2" fill="white" fillOpacity="0.9" />
    <rect x="26" y="10" width="12" height="12" rx="2" fill="white" fillOpacity="0.5" />
    <rect x="10" y="26" width="12" height="12" rx="2" fill="white" fillOpacity="0.5" />
    <rect x="26" y="26" width="12" height="12" rx="2" fill="white" fillOpacity="0.9" />
    <text x="16" y="20" textAnchor="middle" fill="#7C3AED" fontSize="8" fontWeight="900" fontFamily="Arial">M</text>
  </svg>
);

export const AstroIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path d="M24 8L27 20L38 17L29 24L38 31L27 28L24 40L21 28L10 31L19 24L10 17L21 20L24 8Z" fill="white" fillOpacity="0.9" />
    <circle cx="24" cy="24" r="4" fill="#7C3AED" />
    <circle cx="24" cy="24" r="2" fill="white" />
  </svg>
);

export const TaskIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#0F0F0F" stroke="#7C3AED" strokeWidth="1.5" />
    <path d="M16 12L36 24L16 36V12Z" fill="white" />
    <line x1="10" y1="24" x2="16" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5" />
  </svg>
);

export const NBoxIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect x="10" y="18" width="28" height="20" rx="2" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" />
    <path d="M10 18L17 10H31L38 18" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="white" fillOpacity="0.1" />
    <line x1="24" y1="10" x2="24" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <text x="24" y="34" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="Arial, sans-serif">N</text>
  </svg>
);

export const TrackingIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect x="10" y="10" width="12" height="12" rx="1" fill="white" fillOpacity="0.9" />
    <rect x="12" y="12" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="14" y="14" width="4" height="4" fill="white" />
    <rect x="26" y="10" width="12" height="12" rx="1" fill="white" fillOpacity="0.9" />
    <rect x="28" y="12" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="30" y="14" width="4" height="4" fill="white" />
    <rect x="10" y="26" width="12" height="12" rx="1" fill="white" fillOpacity="0.9" />
    <rect x="12" y="28" width="8" height="8" rx="0.5" fill="#7C3AED" />
    <rect x="14" y="30" width="4" height="4" fill="white" />
    <rect x="26" y="26" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="32" y="26" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="26" y="32" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.8" />
    <rect x="32" y="32" width="4" height="4" rx="0.5" fill="white" fillOpacity="0.8" />
  </svg>
);

export const NasaPlannerIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <defs>
      <linearGradient id="npGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#npGrad)" />
    <path d="M10 38L22 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="22" cy="18" r="3" fill="white" />
    <path d="M30 10L31.2 13.8L35 15L31.2 16.2L30 20L28.8 16.2L25 15L28.8 13.8L30 10Z" fill="white" fillOpacity="0.9" />
    <path d="M38 22L38.8 24.4L41 25L38.8 25.6L38 28L37.2 25.6L35 25L37.2 24.4L38 22Z" fill="white" fillOpacity="0.7" />
    <rect x="22" y="24" width="18" height="14" rx="2" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.2" />
    <circle cx="26" cy="29" r="2" fill="white" fillOpacity="0.8" />
    <path d="M22 34L27 30L31 33L34 30L40 34" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
