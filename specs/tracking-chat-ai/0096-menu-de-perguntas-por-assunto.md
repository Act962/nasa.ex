---
id: 0096
titulo: Menu de perguntas por assunto, respondido sem IA
dominio: tracking-chat-ai
status: aprovada
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr:
peso: completa
---

# 0096 — Menu de perguntas por assunto, respondido sem IA

## 1. Contexto

No atendimento montado a partir do roteiro (spec 0091), o cliente escolhe um assunto no menu inicial, recebe a abertura e, dali em diante, tudo o que ele pergunta vai para a IA. A maior parte são as mesmas perguntas de sempre, e as respostas já estão escritas no roteiro da empresa: o documento da Clínica tem as perguntas e respostas separadas por assunto.

O Weydson propôs (2026-10-11): depois da tag de interesse, um atendimento por opções numeradas. O motivo é custo ("nem tudo precisa ser IA") e previsibilidade.

## 2. Objetivo

Depois de escolher um assunto, o cliente recebe as perguntas mais comuns daquele assunto como opções; a resposta de cada uma sai do roteiro, pelo código, sem chamar IA.

### Não-objetivos

- Trocar a assistente: o que o cliente escrever fora das opções continua indo para ela.
- Tela de edição das respostas nesta entrega (fica para a seguinte; ver seção 9).
- Menus para funil que não foi montado a partir de roteiro.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Um menu por assunto do roteiro, guardado como menu salvo do atendimento (`AiButtonPreset`), com o nome "Perguntas: {assunto}". Sem tabela nem coluna nova: a resposta de cada opção vai junto da opção |
| RF-2 | Até 6 perguntas por assunto, mais "Agendar avaliação" e "Falar com atendente" quando o funil tem o menu de botões ligado (são os cliques `cli:book` e `cli:human`, que o menu de botões já resolve sem IA) |
| RF-3 | **A resposta é o texto do roteiro, palavra por palavra.** A IA só ajuda a escolher quais perguntas entram e a escrever o título curto (até 24 caracteres, limite da lista do WhatsApp). Sem IA, valem as primeiras perguntas do assunto com o título cortado |
| RF-4 | O menu sai junto com a abertura do assunto, numa mensagem só: o passo do fluxo do assunto passa de texto para "menu salvo" |
| RF-5 | Clique numa pergunta: o código responde com o texto do roteiro e repete as opções, na mesma mensagem ("Quer saber mais alguma coisa?"). Nenhuma chamada de IA |
| RF-6 | Número oficial: lista para tocar. Número não oficial: texto numerado, com a resposta por número valendo como clique (spec 0095) |
| RF-7 | A assistente não enxerga esses menus no catálogo dela: quem envia é o fluxo e o código |
| RF-8 | Os menus nascem **desligados** e os fluxos não são alterados na geração. Ligar é um passo separado, depois da revisão |
| RF-9 | O mapa da operação mostra o menu do assunto como os demais menus salvos (spec 0092) |

## 4. Critérios de aceite

- [x] **CA-1** — Do documento do roteiro saem os assuntos com as perguntas e respostas de cada um, sem IA; "Informações gerais" não vira menu.
- [x] **CA-2** — Toda resposta do menu é idêntica a um trecho do documento do roteiro.
- [x] **CA-3** — Todo título tem até 24 caracteres e não se repete dentro do menu; o corpo da mensagem cabe no limite da lista do WhatsApp.
- [x] **CA-4** — Clique numa pergunta devolve a resposta daquela opção; id que não é de um menu de perguntas, ou de menu que não existe mais, volta para a assistente.
- [x] **CA-5** — Sem menu de botões ligado no funil, as linhas "Agendar avaliação" e "Falar com atendente" não entram.
- [x] **CA-6** — A geração não liga nada: menus criados desligados, fluxos iguais.
- [ ] **CA-7** — Em conversa real: escolher o assunto, receber abertura com as opções, tocar numa pergunta, receber a resposta do roteiro e as opções de novo, sem execução da assistente.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Assunto com menos de 2 perguntas no roteiro | Não ganha menu; segue como hoje |
| CB-2 | Resposta do roteiro mais longa que o limite da mensagem | Cortada no fim de uma frase; a pergunta continua no menu |
| CB-3 | Cliente toca numa pergunta de um menu antigo, depois de o roteiro ser refeito | Se a opção ainda existe, responde; se não, vai para a assistente |
| CB-4 | Cliente clica muitas vezes seguidas | Vale o mesmo limite de respostas por hora do atendimento |
| CB-5 | Roteiro refeito pelo Astro | Os menus são regerados; menu que a pessoa editou à mão é sobrescrito (avisado na proposta) |
| CB-6 | Fluxo do assunto foi editado e não tem mais o passo de abertura | Ligar os menus pula esse fluxo e avisa |

