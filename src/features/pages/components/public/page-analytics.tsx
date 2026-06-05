"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * PageAnalytics — injeta scripts de tracking (Meta Pixel, Google
 * Analytics 4 / Google Ads, GTM) no contexto da landing pública.
 *
 * Por que `next/script` em vez de `<script>` plain? Pra controlar
 * `strategy` (afterInteractive evita bloquear render inicial) e
 * pra que o Next dedupe quando múltiplos scripts iguais entram.
 *
 * UTM merge: lê `window.location.search` e mescla com defaults da
 * page (passados via `defaults`). Os valores resultantes ficam em
 * `sessionStorage` pra que forms embedded/leads possam ler depois.
 */
export function PageAnalytics({
  meta,
}: {
  meta: {
    metaPixelId?: string;
    googleTagId?: string;
    gtmId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  };
}) {
  // Merge UTMs: URL > defaults da page > nada. Persiste em
  // sessionStorage como `nasa_page_utm` (JSON) — forms embedded e
  // o chat IA leem daí na hora de criar lead.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {
        utmSource: params.get("utm_source") || undefined,
        utmMedium: params.get("utm_medium") || undefined,
        utmCampaign: params.get("utm_campaign") || undefined,
        utmContent: params.get("utm_content") || undefined,
        utmTerm: params.get("utm_term") || undefined,
      };
      const merged = {
        utmSource: fromUrl.utmSource ?? meta.utmSource,
        utmMedium: fromUrl.utmMedium ?? meta.utmMedium,
        utmCampaign: fromUrl.utmCampaign ?? meta.utmCampaign,
        utmContent: fromUrl.utmContent ?? meta.utmContent,
        utmTerm: fromUrl.utmTerm ?? meta.utmTerm,
        referrer: document.referrer || undefined,
        landingPage: window.location.pathname + window.location.search,
      };
      sessionStorage.setItem("nasa_page_utm", JSON.stringify(merged));
    } catch {
      // sessionStorage pode estar bloqueado (incógnito strict, etc) —
      // não derruba a página.
    }
  }, [meta.utmSource, meta.utmMedium, meta.utmCampaign, meta.utmContent, meta.utmTerm]);

  return (
    <>
      {meta.metaPixelId && (
        <>
          <Script
            id="nasa-meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${meta.metaPixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${meta.metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {meta.googleTagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${meta.googleTagId}`}
            strategy="afterInteractive"
          />
          <Script
            id="nasa-gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${meta.googleTagId}');
              `,
            }}
          />
        </>
      )}

      {meta.gtmId && (
        <>
          <Script
            id="nasa-gtm"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${meta.gtmId}');
              `,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${meta.gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="GTM"
            />
          </noscript>
        </>
      )}
    </>
  );
}
