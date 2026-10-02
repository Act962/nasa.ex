---
id: 0053
titulo: Satélites — escolha da IA do ASTRO e chaves cifradas
dominio: astro
status: aprovada
autor: Weydson
criada: 2026-10-01
atualizada: 2026-10-01
branch: feature/W-orbita-melhorias-ui-ux-20261001
pr:
peso: completa
---

# 0053 — Satélites: escolha da IA do ASTRO e chaves cifradas

## 1. Contexto

Integrações passa a se chamar **Satélites**: apps que orbitam o ASTRO. A IA (OpenAI, Gemini, Anthropic) é o satélite que dá inteligência a ele e precisa ser o primeiro. Hoje:

- O ASTRO usa a chave da organização quando ela existe (`src/features/ia/lib/router/resolve-model.ts`), senão a da plataforma — mas cobra Stars de tokens mesmo quando a chave é do cliente: o `meter("astro_tokens")` do `onFinish` em `src/app/api/astro/chat/route.ts` não olha `usingCustomKey`.
- Ninguém avisa o cliente de que ele pode trazer a IA dele, nem oferece o nosso modelo de forma explícita.
- `PlatformIntegration.config.apiKey` fica em texto puro no banco e `platformIntegrations.getMany` devolve a chave crua para o navegador.

## 2. Objetivo

Pedido que precisa de IA aberta pede ao cliente uma escolha — conectar a IA dele ou usar o modelo ÓRBITA — sem atrapalhar os comandos que o ASTRO resolve sem IA, e as chaves de IA deixam de existir em texto puro.

### Não-objetivos

- Mudar a URL `/integrations`, o enum `IntegrationPlatform`, slugs ou o `appSlug "integrations"` (só rótulos viram "Satélites").
- Cifrar chaves de plataformas que não são IA (Google Maps, Kommo, NERP…).
- Fazer o seletor de modelo escolher um modelo específico por pedido (continua decidido pelo roteador).
- Landing page e termos.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `Organization.astroAiMode` (`PLATFORM` \| `OWN` \| null). Modo efetivo: `OWN` se há integração ativa de OPENAI/GEMINI/ANTHROPIC com chave válida; senão o valor salvo; senão `null` (não escolheu). |
| RF-2 | Com modo `null`, cartões, guias, consultas em código e ações guiadas respondem normalmente. Só o pedido que cairia no orquestrador (LLM aberto) recebe o cartão "Você precisa integrar sua IA ou escolher nosso modelo para deixar o Astro mais inteligente." |
| RF-3 | Com modo `null`, a taxa fixa `astro_prompt` só é cobrada quando um caminho de resposta vai de fato responder; o cartão de escolha não custa Stars. |
| RF-4 | O cartão tem "Conectar minha IA" (abre o satélite da OpenAI) e "Usar modelo ÓRBITA" (salva `PLATFORM` e reenvia a pergunta). |
| RF-5 | Modo `PLATFORM`: o orquestrador usa `gpt-4o-mini` com a chave da plataforma; cobra taxa fixa + tokens como hoje. |
| RF-6 | Modo `OWN` (chave da organização usada): cobra só a taxa fixa; tokens não são debitados e o custo registrado é `byo_key` (USD 0). |
| RF-7 | `upsert` de OPENAI/GEMINI/ANTHROPIC cifra `config.apiKey` (`encryptSecret`) e guarda `apiKeyLast4`; campo vazio em edição mantém a chave atual. |
| RF-8 | `getMany` nunca devolve `apiKey` dessas plataformas; devolve `apiKeyConfigured` e `apiKeyLast4`. |
| RF-9 | Todo leitor de chave de IA usa `readIntegrationApiKey(config)`, que decifra e aceita texto puro legado. |
| RF-10 | Rótulos visíveis "Integrações" viram "Satélites"; o guia do ASTRO reconhece "satélite". |
| RF-11 | Na Início, as integrações ativas (e a IA mantida pelo ÓRBITA) orbitam o disco do ASTRO numa órbita inclinada, passando por trás dele (IA primeiro, até 6). O "+" tracejado fica sempre visível no canto superior direito do disco e abre a página de Satélites. |
| RF-12 | A página de Satélites mostra primeiro o que está "Em órbita" e depois o que dá para ativar, dividido por tipo (IA, mensagens, redes sociais, anúncios, e-mail, mapas, CRM e o catálogo). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Chave legada em texto puro continua funcionando até ser cifrada pelo script `scripts/encrypt-platform-integration-keys.ts`. |
| RNF-2 | Órbita respeita `prefers-reduced-motion`. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada org sem IA e modo `null`, quando pergunta "Quantos leads entraram esta semana?", então recebe a resposta da consulta em código.
- [ ] **CA-2** — Dada org sem IA e modo `null`, quando pede "Escreva um e-mail de boas-vindas", então recebe o cartão de escolha e o saldo de Stars não muda.
- [ ] **CA-3** — Quando clica "Usar modelo ÓRBITA", então `astroAiMode = PLATFORM`, a pergunta é reenviada e respondida por `gpt-4o-mini`.
- [ ] **CA-4** — Dada org com chave OpenAI ativa, quando o orquestrador responde, então só `astro_prompt` é debitado e o evento de uso tem `priceSource: "byo_key"`.
- [ ] **CA-5** — Quando salva uma chave de OpenAI, então a linha no banco guarda texto cifrado e `getMany` não traz a chave.
- [ ] **CA-6** — Dada chave legada em texto puro, quando o ASTRO resolve o modelo, então a chave é usada normalmente.
- [ ] **CA-7** — Quando edita a integração sem preencher a chave, então a chave anterior é mantida.
- [ ] **CA-8** — A sidebar mostra "Satélites" e `pnpm guides:check` passa.

## 5. Decisões

- **D-1** Taxa fixa continua com chave própria (cobre a plataforma); tokens não.
- **D-2** Modelo ÓRBITA = `gpt-4o-mini`: barato e bom com ferramentas.
- **D-3** Em vez de estornar a taxa quando o cartão aparece, a taxa é adiada (RF-3) para orgs sem escolha: nenhum estorno, nenhuma transação a desfazer.
- **D-4** O classificador de ações guiadas (modelo FAST) continua rodando sem escolha — sem ele "crie um lead João" deixaria de funcionar, contrariando RF-2.

## 9. Changelog

- 2026-10-01 — criada e aprovada junto com o plano.
- 2026-10-01 — Órbita com profundidade (satélites passam por trás do ASTRO), "+" fixo no canto superior direito, IA mantida pelo ÓRBITA (Gemini, com chave do Google da plataforma) sempre em órbita, página de Satélites nova (em órbita + disponíveis por tipo).
