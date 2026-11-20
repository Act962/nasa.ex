---
id: 0148
titulo: Registrar venda pelo número do cliente e emitir recibo
dominio: forge
status: em-revisao
autor: Weydson
criada: 2026-11-18
atualizada: 2026-11-20
branch: feature/W-star-friends-modo-pontos-20261109
pr: Act962/nasa.ex#502
peso: completa
---

# 0148 — Registrar venda pelo número do cliente e emitir recibo

## 1. Contexto

A FCS Climatizadores (consultoria da ÓRBITA HUB) recebe os clientes pelo WhatsApp oficial e repassa os contatos ao dono, que fecha a venda por fora. A consultoria não fica sabendo quem comprou, quanto foi vendido no mês nem quais anúncios viraram venda. O cliente pede recibo, e hoje o recibo é montado à mão.

O Forge já tem quase tudo: proposta com produtos, desconto e total; ligação com o lead (que tem CPF e endereço); o estado `PAGA`; o link público. Falta o caminho curto para o vendedor e o recibo em si.

A ideia de produto: o recibo é o motivo para o vendedor registrar a venda. Para emitir, ele informa o número do cliente; o sistema acha o lead que conversou no WhatsApp e a venda fica ligada a ele.

## 2. Objetivo

Um vendedor logado registra uma venda em menos de um minuto no celular, informando o número do cliente, e entrega um recibo com a marca da empresa. A venda entra no Forge como proposta paga, ligada ao lead e ao vendedor.

### Não-objetivos

- Envio automático do recibo pelo número oficial (fica para depois: fora da janela de 24 h exige modelo aprovado e cobrança na WABA).
- Nota fiscal. Recibo não é documento fiscal.
- Etiqueta "Fechou negócio" ou mudança de coluna no funil (é específico de cada empresa; caberia nos Gatilhos Automáticos).
- Tela de relatório nova: o painel do Forge já soma propostas pagas.

## 3. Requisitos

### Funcionais

- RF-1. Botão "Registrar venda" na aba de propostas do Forge.
- RF-2. O vendedor digita o telefone do cliente. O sistema procura o lead na empresa por todas as grafias do número (com e sem o 9º dígito, mesma regra do inbound do WhatsApp) e mostra o nome encontrado.
- RF-3. Lead não encontrado: o vendedor informa o nome (e escolhe o funil); o lead é criado com origem manual, como no cadastro do funil.
- RF-4. CPF/CNPJ e endereço são opcionais. Preenchidos, gravam no lead (sem apagar o que já existe quando vierem vazios).
- RF-5. Produtos do catálogo do Forge, com quantidade, preço e desconto por unidade. Forma de pagamento (PIX, dinheiro, débito, crédito, boleto) e parcelas (só no crédito).
- RF-6. Ao salvar, nasce uma proposta `PAGA` com `paidAt`, forma de pagamento, parcelas, vendedor como responsável e lead como cliente.
- RF-7. O recibo fica em `/proposta/<token>/recibo`: marca e dados da empresa, dados do cliente, itens, desconto, total, total por extenso, pagamento, data e linha de assinatura. Botões "Salvar como PDF" e (para o vendedor) "Enviar no WhatsApp" do cliente.
- RF-8. A página pública da proposta paga ganha o botão "Ver recibo".
- RF-9. Proposta marcada como `PAGA` pelo caminho de sempre também grava `paidAt` (quando ainda não tem).

### Não-funcionais

- Sem tabela nova: três colunas em `forge_proposals`.
- Sem função ou cron novo no Inngest.

## 4. Critérios de aceite

- CA-1. Número que já conversou no WhatsApp, digitado com ou sem 55 e com ou sem o 9º dígito, encontra o mesmo lead.
- CA-2. Número desconhecido cria um lead novo no funil escolhido e a venda é ligada a ele.
- CA-3. A venda registrada aparece como proposta `PAGA` com total, forma de pagamento e parcelas corretas, e conta no painel do Forge.
- CA-4. Registrar venda **não** dispara a automação de onboarding (`onboarding/proposal.paid`).
- CA-5. O recibo mostra o total por extenso certo (ex.: R$ 9.000,00 → "nove mil reais"; R$ 4.500,00 → "quatro mil e quinhentos reais").
- CA-6. Usuário de outra empresa não acha lead nem produto de outra org passando ids.
- CA-7. Proposta que não está `PAGA` não mostra recibo (404).
- CA-8. Dois toques seguidos em "Gerar recibo" não criam duas vendas.

