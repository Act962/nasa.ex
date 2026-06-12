# ATENDIMENTO NEON — Cenários de Teste (50)

> Documento de stress-test do workflow `ATENDIMENTO NEON — Fluxo Completo` (ID `yqknxfs0a9n7z5j4ecorgubk`) **antes do evento NEON**. Cobre 50 cenários de leads diferentes mandando mensagens diferentes em momentos diferentes.

## Setup atual (referência)

| Componente | Detalhes |
|---|---|
| **Workflow ID** | `yqknxfs0a9n7z5j4ecorgubk` |
| **Trigger** | `MESSAGE_INCOMING` (único) |
| **Tag gate inicial** | `lead.tags contains NOVO LEAD` OR `lead.tags contains AGENDOU REUNIÃO` |
| **AI #1 "É saudação NEON?"** | branches: `saudacao` / `outro` / `evento_neon` |
| **AI #2 "Qual botão?"** | branches: `consultoria_nasa` / `plataforma_nasa` / `falar_weydson` / `ambiguo` |
| **AI #3 SIM/NÃO (cada produto)** | branches: `sim_agendar` / `duvida` / `nao` |
| **AI #4 SIM/NÃO (após form NEON)** | branches: `sim` / `nao` / `outro` |
| **Formulário NEON NASA** | https://orbita.nasaex.com/forms/73369463-32f4-403d-96b3-6008a12d9890 |
| **Tag "Agendar"** | `cmq9fg86909uy0vphxkccrrnc` |
| **Tag "NOVO LEAD"** | `cmpy3t0ou0dcu0uo44vyp5xy1` |
| **Tag "AGENDOU REUNIÃO"** | `cmq56oec009ub0vulzgs4o2g3` |
| **Agenda Weydson** | https://orbita.nasaex.com/agenda/act-digital/weydson |
| **Agenda Onboarding** | https://orbita.nasaex.com/agenda/act-digital/reuniao-onboarding |

## Como ler cada cenário

```
N#  Nome do lead       Mensagens (com timing)         Resultado esperado
                                                       Risco / observação
```

---

## A — Entradas básicas (10)

### #1 — Lead "João Silva" (novo lead, saudação simples)
- **t=0**: "Oi"
- **Esperado**: gate (false, sem tag) → AI saudação `saudacao` → menu 3 botões → +TAG NOVO LEAD → WAIT 1min → WAIT_FOR_EVENT
- **Risco**: nenhum. Caminho feliz.

### #2 — Lead "Maria Costa" (lead novo, escolhe Consultoria)
- **t=0**: "Bom dia"
- **t=1min**: "Consultoria NASA"
- **Esperado**: menu enviado → WAIT_FOR_EVENT captura → AI qual botão = `consultoria_nasa` → +TAG → msg "obrigado pelo interesse" → WAIT_FOR_EVENT
- **Risco**: a 2ª mensagem dispara MESSAGE_INCOMING de novo. Gate vai bater (ela tem NOVO LEAD) → manda "Oi Maria, em que posso te ajudar?" → fim do run paralelo. ✅ sem duplicação.

### #3 — Lead "Pedro Almeida" (escolhe Plataforma)
- **t=0**: "Boa tarde, quero saber mais"
- **t=2min**: "Plataforma NASA"
- **Esperado**: idem #2 mas branch plataforma_nasa.
- **Risco**: igual #2.

### #4 — Lead "Ana Lima" (escolhe Falar com Consultor)
- **t=0**: "olá"
- **t=30s**: "3"
- **Esperado**: menu → AI qual botão = `falar_weydson` → +TAG → msg "consultor a caminho" → MERGE.
- **Risco**: o "3" é claro, sem ambiguidade.

### #5 — Lead "Lucas Pereira" (responde número errado)
- **t=0**: "oi"
- **t=1min**: "4"
- **Esperado**: AI qual botão = `ambiguo` → MERGE (não chuta).
- **Risco**: depende do prompt refinado. Se a IA "chutar", manda mensagem errada.

### #6 — Lead "Camila Santos" (responde "ok")
- **t=0**: "bom dia"
- **t=2min**: "ok"
- **Esperado**: AI qual botão = `ambiguo` → MERGE.
- **Risco**: como #5.

