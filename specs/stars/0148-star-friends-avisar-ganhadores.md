---
id: 0148
titulo: Avisar os ganhadores do sorteio pelo WhatsApp com um modelo aprovado
dominio: stars
status: em-revisao
autor: João Gabriel
criada: 2026-11-23
atualizada: 2026-11-23
branch: feature/star-friends-armazem-carvalho-20261123
pr:
peso: leve
---

# 0148 — Avisar ganhadores do sorteio

## 1. Contexto

Depois do sorteio ao vivo ([spec 0134](0134-star-friends-sorteio-ao-vivo.md)), a empresa manda à mão, um por um, o modelo de parabéns para cada ganhador. O Armazém Carvalho tem 10 prêmios e o sorteio em 28/11/2026; outras campanhas podem ter dezenas. A spec 0134 deixou "avisar o ganhador pelo WhatsApp" como não-objetivo.

O sorteio já guarda, por posição, o número, o nome e o telefone do ganhador (`LoyaltyCampaignDraw`). O envio de modelo aprovado pela API oficial já existe (`provider.sendTemplate`, `message/create-template.ts`).

## 2. Objetivo

Com um clique no quadro "Sorteio", mandar o modelo de parabéns para todos os ganhadores ainda não avisados, com nome, número da sorte e prêmio de cada um, depois de conferir uma prévia.

### Não-objetivos

- Envio automático na hora do sorteio (D-1).
- Modelo com mídia no cabeçalho ou botão com variável (o envio de hoje não preenche esses campos).
- Aviso aos participantes que não ganharam.
- Número que não é da API oficial: fora da janela de 24 h só modelo aprovado chega.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | A campanha ganha **nomes dos prêmios**, opcionais, um por posição (1º, 2º…). São preenchidos na própria janela do aviso, ao lado de cada ganhador, e gravados no envio: o formulário da campanha trava quando o sorteio começa, e prêmio surpresa só é decidido depois. |
| RF-2 | No quadro "Sorteio", o botão **"Avisar ganhadores"** aparece com pelo menos um ganhador ativo (não revogado) ainda não avisado. Permissão "Aprovar". |
| RF-3 | A janela lista os modelos aprovados do número da campanha que o sistema consegue enviar. Para cada variável do modelo, escolhe-se o que entra: nome do ganhador, primeiro nome, número da sorte, prêmio da posição, posição (1º…), nome da campanha ou um texto fixo. |
| RF-4 | A janela mostra a prévia da mensagem de cada ganhador que vai receber. Se uma variável usa "prêmio" e alguma posição não tem nome, o envio é bloqueado dizendo quais posições faltam. |
| RF-5 | O envio vai só para ganhadores ativos e não avisados, pelo número da campanha, e fica no chat do lead quando ele tem conversa nesse número. Cada envio cobra como a mensagem de modelo da tela de chat. |
| RF-6 | Cada ganhador avisado guarda quando foi avisado; falha guarda o motivo e o ganhador continua "não avisado", para tentar de novo. A lista mostra "Avisado em…" ou "Falhou: …". |
| RF-7 | Ganhador avisado **não pode ser revogado**: a mensagem já chegou. A janela avisa isso antes de confirmar. |

| ID | Não-funcional |
| --- | --- |
| RNF-1 | Dois cliques simultâneos não mandam duas mensagens para o mesmo ganhador. |
| RNF-2 | Sem função nova no Inngest: o envio roda na própria chamada, em lotes de 10 em paralelo (100 ganhadores ≈ 10 lotes). |
| RNF-3 | Escopo da empresa: campanha, número e ganhadores sempre conferidos pelo `organizationId` da sessão. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um sorteio com 3 ganhadores ativos e um modelo de 4 variáveis, quando avisa, então cada um recebe a mensagem com o próprio nome, número e prêmio, e os 3 ficam "Avisado em…".
- [ ] **CA-2** — Dado um ganhador já avisado, quando avisa de novo, então ele não recebe outra mensagem.
- [ ] **CA-3** — Dado um modelo que usa "prêmio" e a 2ª posição sem nome, quando abre a prévia, então o envio fica bloqueado citando a 2ª posição.
- [ ] **CA-4** — Dado um ganhador avisado, quando tenta revogar, então é recusado.
- [ ] **CA-5** — Dado um ganhador revogado, quando avisa, então ele não recebe.
- [ ] **CA-6** — Dado um número que não é da API oficial ou campanha sem funil, quando abre a janela, então ela explica o motivo e não envia.
- [ ] **CA-7** — Dado que a Meta recusa um envio, então aquele ganhador fica com o motivo, os outros seguem e ele pode ser avisado de novo.

## 5. Casos de borda

| # | Caso | Comportamento |
| --- | --- | --- |
| CB-1 | Campanha com "Qualquer funil" | Pede para escolher o funil na campanha: os modelos são do número. |
| CB-2 | Ganhador sem conversa no número da campanha | A mensagem sai pelo telefone do cadastro e não fica em chat. |
| CB-3 | Revogar durante o envio | O envio só pega ganhador ativo na hora de reservar; revogar depois de reservado é recusado (RF-7). |
| CB-4 | Prêmios com nomes a mais que a quantidade | Ignorados. |

## 6. Decisões

- **D-1 — Botão, não envio automático.** O sorteio pode ser revogado em 30 minutos; mensagem automática avisaria quem pode perder o prêmio. O botão também deixa a empresa escolher a hora e conferir a prévia.
- **D-2 — Mapeamento de variáveis na janela, não salvo.** Cada empresa nomeia o modelo de um jeito; guardar o mapeamento seria configuração a mais para um uso por campanha.
- **D-3 — Colunas, não tabela.** `prize_names text[]` na campanha; `notified_at`, `notify_message_id` e `notify_error` no sorteio. O aviso é 1 por ganhador e vive com o sorteio.

## 7. Impacto

- [x] Schema: migration só adiciona colunas (com default/nulas).
- [x] Procedures: `starFriends.campaign.notifyWinners`; `save` aceita `prizeNames`; `revokeDraw` recusa avisado.
- [ ] Inngest: nada.
- [x] Documentação: `docs/star-friends.md` (seção da campanha); changelog da 0134.

## 8. Changelog

- 2026-11-23 — criada.
