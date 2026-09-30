import { Resend } from "resend";

// O Resend lança erro no construtor sem chave; o build da imagem roda sem segredos.
export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_build_placeholder");
