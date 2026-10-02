/** Classes que transformam um Dialog centralizado em gaveta de baixo no celular (<640px). */
export const DIALOG_AS_MOBILE_BOTTOM_SHEET_CLASSES = [
  "max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:translate-y-0",
  "max-sm:max-h-[92dvh] max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100",
  "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
].join(" ");

/** Gaveta de baixo do editor no celular: cantos de cima redondos e só o miolo rola. */
export const BUILDER_BOTTOM_SHEET_CLASSES = "flex h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-[26px] p-0";
