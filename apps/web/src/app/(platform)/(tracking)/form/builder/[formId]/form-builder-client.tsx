"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper client-side que carrega o FormBuilder com SSR desativado.
 *
 * Motivo: o @dnd-kit gera IDs sequenciais via counter interno
 * (`DndDescribedBy-N`). Em SSR o counter começa em 0, mas no client
 * já está em 4 (outros DndContexts da app montaram antes), causando
 * hydration mismatch em `aria-describedby`. Como o builder é uma
 * página privada admin sem requisito de SSR (não indexa Google, não
 * precisa de Time-to-First-Byte ótimo), skip-SSR é a solução mais
 * pragmática.
 */
const FormBuilder = dynamic(
  () =>
    import("@/features/form/components/build/form-builder").then((m) => ({
      default: m.FormBuilder,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export function FormBuilderClient({ formId }: { formId: string }) {
  return <FormBuilder formId={formId} />;
}
