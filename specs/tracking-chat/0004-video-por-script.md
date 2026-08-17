---
id: 0004
titulo: Envio de vídeo pelo chat via anexo em Script
dominio: tracking-chat
status: implementada
autor: João Gabriel
criada: 2026-08-17
atualizada: 2026-08-17
branch: feature/tracking-chat-ajustes-20260817
pr:
peso: completa
baseline: 0003
---

# 0004 — Envio de vídeo pelo chat via anexo em Script

> Baseline do domínio: [0003](0003-tracking-chat-baseline.md). Os invariantes
> citados aqui (`I-n`) e os casos de borda existentes (`CB-n`) vivem lá.

---

## 1. Contexto

O chat não envia vídeo hoje. Não por falta de pipeline — por medo de storage.

O levantamento mostrou que **quase tudo já existe** e falta um único elo:

| Peça | Estado |
| --- | --- |
| `POST /api/s3/upload-video` (streaming, 500MB, partes de 10MB) | ✅ existe, usado só pelo nasa-planner |
| `mediaKind: "video"` na PORT canônica | ✅ existe (`providers/types.ts:226`) |
| Adapter Uazapi mapeando `video → video` | ✅ existe (`uazapi/provider.ts:72`) |
| `inferUazapiMediaType` reconhecendo `video/*` | ✅ existe |
| Inbound de vídeo (`VideoMessage`) | ✅ já persiste |
| **Sender outbound emitindo `mediaKind: "video"`** | ❌ **não existe** |

Os 4 senders emitem apenas `audio`, `document`, `image` e `sticker`.
`create-with-file` manda tudo que não é imagem como `document` — um MP4 incluso.

O bloqueio prático é outro e menor do que parece: `MAX_SIZE = 5MB` hard-coded no
`Uploader` (`src/components/file-uploader/uploader.tsx:28`) e teto de 20MB no
presign `/api/s3/upload`. O composer usa esse Uploader, então um MP4 de 8MB
morre no dropzone antes de chegar em qualquer lógica de chat.

**O medo do storage é legítimo**, e é o que define o desenho: anexar o vídeo a um
`Script` faz o arquivo subir **uma vez** e ser reenviado N vezes por URL (a
Uazapi aceita `file` como URL em `POST /send/media`). Storage passa de
`O(envios)` para `O(vídeos cadastrados)`.

## 2. Objetivo

Um atendente consegue anexar um vídeo a um Script e enviá-lo pelo chat quantas
vezes quiser, com o vídeo ocupando espaço no storage **uma única vez**.

### Não-objetivos

- **Não** é upload de vídeo avulso pelo composer (o `+` → "Arquivo" segue sem
  vídeo). O vídeo só existe preso a um Script.
- **Não** é biblioteca/galeria de mídias reutilizável entre scripts — decidido
  para o futuro (ver D-1).
- **Não** cobra ★ por envio de vídeo nesta fase (ver P-1).
- **Não** implementa `ptv` (vídeo redondo) nem `videoplay` (autoplay/loop) da
  API Uazapi — não existem na union canônica (ver P-3).
- **Não** gera thumbnail própria — a Uazapi gera automaticamente (ver P-4).
- **Não** mexe no `Uploader` global nem nos limites de `/api/s3/upload`. Vídeo
  usa rota própria.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Um `Script` pode ter **no máximo um** vídeo anexado (relação 1:1, opcional) |
