---
id: 0083
titulo: Astro responde em áudio no WhatsApp, para a equipe
dominio: astro-bot
status: parcial
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/W-form-fichas-proxima-data-20261009
pr: Act962/nasa.ex#453
peso: completa
---

# 0083 — Astro responde em áudio no WhatsApp, para a equipe

## 1. Contexto

Segunda etapa do plano "ASTRO por voz no WhatsApp". O Astro já **ouve** áudio da equipe (spec 0036: transcreve e responde em texto). Falta **responder em áudio**, com voz natural, quando a empresa ligar isso nas configurações.

As peças existem soltas no código e nada as liga no bot:

- Voz da OpenAI já é usada na plataforma (`api/astro/voice/speech/route.ts`) e nos workflows (`sendVoiceExecutor`, só Uazapi).
- A porta de envio aceita nota de voz (`provider.sendMedia` com `isVoice`) e a API oficial tem upload de mídia (`uploadOfficialMedia`), sem uso para áudio.
- O canal do bot (`WhatsappBotChannel`) só envia texto, botões e imagem.

Esta spec cobre só a **equipe** (número vinculado ao Astro). Áudio para o cliente (lead) é a spec do atendimento ao cliente.

## 2. Objetivo

Com a opção ligada, o membro da equipe manda um áudio ao Astro e recebe a resposta como **nota de voz**, com voz natural em português, sem perder nada do que hoje chega em texto.

### Não-objetivos

- Áudio para clientes (leads) e lembretes em áudio.
- Chamada de voz.
- Clonagem de voz.
- Preferência por pessoa: a configuração é da empresa.
- Trocar o modelo que ouve os áudios (segue o da spec 0036).

## 3. Requisitos

### Parte A — resposta em áudio com a voz padrão

| ID | Requisito |
| --- | --- |
| RF-1 | Em Astro › WhatsApp, a empresa escolhe **Responder em áudio**: `Nunca` (padrão), `Quando eu mandar áudio` ou `Sempre`. |
| RF-2 | A empresa escolhe a **voz** numa lista curta, com botão para ouvir uma amostra antes de salvar. |
| RF-3 | Opção **Enviar também o texto** (ligada por padrão): depois da nota de voz chega a mesma resposta escrita, para consulta e busca. |
| RF-4 | A resposta em áudio sai como **nota de voz** do WhatsApp (não como arquivo de áudio), na API oficial e na Uazapi. |
| RF-5 | **Sempre em texto, nunca em áudio:** pergunta com botões ou lista, confirmação (Confirmar/Cancelar), menu, PIX, links, códigos, tabelas e listas com mais de 5 itens, recusa de permissão, erro e aviso de falta de Stars. |
| RF-6 | Resposta que daria mais de **90 segundos** de áudio vai só em texto. |
| RF-7 | O áudio fala um **texto próprio para a fala**: sem símbolos de formatação nem emoji, valores por extenso ("cento e cinquenta reais"), datas faladas ("nove de outubro"), sem ler links. Feito em código, sem IA. |
| RF-8 | Se gerar ou enviar o áudio falhar, a resposta chega em **texto**, sem atraso perceptível e sem cobrança do áudio. |
| RF-9 | Cobrança em Stars por minuto de áudio gerado (ação nova `astro_bot_speech`, mínimo 1), só quando o áudio é entregue ao WhatsApp. Empresa isenta hoje (trafeGO) continua isenta. Sem saldo para o áudio, a resposta vai em texto. |
| RF-10 | O registro do comando (`WhatsappBotCommand`) passa a indicar se a resposta foi em áudio e as Stars do áudio. |

### Parte B — voz premium (ElevenLabs), opcional

