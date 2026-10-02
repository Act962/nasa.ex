---
id: 0054
titulo: Conversar por voz com o ASTRO em tempo real
dominio: astro
status: implementada
autor: Weydson (com Claude)
criada: 2026-10-01
atualizada: 2026-10-02
branch: feature/W-orbita-melhorias-ui-ux-20261001
pr:
peso: completa
---

# 0054 — Conversar por voz com o ASTRO em tempo real

## 1. Contexto

O botão "Conversar por voz" da Início (`src/features/nasa-command/components/command-input.tsx`) hoje encadeia três peças do navegador:

1. `SpeechRecognition` do navegador transcreve **uma** frase (`continuous = false`) — não existe no Firefox e falha com frequência no Safari;
2. a frase vira mensagem de texto para `/api/astro/chat`, que responde por texto;
3. `tts.ts` lê a resposta com `speechSynthesis` (voz robótica). O Piper, voz melhor, depende de container próprio e está desligado (`NEXT_PUBLIC_PIPER_ENABLED`).

Resultado: voz robótica, 3–6 s de silêncio entre a fala do usuário e a resposta, impossível interromper o ASTRO e cada turno exige tocar no botão de novo. Não é um diálogo.

## 2. Objetivo

Conversar com o ASTRO por voz como se fosse uma ligação: fala natural em português, resposta em menos de 1 s, o usuário interrompe quando quiser, e o ASTRO continua consultando os dados da empresa quando a pergunta pede.

### Não-objetivos

- Ditado (o botão de microfone que só transcreve para a caixa) — continua como está.
- Wake word "Ei, Astro" e narração automática (`use-wake-word.ts`, `use-auto-narrate.ts`) — continuam como estão.
- Voz no ASTRO do WhatsApp.
- Trocar o motor de texto do ASTRO: a voz delega a ele perguntas sobre dados e ações; não reimplementa ferramentas.
- Relay de áudio pelo nosso servidor (ver D-3).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | "Conversar por voz" abre uma sessão de voz contínua: o usuário fala, o ASTRO responde falando, sem tocar em nada entre os turnos. |
| RF-2 | O usuário pode interromper o ASTRO falando por cima; o áudio dele para na hora. |
| RF-3 | Perguntas sobre dados da empresa ou pedidos de ação ("quantos leads entraram hoje", "agenda uma reunião") são resolvidos pelo ASTRO de texto (`/api/astro/chat`) por uma ferramenta `consultar_astro`; a voz lê o resultado de forma falada (sem tabelas/markdown). |
| RF-4 | As falas aparecem na conversa da Início (balões do usuário e do ASTRO), para o usuário reler depois; a sessão é gravada no Histórico como qualquer conversa. |
| RF-5 | Tela de voz mostra estado (conectando / ouvindo / falando / consultando), o tempo da chamada e o botão de encerrar; mudo do microfone. |
| RF-6 | IA usada segue a spec 0053: chave OpenAI da empresa conectada em Satélites (modo `OWN`) ou chave da plataforma (modo `PLATFORM`). Empresa sem modo escolhido vê o cartão de escolha antes da voz. Empresa cuja IA própria não é OpenAI (só Gemini/Anthropic) usa a chave da plataforma, cobrada em Stars, com aviso. |
| RF-7 | Cobrança por minuto de conversa (`astro_voice_minute`, unidade `minute`) quando a chave é da plataforma. Com chave própria, não há cobrança por minuto; as consultas ao ASTRO de texto seguem a regra atual (taxa fixa `astro_prompt`). |
| RF-8 | Sessão termina sozinha após 2 min de silêncio total, aos 15 min de duração ou quando o saldo de Stars acaba (avisando por voz antes de encerrar). |
| RF-9 | Navegador sem WebRTC/microfone, permissão negada ou falha de conexão: volta ao fluxo atual (Web Speech + TTS) com aviso, sem quebrar a Início. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Latência do fim da fala do usuário ao início do áudio do ASTRO < 1 s no p50 (perguntas que não usam `consultar_astro`). |
| RNF-2 | A chave de API (da empresa ou da plataforma) **nunca** chega ao navegador: o navegador recebe só um segredo efêmero da OpenAI, válido para abrir uma sessão. |
| RNF-3 | Funciona em Chrome, Edge, Safari (macOS e iOS) e Firefox atuais. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado o modo `PLATFORM` com saldo, quando o usuário toca em "Conversar por voz" e fala "oi, tudo bem?", então o ASTRO responde em voz natural sem novo toque, e o primeiro minuto é debitado como `astro_voice_minute`.
- [ ] **CA-2** — Dado o ASTRO falando, quando o usuário fala por cima, então o áudio do ASTRO para em < 500 ms e ele responde à nova fala.
- [ ] **CA-3** — Quando o usuário pergunta "quantos leads entraram esta semana?", então a voz chama `consultar_astro`, a pergunta aparece como balão, a resposta de texto do ASTRO aparece como balão e a voz fala o número.
- [ ] **CA-4** — Dado o modo `OWN` com chave OpenAI, quando a sessão abre, então o segredo efêmero foi criado com a chave da empresa e nenhum `astro_voice_minute` é debitado.
- [ ] **CA-5** — A resposta de `/api/astro/voice/session` não contém nenhuma chave `sk-`; só `clientSecret` efêmero.
- [ ] **CA-6** — Dado saldo zerado no meio da chamada, quando o próximo minuto é cobrado e falha, então o ASTRO avisa por voz e a sessão encerra.
- [ ] **CA-7** — Dado microfone negado, quando o usuário toca em "Conversar por voz", então aparece um aviso pedindo para permitir o microfone e nada é cobrado (o segredo nem é pedido).
- [ ] **CA-8** — Dado modo da IA ainda não escolhido, quando o usuário toca em "Conversar por voz", então aparece o aviso de escolha da IA com o botão "Usar modelo ÓRBITA" (que salva a escolha e abre a chamada) e nenhuma sessão é aberta antes disso.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Usuário fecha a aba no meio da chamada | Conexão WebRTC cai; nenhum minuto novo é cobrado (cobrança é por batimento, ver D-4). |
| CB-2 | Dois toques rápidos no botão | Uma sessão só; o segundo toque encerra a que está abrindo. |
| CB-3 | `consultar_astro` demora > 8 s | A voz diz "só um instante, estou consultando" (instrução no prompt) e espera até 30 s; depois desiste educadamente. |
| CB-4 | `consultar_astro` devolve cartão (escolha de IA, permissão negada, guia na tela) | A voz explica em uma frase e o cartão aparece na conversa normalmente. |
| CB-5 | Chave OpenAI da empresa inválida/sem crédito | Criação do segredo falha → mensagem "sua chave OpenAI recusou a conexão" com link para Satélites; não cai silenciosamente para a chave da plataforma (cobraria sem o usuário saber). |
| CB-6 | Usuário troca de página durante a chamada | A chamada encerra ao sair da Início (o estado vive na tela); as falas já ditas vão para o Histórico. Levar a chamada ao widget global fica para iteração futura. |
| CB-7 | iPhone com tela bloqueada | Safari suspende o áudio; ao voltar, a sessão é encerrada e o usuário toca de novo. |
| CB-8 | Empresa sem saldo antes de começar | Segredo não é criado; aviso de saldo com link de recarga. |

