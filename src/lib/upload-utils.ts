/**
 * Tipos de imagem permitidos para upload nos templates de popup.
 * Fácil de estender no futuro adicionando: "image/png", "image/jpeg", "image/webp"
 */
export const ALLOWED_IMAGE_TYPES = ["image/svg+xml"];

/**
 * Retorna true se o tipo do arquivo estiver na lista de permitidos.
 */
export function isAllowedImageType(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

/**
 * Retorna a string para o atributo 'accept' do input de arquivo.
 */
export const ACCEPT_IMAGE_TYPES = ALLOWED_IMAGE_TYPES.join(",");
