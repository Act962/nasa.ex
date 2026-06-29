/**
 * Assinatura "Powered by NASA" — aparece SEMPRE no final de toda
 * página pública renderizada. Não é editável pelo user porque é parte
 * da identidade do produto (futuramente pode virar config "premium
 * remove watermark", mas por enquanto: sempre presente).
 *
 * Usa as mesmas logos da home (`/logo-dark.png` ou `/logo.png`) pra
 * coerência visual. Como o footer tem fundo escuro, usamos `logo-dark`
 * (versão branca do logo). Renderizado com `<img>` puro pra não
 * depender do `next/image` neste contexto público que pode rodar fora
 * do contexto Next quando exportado.
 */
export function PoweredByNasa() {
  return (
    <div
      style={{
        width: "100%",
        padding: "14px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.95)",
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        gap: 10,
      }}
    >
      <span style={{ opacity: 0.8 }}>Powered by</span>
      <a
        href="https://orbita.nasaex.com/"
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
        }}
        aria-label="N.A.S.A — Powered by NASA"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.png"
          alt="N.A.S.A"
          style={{ height: 22, width: "auto", display: "block" }}
        />
      </a>
    </div>
  );
}