## 6. Decisões de design

### D-1 — A resposta é sempre o texto do roteiro
- **Escolha**: a IA não redige resposta de menu. Ela só escolhe e dá título.
- **Alternativas descartadas**: deixar a IA resumir a resposta para caber melhor. Traz de volta o risco de inventar, que é o que o menu quer evitar.
- **Consequência**: resposta longa no roteiro fica longa no WhatsApp (até o corte do CB-2).

### D-2 — Menu salvo, não fluxo com uma saída por pergunta
- **Escolha**: as respostas ficam no menu salvo e o código responde ao clique.
- **Alternativas descartadas**: um fluxo com "Esperar o clique" e um passo por resposta. Ficaria visível no editor, mas só funciona em número oficial, exige a opção de botões em fluxo e multiplica os passos (6 assuntos × 6 respostas).
- **Consequência**: as respostas não aparecem como passos no editor; aparecem no menu salvo.

### D-3 — Sem tabela nova
- **Escolha**: `AiButtonPreset.buttons` já é JSON livre; cada opção ganha o campo `answer`. O assunto é reconhecido pelo id da opção (`tq:{tag}:{n}`).
- **Consequência**: a aba "Botões" de hoje mostra o menu, mas ainda não edita a resposta.

## 7. Segurança

- O id do clique é entrada do cliente: só vale se pertencer a um menu de perguntas ativo **daquele funil**; a resposta enviada é a gravada no menu, nunca algo vindo da mensagem.
- As respostas vêm do documento que a própria empresa aprovou para o atendimento. Nada de outro funil ou empresa entra.
- Os menus nascem desligados, para ninguém receber resposta não revisada.
- O limite de respostas por hora por cliente continua valendo.

## 8. Regras da Meta

- Lista interativa: até 10 linhas, título de até 24 caracteres, corpo de até 1.024 caracteres. Conferido na geração.
- Mensagem interativa só sai dentro da janela de 24 horas: o menu é sempre resposta a um clique ou a uma mensagem do cliente.
- Em número não oficial não há botão nem lista (spec 0095).
- O passo "menu salvo" dentro de um fluxo, em número oficial, depende de `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` (spec 0090, seção F).

## 9. O que fica para depois

- Tela para editar título e resposta de cada opção.
- O Astro gerar os menus junto com o roteiro e oferecer o "ligar" na conversa.

## 10. Riscos e rollback

- Risco: resposta do roteiro desatualizada vira resposta automática. Mitigado por nascer desligado e pela revisão.
- Rollback: desligar os menus de perguntas e voltar o passo do fluxo para texto. Sem migration.

## 11. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Criada e aprovada na conversa ("pode escrever a spec e gerar os menus da Clínica") |
| 2026-10-11 | Weydson | **Implementada até a geração; nada ligado.** `tracking-chat-ai/lib/topic-menu.ts` (puro: lê os assuntos do documento do roteiro, monta as opções, corta títulos e respostas, acha a resposta do clique), `topic-menu-handler.ts` (responde ao clique com o texto do roteiro e repete as opções, numa mensagem só; entra em `agent.ts` antes do menu do roteiro), `attendance-setup/build-topic-menus.ts` (`buildTopicMenus`, `saveTopicMenus`, `switchTopicMenus`). A assistente deixou de enxergar esses menus no catálogo. `scripts/verify-topic-menu.ts` (17 verificações). **Menus da Clínica gerados e gravados desligados**: seis assuntos, seis perguntas cada, mais "Agendar avaliação" e "Falar com atendente"; a escolha das perguntas e dos títulos custou US$ 0,0016 por rodada no `gpt-4.1-mini` (duas rodadas), e as respostas são o texto do documento. Ajustes depois de ver o resultado: título que passa de 24 caracteres perde o "O que é a" e é cortado em palavra inteira; a pergunta do fim da abertura sai, porque as opções vêm logo abaixo. **Ainda não feito**: ligar na Clínica (`scripts/switch-topic-menus.ts`, não rodado), o teste em conversa real (CA-7), a tela de edição das respostas, e o Astro gerar os menus junto com o roteiro. Em número oficial, ligar depende de `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` |