| RF-2 | O upload grava no bucket padrão sob o prefixo `videos/scripts/<uuid>.<ext>` |
| RF-3 | Ao usar um script com vídeo, o chat envia **uma única mensagem**: o vídeo com o texto do script como caption |
| RF-4 | Variáveis (`{{nome_cliente}}` etc.) são resolvidas no caption, igual ao fluxo de texto atual |
| RF-5 | Script sem vídeo mantém o comportamento atual: insere o texto no composer, sem enviar |
| RF-6 | Excluir um script apaga o objeto no R2 |
| RF-7 | Trocar o vídeo de um script existente apaga o objeto anterior |
| RF-8 | Só MP4 é aceito no upload (restrição da Uazapi: "vídeo: apenas MP4") |
| RF-9 | O vídeo enviado renderiza como player no chat, não como card de download |
| RF-10 | Vídeo acima de **16MB** é bloqueado no upload, com mensagem clara, para **qualquer** provider |
| RF-11 | Qualquer membro que já pode criar script pode anexar vídeo — sem papel adicional |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A URL entregue ao provider é absoluta e acessível publicamente pelo servidor da Uazapi — nunca relativa |
| RNF-2 | Upload não bloqueia a UI: progresso visível e o dialog do script permanece utilizável |
| RNF-3 | Teto de tamanho aplicado **no cliente e no servidor** (defesa em profundidade) |
| RNF-4 | Nenhuma key órfã: script sem vídeo salvo não deixa objeto no bucket (ver CB-9) |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um script novo com MP4 anexado, quando salvo, então o objeto existe em `videos/scripts/` e o `Script` guarda a key. _(verificado 2026-08-17)_
- [x] **CA-2** — Dado um script com vídeo e texto, quando o atendente clica "Usar script", então **uma** mensagem chega no WhatsApp do lead: vídeo com o texto como legenda. _(verificado 2026-08-17)_
- [ ] **CA-3** — Dado um script com vídeo e texto contendo `{{nome_cliente}}`, quando enviado, então a legenda chega com o nome real do lead.
- [ ] **CA-4** — Dado um script **sem** vídeo, quando o atendente clica "Usar script", então o texto é inserido no composer e **nada** é enviado (comportamento atual, intocado).
- [ ] **CA-5** — Dado um script com vídeo, quando o script é excluído, então o objeto some do bucket e um GET na URL devolve 404/403.
- [ ] **CA-6** — Dado um script com vídeo, quando o vídeo é trocado por outro, então o objeto antigo some do bucket.
- [ ] **CA-7** — Dado um arquivo que não é MP4, quando selecionado, então é rejeitado antes do upload com mensagem explícita.
- [x] **CA-8** — Dado o vídeo enviado, quando renderizado no chat, então aparece como player reproduzível — não como card de download. _(verificado 2026-08-17)_
- [ ] **CA-9** — Dado um vídeo acima de 16MB, quando selecionado, então é rejeitado antes do upload (D-7 tornou o teto global, então não há caso específico de `META_CLOUD`).
- [ ] **CA-10** — Dado um envio de vídeo, quando a mensagem é persistida, então `mimetype` começa com `video/` e o preview na lista de conversas mostra "🎬 Vídeo".

> **Status da verificação**: CA-1, CA-2 e CA-8 confirmados manualmente no chat
> real. Os demais seguem **não testados** — em especial **CA-5**, que é o
> critério que prova que o storage não cresce sem limite.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Todos os `Script` existentes em produção (sem vídeo) | Caminho atual intocado — colunas novas são nullable, `videoKey = null` |
| CB-2 | Script com vídeo e **texto vazio** | Envia o vídeo sem caption. Não bloqueia |
| CB-3 | Script com vídeo cujo texto virou vazio após resolver variáveis | Idem CB-2 |
| CB-4 | `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` ausente | **Falha cedo com erro explícito.** Sem ela a URL vira relativa (`/uploads/<key>`) e a Uazapi não consegue baixar — hoje isso passaria silencioso |
| CB-5 | `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` **com** protocolo (`https://...`) | `getPublicMediaUrl` (`src/lib/r2-url.ts:22`) concatena sem limpar e gera `https://https://…`. Normalizar antes de usar — `useConstructUrl` já faz isso, `getPublicMediaUrl` **não** |
| CB-6 | Tracking em `META_CLOUD` | Nenhum tratamento especial — o teto de 16MB é global (D-7), então o arquivo que sobe já cabe na Meta |
| CB-7 | Conversa em modo In-Chat (`CB-16`/`CB-17`/`CB-18` da baseline) | Não vai pra Uazapi; persiste com `viaInChat: true`. O vídeo precisa aparecer no widget público `/whatsapp/[orgSlug]` |
| CB-8 | Upload estoura o `maxDuration = 60` da rota | Erro tratado; o script **não** é salvo com key inválida |
| CB-9 | Upload conclui mas o usuário cancela o dialog | Objeto órfão no bucket. Mitigação: só faz upload no submit do formulário, não no drop |
| CB-10 | Delete do objeto no R2 falha ao excluir o script | Script é excluído mesmo assim (best-effort, I-9) e o erro é logado. Objeto órfão é aceitável; script fantasma não |
| CB-11 | Bucket sem CORS (pendência conhecida, `CLOUDFLARE_R2_CORS_PENDING.md`) | O upload de vídeo usa rota server-side própria — não depende de CORS do browser |
| CB-12 | Bucket privado sem domínio público | A Uazapi não consegue baixar por URL. Requer domínio público configurado — mesma dependência de CB-4 |
| CB-13 | Arquivo MP4 corrompido / que a Uazapi recusa | Erro do provider propaga pelo caminho normal de erro de envio (`showSendMessageError`) |
| CB-14 | Dois atendentes usam o mesmo script simultaneamente | Sem conflito — leitura apenas; o objeto é imutável |
| CB-15 | Reenvio do mesmo script para o mesmo lead | Duas mensagens distintas, `messageId` distintos. Sem dedupe (I-4 vale só para inbound) |
| CB-16 | Lead sem telefone | Bloqueia antes do envio, como os demais senders já fazem |

