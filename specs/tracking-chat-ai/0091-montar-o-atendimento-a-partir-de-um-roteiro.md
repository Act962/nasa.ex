---
id: 0091
titulo: Montar o atendimento a partir de um roteiro colado no Astro
dominio: tracking-chat-ai
status: em-revisao
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr: Act962/nasa.ex#454
peso: leve
---

# 0091 — Montar o atendimento a partir de um roteiro colado no Astro

## 1. Contexto

Muitas empresas já têm o atendimento escrito: um texto longo, de várias páginas, com o nome da assistente, as regras, o menu inicial e as perguntas e respostas de cada assunto. É o texto que usavam para treinar um assistente em outra ferramenta. O caso real que motivou esta spec é o roteiro da Clínica Tércio Rezende (69 mil caracteres, 6 assuntos, cerca de 110 perguntas e respostas).

Hoje, para trazer isso para a plataforma, alguém precisa criar à mão o documento na Auto Inteligência, as instruções, o menu de botões, as tags e um fluxo por assunto. A spec 0088 já monta o atendimento a partir do **site**; a 0090 cria **um fluxo** a partir de uma frase. Faltava o caminho para quem já tem o roteiro pronto.

## 2. Objetivo

A pessoa cola o roteiro na conversa do Astro e, depois de confirmar, o atendimento do funil fica montado e desligado para revisão.

## 3. Escopo

**Entra**

- Ação `attendance.setup_from_script` no registro do Astro. Um roteiro colado (texto longo que fala de atendimento) vai direto para ela, sem classificador.
- Organização do roteiro por IA em duas passadas: a estrutura e, depois, as perguntas e respostas de cada assunto.
- O que é criado, tudo desligado: documento na Auto Inteligência (um por funil; reenviar atualiza), nome e instruções da assistente, menu inicial salvo (botões até 3 opções, lista acima disso), uma tag de interesse por opção e um fluxo por assunto (tag de interesse → abertura do roteiro).
- Lista de contradições encontradas no próprio roteiro, mostrada antes da confirmação.

**Não entra**

- Ligar o atendimento, os fluxos ou a IA do funil.
- Agendas, PIX, voz.
- Fluxos com mais passos que "tag → abertura". Quem quiser cadência usa "Criar fluxo com ASTRO" (0090).

## 4. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Texto com 1.200 caracteres ou mais que fale de atendimento, assistente, WhatsApp ou chatbot é tratado como roteiro, pelo texto original (`claimsText`), antes dos padrões de frase |
| RF-2 | A prévia mostra: quantas respostas, o nome da assistente, as opções do menu, tags e fluxos, e as contradições do roteiro. Nada é gravado na prévia além do registro de uso |
| RF-3 | O "sim" grava exatamente o rascunho mostrado (guardado pelo código), numa transação só |
| RF-4 | Funil que já tem instruções escritas: o Astro pergunta se troca pelas do roteiro ou mantém |
| RF-5 | Fluxo com o mesmo nome já existente no funil não é refeito; o resumo diz quais ficaram |
| RF-6 | O documento respeita o teto de leitura do atendimento. Se o roteiro não couber, o resumo diz quantas respostas ficaram de fora |
| RF-7 | Valores, nomes, endereços e links entram como estão no roteiro. Contradição não é resolvida em silêncio: entra a versão mais específica e a contradição é listada |
| RF-8 | Modelo reserva de outro provedor quando o principal falha |

### Segurança

- Só dono ou administrador da empresa. O funil é resolvido dentro da empresa de quem pede.
- O roteiro é do dono da conta, então o nome da assistente e as regras vêm dele (diferente do site, 0088). Mesmo assim o modelo que organiza não recebe ferramenta nenhuma: só devolve o rascunho, e quem grava é o código, depois do "sim".
- Pelo WhatsApp a ação não roda: manda continuar na plataforma.
- Limite de 5 organizações de roteiro por empresa a cada 24 horas.
- Nada nasce ligado. Configuração nova de IA deixa o atendimento do funil desligado.

### Regras da Meta

- Menu inicial: até 3 opções vira botões; acima disso, lista. Título de cada opção cortado em 24 caracteres e sem repetição.
- As aberturas dos fluxos são texto livre: na API oficial só chegam dentro de 24 horas da última mensagem do cliente. Como o gatilho é a tag de interesse aplicada durante a conversa, a janela costuma estar aberta; o editor avisa.

## 5. Critérios de aceite

