---
id: 0136
titulo: IA anexa mídia ao post por link, sem precisar subir o arquivo
dominio: external-ai
status: em-revisao
autor: João Gabriel
criada: 2026-11-10
atualizada: 2026-11-10
branch: claude/mcp-attach-media-from-url
pr:
peso: completa
---

# 0136 — IA anexa mídia ao post por link, sem precisar subir o arquivo

## 1. Contexto

Com a spec 0135, o ChatGPT conectou ao MCP e criou o post, mas **não conseguiu anexar a arte**. Teste real em 2026-11-10: o ambiente onde o ChatGPT roda código não tem internet, então o `PUT` no link assinado do `request_upload_url` falha com `curl: (6) Could not resolve host`. O mesmo vale para o claude.ai e para o chat do Claude Desktop. Só as IAs que rodam no computador da pessoa (Claude Code, Codex, Cursor) conseguem enviar.

Há um segundo problema, mais antigo: o `attach_media` aceita qualquer `https` e **guarda o link de outro site como está**. Se esse site apagar o arquivo, ou se o link for temporário (o do ChatGPT é), o post fica sem mídia na hora de publicar.

## 2. Objetivo

Qualquer IA conectada anexa imagem ou vídeo passando um link (ou, no ChatGPT, o próprio arquivo gerado na conversa). O ÓRBITA baixa o arquivo com travas de segurança, guarda uma cópia no R2 da empresa e anexa a cópia.

### Não-objetivos

- Não muda o caminho do `request_upload_url` + `PUT`, que continua para as IAs locais.
- Não gera imagem nem converte SVG ou HTML em imagem.
- Não reprocessa a imagem (redimensionar, tirar metadados): ela é guardada como chegou, depois de conferida.
- Não aceita arquivo em base64 no argumento da ferramenta, porque a IA teria de escrever megabytes de texto.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O `attach_media` aceita `mediaUrl` (link `https`) **ou** `file` (o arquivo que o ChatGPT entrega, com `download_url`). Pelo menos um dos dois é obrigatório. |
| RF-2 | Link do próprio armazenamento do ÓRBITA (o `publicUrl` do `request_upload_url`) é anexado como antes, sem baixar. |
| RF-3 | Qualquer outro link é **baixado pelo servidor** e guardado em `external-ai/<organizationId>/<uuid>.<ext>` no R2. O post recebe o link da cópia, nunca o original. |
| RF-4 | O `attach_media` declara `_meta["openai/fileParams"] = ["file"]`, para o ChatGPT mandar a imagem gerada na conversa como arquivo. |
| RF-5 | O tipo vale pelo conteúdo: JPG, PNG, WebP (imagem) ou MP4/MOV (vídeo), conferido pelos primeiros bytes. O `kind` pedido tem de bater com o que chegou. SVG, HTML e qualquer outro tipo são recusados. |
| RF-6 | Erros voltam para a IA em português e dizem o que fazer (ex.: "o link precisa ser público e https", "a imagem passou de 15 MB"). |

### Não-funcionais (segurança)

| ID | Requisito |
| --- | --- |
| RNF-1 | Só `https`, porta 443, nome de domínio (nunca IP), sem usuário e senha, sem domínio local (`.local`, `.internal`…). Usa `parsePublicSiteUrl`. |
| RNF-2 | Todos os IPs do domínio têm de ser públicos (sem rede privada, loopback, link-local, metadados da nuvem). A conexão usa **exatamente** o IP conferido, para o DNS não trocar o endereço no meio. |
| RNF-3 | No máximo 3 redirecionamentos, cada um conferido de novo como um link novo. |
| RNF-4 | Limite por tipo: imagem 15 MB, vídeo 100 MB, cortados durante o download (não depois). O tempo máximo é de 20 s para imagem e 90 s para vídeo. |
| RNF-5 | O vídeo vai direto do download para o R2 em partes, sem ficar inteiro na memória. |
| RNF-6 | No máximo 30 downloads por hora por pessoa. |
| RNF-7 | O pedido de saída não leva nada da empresa, da pessoa ou da plataforma. |
| RNF-8 | O arquivo é gravado com o `Content-Type` do tipo conferido, nunca o que o outro site declarou. |

## 4. Critérios de aceite

- [x] **CA-1** — Link de imagem pública em https: a imagem é copiada para o R2 e o post fica com o link da cópia.
- [x] **CA-2** — `publicUrl` do próprio armazenamento: é anexado sem baixar, como antes.
- [x] **CA-3** — `http://`, IP literal, `localhost`, `*.internal` ou porta diferente de 443: recusado sem conexão.
- [x] **CA-4** — Domínio que resolve para IP privado (ex.: `127.0.0.1.nip.io`): recusado.
- [x] **CA-5** — Redirecionamento de um site público para um endereço interno: recusado no salto.
- [x] **CA-6** — Arquivo que diz ser `.png` mas é HTML: recusado. O R2 não recebe nada.
- [x] **CA-7** — Imagem acima de 15 MB: download cortado e erro claro.
- [x] **CA-8** — `kind: "video"` com uma imagem: recusado.
- [x] **CA-9** — Ferramenta chamada com `file.download_url` no formato do ChatGPT: anexa como no CA-1.
- [ ] **CA-10** — 31º download na mesma hora pela mesma pessoa: recusado com o tempo de espera.
- [ ] **CA-11** — Verificação manual: o ChatGPT gera a arte na conversa e ela aparece anexada no post.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | `download_url` do ChatGPT vence antes do download | Erro "link expirou, gere de novo"; nada é gravado. |
| CB-2 | Site responde `200` com `Content-Type` de imagem, mas o corpo é outro tipo | Recusado pelo conteúdo (RF-5). |
| CB-3 | Download cai no meio do vídeo | O envio ao R2 é abortado (as partes multipart são canceladas) e nada é anexado. |
| CB-4 | A mesma IA chama duas vezes com o mesmo link | Duas cópias e, no carrossel, dois cards. É o que acontece hoje com o `PUT`; a IA é instruída a chamar uma vez. |
| CB-5 | Post deixou de ser rascunho entre o pedido e o fim do download | A conferência do post é feita antes e de novo antes de gravar no banco; se mudou, a cópia fica órfã no R2 (custo desprezível) e a IA recebe o erro. |
| CB-6 | Link com espaço, acento ou query longa | Aceito, desde que passe pelo RNF-1. |
| CB-7 | Site lento que manda 1 byte por segundo | Cortado pelo tempo máximo (RNF-4). |

