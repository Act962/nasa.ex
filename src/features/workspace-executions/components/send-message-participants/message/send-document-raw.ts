import { sendMedia } from "@/http/uazapi/send-media";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface Params {
  body: string;
  number: string;
  token: string;
  mediaUrl: string;
  fileName: string;
  baseUrl?: string;
}

export const sendDocumentRaw = async ({
  body,
  number,
  token,
  mediaUrl,
  fileName,
  baseUrl,
}: Params) => {
  return await sendMedia(
    token,
    {
      file: useConstructUrl(mediaUrl),
      text: body,
      docName: fileName,
      number,
      delay: 2000,
      type: "document",
      readchat: true,
      readmessages: true,
    },
    baseUrl,
  );
};