### #7 — Lead "Felipe Rocha" (escolhe sim agendar)
- **t=0**: "oi"
- **t=1min**: "1"
- **t=2min**: "sim, quero agendar"
- **Esperado**: branch consultoria → SIM/NÃO = `sim_agendar` → manda agenda → **+TAG AGENDOU REUNIÃO** (novo gate ativo)
- **Risco**: como #2.

### #8 — Lead "Beatriz Oliveira" (escolhe não)
- **t=0**: "oi"
- **t=1min**: "Consultoria"
- **t=3min**: "agora não"
- **Esperado**: branch consultoria → SIM/NÃO = `nao` → msg recuperação → WAIT 5min.
- **Risco**: como #2.

### #9 — Lead "Rafael Souza" (escolhe tirar dúvida)
- **t=0**: "boa noite"
- **t=1min**: "1"
- **t=2min**: "antes de agendar, queria entender o preço"
- **Esperado**: branch consultoria → SIM/NÃO = `duvida` → msg recuperação.
- **Risco**: depende da IA classificar pergunta como `duvida`. Pode classificar como `outro` em vez disso.

### #10 — Lead "Gabriela Martins" (lead silencioso)
- **t=0**: "oi"
- **t=∞**: não responde
- **Esperado**: menu enviado → WAIT 1min → WAIT_FOR_EVENT (timeout 60min) → após 60min run termina sem ação.
- **Risco**: ela vai ficar com tag NOVO LEAD pra sempre se não fizer nada. Gate dela ficará permanente. ⚠️

---

## B — Entradas NEON específicas (5)

### #11 — Lead "Carlos Mendes" (frase exata)
- **t=0**: "Olá! Te conheci no evento NEON. Quero saber mais sobre a Plataforma NASA."
- **Esperado**: AI saudação = `evento_neon` → msg "Maravilha Carlos!" → link form → WAIT_FOR_EVENT (3 dias)
- **Risco**: prompt deve detectar combinação NEON+Plataforma NASA.

### #12 — Lead "Patrícia Gomes" (variação)
- **t=0**: "Te conheci no NEON e queria saber da Plataforma NASA"
- **Esperado**: idem #11.
- **Risco**: IA pode classificar como `outro` se a frase for muito diferente.

### #13 — Lead "Ricardo Borges" (só fala NEON)
- **t=0**: "Estava no evento NEON"
- **Esperado**: pode cair em `saudacao` (mais provável) ou `outro`. Se cair em saudação → manda menu (esse é o caminho de fallback).
- **Risco**: a frase NÃO inclui "Plataforma NASA" → vai pro caminho normal de menu. ✅ aceitável.

### #14 — Lead "Juliana Vieira" (NEON + número)
- **t=0**: "Vim do NEON"
- **t=3min**: "2"
- **Esperado**: NEON sozinho → saudacao → menu → "2" → branch plataforma_nasa.
- **Risco**: como #2 (mais um run gerado pela 2ª mensagem; gate corta).

### #15 — Lead "Marcos Antonio" (frase NEON + responde form)
- **t=0**: "Olá! Te conheci no evento NEON. Quero saber mais sobre a Plataforma NASA."
- **t=10min**: preenche o formulário até o fim
- **t=12min**: "Sim, quero agendar"
- **Esperado**: branch evento_neon → form → WAIT_FOR_EVENT → AI sim/nao = `sim` → +TAG Agendar → link agenda.
- **Risco**: o WAIT_FOR_EVENT do branch NEON espera `message-incoming`, não "form-submitted". Pode ser que a submissão do form NÃO acorde o WAIT. ⚠️ **investigar evento Inngest disparado pelo submit do form.**

---

## C — Saudações variadas (5)

### #16 — "vc é a NASA?"
- **t=0**: "vcs são a NASA?"
- **Esperado**: ambíguo. AI saudação pode cair em `outro`. Se `outro` → MERGE (não responde).
- **Risco**: lead perde resposta. **Considerar adicionar branch "duvida" no AI saudação.**

### #17 — Lead com emoji
- **t=0**: "🚀"
- **Esperado**: AI provavelmente classifica como `outro` ou `saudacao`. Resultado imprevisível.
- **Risco**: lead recebe menu ou nada.

### #18 — Lead áudio
- **t=0**: [áudio]
- **Esperado**: `lead.lastMessage` provavelmente é vazio ou "[audio]" → AI cai em `outro`.
- **Risco**: lead em áudio fica sem resposta. **Considerar gate por tipo de mensagem.**

