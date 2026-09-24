import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// A raiz deixou de servir a landing: quem chega em "/" vai direto para o
// login, e quem já tem sessão vai para o app. A landing continua montada em
// `_components/landing-page.tsx` caso volte a ter uma rota própria.
export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  redirect(session ? "/home" : "/sign-in");
}
