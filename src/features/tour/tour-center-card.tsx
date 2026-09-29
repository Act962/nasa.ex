"use client";

import { TOUR_ACCENT } from "./spotlight";

export interface CenterCardAction {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
}

/** Cartão no meio da tela: fim do guia ou item que não apareceu (spec 0046, CA-4/CA-5). */
export function TourCenterCard({ title, message, actions }: {
  title: string;
  message: string;
  actions: CenterCardAction[];
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        pointerEvents: "auto",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "rgba(10,4,40,0.97)",
          border: `1.5px solid ${TOUR_ACCENT}66`,
          borderRadius: 20,
          padding: "22px 22px 18px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          animation: "tourBubbleIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 16 }}>{message}</p>
        <div style={{ display: "flex", gap: 8 }}>
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: action.isPrimary ? "none" : "1px solid rgba(255,255,255,0.12)",
                background: action.isPrimary
                  ? `linear-gradient(135deg, ${TOUR_ACCENT}, #a855f7)`
                  : "rgba(255,255,255,0.08)",
                color: action.isPrimary ? "#fff" : "rgba(255,255,255,0.75)",
              }}
              className="hover:brightness-110 transition-all"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
