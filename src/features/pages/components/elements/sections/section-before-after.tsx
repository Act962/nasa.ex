/**
 * Section Before/After — duas colunas "onde você está" × "onde vai estar", com lista de itens em cada.
 * No celular as colunas empilham.
 */
import { Check, X } from "lucide-react";
import { bgColor, fgColor, mutedColor, primaryColor, type SectionRendererProps } from "./types";
import { renderHighlightedText } from "./highlight-text";

function isFilledLine(itemText: string): boolean {
  return itemText.trim().length > 0;
}

export function SectionBeforeAfter({ element, tokens }: SectionRendererProps) {
  const eyebrow = (element.eyebrow as string | undefined) ?? "";
  const heading = (element.heading as string | undefined) ?? "";
  const subheading = (element.subheading as string | undefined) ?? "";
  const beforeEyebrow = (element.beforeEyebrow as string | undefined) ?? "";
  const beforeTitle = (element.beforeTitle as string | undefined) ?? "";
  const beforeItems = ((element.beforeItems as string[] | undefined) ?? []).filter(isFilledLine);
  const afterEyebrow = (element.afterEyebrow as string | undefined) ?? "";
  const afterTitle = (element.afterTitle as string | undefined) ?? "";
  const afterItems = ((element.afterItems as string[] | undefined) ?? []).filter(isFilledLine);
  const anchorId = (element.anchorId as string | undefined) || undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      id={anchorId}
      className="w-full scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      style={{ background: bg, color: fg }}
    >
      <div className="mx-auto max-w-5xl">
        {(eyebrow || heading || subheading) && (
          <div data-cascade-item className="mx-auto mb-10 max-w-3xl text-center">
            {eyebrow && (
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: primary }}>
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="text-2xl leading-tight font-bold sm:text-4xl">
                {renderHighlightedText(heading, element, primary)}
              </h2>
            )}
            {subheading && (
              <p className="mt-4 text-sm leading-relaxed sm:text-base" style={{ color: muted }}>
                {subheading}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div data-cascade-item className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: `${fg}1a`, background: `${fg}08` }}>
            {beforeEyebrow && (
              <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: muted }}>
                {beforeEyebrow}
              </p>
            )}
            {beforeTitle && <h3 className="mb-5 text-lg font-bold sm:text-xl">{beforeTitle}</h3>}
            <ul className="flex flex-col gap-3.5">
              {beforeItems.map((itemText, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: muted }}>
                  <X className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                  <span>{itemText}</span>
                </li>
              ))}
            </ul>
          </div>

          <div data-cascade-item className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: `${primary}66`, background: `${primary}14` }}>
            {afterEyebrow && (
              <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: primary }}>
                {afterEyebrow}
              </p>
            )}
            {afterTitle && <h3 className="mb-5 text-lg font-bold sm:text-xl">{afterTitle}</h3>}
            <ul className="flex flex-col gap-3.5">
              {afterItems.map((itemText, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: primary }} aria-hidden />
                  <span>{itemText}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
