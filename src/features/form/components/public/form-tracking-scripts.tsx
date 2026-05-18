import Script from "next/script";
import { GoogleTagManager } from "@next/third-parties/google";
import type { FormSettings } from "@/generated/prisma/client";

const PIXEL_ID_REGEX = /^\d+$/;
const GTM_ID_REGEX = /^GTM-[A-Z0-9]+$/i;

type Props = {
  settings?: FormSettings | null;
};

// Carrega Facebook Pixel + Google Tag Manager por formulário. IDs vêm de
// FormSettings (id_pixel / id_tag_manager) e são validados por regex antes
// de irem para o DOM — sem regex bater, nada é renderizado. Isso fecha o
// vetor de XSS que existia ao interpolar o id direto no template do snippet.
export function FormTrackingScripts({ settings }: Props) {
  const rawPixel = settings?.idPixel?.trim();
  const rawGtm = settings?.idTagManager?.trim();

  const pixelId = rawPixel && PIXEL_ID_REGEX.test(rawPixel) ? rawPixel : null;
  const gtmId = rawGtm && GTM_ID_REGEX.test(rawGtm) ? rawGtm : null;

  if (!pixelId && !gtmId) return null;

  return (
    <>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      {pixelId && (
        <>
          <Script
            id={`fb-pixel-${pixelId}`}
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
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
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
