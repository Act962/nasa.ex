import { sendText } from "@/http/uazapi/send-text";

interface Params {
  body: string;
  number: string;
  token: string;
  baseUrl?: string;
}

export const sendTextRaw = async ({ body, number, token, baseUrl }: Params) => {
  return await sendText(
    token,
    {
      text: body,
      number,
      delay: 2000,
    },
    baseUrl,
  );
};
