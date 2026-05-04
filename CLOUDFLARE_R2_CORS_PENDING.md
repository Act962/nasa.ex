# 🚨 PENDÊNCIA — Configurar CORS no bucket R2 `nasa-ex`

## Sintoma

Qualquer upload de imagem/vídeo via browser (editor de post no NASA Planner,
Linnker, anexos, vídeo do uploader genérico, etc.) falha com:

```
TypeError: Failed to fetch
```

Avatar do usuário **passa** porque é gravado como `data:image/jpeg;base64,...`
direto no banco — não passa pelo R2.

## Diagnóstico (já confirmado)

Curl OPTIONS direto no endpoint do bucket:

```
curl -i -X OPTIONS \
  "https://nasa-ex.<account-id>.r2.cloudflarestorage.com/<arquivo>?<params>" \
  -H "Origin: https://localhost:3000" \
  -H "Access-Control-Request-Method: PUT"
```

Resposta:

```
HTTP/1.1 403 Forbidden
<Code>Unauthorized</Code>
<Message>CORS not configured for this bucket</Message>
```

**Importante**: o bucket aceita PUT em si (testei curl PUT direto sem preflight
e retornou 200 OK). Falta apenas a regra CORS para o navegador conseguir
fazer o preflight (OPTIONS) antes do PUT.

## Como corrigir (NO PAINEL DA CLOUDFLARE)

> Tem que ser feito por quem tem acesso ao painel da Cloudflare. Não há nada
> no código pra ajustar — é config de infra.

1. Acesse `dash.cloudflare.com` → conta da NASA → **R2**.
2. Bucket **`nasa-ex`** → aba **Settings** → role até **CORS Policy**.
3. **Add CORS policy** e cole:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://localhost:3000",
      "https://<dominio-de-producao>"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Substitua `<dominio-de-producao>` pelo domínio real onde o app está hospedado.

4. Salvar. Em ~30s a regra propaga.

## Como verificar que ficou OK

Rodar de novo o curl OPTIONS — deve responder **200** ou **204** com header
`Access-Control-Allow-Origin: https://<seu-origin>`.

Depois, subir uma imagem real pelo editor de post no NASA Planner — deve
funcionar sem "failed to fetch".

## Onde no código isso é consumido

Toda chamada que pega URL presigned em `/api/s3/upload` e faz PUT direto no R2:

- `src/features/nasa-planner/components/post-media-uploader.tsx`
- `src/features/nasa-planner/components/video-uploader/video-uploader.tsx`
- `src/features/nasa-planner/components/video-editor/video-editor-dialog.tsx`
- `src/features/nasa-planner/components/image-editor/image-editor-dialog.tsx`
- `src/features/settings/components/avatar-uploader.tsx` (atualmente usando base64 inline)
- `src/features/linnker/components/linnker-image-uploader.tsx`
- `src/features/space-station/components/world/lpc-avatar-editor.tsx`
- `src/features/admin/components/space-help/feature-steps-editor.tsx`
- `src/features/admin/components/popup-templates-manager.tsx`
- `src/features/admin/components/assets/assets-manager.tsx`
- `src/features/nasa-route/components/creator/plan-attachments-list.tsx`
- `src/features/actions/components/chat/chat-footer.tsx`
- `src/features/nbox/components/nbox-app.tsx`
- `src/components/file-uploader/uploader.tsx`

Configurar CORS uma vez destrava todos eles.