### #19 — Lead foto
- **t=0**: [imagem]
- **Esperado**: similar a áudio.
- **Risco**: similar.

### #20 — Lead "tudo bem?"
- **t=0**: "tudo bem?"
- **Esperado**: AI saudação pode cair em `saudacao` ou `outro`.
- **Risco**: se cair em `saudacao` → manda menu. Se cair em `outro` → MERGE silencioso.

---

## D — Respostas ambíguas (8)

### #21 — Lead manda "ok" no menu
- **t=0**: "oi"
- **t=1min**: "ok"
- **Esperado**: AI qual botão = `ambiguo` → MERGE.
- **Risco**: lead fica sem ação. **Sugestão: branch `ambiguo` re-envia menu em vez de terminar.**

### #22 — Lead manda "sim" no menu
- **t=0**: "boa tarde"
- **t=2min**: "sim"
- **Esperado**: AI qual botão = `ambiguo` (porque "sim" não é nome de produto).
- **Risco**: como #21.

### #23 — Lead manda "manda mais info"
- **t=0**: "oi"
- **t=1min**: "manda mais info"
- **Esperado**: AI qual botão = `ambiguo`.
- **Risco**: lead esperava info mas não recebe nada.

### #24 — Lead manda "?"
- **t=0**: "oi"
- **t=1min**: "?"
- **Esperado**: `ambiguo` → MERGE.
- **Risco**: igual.

### #25 — Lead manda "."
- **t=0**: "."
- **Esperado**: AI saudação = `outro`.
- **Risco**: MERGE silencioso.

### #26 — Lead manda link
- **t=0**: "https://meu-site.com.br"
- **Esperado**: `outro`.
- **Risco**: silêncio.

### #27 — Lead manda "vai NEON"
- **t=0**: "vai NEON"
- **Esperado**: pode cair em `saudacao` (NEON mencionado).
- **Risco**: manda menu pra alguém que talvez só tava reagindo.

### #28 — Lead manda "Quanto custa?"
- **t=0**: "oi"
- **t=1min**: "Quanto custa?"
- **Esperado**: AI qual botão = `ambiguo`. **Suporte de pricing fica perdido.**
- **Risco**: lead com intenção de compra fica sem resposta.

---

## E — Múltiplas mensagens em rajada (5)

### #29 — Lead manda 3 mensagens em 5 segundos
- **t=0**: "oi"
- **t=2s**: "tudo bem?"
- **t=5s**: "queria saber dos preços"
- **Esperado**: 3 runs MESSAGE_INCOMING. Run 1 chega ao menu, Run 2/3 pegam no tag gate (false) → cada um classifica e MERGE silencioso (provavelmente).
- **Risco**: ⚠️ **POSSÍVEL DUPLICAÇÃO DE MENU** — se Run 1 e 2 chegarem ao SEND_MESSAGE menu antes de qualquer um adicionar a tag, os dois mandam menu. **Causa raiz: race condition entre persistência da tag e o gate.**

### #30 — Lead manda saudação + escolha imediata
- **t=0**: "oi, plataforma"
- **Esperado**: AI saudação tem que decidir entre `saudacao` e `outro`. "plataforma" sugere produto.
- **Risco**: pode cair em `outro` (= silêncio) ou `saudacao` (= menu).

### #31 — Lead manda 5 mensagens em 30s
- **t=0**: "oi"
- **t=5s**: "boa noite"
- **t=10s**: "queria saber"
- **t=15s**: "como funciona a NASA"
- **t=30s**: "alguem aí?"
- **Esperado**: 5 runs paralelos. Tag NOVO LEAD pode acabar adicionada várias vezes (ou não, depende da idempotência).
- **Risco**: ⚠️ **menu pode ser enviado 2-3x antes do gate começar a cortar.**

### #32 — Lead manda duas saudações iguais
- **t=0**: "oi"
- **t=0.5s**: "oi"
- **Esperado**: 2 runs simultâneos. Mesmo risco de #29.
- **Risco**: ⚠️ duplicação.

### #33 — Lead manda saudação + áudio
- **t=0**: "oi"
- **t=10s**: [áudio]
- **Esperado**: Run 1 menu, Run 2 áudio → cai em `outro` → MERGE.
- **Risco**: aceitável.

---