## 6. Decisões de design

### D-1 — Vídeo preso ao Script (1:1), não biblioteca

- **Escolha**: colunas de vídeo no próprio `Script`, um vídeo por script.
- **Alternativa descartada**: model `MediaAsset` reutilizável por N scripts —
  resolve melhor o storage, mas exige contagem de referências para saber quando
  apagar, e não há demanda hoje.
- **Consequência**: dois scripts com o mesmo vídeo = dois objetos. Aceito.
  Migrar para biblioteca depois é uma spec nova (P-2).

### D-2 — Escopo por tracking

- **Escolha**: herda o escopo de `Script` (`trackingId`), sem coluna nova.
- **Alternativa descartada**: escopo por organização (como `UserSticker`).
- **Consequência**: o provider é resolvível direto do `trackingId`
  (`WhatsAppInstance.trackingId` é `@unique`), o que torna o gate do CB-6
  trivial. Foi esse o motivo da escolha.

### D-3 — Envio por URL, não base64

- **Escolha**: passar a URL pública no campo `file` do `POST /send/media`.
- **Alternativa descartada**: base64 — dobraria a banda, e o binário passaria
  pelo nosso servidor a cada envio.
- **Consequência**: o desenho inteiro depende de URL pública estável (CB-4,
  CB-12).

### D-4 — Rota de upload própria em `videos/scripts/`

- **Escolha**: rota nova gravando no bucket padrão sob `videos/scripts/`.
- **Alternativa descartada**: reusar `/api/s3/upload-video`, que grava em
  `nasa-planner/videos/` — mesmo bucket, mas prefixo de outro app; misturaria
  os domínios no storage.
- **Consequência**: organização explícita por domínio no bucket. Não há
  migração de storage envolvida — o bucket sempre foi um só
  (`NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES`); `nasa-planner/` era só prefixo.

### D-5 — Uma mensagem (vídeo + caption), não duas

- **Escolha**: `text` do `send/media` recebe o conteúdo do script.
- **Alternativa descartada**: vídeo e texto como duas mensagens — mais frágil
  (ordem de entrega não garantida) e polui a conversa.
- **Consequência**: o limite de caption do WhatsApp passa a valer para o texto
  do script. Script longo + vídeo pode ser truncado pelo WhatsApp — verificar
  em CA-2.

### D-7 — Teto único de 16MB, não teto por provider

- **Escolha**: 16MB para todos os providers, validado no upload.
- **Alternativa descartada**: teto por provider (Uazapi mais generoso, Meta em
  16MB) — significaria que um script criado num tracking Uazapi poderia ficar
  inutilizável se o tracking migrasse para Meta, e o erro só apareceria na hora
  de enviar, para o atendente errado.
- **Consequência**: o limite mais restritivo (Meta) vira o limite do produto.
  Um arquivo aceito no upload envia em qualquer provider — **o gate some do
  caminho de envio e vira validação de entrada**, que é onde erro é barato.

### D-8 — Sem restrição de papel para anexar

- **Escolha**: quem já pode criar script pode anexar vídeo.
- **Consequência**: qualquer membro pode consumir storage da org. Aceito
  enquanto não houver cota (P-5); se a cota entrar, o controle vive lá, não em
  permissão.

### D-6 — Sem cobrança de ★ nesta fase

- **Escolha**: envio de vídeo não passa por `chargeMessageOutbound` com tipo
  próprio.
- **Consequência**: o breakdown de Stars não distingue vídeo. Registrado em P-1.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — colunas nullable em `Script`
- [x] Procedures oRPC — `scripts.create`/`update`/`delete` mudam de contrato; sender novo de vídeo
- [ ] Realtime (Pusher / event-bus) — sem evento novo
- [ ] Automações (Inngest)
- [ ] Env vars novas — nenhuma, mas `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL` passa a ser **obrigatória** para a feature funcionar
- [ ] Breaking change para clientes existentes — não (colunas nullable)
- [x] Documentação obrigatória — atualizar o changelog da baseline [0003](0003-tracking-chat-baseline.md); `docs/whatsapp-oficial-overview.md` só se o gate do Meta (CB-6) mexer em `src/http/whats-oficial/`

### Invariantes da baseline que esta mudança aciona

- **I-3** (tipo de mensagem novo toca 5 lugares) — vídeo precisa de render em
  `message-box.tsx` + preview em `lead-box.tsx`. **Correção da análise
  inicial**: supunha-se que vídeo caía em `file-message-box.tsx` como card de
  download; na verdade **nenhuma** branch cobria `video/*` e a bolha saía
  vazia — inclusive para vídeo recebido do lead. Resolvido com
  `video-message-box.tsx`.