## 5. Casos de borda

- Mesmo número em dois funis da empresa: usa o lead com conversa mais recente; sem conversa, o atualizado por último.
- Número fixo (sem o 9) não ganha 9 (regra ANATEL já no `waIdLookupVariants`).
- Empresa sem CNPJ ou endereço cadastrado: o recibo omite a linha, não quebra.
- Lead sem CPF/endereço: linha em branco para preencher à mão no papel.
- Desconto maior que o preço: recusado.
- Proposta `PAGA` antiga (sem `paidAt`): recibo usa a data de atualização.

## 6. Decisões de design

### D-1 — A venda é uma proposta `PAGA`, não um modelo novo
O Forge já soma propostas pagas no painel e liga ao lead. Um `Sale` novo duplicaria o conceito.

### D-2 — Três colunas: `payment_method`, `installments`, `paid_at`
Forma e parcelas são filtráveis e aparecem no recibo: colunas tipadas, não `headerConfig`. `paid_at` dá a data do recibo e permite "vendas do mês" sem depender de `updatedAt`. Índice `(organization_id, paid_at)`.

### D-3 — Registrar venda não dispara o onboarding de agência
`onboarding/proposal.paid` cria projeto, planner, dois formulários e e-mail ao cliente: faz sentido para contrato de serviço, não para venda de balcão. Os demais efeitos de "paga" valem: pontos do vendedor, Star Friends, métricas do lead e alerta de mudança de estado.

### D-4 — Envio pelo WhatsApp do próprio vendedor
`wa.me` com o link do recibo, aberto no celular do vendedor. Não gasta modelo da Meta nem depende da janela de 24 h.

### D-5 — Proteção contra clique duplo
A mesma venda (mesmo vendedor, mesmo lead, mesmo total) nos últimos 2 minutos devolve a proposta existente em vez de criar outra.

## 7. Impacto

- Schema: enum `ForgePaymentMethod` e 3 colunas em `forge_proposals` (migration aditiva, sem default obrigatório).
- Procedures novas: `forge.sales.lookupClient`, `forge.sales.register`.
- Página nova: `/proposta/[token]/recibo`.
- Guia do Astro: âncora do botão "Registrar venda".

## 8. Plano de testes

Não há runner de teste no projeto (regra 20 do CLAUDE.md). Validação manual:
- CA-1/CA-2 com um número existente e um novo.
- CA-5 conferindo os dois valores do exemplo.
- CA-4 conferindo que nenhum `ClientOnboardingProcess` nasce.

## 9. Riscos e rollback

- Venda marcada por engano: o vendedor cancela a proposta (estado `CANCELADA`) e o recibo some (CA-7).
- Brecha que continua: venda que o vendedor não registra não aparece. O incentivo é o recibo.
- Rollback: remover o botão; as colunas novas são opcionais e podem ficar.

### Segurança

- Tudo filtrado por `organizationId` da sessão (lead, produto, funil).
- A página do recibo é pública pelo token da proposta (mesmo nível de acesso do link da proposta) e mostra CPF e endereço do cliente: só para proposta `PAGA`, e o CPF aparece mascarado no meio (`241.***.***-04`). A máscara é aplicada no servidor: o número inteiro não vai no HTML da página.

## 10. Changelog da spec

- 2026-11-18: criada.
- 2026-11-20: o código entrou na branch e na PR do STAR FRIENDS modo pontos (Act962/nasa.ex#502), a pedido do Weydson (uma PR só). CPF passa a ser mascarado no servidor, não no navegador. O recibo mostra a descrição do produto em uma linha, abaixo do nome.