## F — Re-entrada (lead já existia) (5)

### #34 — Lead já agendou volta a falar
- Pré: lead tem tag **AGENDOU REUNIÃO**
- **t=0**: "oi"
- **Esperado**: tag gate `true` → "Oi {nome}, em que posso te ajudar agora?" → FIM. ✅
- **Risco**: nenhum.

### #35 — Lead já é cliente antigo manda mensagem
- Pré: lead sem nenhuma tag, mas é cliente
- **t=0**: "preciso de suporte"
- **Esperado**: tag gate `false` → AI saudação = `outro` → MERGE.
- **Risco**: cliente velho fica sem resposta. **Considerar 3ª branch no AI saudação pra "lead conhecido".**

### #36 — Lead já recebeu menu antes (NOVO LEAD setada) volta
- Pré: lead tem **NOVO LEAD**
- **t=0**: "boa tarde"
- **Esperado**: gate `true` → "Oi nome, em que posso te ajudar agora?" → FIM.
- **Risco**: nenhum.

### #37 — Lead tem ambas tags (NOVO LEAD + AGENDOU REUNIÃO)
- Pré: ambas tags ativas
- **t=0**: "oi"
- **Esperado**: gate `true` (OR) → pergunta amigável → FIM. ✅
- **Risco**: nenhum.

### #38 — Lead tem AGENDOU REUNIÃO mas teve dúvida pós-agendamento
- Pré: AGENDOU REUNIÃO setada
- **t=0**: "Esqueci de perguntar quanto custa"
- **Esperado**: gate `true` → "Oi nome, em que posso te ajudar agora?" → FIM.
- **Risco**: lead fica esperando resposta sobre preço, mas a resposta é genérica. **Gate é por design — humano precisa continuar.**

---

## G — Casos de agendamento via AGENDA (5)

### #39 — Lead clica no link de agenda e agenda
- **t=0**: fluxo normal até link agenda ser enviado
- **t=5min**: lead clica e agenda fora do WhatsApp
- **Esperado**: o evento "appointment.scheduled" deveria adicionar tag AGENDOU REUNIÃO no lead.
- **Risco**: ⚠️ **investigar se sistema de agenda dispara evento Inngest pra workflow.** Se não dispara, o gate nunca fecha.

### #40 — Lead clica no link mas NÃO agenda
- **t=0**: link enviado
- **t=1min**: nada
- **Esperado**: follow-up 1min → "conseguiu abrir o link?" → 10min → "sem stress".
- **Risco**: nenhum. Cobre o fluxo.

### #41 — Lead pede pra reagendar
- Pré: tag AGENDOU REUNIÃO
- **t=0**: "preciso reagendar"
- **Esperado**: gate `true` → "Oi nome..." → FIM.
- **Risco**: lead com necessidade legítima fica sem caminho. **Cliente precisa de atendimento humano.**

### #42 — Lead responde "Sim" no form
- **t=0..**: fluxo evento_neon → form preenchido
- **t=20min**: "Sim, quero agendar"
- **Esperado**: AI sim/nao = `sim` → +TAG Agendar → link agenda.
- **Risco**: a próxima mensagem dispara MESSAGE_INCOMING que cai no tag gate. **A tag Agendar não está no gate, então não fecha.** Vai criar run paralelo. **Recomendação: adicionar tag Agendar no gate também.**

### #43 — Lead preenche form mas não responde a última pergunta
- **t=0..**: fluxo evento_neon → preenche perguntas 1-5 e abandona
- **Esperado**: WAIT_FOR_EVENT do branch NEON espera 3 dias → expira sem ação.
- **Risco**: lead com intenção parcial não recebe nada. **Considerar follow-up no abandono do form.**

---

## H — Edge cases linguísticos (5)

### #44 — Lead em inglês
- **t=0**: "Hi"
- **Esperado**: AI saudação pode classificar como `saudacao` (genérico) ou `outro`.
- **Risco**: menu em português pode confundir lead que fala inglês.

### #45 — Lead com erro de digitação grosseiro
- **t=0**: "oi sera que voccceesss tem ferrramnt q ajdua a gente?"
- **Esperado**: AI saudação = `saudacao` (provavelmente). Menu enviado.
- **Risco**: aceitável.