- **I-5** (resolve de provider antes de cobrar ★) — sem cobrança nesta fase,
  mas o gate do CB-6 exige o provider resolvido antes do envio de qualquer jeito.
- **I-9** (efeito colateral é best-effort) — o delete no R2 (CB-10).

## 8. Plano de testes

Sem runner de testes no projeto — verificação manual, com o passo descrito no PR.

| Critério | Como verificar |
| --- | --- |
| CA-1, CA-7 | Subir um MP4 e um não-MP4 pelo dialog do script; conferir o objeto no bucket |
| CA-2, CA-3 | Usar o script num lead real com nome preenchido; conferir no WhatsApp do lead |
| CA-4 | Usar um script antigo (sem vídeo) e confirmar que só preenche o composer |
| CA-5, CA-6 | Excluir e editar o script; `GET` na URL antiga deve falhar |
| CA-8, CA-10 | Observar a bolha no chat e o preview na lista de conversas |
| CA-9 | Tracking `META_CLOUD` com vídeo acima do limite |

## 9. Riscos e rollback

| Risco | Sinal | Mitigação |
| --- | --- | --- |
| URL relativa entregue ao provider | Envio "ok" mas vídeo não chega | CB-4 — falhar cedo com erro explícito |
| `https://https://` na URL | Provider devolve erro de download | CB-5 — normalizar em `getPublicMediaUrl` |
| Objetos órfãos acumulando | Bucket crescendo sem scripts correspondentes | CB-9 (upload só no submit) + CB-10 (log) |
| Storage cresce mesmo assim | Nº de scripts com vídeo sobe sem controle | **Sem cota nesta fase** — ver P-5 |
| Vídeo grande trava a rota | 504 no upload | `maxDuration` e teto de tamanho (RNF-3) |

**Rollback**: a migration só adiciona colunas nullable — reversível com um
`DROP COLUMN`, sem perda de dado pré-existente. Objetos já subidos ficam no
bucket e precisam de limpeza manual.

## 10. Pendências (fora de escopo, registradas)

| # | Pendência |
| --- | --- |
| P-1 | Cobrança de ★ por vídeo — `chargeMessageOutbound.mediaType` é union fechada sem `"video"` |
| P-2 | Galeria/biblioteca de mídias reutilizável entre scripts (evolução de D-1) |
| P-3 | Suporte a `ptv` (vídeo redondo) e `videoplay` (autoplay/loop) — exige estender a union canônica |
| P-4 | Thumbnail própria (`thumbnail` do `send/media`) — hoje delegada à geração automática da Uazapi |
| P-5 | **Cota de storage por organização** (nº de vídeos ou MB) — sem isso o script reduz a taxa de crescimento, mas não a trava |
| P-6 | Player de vídeo no widget público In-Chat (CB-7) |
| P-7 | `useConstructUrl` sendo chamado dentro de handlers oRPC (`create-with-file.ts:101`) e condicionalmente em JSX (`message-box.tsx:381`, erro de lint pré-existente) — funciona por ser função pura, mas o nome mente. Renomear para `constructStoredUrl` |
| P-8 | Objeto órfão gerado quando o upload conclui mas o `scripts.create` falha depois (aconteceu uma vez no teste de 2026-08-17). A mitigação de CB-9 só cobre o cancelamento, não a falha pós-upload |

## 11. Questões resolvidas

| # | Questão | Decisão |
| --- | --- | --- |
| Q-1 | Teto de tamanho por vídeo | **16MB**, o limite documentado da Meta (D-7) |
| Q-2 | Comportamento em tracking `META_CLOUD` | Sem tratamento especial — o teto global já garante compatibilidade (D-7) |
| Q-3 | Quem pode anexar vídeo | Qualquer membro que já cria script (D-8, RF-11) |

## 12. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-17 | João Gabriel | Criada — decisões D-1..D-6 vindas da conversa; Q-1..Q-3 em aberto |
| 2026-08-17 | João Gabriel | Q-1..Q-3 respondidas → D-7 (teto único 16MB) e D-8 (sem restrição de papel); CB-6 deixa de exigir gate por provider; status → aprovada |
| 2026-08-17 | João Gabriel | Implementada. Migration `20260817175801_script_video`. CA-1/CA-2/CA-8 verificados; demais pendentes. Dois desvios do previsto, ambos ampliando o escopo de correção: (1) vídeo não renderizava **nada** no chat — nenhuma branch do `message-box` cobria `video/*`, não era card de download como a análise inicial supôs; (2) `isFile` removia a bolha inteira de **toda** mídia, deixando legenda e horário soltos sobre o papel de parede — corrigido para imagem, vídeo, arquivo, áudio, localização e contato. Novas pendências P-7 e P-8 |