## 6. Decisões de design

### D-1 — Qualquer site público, protegido por IP, em vez de uma lista fechada de domínios

- **Escolha**: aceitar qualquer site `https` público, com as travas de rede (RNF-1 a RNF-3), de tamanho, de tipo e de uso.
- **Alternativa descartada**: lista fechada (só os domínios de arquivos da OpenAI e da Anthropic). Ela bloquearia o uso pelo Claude e por outras IAs, que costumam passar links de bancos de imagem ou do próprio site do cliente, e quebraria sem aviso quando a OpenAI trocasse o domínio dos arquivos. O que a lista protegeria, que é a rede interna, as travas por IP já protegem.
- **Consequência**: o ÓRBITA faz pedidos de saída para sites escolhidos pela IA. O limite de uso (RNF-6) e o tamanho máximo impedem que isso vire um depósito de arquivos ou um gerador de tráfego.

### D-2 — Copiar sempre, em vez de guardar o link de fora

- **Escolha**: todo link de fora vira cópia no R2 (RF-3). Isso também corrige o comportamento antigo do `attach_media`.
- **Consequência**: o post não depende mais de um site de terceiros nem de link temporário. Custo de armazenamento: o mesmo de um envio pelo `PUT`.

### D-3 — Reaproveitar as travas do leitor de sites

- **Escolha**: `parsePublicSiteUrl`, `resolvePublicAddress` e a conexão presa ao IP (spec 0088) saem de `tracking-chat-ai/lib/site-reader/` para `src/lib/safe-public-url.ts`, que vira infraestrutura global, e as duas features passam a usar o mesmo código. O download de arquivo é um irmão do `fetchPublicPage`, com limites de bytes e sem exigir `text/html`.
- **Alternativa descartada**: copiar o código. Seria a segunda versão de uma proteção de segurança, e uma correção feita numa não chegaria à outra.

### D-4 — Sem reprocessar a imagem

- **Escolha**: guardar como chegou, depois de conferir os primeiros bytes. O `sharp` não é dependência direta do projeto, e a Meta reprocessa tudo na publicação.
- **Consequência**: os metadados da imagem (EXIF) ficam no arquivo. Para imagem gerada por IA, isso não é sensível.

## 7. Impacto

- [ ] Schema / migration: nenhum.
- [ ] Inngest: nenhum. O download roda na própria chamada, porque a IA espera o resultado.
- [ ] Env vars: nenhuma.
- [x] **Contrato do MCP**: `attach_media` ganha `file` e `mediaUrl` vira opcional. É compatível: quem já manda `mediaUrl` continua funcionando.
- [x] **Mudança de comportamento**: link de fora passa a ser copiado (D-2).
- [x] **Arquivos**: `src/lib/safe-public-url.ts` (movido), `src/features/external-ai/server/remote-media.ts` (download e cópia) e `planner-mcp-tools.ts`. A skill `orbita-planner` e as instruções do servidor ganham uma linha sobre anexar por link.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-9 | script contra o dev local | Chamar `attach_media` com um link público real, com o `publicUrl` do ÓRBITA e com `file.download_url`. Conferir o `thumbnail` do post e o objeto no R2. |
| CA-3 a CA-8, CA-10 | script | Cada caso de recusa, conferindo a mensagem e que nada foi gravado. |
| CA-11 | manual | ChatGPT de verdade, por túnel. |

## 9. Riscos e rollback

- **Pedido de saída para sites escolhidos pela IA** é o risco principal, coberto pelas travas de rede. A proteção é a mesma já em produção no leitor de sites (spec 0088).
- **Memória**: imagem até 15 MB em memória por chamada; o vídeo vai em partes.
- **Rollback**: reverter o PR. Não há schema. As cópias que ficarem no R2 são inofensivas.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-10 | João Gabriel (com Claude) | Criada, a partir do teste real do ChatGPT na spec 0135. A lista fechada de domínios, proposta na conversa, foi trocada por travas de rede (D-1) para servir também ao Claude e a outras IAs. |
| 2026-11-10 | João Gabriel (com Claude) | Verificação local (dev na 3001, upload local da spec 0066 no lugar do R2): CA-1 a CA-9 passaram. O redirecionamento de um site público (postman-echo) para `127.0.0.1.nip.io` foi barrado no salto, e uma imagem de 690 MB foi cortada em 15 MB em 1 s, sem deixar arquivo. O `tools/list` anuncia `openai/fileParams: ["file"]`. Faltam CA-10 (limite de uso, mesmo `takeRateLimit` do trafeGO), o envio em partes ao R2 de verdade (só em homologação) e CA-11 (ChatGPT real). |