| ID | Requisito |
| --- | --- |
| RF-11 | A camada de voz aceita mais de um provedor. A Parte A entrega a OpenAI. |
| RF-12 | ElevenLabs entra como segundo provedor, com a **chave da própria empresa** cadastrada em Satélites, e lista de vozes dela. Sem chave, a opção não aparece. |
| RF-13 | Com chave própria, o áudio não cobra Stars de voz (a empresa paga direto à ElevenLabs), como já é com as chaves de IA. |

A Parte B exige um valor novo no cadastro de integrações (migration) e a tela de Satélites. Entra depois da Parte A testada, com autorização própria.

### Segurança

| ID | Requisito |
| --- | --- |
| RS-1 | O áudio é só outra forma de **entregar** a resposta: ela é montada pelo mesmo caminho do texto, depois do portão de permissão da spec 0082. Nada novo é consultado para falar. |
| RS-2 | Ao provedor de voz vai só o texto da resposta. Nenhuma credencial, id interno ou dado além do que a pessoa já ia receber. |
| RS-3 | Chaves de voz ficam só no servidor, cifradas como as demais; nunca em log, mensagem de erro ou resposta. |
| RS-4 | O arquivo de áudio não fica guardado: é gerado em memória, enviado e descartado. Na API oficial sobe direto para a Meta, sem link público. |
| RS-5 | PIX, links, códigos e recusas nunca são falados (RF-5): áudio pode ser ouvido por quem está perto. |
| RS-6 | Limite de uso: vale o limite de comandos por hora que já existe; o áudio não cria caminho para ultrapassá-lo. |

### Regras da Meta (conferidas em 10/10/2026)

Fonte: Termos da Meta para a Plataforma do WhatsApp Business (atualizados em 23/09/2026) e documentação de mídia da Cloud API.

| Regra | Como a spec atende |
| --- | --- |
| Provedor de IA não pode usar a plataforma para oferecer IA como **funcionalidade principal**; uso incidental ou auxiliar é permitido. A Meta decide a seu critério | O Astro do WhatsApp opera os Apps da empresa (consultas e ações), com o filtro da spec 0082 e a recusa para assuntos fora deles. A voz é só o formato da resposta. **Risco que permanece:** a interpretação é da Meta; o Astro da equipe é uso interno. Manter o Astro restrito aos Apps é a mitigação |
| Dados da plataforma não podem treinar modelos de IA | Nenhum áudio ou texto do WhatsApp é usado para treinar ou ajustar modelo. Não usar clonagem de voz com áudio recebido |
| Nota de voz: OGG com codec Opus, até 16 MB | Formato gerado já é OGG/Opus; o limite de 90 s fica muito abaixo de 16 MB |
| Fora da janela de 24 h só template | A resposta em áudio só existe como **resposta** a uma mensagem do membro, portanto dentro da janela. Nenhum áudio proativo |
| Qualidade do número | Áudio só para quem mandou áudio, ou quando a empresa escolheu "Sempre" para a própria equipe. Nunca para clientes nesta spec |

## 4. Critérios de aceite

- [ ] **CA-1** — Opção em `Nunca`: áudio do membro recebe resposta em texto, como hoje.
- [ ] **CA-2** — `Quando eu mandar áudio`: áudio "quantas manutenções tenho essa semana?" recebe nota de voz (ícone de microfone, não arquivo) e, em seguida, o texto. Mensagem escrita recebe só texto.
- [ ] **CA-3** — `Sempre`: mensagem escrita também recebe nota de voz.
- [ ] **CA-4** — "Enviar também o texto" desligado: chega só a nota de voz.
- [ ] **CA-5** — Pedido que gera botões, confirmação, PIX ou link chega em texto, mesmo em `Sempre`.
- [ ] **CA-6** — Resposta longa (lista de 20 leads) chega só em texto.
- [ ] **CA-7** — O áudio diz "cento e cinquenta reais" e "nove de outubro", sem ler asteriscos, emoji ou endereço de link.
- [ ] **CA-8** — Membro sem permissão pergunta por áudio: recebe a recusa da spec 0082 **em texto**.
- [ ] **CA-9** — Com o provedor de voz fora do ar (chave inválida no teste), a resposta chega em texto e nenhuma Star de áudio é cobrada.
- [ ] **CA-10** — As Stars do áudio aparecem no extrato e no registro do comando.
- [ ] **CA-11** — Funciona no número da API oficial e num número Uazapi.
- [ ] **CA-12** — A amostra de voz toca na tela de configuração sem salvar nada.

