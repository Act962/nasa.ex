import { sendMedia } from "@/http/uazapi/send-media";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface Params {
  body: string;
  number: string;
  token: string;
  mediaUrl: string;
  baseUrl?: string;
}

export const sendImageRaw = async ({
  body,
  number,
  token,
  mediaUrl,
  baseUrl,
}: Params) => {
  return await sendMedia(
    token,
    {
      file: useConstructUrl(mediaUrl),
      text: body,
      number,
      delay: 2000,
      type: "image",
      readchat: true,
      readmessages: true,
    },
    baseUrl,
  );
};
