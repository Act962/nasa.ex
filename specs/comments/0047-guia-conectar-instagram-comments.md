---
id: 0047
titulo: Guia passo a passo para conectar o Instagram no COMMENTS
dominio: comments
status: em-revisao
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-apps-ajustes-20260929
pr:
peso: leve
---

# 0047 — Guia passo a passo para conectar o Instagram no COMMENTS

## 1. Contexto

Conectar o Instagram no `/comments` pede quatro valores (Instagram Account ID,
Access Token, App Secret, Verify Token) e uma configuração de webhook na Meta.
O card atual só mostra quatro campos vazios: quem nunca criou um app na Meta
não sabe onde achar nada, e as pegadinhas custam testes inteiros:

- o App Secret certo é o de **Instagram → Configuração da API**, não o de
  Configurações → Básico;
- a Meta **recusa a palavra "Instagram" no nome do app**;
- o app só publica com **URL de Política de Privacidade**, e o webhook só
  entrega com o app **publicado**;
- a conta precisa aceitar o convite de **Testador do Instagram** antes de gerar
  o token.

O número oficial do WhatsApp já tem um guia assim (spec 0040): print de cada
tela da Meta com seta vermelha, instrução curta, link direto e o Astro
comemorando. Este guia reaproveita esse mesmo componente.

## 2. Objetivo

Qualquer dono de conta conecta o Instagram no COMMENTS sozinho, seguindo um
popup com print de cada tela da Meta, sem precisar de ajuda da equipe.

### Não-objetivos

- OAuth / "Entrar com Instagram" (continua na fase 3 do roadmap do COMMENTS).
- Progresso salvo no banco ou compartilhado entre aparelhos. Fica no navegador
  (D-2).
- Mudar o fluxo do guia do WhatsApp. Ele só passa a consumir o componente
  genérico, sem mudança de comportamento.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | "Conectar Instagram" e "Trocar conta ou credenciais" abrem um popup guiado no lugar do formulário solto. |
| RF-2 | O guia tem fases: criar o app, ligar o Instagram, publicar, liberar a conta como testadora, pegar as chaves, conectar na ÓRBITA e configurar o webhook. Cada passo com print tem seta vermelha no alvo. |
| RF-3 | O primeiro passo pergunta se o cliente já tem o app. "Já tenho" pula direto para as chaves. |
| RF-4 | O ID da conta, o token e a chave secreta são colados no próprio passo em que são copiados, e ficam só na memória do popup até a conexão. |
| RF-5 | O Verify Token é gerado pela ÓRBITA. O cliente não precisa inventar um. |
| RF-6 | Depois de conectar, o passo do webhook mostra a URL de callback e o Verify Token com botão Copiar. |
| RF-7 | O passo da Política de Privacidade oferece `https://orbita.nasaex.com/privacidade` para copiar. |
| RF-8 | O Astro comemora cada fase e os marcos de 25/50/75/100%, uma vez só. |
| RF-9 | Fechar e reabrir o popup volta ao passo em que o cliente parou. |
| RF-10 | O stepper, o print com seta, o checklist de instrução, o campo copiar e o aviso "fique no passo" viram o módulo `features/meta-guide`, compartilhado pelo WhatsApp e pelo Instagram. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum print publicado mostra token, chave secreta, senha, nome ou foto pessoal (os mesmos borrões do CA-10 da spec 0040). |
| RNF-2 | Sem migration: nenhum modelo Prisma novo. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado o `/comments` sem conta conectada, quando clico em "Conectar Instagram", então abre o popup no primeiro passo.
- [ ] **CA-2** — Dado o passo "Você já tem um app?", quando clico em "Já tenho", então vou para o passo do ID da conta.
- [ ] **CA-3** — Dado o ID, o token e a chave preenchidos, quando clico em "Conectar", então o canal é conectado com um Verify Token gerado e o passo seguinte mostra a URL do webhook e esse Verify Token para copiar.
- [ ] **CA-4** — Dado que parei no passo 9 e fechei o popup, quando reabro, então continuo no passo 9.
- [ ] **CA-5** — Dada uma conta conectada, quando clico em "Trocar conta ou credenciais", então o guia abre no passo do ID da conta, preenchido com o ID atual.
- [ ] **CA-6** — O guia do WhatsApp continua igual: mesmos passos, prints, balões e salvamento.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente fecha o popup depois de conectar e volta outro dia para o webhook | O Verify Token vem do servidor (`channel.webhookSetup`, só admin). Não se perde. |
| CB-2 | Chave secreta colada é a de Configurações → Básico | Não dá para distinguir pelo formato. O passo tem o aviso em destaque e o print aponta a chave certa. |
| CB-3 | Token no formato antigo (`IGQV…`) | Aceito. Validação só por tamanho mínimo, o servidor confere na Graph API. |
| CB-4 | Nome do app com "Instagram" | Aviso no passo, com o erro real da Meta. |
| CB-5 | Navegador sem `localStorage` (modo privado) | O guia funciona e só não lembra o passo. |
| CB-6 | Usuário sem papel de admin | `connect` já recusa. O popup mostra o erro vindo do servidor. |
| CB-7 | Cliente cola o "ID do app do Instagram" no lugar do ID da conta | Aconteceu no teste real. O campo avisa quando o número não começa com 1784, e o passo tem a dica em destaque. |
| CB-8 | "Verificar e salvar" do webhook falha na primeira vez | Aconteceu no teste real com o endpoint respondendo 200. A dica do passo manda tentar de novo. |

## 6. Decisões de design

### D-1 — Reaproveitar o stepper do WhatsApp, não copiar

O stepper recebe uma definição de guia (`MetaGuideDefinition`: fases, passos,
marcos, montagem de link, pasta dos prints). O WhatsApp passa a sua, com
comportamento idêntico. Descartado: copiar os componentes para `comments`, que
dobra a manutenção de algo com animação, zoom e balões.

### D-2 — Progresso no `localStorage`, não no banco

O guia do WhatsApp salva no banco porque o fluxo leva dias (cartão, número,
SMS). O do Instagram cabe numa sessão, e salvar no banco pediria migration
num projeto com histórico de migrations divergente. Só o passo e os balões já
mostrados ficam no navegador. As chaves nunca vão para o `localStorage`.

### D-3 — Verify Token gerado pela ÓRBITA

É só um segredo de handshake: o cliente não ganha nada escolhendo um. Gerar
tira um campo do caminho e evita "123" como token.

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-29 | Implementada: 24 passos, 22 prints em `public/guides/instagram-comments/`, `channel.webhookSetup`, stepper movido para `src/features/meta-guide/`. CB-7 e CB-8 vieram da configuração real |
| 2026-09-29 | Criada. Prints tirados de um app de teste real ("ÓRBITA GUIA COMMENTS") com a conta @orbitahub.plataforma |
