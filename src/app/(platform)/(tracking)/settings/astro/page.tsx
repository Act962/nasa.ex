import { redirect } from "next/navigation";

/**
 * O ASTRO deixou de ser uma configuração e virou app próprio (spec 0023).
 * Mantido como redirect: link antigo e favorito continuam funcionando.
 */
export default function AstroSettingsRedirect() {
  redirect("/astro?aba=permissoes");
}
