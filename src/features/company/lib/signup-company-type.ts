import { COMPANY_TYPE_SLUGS } from "../constants";

// Tipo de empresa escolhido no cadastro: a empresa só nasce na tela seguinte, então a escolha viaja num cookie.
const SIGNUP_COMPANY_TYPE_COOKIE = "nasa_signup_company_type";
const SIGNUP_COMPANY_TYPE_MAX_AGE_SECONDS = 60 * 60 * 24;

export function saveSignupCompanyType(companyType: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SIGNUP_COMPANY_TYPE_COOKIE}=${encodeURIComponent(companyType)}; Max-Age=${SIGNUP_COMPANY_TYPE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
}

export function readSignupCompanyType(): string | null {
  if (typeof document === "undefined") return null;
  const cookieEntry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${SIGNUP_COMPANY_TYPE_COOKIE}=`));
  const companyType = cookieEntry ? decodeURIComponent(cookieEntry.split("=")[1] ?? "") : "";
  return COMPANY_TYPE_SLUGS.includes(companyType) ? companyType : null;
}

export function clearSignupCompanyType(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SIGNUP_COMPANY_TYPE_COOKIE}=; Max-Age=0; path=/`;
}
