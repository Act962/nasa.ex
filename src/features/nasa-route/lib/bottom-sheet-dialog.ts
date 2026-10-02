/** Classes que transformam o Dialog em gaveta de baixo no celular (playbook dos Apps, seção 4). */

export const BOTTOM_SHEET_DIALOG_CLASS = [
  "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-[24px] p-0",
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
  "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
].join(" ");

export const BOTTOM_SHEET_HANDLE_CLASS = "mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden";

export const BOTTOM_SHEET_HEADER_CLASS = "shrink-0 px-4 pt-3 pb-3 text-left sm:px-6 sm:pt-5 sm:pb-4";

export const BOTTOM_SHEET_BODY_CLASS =
  "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6";

export const BOTTOM_SHEET_FOOTER_CLASS =
  "shrink-0 flex-col-reverse gap-2 border-t border-line bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:py-4";

export const BOTTOM_SHEET_ACTION_CLASS = "h-12 w-full rounded-full text-base sm:h-9 sm:w-auto sm:text-sm";