### #46 — Lead manda áudio com saudação
- **t=0**: [áudio "oi tudo bem?"]
- **Esperado**: o sistema não transcreve áudio na hora, então `lead.lastMessage` fica vazio → AI saudação = `outro` → MERGE silencioso.
- **Risco**: silêncio frio. **Considerar prompt no audio: "respondemos por escrito".**

### #47 — Lead manda meme/figurinha
- **t=0**: [figurinha]
- **Esperado**: similar a foto/áudio.
- **Risco**: silêncio.

### #48 — Lead com gírias regionais
- **t=0**: "salve"
- **Esperado**: AI provavelmente classifica como `saudacao` (é cumprimento informal).
- **Risco**: aceitável.

---

## I — Timings (2)

### #49 — Lead manda saudação fora do horário comercial
- **t=0** (23:00): "oi"
- **Esperado**: workflow não tem horário comercial — manda menu mesmo à noite.
- **Risco**: lead pode achar estranho receber resposta tão tarde. **Considerar gate de horário.**

### #50 — Lead pega timeout de WAIT_FOR_EVENT
- **t=0**: menu enviado
- **t=60min**: ainda esperando resposta
- **Esperado**: WAIT_FOR_EVENT expira → run termina.
- **Risco**: lead com tag NOVO LEAD ficou pendurada. Próxima mensagem dele cai no gate, ele só vê "Oi nome, em que posso te ajudar?".

---

## Resumo de riscos críticos descobertos

| Risco | Cenários | Severidade | Sugestão |
|---|---|---|---|
| **Race condition em rajada de mensagens** | #29, #31, #32 | 🔴 Alta | Adicionar lock de tag por lead via Inngest idempotency key |
| **Lead em áudio/imagem fica em silêncio** | #18, #19, #46, #47 | 🟡 Média | Branch dedicada no AI saudação que reconhece tipo não-texto |
| **AI cai em `outro` sem responder** | #16, #28, #35 | 🟡 Média | Adicionar branch "duvida_genérica" que pede pra reformular |
| **Form submit não acorda WAIT_FOR_EVENT** | #15, #42, #43 | 🔴 Alta | Confirmar se submit do form dispara evento Inngest `message-incoming` ou similar |
| **Tag "Agendar" não está no gate** | #42 | 🟠 Média | Adicionar `lead.tags contains Agendar` no IF inicial |
| **Lead novo silencioso fica com NOVO LEAD pra sempre** | #10, #50 | 🟢 Baixa | TTL na tag NOVO LEAD via cron (auto-limpa após 7 dias) |
| **Sem horário comercial** | #49 | 🟢 Baixa | Aceito pro evento (dia único). Adicionar depois. |
| **Lead em inglês recebe português** | #44 | 🟢 Baixa | Branch i18n no AI saudação |

---

## Checklist pré-evento

- [ ] Validar #1, #2, #11 manualmente com leads de teste reais (recomendado).
- [ ] Confirmar se o form submit dispara evento `message-incoming` (cenário #15/#42).
- [ ] Adicionar tag "Agendar" no gate inicial pra prevenir loop após agendar via form.
- [ ] Verificar idempotência do Inngest pra rajadas de mensagens.
- [ ] Avisar equipe humana pra atender leads que caem em `outro`/`ambiguo` (não há fallback automático).
- [ ] Backup: ter consultor humano monitorando o Tracking durante o evento.

---

## Como simular um cenário

Via "Testar passo-a-passo" no editor visual:
1. Abre o workflow → Testar passo-a-passo
2. Trigger inicial = MESSAGE_INCOMING
3. Mock do lead = preencher nome+email+phone
4. Após cada node, o painel mostra qual branch a IA escolheu

Via API:
```js
fetch('/api/rpc/workflow/dryRun', {
  method:'POST',
  headers:{'content-type':'application/json'},
  body: JSON.stringify({json: {
    workflowId: 'yqknxfs0a9n7z5j4ecorgubk',
    triggerType: 'MESSAGE_INCOMING',
    mockLead: { id: 'mock', name: 'João Teste', tags: [], lastMessage: 'oi' }
  }})
}).then(r=>r.json()).then(console.log)
```

Mudar `mockLead.lastMessage` e `mockLead.tags` pra cobrir cada cenário acima.

---

**Versão**: v1 — 2026-06-11
**Workflow auditado**: `yqknxfs0a9n7z5j4ecorgubk` (40 nodes, 51 edges)