## 6. Decisões de design

### D-1 — OpenAI Realtime (`gpt-realtime`), fala direto com fala

Modelo de voz nativo (áudio entra, áudio sai), com detecção de turno e interrupção embutidas, vozes naturais em português (padrão `marin`) e chamada de ferramenta. Configurável por env `ASTRO_VOICE_MODEL` (`gpt-realtime` padrão; `gpt-realtime-mini` para cortar custo).

**Descartadas:**
- *Manter o encadeamento atual com TTS melhor (Piper/ElevenLabs)*: continua com 3 saltos de rede, sem interrupção nem detecção de turno — o problema é a arquitetura, não só a voz.
- *Gemini Live*: qualidade comparável, mas as vozes em pt-BR soam menos naturais nos testes públicos e a empresa já usa OpenAI como IA principal (spec 0053).
- *ElevenLabs Conversational AI*: vozes excelentes, mas exige mais um fornecedor/chave e não aproveita a chave OpenAI que o cliente já conecta em Satélites.

### D-2 — Ferramenta `consultar_astro` delega ao ASTRO de texto

A voz não ganha as ~60 ferramentas do ASTRO. Recebe **uma**: `consultar_astro({ pergunta })`. O navegador executa enviando a pergunta pela mesma conversa da Início (`sendMessage` do `useChat`), espera a resposta final e devolve o texto à sessão de voz. Assim permissões, cobrança por pergunta, cartões e histórico continuam num lugar só.

### D-3 — WebRTC direto do navegador para a OpenAI, com segredo efêmero