## 5. Abordagem

- **Banco** (migration aditiva em `OrganizationBotConfig`, molde do `financeEnabled`): `voiceReplyMode` (`off`/`match`/`always`, padrão `off`), `voiceName` (opcional), `voiceAlsoText` (padrão `true`). Em `WhatsappBotCommand`: `repliedWithVoice` e `voiceStarsCharged`. Autorização do Weydson antes de aplicar; ritual da Regra 11.
- **Configuração:** `router/astro-bot/config/upsert.ts` e `get.ts`; tela em `astro-bot/components/bot-config-section.tsx`; hooks em `astro-bot/hooks/use-astro-bot.ts`. Amostra de voz por uma rota autenticada que devolve um áudio curto fixo.
- **Camada de voz** em `src/features/astro-bot/lib/voice/`: `synthesizeSpeech({ text, voiceName, organizationId })` devolvendo OGG/Opus e a duração; adaptador OpenAI (`gpt-4o-mini-tts`, formato `opus`), com a chave da empresa ou a da plataforma (`loadOrganizationKeys`, `envKeyFor`).
- **Texto para a fala:** `voice/speakable-text.ts`, função pura (valores, datas, horários, remoção de formatação) e a decisão "pode ser falado?" (RF-5, RF-6).
- **Canal:** `sendVoice(phone, audio)` em `WhatsappBotChannel` e `TrackingProviderBotChannel`. API oficial: `uploadOfficialMedia` e `sendMedia` com `mediaKind: "audio"`, `mediaId`, `isVoice: true`. Uazapi: `send-media` com `type: "ptt"`.
- **Decisão de envio:** `maybeHandleBotMessage` (`webhook-handler.ts`), no ponto que hoje escolhe botões ou texto. `handleBotCommand` passa a informar `wasAudioInput`.
- **Cobrança:** `astro_bot_speech` em `stars/lib/metering/catalog-defaults.ts` e nos seeds, com `meter()`, como `chargeTranscription`.
- **Documentação:** `docs/whatsapp-oficial-overview.md` (Regra 14).

## 6. Decisões tomadas sem resposta do Weydson

1. **Padrão desligado.** Nenhuma empresa passa a receber áudio sem escolher.
2. **Texto junto com o áudio, por padrão.** Áudio não dá para pesquisar nem copiar.
3. **Limite de 90 segundos.** Acima disso a resposta é lista ou relatório, que se lê melhor.
4. **Preço:** 1 Star por minuto de áudio, igual à transcrição. O custo real é de cerca de R$ 0,08 por minuto na OpenAI.
5. **Configuração por empresa**, não por pessoa.

## 7. Verificação

- ASTRO QA, número de teste da API oficial, banco de desenvolvimento: CA-1 a CA-10 com áudios reais enviados pelo Weydson.
- CA-7 também por script, com casos de valor, data e formatação.
- CA-11 num número Uazapi de teste.
- Lint nos arquivos alterados. Typecheck fica com o CI.

## 9. Changelog

