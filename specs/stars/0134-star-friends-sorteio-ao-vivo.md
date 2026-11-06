---
id: 0134
titulo: Sorteio ao vivo, simulador, revogação de ganhador, ajuste de números e exclusão de participante no STAR FRIENDS
dominio: stars
status: em-revisao
autor: João Gabriel
criada: 2026-11-06
atualizada: 2026-11-06
branch: feature/star-friends-sorteio-ao-vivo-20261106
pr:
peso: leve
---

# 0134 — Sorteio ao vivo no STAR FRIENDS

## 1. Contexto

A campanha de sorteio por cupom (spec 0102) sorteava todos os prêmios de uma vez, com um clique, sem tela para o público e sem volta. O Mercadinho Preço Baixo vai fazer 15 sorteios em evento, apresentados num telão. Também faltava excluir participante pela tela (só dava por SQL) e a quantidade de ganhadores ficava escondida no fim do formulário da campanha.

## 2. Objetivo

Sortear um prêmio por vez numa tela própria para apresentação, testar antes num simulador, desfazer um sorteio feito por engano e excluir participantes pela tela.

### Não-objetivos

- Personalizar a tela (cores, logo, música). Fica para a versão "mais profissional" do módulo.
- Avisar o ganhador pelo WhatsApp automaticamente.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Tela `/star-friends/sorteio` em tela cheia (botão e tecla F), com nomes passando, revelação do ganhador e confete. Espaço ou Enter sorteia. |
| RF-2 | O sorteio tira **um número por vez**, na menor posição de prêmio livre, entre os números válidos de quem ainda não ganhou. Cada número tirado grava semente, tamanho da lista, quem sorteou e quando (`LoyaltyCampaignDraw`). Continuam valendo as travas da spec 0102: varredura feita depois do último cupom e nenhum cupom em conferência. |
| RF-3 | O primeiro número tirado fecha a campanha para cupons novos (`isActive = false`) e congela a lista: a varredura não roda mais e as regras da campanha não mudam. Só a quantidade de ganhadores continua editável. A campanha fica concluída (`drawnAt`) quando todos os prêmios saem. |
| RF-4 | Um sorteio pode ser **revogado em até 30 minutos**, com motivo opcional. O número volta a concorrer e o prêmio volta a ficar livre: o próximo sorteio o repõe. O sorteio revogado continua no histórico, riscado. |
| RF-5 | Simulador (`/star-friends/sorteio?modo=simulacao`): a mesma tela, com os nomes reais da campanha (ou nomes fictícios, se ainda não há números), sorteio feito no navegador e **nada gravado**. Dá para escolher quantos prêmios simular e recomeçar. |
| RF-6 | A quantidade de ganhadores fica no quadro "Sorteio" da aba Campanha e num cartão da aba Configurações. Não pode ficar abaixo de uma posição já sorteada. |
| RF-7 | A aba Participantes tem botão de excluir (permissão "Excluir"). Some o participante com extrato, resgates, cupons e números. Ganhador com sorteio ativo não pode ser excluído: revoga-se antes. |
| RF-8 | **Lançar cupom manual** (permissão "Aprovar"): escolhe-se um participante da campanha e informa-se valor, data e número do cupom (os dois últimos opcionais) e um motivo. Os números saem pela mesma conta do cupom do WhatsApp, somando a sobra. Com uma loja só na campanha, o CNPJ dela entra no cupom, e o cupom repetido (mesmo número, dia e valor) é barrado. O cupom fica com o alerta "Lançado manualmente por …" e o sorteio volta a exigir varredura. Não roda com o sorteio em andamento. |
| RF-9 | **Anular cupom aceito** (permissão "Aprovar"), com motivo obrigatório: o cupom vira "Anulado", os números dele deixam de concorrer, o valor sai do total do participante e a sobra é recalculada. Se a sobra desse cupom ajudou a formar números de outros cupons, os números a mais (os mais novos, nunca um sorteado) também saem. As stars dos números anulados são estornadas no extrato (`REVERSAL` negativo). Cupom com número sorteado não é anulado: revoga-se antes. Vale também com o sorteio em andamento. |
| RNF-1 | A tela do telão mostra nome e sobrenome e o telefone mascarado (DDD e 4 finais). O telefone completo fica só na aba Campanha. |
| RNF-2 | Dois cliques simultâneos em "Sortear" não tiram dois números para o mesmo prêmio: a transação trava a linha da campanha antes de ler os ganhadores. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma campanha com 3 prêmios e varredura em dia, quando se sorteia três vezes, então saem as posições 1, 2 e 3, a campanha fecha para cupons no primeiro e fica concluída no terceiro; um quarto sorteio é recusado.
- [ ] **CA-2** — Dado um participante com vários números, quando ele é sorteado, então nenhum outro número dele sai nos prêmios seguintes.
- [ ] **CA-3** — Dado o 2º prêmio sorteado há menos de 30 minutos, quando é revogado, então o número volta a concorrer e o próximo sorteio sai na posição 2. Com mais de 30 minutos, a revogação é recusada.
- [ ] **CA-4** — Dados 3 prêmios sorteados, quando se tenta reduzir para 2, então é recusado; quando se aumenta para 4, a campanha deixa de estar concluída e o 4º pode ser sorteado.
- [ ] **CA-5** — Dado o simulador aberto, quando se sorteiam prêmios, então nada é gravado no banco.
- [ ] **CA-6** — Dado um participante sem sorteio ativo, quando é excluído, então somem o cadastro, os cupons e os números; se ele for ganhador, a exclusão é recusada.

