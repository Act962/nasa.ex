---
id: 0101
titulo: Passo "Enviar para grupo" com resumo do dia nos Gatilhos Automáticos
dominio: workflows
status: em-revisao
autor: Weydson
criada: 2026-10-12
atualizada: 2026-10-12
branch: feature/W-gatilhos-envio-diario-grupo-20261012
pr:
peso: leve
---

# 0101 — Passo "Enviar para grupo" com resumo do dia

## 1. Contexto

A ÓRBITA HUB quer receber todo dia útil, às 08:00, um resumo da operação no grupo de WhatsApp "Tecnologia Orbita Hub". Hoje não dá para montar isso nos Gatilhos Automáticos:

- O quadro "Enviar Mensagem" só envia para o telefone do lead do fluxo. O único envio a grupo do sistema é o aviso de formulário respondido (`send-whatsapp-notification`).
- Nenhum passo coloca números da empresa no texto. O texto por IA não lê o banco.

O que já existe e é reaproveitado: o gatilho "Agendado" (diário ou por dias da semana, spec 0039), o padrão de variação do quadro Enviar Mensagem com janela própria (spec 0099), a busca de grupos do número (`conversation.findChat`) e os períodos do painel do Astro (`computeBriefingPeriod`, spec 0056).

## 2. Objetivo

Um fluxo em modo agente consegue enviar um texto para um grupo de WhatsApp, com os números do dia da empresa preenchidos na hora do envio.

### Não-objetivos

- Enviar para grupo por número da API oficial (a API não permite).
- Imagem, arquivo, áudio ou botões no grupo.
- Resumo por funil ou por pessoa; os números são da empresa inteira.
- Texto escrito por IA.
- Tipo novo de quadro (`NodeType`): é uma variação do Enviar Mensagem, sem migration.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O editor de fluxos em modo agente oferece o passo "Enviar para grupo", com janela própria: busca de grupo pelo nome entre os grupos do número do funil, e o texto. |
| RF-2 | O passo grava funil remetente, id e nome do grupo e o texto (`payload.type = "GROUP_TEXT"`). |
| RF-3 | Na execução, o texto é enviado ao grupo pelo número do funil gravado no passo. Funciona sem lead, portanto também em fluxo com gatilho "Agendado". |
| RF-4 | O texto aceita as variáveis `{{resumo.data}}`, `{{resumo.leads_ontem}}`, `{{resumo.leads_semana}}`, `{{resumo.agendamentos_hoje}}`, `{{resumo.conversas_sem_resposta}}`, `{{resumo.demandas_hoje}}` e `{{resumo.demandas_atrasadas}}`, calculadas no momento do envio para a empresa do fluxo. |
| RF-5 | O passo falha com mensagem clara quando: falta grupo, funil ou texto; o funil não é da empresa da execução; o número é da API oficial; o número está desconectado; não há saldo de Stars. |
| RF-6 | No motor antigo (fluxo fora do modo agente) o passo recusa com "Este passo só funciona em fluxo no modo agente". |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Sem migration e sem função nova no Inngest. |
| RNF-2 | O resumo só é calculado quando o texto usa alguma variável `{{resumo.` (6 contagens no banco). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um funil com número conectado por QR code, quando abro o passo e digito parte do nome de um grupo, então o grupo aparece e posso escolhê-lo.
- [ ] **CA-2** — Dado um fluxo ligado com gatilho "Agendado" e o passo configurado, quando chega o horário, então o grupo recebe o texto uma vez.
- [ ] **CA-3** — Dado um texto com `{{resumo.leads_ontem}}`, quando o passo roda, então o grupo recebe o número de leads criados ontem na empresa.
- [ ] **CA-4** — Dado um passo cujo funil é de outra empresa, quando o fluxo roda, então nada é enviado e o passo falha.
- [ ] **CA-5** — Dado um funil com número da API oficial, quando o fluxo roda, então nada é enviado e o erro diz que a API oficial não envia para grupos.
- [ ] **CA-6** — Dado o número desconectado, quando o fluxo roda, então o passo falha com "desconectado" e nenhuma Star é cobrada.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Número saiu do grupo ou o grupo foi apagado | O provedor recusa; o passo falha com o erro devolvido. |
| CB-2 | Variável `{{resumo.algo}}` que não existe | Fica vazia, como qualquer variável desconhecida do fluxo. |
| CB-3 | Texto acima de 3.000 caracteres depois das variáveis | É cortado em 3.000. |
| CB-4 | Fluxo disparado por lead (não agendado) | A empresa vem do funil do lead; `{{lead.name}}` e as demais variáveis do fluxo continuam valendo. |
| CB-5 | Simulação (dry run) | Mostra o texto com os números, não envia e não cobra. |
| CB-6 | Duas varreduras do agendado no mesmo horário | A reserva de horário do gatilho (`WorkflowScheduleClaim`) já impede o segundo disparo. |

## 6. Decisões de design

### D-1 — Variação do Enviar Mensagem, não quadro novo

Mesmo caminho de "Pedir aceite" e "Preencher formulário" (spec 0099): `payload.type` próprio e janela própria. Quadro novo exigiria valor novo no enum `NodeType`, com migration.

### D-2 — O funil remetente fica gravado no passo

Fluxo agendado roda sem lead, e o contexto da execução não carrega o funil. A janela grava o funil da tela. Como é dado editável, a execução só aceita o funil se ele for da mesma empresa da execução (do gatilho agendado ou do funil do lead).

### D-3 — Resumo por contagem, sem IA

Mesma escolha do painel do Astro (spec 0056): números exatos, sem custo de modelo e sem risco de número inventado. As frases prontas do painel não servem aqui porque são por pessoa ("você tem…") e por semana.

### D-4 — Sem chave de liberação

É só adição: nenhum fluxo existente muda de comportamento. Uma chave `NEXT_PUBLIC_*` dependeria do secret de build (regra 24b) sem ganho.

## 7. Segurança

- O resumo traz números da empresa inteira e vai para todos os participantes do grupo. Só quem tem permissão de criar e editar automações monta o passo, e a janela avisa que todos no grupo veem a mensagem.
- O resumo contém apenas contagens: nenhum nome, telefone ou valor de cliente.
- Funil e grupo gravados no passo são conferidos no servidor: o funil precisa ser da empresa da execução. O id do grupo só é usado como destino no número dessa empresa.
- A busca de grupos usa a rota que já existe e o número do funil aberto na tela.

## 8. Regras da Meta

- Não se aplica à API oficial: o passo recusa número oficial.
- Em número conectado por QR code, envio automático repetido para grupo aumenta o risco de bloqueio do número pelo WhatsApp. O uso previsto é uma mensagem por dia para um grupo interno; o limite de execuções por hora do fluxo protege contra laço.

## 9. Riscos e rollback

- Reverter o commit remove o passo; fluxos que o usarem passam a falhar nesse quadro com "tipo desconhecido", sem efeito nos demais.

## 10. Changelog da spec

- 2026-10-12 — criada. Resumo do dia conferido contra o banco de desenvolvimento por script; envio real ao grupo ainda não testado. Sem runner de teste no projeto (CLAUDE.md, regra 20): critérios de aceite ficam para teste manual.