- 2026-10-10 — criada, a partir do plano aprovado.
- 2026-10-10 — spec e leiaute aprovados pelo Weydson ("pode seguir"). **Parte A implementada; Parte B (ElevenLabs) não iniciada.**
  - Banco: migration `20261010120000_bot_voice_reply` (`voice_reply_mode`, `voice_name`, `voice_also_text` em `organization_bot_config`; `replied_with_voice`, `voice_stars_charged` em `whatsapp_bot_command`). Aplicada no banco de desenvolvimento.
  - Arquivos novos em `astro-bot/lib/voice/`: `voices.ts` (modos e lista de vozes), `speakable-text.ts` (texto para a fala e a regra do que pode ser falado), `synthesize-speech.ts` (OpenAI `gpt-4o-mini-tts`, OGG/Opus), `reply-voice.ts` (decisão, envio, cobrança e registro). Tela: `components/bot-voice-reply-settings.tsx`. Rota de amostra: `router/astro-bot/config/voice-sample.ts` (texto fixo, só owner/admin).
  - A porta de provedores ganhou `uploadMedia` (Meta); o canal do bot ganhou `sendVoice`.
  - Vozes oferecidas: Marin, Cedar, Coral e Ash (nomes reais do provedor; os do leiaute eram ilustrativos).
  - **Divergências:** além do RF-5, ficam em texto as respostas que citam PIX, senha, código ou token. A cobrança acontece depois da entrega; antes de gerar o áudio só se confere se a empresa tem algum saldo.
  - **Verificado** (banco de desenvolvimento, ASTRO QA, envio real pelo número oficial de teste ao celular do Weydson): modo `Sempre` com pergunta escrita → nota de voz entregue e texto em seguida, registro com `replied_with_voice = true` (CA-3); "menu" → só texto com botões (CA-5); chave do provedor inválida → resposta em texto, sem registro de voz (CA-9); modo `Quando eu mandar áudio` com mensagem escrita → só texto (parte do CA-2). CA-7 por script: valores, datas, formatação, e os casos que não podem ser falados (link, PIX, lista longa, tabela, texto longo).
  - **Não verificado:** áudio real enviado pelo membro (CA-2 completo e CA-8); "enviar também o texto" desligado (CA-4); resposta longa de verdade (CA-6, só por script); Stars no extrato (CA-10) — o banco de desenvolvimento não tem os preços do catálogo cadastrados, então a cobrança saiu 0; Uazapi (CA-11); a tela e a amostra de voz no navegador (CA-12, só lint e resposta 401 da rota sem login); como o áudio soa (ninguém ouviu ainda).
  - **Para produção:** rodar o cadastro de preços (`prisma/seed-astro-action-prices.ts`) para a ação `astro_bot_speech`; sem ele o áudio sai sem cobrar.
- 2026-10-10 — teste com áudio real do Weydson: o Astro entendeu "Eu queria fazer um agendamento" e respondeu em nota de voz e texto (CA-2 verificado), em cerca de 22 s. Dois ajustes a partir do que ele ouviu:
  - **Voz.** A primeira soou pausada, palavra por palavra; a causa era a instrução de "ritmo de conversa". Depois de 10 amostras enviadas ao celular dele, o Weydson escolheu a **Onyx no modelo clássico (`tts-1-hd`), 10% mais rápida**, que virou a padrão. Lista final: Onyx, Nova, Cedar e Marin; cada voz declara o modelo e a velocidade em `voices.ts` (Cedar e Marin só existem no `gpt-4o-mini-tts` e ficaram com instrução de leitura direta).
  - **Tempo.** Não é configurável: é a soma de baixar, transcrever, responder, gerar a voz e enviar. Resposta em 1–2 s só em chamada em tempo real (Fase 5 do plano). Feito agora: a voz nova gera em 2–5 s (antes 7–9 s) e a resposta a um áudio deixou de esperar os 1,5–4 s que imitam digitação. Ficou a medição por etapa no log (`[astro-bot/tempo]`). **Ainda não medido de ponta a ponta depois dos ajustes.** Trocar o modelo de transcrição por um mais rápido ficou de fora: o atual devolve a duração do áudio, usada na cobrança e no limite de 10 minutos.
  - Nome próprio incomum pode sair com pronúncia errada ("Weydson"). Fora do escopo; possível lista de pronúncia por empresa no futuro.
