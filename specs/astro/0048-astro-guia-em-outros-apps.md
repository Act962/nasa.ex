---
id: 0048
titulo: Astro Guia em Chat, Agenda, Forge e Formulários
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-30
atualizada: 2026-09-30
branch: feature/W-astro-guias-outros-apps-20260930
pr:
peso: leve
---

# 0048 — Astro Guia em Chat, Agenda, Forge e Formulários

> Continua a [0046](0046-astro-guia-na-tela.md), que fez o piloto no Tracking.

## 1. Contexto

A 0046 provou o guia na tela real no Tracking. Os apps com mais dúvida de
suporte depois dele são Chat, Agenda, Forge e Formulários. O mapeamento das
telas mostrou quatro limites do motor que os guias do Tracking não tocavam:

1. **Resultado sem dono.** Qualquer `emitTourResult` encerrava qualquer guia
   que esperasse resultado. Com mais guias, mandar uma mensagem no Chat
   encerraria o guia "Criar lead".
2. **Menus em portal ficam atrás do escurecido.** Select, Dropdown e Popover do
   Radix abrem em portal com `z-50`; o overlay do guia fica em `z-9998`. A Agenda
   exige escolher um tracking num Select.
3. **Passo condicional à tela, não à rota.** A lista de agendas começa
   recolhida; o passo "abra a lista" só faz sentido quando ela está fechada.
4. **Ação sem link.** Criar produto no Forge só atualiza a lista.

## 2. Objetivo

Nove guias novos nos quatro apps, e o motor aguenta passo condicional à tela,
menus em portal e resultados identificados por tipo.

### Não-objetivos

- Iniciar conversa nova pelo Chat (o diálogo não devolve id nem navega).
- Enviar proposta por WhatsApp a partir do /forge — ali só existe copiar link;
  o envio pelo WhatsApp mora no painel do Forge dentro do chat.
- Guia para instância do WhatsApp Oficial (Meta): o fluxo é outro (spec própria).
- Astro montar guia sozinho (fase 2 da 0046).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Guias novos: Chat (responder conversa, conectar WhatsApp por QR Code), Agenda (criar agenda, copiar link de agendamento), Forge (criar proposta, copiar link da proposta, cadastrar produto), Formulários (criar, publicar). |
| RF-2 | `emitTourResult` carrega `kind` (ex.: `lead.created`); um passo `result` só termina com o `kind` que declarou. |
| RF-3 | Passo pode declarar `skipWhenVisible`: é pulado quando aquela âncora já está na tela. |
| RF-4 | Com guia ativo, o conteúdo em portal do Radix (Select, Dropdown, Popover) fica acima do escurecido e clicável — inclusive o Select em modo `item-aligned` (padrão do shadcn), que não usa o wrapper do popper: o z-index vai no próprio `[data-slot="select-content"]`. |
| RF-5 | Passo `input` também vale para Select do Radix: libera quando há opção escolhida. |
| RF-6 | Resultado pode vir sem link: o cartão final mostra só "Fechar". |
| RF-7 | Passo pode declarar `missingMessage`, usada no cartão "Não encontrei" no lugar do texto genérico. |
| RF-8 | Avanço é idempotente: clique e pulo automático no mesmo passo não avançam dois passos. |
| RF-9 | Artigos do Space Help ligados: `nasachat/atender-conversa`, `nasachat/conectar-whatsapp`, `spacetime/criar-agenda`, `spacetime/compartilhar-link-agendamento`, `forge/criar-proposta`, `cosmic/criar-formulario`, `cosmic/publicar-formulario`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Pedidos dos guias novos continuam sem modelo e sem Stars (0046, RNF-1/RNF-3). |

## 4. Critérios de aceite

- [x] **CA-1** — "como crio uma proposta pro cliente?" abre o guia da proposta, não o de lead.
- [x] **CA-2** — Guia "Criar lead" ativo + mensagem enviada no Chat → o guia do lead **não** termina.
- [x] **CA-3** — Guia "Criar agenda": com a lista recolhida, o primeiro passo destaca o botão de abrir; com ela aberta, o passo é pulado.
- [x] **CA-4** — No passo do tracking da agenda, o Select abre por cima do escurecido, a opção é clicável e "Continuar" só libera com opção escolhida.
- [x] **CA-5** — Guia "Cadastrar produto" termina com cartão final só com "Fechar".
- [x] **CA-6** — Guia "Publicar formulário" só termina quando o resultado é publicado (despublicar não conta).
- [x] **CA-7** — Os guias do Tracking (0046) continuam passando.
- [x] **CA-8** — `pnpm guides:check` passa com os 13 guias.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Chat sem instância de WhatsApp: o compositor não tem campo de texto | Cartão "Não encontrei" com `missingMessage` apontando para o guia de conectar o WhatsApp. No último passo o cartão só oferece "Encerrar" — "Pular passo" abriria o cartão de sucesso sem nada feito. |
| CB-2 | Instância já existe ao pedir "conectar WhatsApp" | Botão "Criar primeira instância" não aparece → `missingMessage` explica usar "Conectar Agora" na instância. |
| CB-3 | QR Code aberto numa instância que já estava conectada | Não emite `whatsapp.connected`: o sinal vem de `useConnectIntegrationStatus`, que só roda quando o status muda. |
| CB-4 | Nenhuma proposta criada ao pedir "copiar link da proposta" | Botão não existe → `missingMessage` sugere o guia "Criar proposta". |
| CB-5 | Várias propostas/agendas na tela | O guia destaca o primeiro item (primeiro `data-guide` no DOM). |
| CB-6 | Tela menor que `lg` na Agenda (botão de abrir lista oculto) | Âncora não visível → cartão "Não encontrei". |
| CB-7 | Usuário despublica o formulário no passo de publicar | Nenhum resultado é emitido; o guia continua esperando. |

## 9. Riscos e rollback

Mudança só de front, sem schema. O `kind` no resultado é o único contrato
novo: os emissores do Tracking (lead e tracking criados) passam a mandar
`kind`. O aumento de z-index dos portais do Radix só existe enquanto um guia
está ativo (estilo montado pelo overlay). Rollback: tirar os guias novos do
`ASTRO_GUIDES` — o motor novo é compatível com os guias antigos.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-30 | Weydson | Criada |
| 2026-09-30 | Weydson | CA-1 a CA-8 conferidos (CA-1 por 22 frases em script; CA-2 e CA-7 disparando o evento de resultado na página; os demais pelo fluxo real). Elemento escondido por CSS passou a contar como ausente (CB-6). "Conectar WhatsApp" testado até o nome da instância, sem criar — criar chama o Uazapi. |
| 2026-09-30 | Weydson | Teste no navegador (org ASTRO QA): o Select da Agenda abria atrás do escurecido (modo item-aligned) → RF-4 ampliado; o formulário do Chat existe mesmo sem instância (mostra "Conectar instância") → âncora do compositor só com campo de texto habilitado (CB-1). |
