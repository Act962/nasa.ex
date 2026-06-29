"use client";

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#0a0a0a", color: "#fff" }}>
        <div style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "32px",
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>
            Algo deu errado!
          </h2>
          <p style={{ color: "#94a3b8", textAlign: "center", maxWidth: "400px", margin: 0, fontSize: "14px" }}>
            {error.message ?? "Ocorreu um erro inesperado."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 24px",
              borderRadius: "8px",
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