- [x] **CA-1** — Roteiro colado é reconhecido sem classificador; pedido curto não é.
- [x] **CA-2** — A prévia devolve a proposta e guarda o rascunho para a confirmação.
- [x] **CA-3** — A prévia não cria fluxo.
- [x] **CA-4** — O "sim" grava e nenhum fluxo criado nasce ligado.
- [x] **CA-5** — Organização do roteiro pela IA, do começo ao fim, com um roteiro real. Verificado em 2026-10-11 com o roteiro da Clínica Tércio Rezende (gpt-4o, cerca de 20 s, 154 mil tokens de entrada): assistente "Oculina", 24 regras, 8 informações gerais, 6 opções de menu e 119 respostas por assunto, documento de 26 mil caracteres. Só a organização; a gravação a partir desse rascunho não foi rodada.
- [ ] **CA-6** — Roteiro colado no campo da conversa do Astro na tela (tamanho da mensagem aceito de ponta a ponta). **Não verificado.**

Conferência: `scripts/attendance-script-check.ts`.

## 9. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Criada junto com a implementação, a pedido, com o roteiro real da Clínica Tércio Rezende. Arquivos: `tracking-chat-ai/lib/attendance-setup/{script-draft,extract-script-draft,apply-script-draft}.ts`, `astro/actions/tracking/setup-attendance-from-script.ts`, `claimsText` em `astro/actions/types.ts` e `match-intent-pattern.ts`. O teto de leitura do atendimento na Auto Inteligência subiu de 24 mil para 40 mil caracteres (`attendance-knowledge.ts`), porque um roteiro completo não cabia; isso vale para todas as empresas e aumenta o texto enviado ao modelo a cada resposta de quem tem documentos grandes. A geração não é cobrada em Stars. No ambiente de desenvolvimento o rascunho da clínica foi organizado à mão (os provedores de IA estavam fora) e gravado pelo mesmo caminho do "sim" |
| 2026-10-11 | Weydson | Com o crédito da OpenAI de volta, a organização pela IA foi rodada de verdade. A primeira versão, numa passada só, resumia demais (22 respostas de cerca de 120). Passou a ser em etapas sobre o mesmo roteiro: estrutura; depois, em paralelo, informações gerais, revisão de contradições e uma chamada por assunto. Custo: o roteiro inteiro vai em cada chamada (9 chamadas para 6 assuntos). **Limite conhecido da revisão de contradições**: achou 3 das 8 que uma leitura atenta acha (regra de não citar médicos, de não agendar direto e de não informar horários) e trouxe 2 que não são contradição; não pegou nomes diferentes da mesma unidade, grafias da lista de convênios nem o valor da avaliação dito de dois jeitos. A lista ajuda, mas não substitui a revisão da empresa |
| 2026-10-11 | Weydson | **Teste real no WhatsApp e corte de custo, depois de o Weydson apontar US$ 1,33 gastos no dia.** (1) No teste, o menu fixo de agendamento (0089) respondeu antes do roteiro: a montagem passou a desligá-lo quando o roteiro tem menu próprio. (2) A assistente descreveu o menu em texto em vez de enviar a lista: a saudação com o menu passou a sair **pelo código** (`lib/script-menu.ts`) no começo da conversa e quando o cliente manda só uma saudação ou "menu", sem chamada de modelo. (3) **Custo por resposta**: o documento do roteiro ia inteiro a cada mensagem (9,8 mil tokens de entrada numa resposta a um "oi"). Agora vai só o recorte: informações gerais mais os assuntos em pauta, escolhidos sem IA pelas tags do lead e pelas palavras das últimas mensagens (`attendance-setup/script-knowledge-focus.ts`); no roteiro da clínica, 22 mil caracteres viram 3,4 mil numa saudação e 5,9 mil com um assunto. Cada assunto do documento ganhou uma linha "> Quando:" que serve de pista para o recorte. A chamada de voz continua recebendo o documento inteiro. (4) O teto de leitura voltou a 24 mil caracteres: a subida para 40 mil aumentava o custo de todas as empresas e deixou de ser necessária. (5) **Custo da montagem**: a organização do roteiro passou de gpt-4o para gpt-4.1-mini (estimativa: de US$ 0,45 para menos de US$ 0,10 por montagem). **Não verificado** com o modelo pequeno: a qualidade precisa de uma rodada paga. A maior parte do gasto do dia foi de quatro rodadas de teste da organização do roteiro com o modelo grande, feitas por script |
| 2026-10-11 | Weydson | **Teste real no WhatsApp: a assistente repetia o nome e o cliente recebia duas respostas por clique.** O Weydson mandou "Oi", escolheu "SLT (Glaucoma)" e recebeu "👋 Olá! Tudo bem? Sou a Oculina…" logo depois de o menu já ter dito "Eu me chamo Oculina", seguido de uma segunda mensagem. Duas causas: (1) a abertura de cada assunto é o texto do roteiro da empresa, que cumprimenta e se apresenta de novo em todo assunto; (2) depois do clique, o fluxo do assunto respondia **e** a assistente também. Ajustes: `stripRepeatedIntroduction` (em `attendance-setup/script-draft.ts`) tira saudação, cortesia e apresentação do começo da abertura ao montar o fluxo, mantendo o conteúdo (inclusive quando a apresentação vem emendada: "Sou a Oculina…, e vou te explicar…" vira "Vou te explicar…"); e `handleScriptMenu` passou a calar a assistente quando o clique acabou de aplicar uma tag que um fluxo ligado do funil responde (economiza também uma chamada de IA por clique). Se a tag já existia ou nenhum fluxo ligado responde a ela, a assistente responde como antes. `scripts/verify-script-topic-opening.ts` (8 verificações). Os seis fluxos da Clínica no banco de desenvolvimento foram corrigidos com a mesma função. **Limite**: se o fluxo falhar depois do clique, o cliente fica sem resposta até escrever de novo. **Não conferido em conversa real** depois do ajuste |
| 2026-10-11 | Weydson | **Os dois menus juntos e agendamento pela conversa** ("pode fazer os dois"). (1) **Menus**: o menu do roteiro continua abrindo a conversa e, quando o funil tem o menu de botões ligado e agenda disponível, leva junto as linhas "Agendar consulta" e "Meus horários" (`withBookingRows` em `script-menu.ts`, respeitando o teto de 10 linhas da lista). Esses cliques são do menu de botões da spec 0089, que marca sem IA; a saudação em texto passa a ser sempre do menu do roteiro (`handleGuidedMenu` cede a vez quando o funil tem o menu do roteiro). Montar o atendimento pelo roteiro deixou de desligar o menu de botões. (2) **Instruções**: com agenda ligada no funil, as regras do roteiro que proíbem marcar ou citam o setor de agendamento saem, as que só terminam em "encaminhar ao agendamento" têm o trecho trocado por "oferecer os horários da agenda e marcar", e entra a regra de marcar pela agenda (`scriptBehaviorRules`; `allowBookingInPrompt` para instruções já gravadas). Sem agenda, as regras ficam como vieram. `scripts/verify-script-topic-opening.ts` passou a 15 verificações. **Na Clínica (banco de desenvolvimento)**: instruções ajustadas (três proibições fora, duas regras adaptadas), menu de botões religado e as tags de interesse do contato de teste removidas. **Não conferido em conversa real** |
| 2026-10-11 | Weydson | **Conversa real depois dos ajustes.** Confirmado: a abertura do assunto sai sem repetir saudação e nome; depois do clique vem uma mensagem só (a do fluxo); o menu do roteiro saiu com "Agendar consulta" e "Meus horários"; e a assistente, ao ouvir "queria agendar", passou a oferecer a unidade em vez de encaminhar. **Defeito achado e corrigido**: a assistente reenviou a saudação com o menu no meio da conversa, usando o menu salvo como ferramenta, porque as instruções diziam "na primeira mensagem… envie o menu inicial". Agora o menu inicial do roteiro fica fora do que a assistente enxerga (`agent.ts`), as instruções geradas dizem que a saudação e o menu já foram enviados, e a instrução da Clínica foi trocada |
| 2026-10-11 | Weydson | **Teste real completo (menu, assunto, duas perguntas do roteiro, agendamento, pergunta livre): uma única chamada de IA, e três ajustes.** (1) **"Voltar ao menu" abria o menu errado**: trazia o menu curto de agendamento (Agendar · Meus horários · Mais opções) em vez do menu do roteiro. Em funil com menu do roteiro, o clique em "Menu" passa a ser dele (`guided-menu.ts` devolve a mensagem; `script-menu.ts` reconhece `cli:menu`). (2) **Apresentação repetida**: no meio da conversa (há mensagem nas últimas 12 h) o menu volta só com "Escolha uma opção ou escreva sua dúvida.", sem "Olá! Aqui é…", tanto no clique quanto ao digitar "menu"; vale também para o menu de botões sem roteiro (`showMenu(isReturning)`). (3) **Espera de 3 s nos toques**: o atendimento espera 3 s para juntar mensagens digitadas em sequência; num toque isso só atrasa. Toques passam a ir por uma função própria sem espera (`chat-ai-whatsapp-button-click`, evento `chat/ai.whatsapp-button-clicked`), **só com `ATTENDANCE_CLICK_NO_DEBOUNCE=true`**: a função nova só existe em produção depois do "Resync" do Inngest, e sem a trava os toques ficariam sem resposta entre o deploy e o resync. Ausente = tudo como antes. Medição do teste local: 12 s por toque (6 s até o servidor receber, 3 s da espera, 3 s para responder); só a espera é igual em produção. |
