import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  APP_SIGNUP_COOKIE,
  APP_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  resolveAppLink,
} from "@/features/apps/lib/app-signup-link";

// Link próprio de cada app (spec 0042): logado abre o app; sem conta vai ao cadastro e
// o app fica guardado em cookie até a criação da empresa (sobrevive ao login Google).
export async function GET(request: NextRequest, { params }: { params: Promise<{ appKey: string }> }) {
  const { appKey } = await params;
  const appLink = resolveAppLink(appKey);
  const session = await auth.api.getSession({ headers: request.headers });

  if (session) {
    return NextResponse.redirect(new URL(appLink?.url ?? "/apps", request.url));
  }

  const response = NextResponse.redirect(new URL("/sign-up", request.url));
  if (appLink) {
    response.cookies.set({
      name: APP_SIGNUP_COOKIE,
      value: appKey,
      // Lido no navegador ao criar a empresa: não pode ser httpOnly (não é segredo).
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: APP_SIGNUP_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
  }
  return response;
}
