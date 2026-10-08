/** Endereço e download das mídias de post guardadas no bucket. */

const BUCKET_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;

export function getPlannerMediaUrl(mediaKey: string) {
  return mediaKey.startsWith("http") ? mediaKey : `https://${BUCKET_HOST}/${mediaKey}`;
}

/** Caminho inverso de `getPlannerMediaUrl`; `undefined` quando o endereço não é do bucket. */
export function extractPlannerMediaKey(mediaUrl: string): string | undefined {
  return mediaUrl.split(`${BUCKET_HOST}/`)[1];
}

function triggerDownload(href: string, filename: string, opensInNewTab = false) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  if (opensInNewTab) anchor.target = "_blank";
  anchor.click();
}

export function downloadFromUrl(mediaUrl: string, filename: string) {
  triggerDownload(mediaUrl, filename, true);
}

/** Baixa sempre como PNG: reencoda no canvas e, se o navegador recusar, cai no download direto. */
export async function downloadPlannerImageAsPng(mediaKey: string, title?: string) {
  const mediaUrl = getPlannerMediaUrl(mediaKey);
  const filename = `${title ?? "post"}.png`;
  try {
    const response = await fetch(mediaUrl);
    const imageBitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    canvas.getContext("2d")!.drawImage(imageBitmap, 0, 0);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const objectUrl = URL.createObjectURL(pngBlob);
      triggerDownload(objectUrl, filename);
      URL.revokeObjectURL(objectUrl);
    }, "image/png");
  } catch {
    downloadFromUrl(mediaUrl, filename);
  }
}
