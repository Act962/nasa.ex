"use client";

// Icons A: CommentsIcon, NerpIcon, CosmicIcon, NasaChatIcon,
//          SpaceTimeIcon, PaymentIcon, ForgeIcon, LinnkerIcon, BoostIcon, StarsIcon

const S = "w-full h-full";

export const CommentsIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path d="M10 14C10 11.8 11.8 10 14 10H34C36.2 10 38 11.8 38 14V28C38 30.2 36.2 32 34 32H27L20 38V32H14C11.8 32 10 30.2 10 28V14Z" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" />
    <text x="24" y="26" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="monospace">@@</text>
  </svg>
);

export const NerpIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#0F0F0F" stroke="#7C3AED" strokeWidth="1.5" />
    <text x="24" y="31" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="Arial, sans-serif">N</text>
    <rect x="9" y="9" width="30" height="22" rx="3" fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.3" />
    <line x1="13" y1="35" x2="35" y2="35" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
    <line x1="19" y1="38" x2="29" y2="38" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3" />
  </svg>
);

export const CosmicIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <circle cx="24" cy="24" r="8" stroke="white" strokeWidth="2" />
    <ellipse cx="24" cy="24" rx="18" ry="7" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
    <circle cx="24" cy="24" r="3" fill="white" />
    <circle cx="39" cy="20" r="2" fill="white" fillOpacity="0.7" />
  </svg>
);

export const NasaChatIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path d="M9 13C9 10.8 10.8 9 13 9H35C37.2 9 39 10.8 39 13V29C39 31.2 37.2 33 35 33H26L19 39V33H13C10.8 33 9 31.2 9 29V13Z" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5" />
    <text x="24" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Arial, sans-serif">N</text>
  </svg>
);

export const SpaceTimeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <rect x="10" y="14" width="28" height="24" rx="3" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.1" />
    <line x1="10" y1="21" x2="38" y2="21" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
    <line x1="17" y1="10" x2="17" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <line x1="31" y1="10" x2="31" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <text x="24" y="34" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">A</text>
  </svg>
);

export const PaymentIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#1E90FF" />
    <rect x="8" y="15" width="32" height="22" rx="4" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.1" />
    <line x1="8" y1="21" x2="40" y2="21" stroke="white" strokeWidth="1.5" />
    <rect x="12" y="27" width="8" height="4" rx="1" fill="white" fillOpacity="0.7" />
    <rect x="24" y="27" width="4" height="4" rx="1" fill="white" fillOpacity="0.5" />
    <rect x="30" y="27" width="4" height="4" rx="1" fill="white" fillOpacity="0.5" />
    <circle cx="35" cy="10" r="5" fill="#00FF87" />
    <text x="35" y="13" textAnchor="middle" fill="#0A0E27" fontSize="7" fontWeight="900" fontFamily="Arial">$</text>
  </svg>
);

export const ForgeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path d="M24 8C24 8 30 16 30 22C30 25.3 27.3 28 24 28C20.7 28 18 25.3 18 22C18 16 24 8 24 8Z" fill="white" fillOpacity="0.9" />
    <path d="M20 22C20 22 21 18 24 16C24 16 22 21 25 24C25 24 23 24 22 23" fill="#7C3AED" />
    <path d="M16 30H32L30 40H18L16 30Z" fill="white" fillOpacity="0.7" />
    <line x1="20" y1="34" x2="28" y2="34" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="21" y1="37" x2="27" y2="37" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const LinnkerIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <circle cx="15" cy="24" r="6" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.1" />
    <circle cx="33" cy="24" r="6" stroke="white" strokeWidth="2" fill="white" fillOpacity="0.1" />
    <rect x="15" y="20" width="18" height="8" fill="#7C3AED" />
    <line x1="18" y1="24" x2="30" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="15" cy="24" r="3" fill="white" />
    <circle cx="33" cy="24" r="3" fill="white" />
  </svg>
);

export const BoostIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#0F0F0F" stroke="#7C3AED" strokeWidth="1.5" />
    <path d="M24 10L32 24H24V38L16 24H24V10Z" fill="white" />
    <path d="M24 10L32 24H24V38L16 24H24V10Z" fill="none" stroke="white" strokeWidth="0.5" />
  </svg>
);

export const StarsIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={S}>
    <rect width="48" height="48" rx="12" fill="#7C3AED" />
    <path d="M24 10L26.5 19H36L28.5 25L31 34L24 28L17 34L19.5 25L12 19H21.5L24 10Z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="3" fill="#7C3AED" />
  </svg>
);
