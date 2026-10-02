/** Dialog que vira gaveta de baixo no celular (playbook: formulário longo / edição). */
export const BOTTOM_SHEET_DIALOG_CLASS = [
  "max-h-[92dvh] overflow-y-auto sm:rounded-[24px]",
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
].join(" ");

/** Rodapé com a ação em botão largo no celular. */
export const BOTTOM_SHEET_FOOTER_CLASS =
  "max-sm:sticky max-sm:bottom-0 max-sm:-mx-6 max-sm:-mb-6 max-sm:bg-popover max-sm:px-6 max-sm:pt-3 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:[&>button]:h-12 max-sm:[&>button]:w-full max-sm:[&>button]:rounded-full";
