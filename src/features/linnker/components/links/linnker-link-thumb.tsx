import type { LinnkerLink } from "../../types";

/** Imagem ou emoji do link, como aparece no botão da página pública. */
export function LinnkerLinkThumb({ link }: { link: Pick<LinnkerLink, "imageUrl" | "emoji"> }) {
  if (link.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={link.imageUrl} alt="" className="size-10 shrink-0 rounded-full border border-line object-cover" />
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-lg" aria-hidden>
      {link.emoji ?? "🔗"}
    </span>
  );
}
