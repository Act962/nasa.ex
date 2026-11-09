/**
 * Token do Facebook (`EAA...`) em vez do Instagram (`IGAA...`). É o que o app criado
 * com "API setup with Unified login" gera no passo a passo, e só funciona em graph.facebook.com.
 */
export function isFacebookGraphToken(accessToken: string): boolean {
  return accessToken.trim().startsWith("EAA");
}