`POST /api/astro/voice/session` (nosso servidor) valida usuário, empresa, modo da IA e saldo, e cria o segredo efêmero em `POST https://api.openai.com/v1/realtime/client_secrets` com a configuração da sessão (modelo, voz, instruções do ASTRO, ferramenta). O navegador abre o WebRTC com esse segredo. **Descartado** relay de áudio pelo nosso servidor: dobraria a latência e o Next.js não segura WebSocket longo.

### D-4 — Cobrança por batimento de minuto

O primeiro minuto é cobrado ao criar o segredo. Enquanto a chamada estiver aberta, o navegador chama `POST /api/astro/voice/heartbeat` a cada 60 s; o servidor cobra 1 minuto (`astro_voice_minute`) e responde `continue` ou `stop`. Preço por minuto é decisão de negócio e mora no banco (catálogo da spec 0020), como as outras ações por quantidade; até ser cadastrado, a ação não cobra e aparece no relatório de ações sem preço.

**Risco aceito:** como o áudio não passa pelo servidor, um cliente adulterado poderia parar os batimentos e seguir conversando até o limite da OpenAI. Mitigações: teto de 15 min por sessão nas instruções e no cliente, limite de 6 sessões por usuário por hora no endpoint de criação, e o custo real fica visível no painel de uso da OpenAI da plataforma. Revisitar se o abuso aparecer.

### D-5 — Mesma conversa, balões visíveis

As transcrições (`conversation.item.input_audio_transcription.completed` e a transcrição do áudio do ASTRO) entram como balões na conversa da Início e são gravadas na sessão do Histórico. A voz não tem histórico paralelo.

## 7. Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/app/api/astro/voice/session/route.ts` | Cria o segredo efêmero (modo da IA, saldo, rate limit, 1º minuto) |
| `src/app/api/astro/voice/heartbeat/route.ts` | Cobra cada minuto seguinte, devolve `continue`/`stop` |
| `src/features/astro/server/voice/build-voice-session-config.ts` | Instruções, voz, ferramenta `consultar_astro` |
| `src/features/astro/server/voice/voice-call-token.ts` | Comprovante HMAC da chamada (o batimento só cobra chamada aberta por nós) |
| `src/features/astro/server/voice/charge-voice-minute.ts` | Cobrança de 1 minuto via `meter()` |
| `src/features/astro/server/routes/append-voice-turns.ts` | `astro.sessions.appendVoiceTurns`: grava as falas no Histórico |
| `src/features/astro/voice/realtime/use-realtime-voice.ts` | WebRTC, data channel, eventos, ferramenta, batimento, teto e silêncio |
| `src/features/astro/voice/realtime/voice-call-panel.tsx` | Estado da chamada, tempo, mudo, encerrar |
| `src/features/nasa-command/hooks/use-home-voice-call.ts` | Liga a chamada à conversa da Início (balões, `consultar_astro`, Histórico, fallback) |
| `src/features/stars/lib/metering/catalog-defaults.ts` | `astro_voice_minute` (unidade minuto, teto 50) — em `ACTIONS_WITHOUT_PRICE` até o preço ser decidido |
| `src/features/nasa-command/components/command-input.tsx` | Botão passa a abrir a chamada; painel substitui a caixa durante a chamada |

## 8. Plano de rollout

- Chave `ASTRO_VOICE_REALTIME` (padrão ligado). Desligada = fluxo atual sem mudança.
- Medir custo real de 1 min com a chave da plataforma antes de o admin cadastrar o preço de `astro_voice_minute`.

## 9. Changelog

- 2026-10-01 — Rascunho e envio para revisão.
- 2026-10-02 — Aprovada pelo Weydson: modelo `gpt-realtime` (voz `marin`) e risco de D-4 aceito com os limites (15 min por chamada, 6 chamadas por hora).
- 2026-10-02 — Implementada. Divergências: CB-6 (a chamada vive na Início e encerra ao sair dela); a narração automática (`use-auto-narrate`) pausa durante a chamada para não duplicar a voz; a fala que só anuncia ou resume uma consulta não vira balão (a resposta do ASTRO de texto já aparece); o limite de 6 chamadas/hora é por instância do servidor (memória); CA-7 e CA-8 usam aviso (toast) em vez do guia/cartão, porque a chamada acontece fora da lista de mensagens. Envs opcionais: `ASTRO_VOICE_REALTIME=false` desliga, `ASTRO_VOICE_MODEL`, `ASTRO_VOICE_NAME`.
