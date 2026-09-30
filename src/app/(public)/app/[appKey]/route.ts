import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  APP_SIGNUP_COOKIE,
  APP_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  resolveAppLink,
} from "@/features/apps/lib/app-signup-link";

// Link próprio de cada app (spec 0042): logado abre o app; sem conta vai ao cadastro e
// o app fica guardado em cookie até a criação da empresa (sobrevive ao login Google).

// Atrás do proxy de produção `request.url` é o endereço interno (localhost:3000): o destino
// sai do endereço público do app (`NEXT_PUBLIC_APP_URL`); sem ela, do host que o navegador usou.
function resolvePublicOrigin(request: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) return appUrl;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ appKey: string }> }) {
  const { appKey } = await params;
  const publicOrigin = resolvePublicOrigin(request);
  const appLink = resolveAppLink(appKey);
  const session = await auth.api.getSession({ headers: request.headers });

  if (session) {
    return NextResponse.redirect(new URL(appLink?.url ?? "/apps", publicOrigin));
  }

  const response = NextResponse.redirect(new URL("/sign-up", publicOrigin));
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
