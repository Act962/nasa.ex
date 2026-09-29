/**
 * Abre o "Criar comando" de qualquer lugar da plataforma (spec 0029, RF-12).
 * O dialog é montado uma vez só, no escopo global; cada app só dispara o evento
 * com os exemplos da sua área.
 */
export const ASTRO_CREATE_COMMAND_EVENT = "astro:create-command";

export interface AstroCreateCommandDetail {
  examples?: string[];
  instruction?: string;
}

export function openCreateCommand(detail: AstroCreateCommandDetail = {}) {
  window.dispatchEvent(
    new CustomEvent<AstroCreateCommandDetail>(ASTRO_CREATE_COMMAND_EVENT, { detail }),
  );
}