- [ ] **CA-7** — Dado um participante com R$ 0 de sobra, quando se lança à mão um cupom de R$ 250 (R$ 100 por número), então ganha 2 números, fica com R$ 50 de sobra e o sorteio volta a exigir varredura. Para quem não está na campanha, ou com o sorteio em andamento, o lançamento é recusado.
- [ ] **CA-8** — Dado um cupom aceito que rendeu 2 números e 2 stars, quando é anulado, então os números saem do sorteio, as 2 stars são estornadas e o participante não fica com mais números do que o valor válido dá. Cupom com número sorteado não é anulado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Menos participantes do que prêmios | Sorteia enquanto houver gente; depois recusa com "Não há números válidos para sortear". |
| CB-2 | Campanha sorteada antes desta spec (todos de uma vez) | Continua mostrando os ganhadores marcados nos números; não há revogação para ela. |
| CB-3 | Ganhador revogado e participante excluído depois | O registro do sorteio guarda código, nome e telefone, e continua legível. |
| CB-4 | Navegador bloqueia a tela cheia | Aviso para usar F11. A tela inteira (não só o palco) entra em tela cheia, para as janelas de confirmação aparecerem. |
| CB-6 | Anular cupom cujas stars já foram trocadas por prêmio | O estorno entra mesmo assim e o saldo pode ficar negativo. O resgate feito não é desfeito. |
| CB-7 | Programa STAR FRIENDS desligado quando o cupom entrou | Não houve stars; a anulação só tira os números. |
| CB-5 | Lista recarrega antes da animação acabar | No telão a lista só recarrega depois da revelação, para o ganhador não aparecer no rodapé antes da hora. |

## 6. Decisões

- **D-1 — Um por vez em vez de todos de uma vez.** No evento cada prêmio é anunciado; sortear tudo antes estragaria a apresentação e impediria corrigir um clique errado só daquele prêmio. A regra de sorteio é a mesma da spec 0102 (sha256 da semente módulo o tamanho da lista ordenada por código).
- **D-2 — Revogação devolve o número à disputa.** O caso de uso é "sorteamos sem querer". Se a pessoa precisar ser desclassificada de vez, o caminho é anular o cupom ou excluir o participante.
- **D-4 — Adicionar números só por cupom com valor.** Decisão de João Gabriel em 2026-11-06: número avulso por quantidade ficaria fora da conta de valor e da sobra, e a varredura poderia anulá-lo como "número acima do total de compras". O cupom manual entra nas mesmas regras de todos.
- **D-5 — Anular o cupom inteiro, com estorno das stars.** Decisão de João Gabriel em 2026-11-06, a partir do caso de produção de uma nota ainda não paga que rendeu muitos números. A varredura (spec 0102, P-2) continua sem estornar.
- **D-3 — Simulador no navegador.** Usa `Math.random` sobre a mesma lista do telão. Não precisa reproduzir a semente: serve para ver a tela e ensaiar.

## 7. Impacto

- Migration `20261106120000_star_friends_live_draw`: cria `loyalty_campaign_draws`. Só criação de tabela, sem mexer em dado existente.
- `starFriends.campaign.draw` (todos de uma vez) sai; entram `drawNext`, `revokeDraw`, `setPrizeCount`, `drawPool`, `participants`, `addManualReceipt` e `voidReceipt`. `starFriends.members.delete` é novo.
- Dependência nova: `canvas-confetti`.

## 8. Plano de testes

| Critério | Tipo | Onde |
| --- | --- | --- |
| CA-1 a CA-4, CA-7, CA-8 | automatizado (banco local, campanha descartável) | `scripts/star-friends-live-draw-check.ts` |
| CA-5, CA-6, RF-1 | manual | tela local: simulador, sorteio da campanha de teste e exclusão na aba Participantes |

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-06 | João Gabriel | Criação. |
| 2026-11-06 | João Gabriel | RF-8, RF-9, CA-7, CA-8, D-4 e D-5: lançar cupom manual e anular cupom com estorno das stars. |
