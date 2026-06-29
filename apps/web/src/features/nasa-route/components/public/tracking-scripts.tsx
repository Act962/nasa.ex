"use client";

import Script from "next/script";

/**
 * Injeta scripts de tracking (Facebook Pixel + Google Tag Manager) na
 * página pública do curso. Dispara `PageView` automático em ambos —
 * eventos de compra são chamados via `window.fbq("track", "Purchase")`
 * e `window.dataLayer.push({...})` em outros pontos do app
 * (ex: enrollment-modal após mutate de compra).
 *
 * Os IDs são públicos por design — não há informação sensível em
 * Pixel ID ou GTM Container ID; aparecem no HTML de qualquer site
 * que use Facebook/Google Tag Manager.
 *
 * `next/script` com `strategy="afterInteractive"` carrega depois do
 * hydration pra não atrasar o LCP.
 */
interface Props {
  pixelId?: string | null;
  gtmId?: string | null;
}

export function TrackingScripts({ pixelId, gtmId }: Props) {
  return (
    <>
      {/* ── Facebook Pixel ──────────────────────────────────── */}
      {pixelId && (
        <>
          <Script id="fb-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* ── Google Tag Manager ─────────────────────────────── */}
      {gtmId && (
        <>
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="gtm"
            />
          </noscript>
        </>
      )}
    </>
  );
}
