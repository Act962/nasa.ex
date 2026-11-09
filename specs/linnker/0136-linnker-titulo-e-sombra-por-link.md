---
id: 0136
titulo: Linnker — esconder o título sobre a imagem e tirar a sombra, por link
dominio: linnker
status: aprovada
autor: Weydson
criada: 2026-11-09
atualizada: 2026-11-09
branch: feature/W-star-friends-modo-pontos-20261109
pr: https://github.com/Act962/nasa.ex/pull/502
peso: leve
---

# 0136 — Linnker: título sobre a imagem e sombra, por link

## 1. Contexto

No Linnker da SEMPRE MIX, cada card é uma arte pronta, com o texto dentro da imagem. A página pública escreve o título do link por cima da imagem, numa faixa escura, e põe sombra em todo card e botão. Para esconder o texto, o título foi trocado por "." à mão: a faixa escura continua e a lista de links do editor fica cheia de ".".

## 2. Objetivo

Cada link escolhe se o título aparece sobre a imagem do card e se o card ou botão tem sombra. O título continua guardado: nomeia o link na lista e serve de texto alternativo da imagem.

### Não-objetivos

- Sombra ou título como configuração da página inteira.
- Botão comum (sem imagem) sem título: o texto do botão é o próprio botão.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | `LinnkerLink.showTitle` (padrão ligado): no card com imagem, desligado tira o texto e a faixa escura. |
| RF-2 | `LinnkerLink.hasShadow` (padrão ligado): desligado tira a sombra do card ou do botão, na página pública e na prévia do editor. |
| RF-3 | A janela "Editar link" tem as duas chaves: "Mostrar título sobre a imagem" (só em card) e "Sombra no card/botão". |
| RF-4 | Links que já existem continuam iguais: migration aditiva com padrão `true`. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um card com imagem e "Mostrar título" desligado, a página pública mostra só a imagem, sem texto e sem faixa escura.
- [ ] **CA-2** — Dado "Sombra" desligado, o card (ou botão) aparece sem sombra na página e na prévia.
- [ ] **CA-3** — Dado um link criado antes da mudança, nada muda na página.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Card sem imagem (cor sólida) com "Mostrar título" desligado | A chave só aparece com estilo card; o card de cor sólida continua com o texto, porque ele é o conteúdo. |
| CB-2 | Título "." de antes da mudança | Continua funcionando; pode ser trocado pelo nome real e desligar o título. |

## 9. Riscos e rollback

Migration aditiva (`20261109150000_linnker_link_title_shadow`), duas colunas `boolean NOT NULL DEFAULT true`. Reverter o código deixa as colunas sem uso. Segurança: nada novo sai na rota pública além de dois booleanos de aparência; a edição continua escopada pela organização do link.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-09 | Weydson (Claude) | Criada a pedido do Weydson para o Linnker da SEMPRE MIX. |
