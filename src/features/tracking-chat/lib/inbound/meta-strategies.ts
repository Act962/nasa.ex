/**
 * Strategies da Meta Cloud API pra `persistCanonicalInbound` (Fase 5).
 *
 * O pipeline canônico é provider-agnostic — quem mora aqui é a parte
 * Meta-específica do trajeto inbound:
 *
 *  - `buildMetaFetchProfilePicture` — a Meta Cloud API **não expõe** foto
 *    de contato (limitação documentada; só profile picture do business
 *    próprio). Por isso a strategy retorna `null` sempre. Lead segue
 *    sem avatar (best-effort, igual o Uazapi quando o `/chat/details`
 *    não tem foto). O `displayName` ainda vem via `contacts[].profile.
 *    name` no webhook → canonical sender.displayName.
 *
 *  - `buildMetaDownloadInboundMedia` — baixa o binário via
 *    `downloadInboundMedia` do `src/http/whats-oficial/get-media.ts`
 *    (resolve URL fresca via Graph + GET com Bearer). Sobe pro S3/R2
 *    do mesmo bucket que o Uazapi usa.
 *
 * Cada factory recebe o `accessToken` da instância Meta (decifrado a
 * partir de `WhatsAppInstance.metaAccessToken`) e devolve uma função
 * fechada sobre ele — pronta pra ser passada em
 * `PersistCanonicalInboundContext.fetchProfilePicture` /
 * `downloadInboundMedia`.
 *
 * Diferenças importantes vs. Uazapi:
 *  - Meta exige `Authorization: Bearer` no GET da URL de download (até
 *    no lookaside.fbsbx.com). O helper `downloadOfficialMedia` já cobre.
 *  - URL lookaside expira em ~5 min — sempre resolvemos via `mediaId`
 *    pra obter URL fresca, mesmo que o webhook tenha entregue uma.
 *  - Sem `generate_mp3` (Meta entrega áudio em `.ogg` opus; UI já toca).
 */
import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

import { downloadInboundMedia as downloadInboundMediaFromMeta } from "@/http/whats-oficial/get-media";
import { S3 } from "@/lib/s3-client";

import type {
  CanonicalInboundMedia,
  CanonicalInboundSender,
} from "../providers/types";
import type {
  FetchProfilePicture,
  DownloadInboundMedia,
  ProfilePictureUpload,
  InboundMediaUpload,
} from "./persist-canonical-inbound";
import { defaultMimetypeForKind, pickExtension } from "./media-helpers";

/**
 * Strategy fixa que devolve `null`: a Meta Cloud API não tem endpoint
 * público de foto de contato (só do business próprio). Mantida na
 * mesma forma de factory pra simetria com o Uazapi — caso a Meta
 * exponha isso no futuro, troca-se aqui sem mexer no pipeline.
 *
 * Parâmetros são ignorados (placeholder pra simetria/futuro); o
 * `_accessToken` é prefixado pra deixar claro que não é bug.
 */
export function buildMetaFetchProfilePicture(
  _accessToken: string,
): FetchProfilePicture {
  return async function metaFetchProfilePicture(
    _sender: CanonicalInboundSender,
  ): Promise<ProfilePictureUpload | null> {
    return null;
  };
}

/**
 * Strategy: baixa o binário de uma mensagem de mídia inbound via
 * `/{media_id}` (Graph API) + GET no lookaside da Meta, e sobe pro S3.
 *
 * O `downloadInboundMedia` do `src/http/whats-oficial/get-media.ts`
 * já encapsula `getOfficialMediaUrl` + `downloadOfficialMedia` (Bearer
 * obrigatório). Aqui só decidimos extensão/mimetype final e fazemos o
 * upload no mesmo bucket que o Uazapi.
 *
 * Falhas são best-effort: erro → `null` (pipeline persiste a `Message`
 * sem `mediaUrl` em vez de explodir o webhook inteiro).
 */
export function buildMetaDownloadInboundMedia(
  accessToken: string,
): DownloadInboundMedia {
  return async function metaDownloadInboundMedia(
    canonical: CanonicalInboundMedia,
  ): Promise<InboundMediaUpload | null> {
    try {
      // Meta usa `mediaId` (graph id). Se o normalizer não populou
      // (cenário não esperado), aborta — não dá pra fazer download sem ele.
      const mediaId = canonical.mediaId;
      if (!mediaId) {
        console.warn("[meta-strategies] missing_media_id", {
          externalMessageId: canonical.externalMessageId,
          kind: canonical.kind,
        });
        return null;
      }

      const downloaded = await downloadInboundMediaFromMeta(
        accessToken,
        mediaId,
      );
      if (!downloaded?.buffer || downloaded.buffer.length === 0) {
        return null;
      }

      // Resolve mimetype: prioridade Graph metadata > canônico > default.
      // O `downloadInboundMedia` já consolidou `metadata.mime_type ||
      // header content-type` em `downloaded.mimetype`.
      const mimetype =
        downloaded.mimetype ||
        canonical.mimetype ||
        defaultMimetypeForKind(canonical.kind);

      // A "URL" usada no pickExtension serve só pra documentos/stickers
      // tentarem casar pela extensão do path. A URL fresca da Meta é
      // lookaside criptográfico e não tem extensão útil — passamos
      // string vazia pra cair direto no fallback por mimetype/kind.
      const extension = pickExtension(canonical.kind, "", mimetype);
      const key = `${uuidv4()}.${extension}`;

      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: key,
          Body: downloaded.buffer,
          ContentType: mimetype,
        }),
      );

      return {
        key,
        mimetype,
        fileName: canonical.fileName ?? null,
      };
    } catch (error) {
      console.error("[meta-strategies] download_media_failed", error);
      return null;
    }
  };
}
