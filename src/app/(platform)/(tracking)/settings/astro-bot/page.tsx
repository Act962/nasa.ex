import { redirect } from "next/navigation";

/** A configuração do WhatsApp agora é uma aba do App ASTRO (spec 0023). */
export default function AstroBotSettingsRedirect() {
  redirect("/astro?aba=whatsapp");
}
