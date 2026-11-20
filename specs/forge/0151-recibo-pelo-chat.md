---
id: 0151
titulo: Emitir recibo pelo chat, com item digitado na hora
dominio: forge
status: implementada
autor: Weydson
criada: 2026-11-20
atualizada: 2026-11-20
branch: feature/W-star-friends-modo-pontos-20261109
pr: Act962/nasa.ex#502
peso: leve
---

# 0151 — Emitir recibo pelo chat, com item digitado na hora

## 1. Contexto

A spec 0148 criou o "Registrar venda" no Forge: o vendedor digita o WhatsApp do cliente, escolhe produtos do catálogo e gera o recibo. Há clientes da consultoria com pouca habilidade no digital: o dono atende pelo chat do Órbita e não vai abrir o Forge, procurar o cliente pelo número e montar o catálogo antes de vender.

O chat já é onde a venda acontece. O menu de anexos (`tracking-chat/components/footer-chat.tsx`) tem Fotos, Documento, Formulários, Agenda, Propostas, Star Friends etc., e ainda há espaço livre.

Decisão do Weydson (20/11/2026): ícone "Recibo" no menu do chat, abrindo uma tela cheia já preenchida com os dados do lead e com tudo editável; o item pode ser digitado na hora e, quando não existe no catálogo, vira produto do Forge sozinho.

## 2. Objetivo

No chat de um lead, o atendente toca em "Recibo", confere ou ajusta os dados, toca em "Gerar e enviar" e o cliente recebe o link do recibo na mesma conversa. A venda entra no Forge como na 0148.

### Não-objetivos

- Recibo como imagem ou PDF anexado (vai o link, que já tem "Salvar como PDF").
- Editar um recibo já emitido. Recibo errado se corrige cancelando a proposta no Forge e emitindo outro, como na 0148.
- Item sem produto no banco (descartado: exigiria mudar o banco e os relatórios do Forge).
- Envio fora da janela de 24 h do WhatsApp oficial por modelo da Meta.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Item "Recibo" no menu de anexos do chat, para qualquer conversa com lead. |
| RF-2 | Tela cheia (folha que cobre a tela no celular e janela grande no computador) com um X para fechar sem salvar. |
| RF-3 | Pré-preenchido com o lead da conversa: nome, WhatsApp, CPF/CNPJ e endereço. Tudo editável. O WhatsApp vem do cadastro do lead; se o lead não tem, o atendente digita: número que já é de outro lead leva a venda para esse lead, número novo é gravado no próprio lead (sem criar lead duplicado); o que for alterado grava no lead ao emitir, sem apagar o que vier vazio (mesma regra da 0148, RF-4). |
| RF-4 | Itens: buscar no catálogo do Forge **ou** digitar nome e preço na hora. Quantidade, preço e desconto por unidade editáveis em qualquer item. |
| RF-5 | Item digitado que não existe no catálogo vira produto do Forge da empresa ao emitir (nome, preço, unidade "un", SKU gerado). Se já existe um produto com o mesmo nome (sem diferença de maiúsculas e acentos), usa esse em vez de criar outro. |
| RF-6 | Forma de pagamento e parcelas (só crédito), como na 0148. |
| RF-7 | Prévia do recibo atualizada enquanto edita (abaixo no celular, ao lado no computador). |
| RF-8 | "Gerar e enviar": registra a venda pela mesma rota da 0148 e envia na conversa a mensagem "Olá, {primeiro nome}! Segue o seu recibo: {link}". Botão secundário "Só gerar", que registra e mostra o link sem enviar. |
| RF-9 | Se o envio falhar (ex.: fora da janela de 24 h no número oficial), a venda continua registrada e a tela mostra o link com "Copiar link", explicando que a mensagem não foi. |

## 4. Critérios de aceite

- [ ] **CA-1** — Abrir "Recibo" no chat de um lead com CPF e endereço cadastrados mostra esses dados já preenchidos.
- [ ] **CA-2** — Item digitado "Climatizador 130 L — R$ 5.500,00", quantidade 2, cria um produto no Forge da empresa e o recibo sai com 2 × R$ 5.500,00.
- [ ] **CA-3** — Digitar de novo "climatizador 130 l" na mesma empresa não cria um segundo produto.
- [ ] **CA-4** — "Gerar e enviar" cria uma venda paga ligada ao lead da conversa e a mensagem com o link aparece na conversa.
- [ ] **CA-5** — Dois toques seguidos em "Gerar e enviar" registram uma venda só e enviam uma mensagem só.
- [ ] **CA-6** — Falha no envio deixa a venda registrada e mostra o link para copiar.
- [ ] **CA-7** — Em 360 px e 390 px a tela não rola para o lado e o botão de emitir fica visível sem precisar achar.
- [ ] **CA-8** — Usuário de outra empresa não consegue emitir recibo para lead de outra org passando ids.

## 5. Casos de borda

- Lead sem telefone (visitante do ASTRO CHAT): o atendente pode digitar o número; "Gerar e enviar" manda o link na própria conversa do chat. Só fica desligado sem número conectado.
- Item digitado sem nome ou com preço zero: não deixa emitir.
- Nome digitado com espaços sobrando: são removidos antes de comparar e de gravar.
- SKU gerado colidindo com um existente (raro): gera outro e tenta de novo.
- Desconto maior que o preço: recusado, como na 0148.

## 9. Riscos e rollback

- **Catálogo acumula produtos digitados no chat.** É o custo aceito da opção escolhida; o RF-5 evita duplicar o mesmo nome. Produtos assim ficam editáveis e apagáveis no Forge como qualquer outro.
- **Rollback:** tirar o item "Recibo" do menu. Nada no banco muda.

### Segurança

- A rota recebe o id do lead e confere que ele pertence à organização da sessão antes de usar seus dados (CA-8). O envio usa a mesma rota de mensagem do chat, que já confere a conversa.
- O recibo continua público só pelo token, com CPF mascarado no servidor (0148).

### Impacto

- Sem tabela nova e sem migration. Sem função nova no Inngest e sem variável de ambiente.
- `forge.sales.register` passa a aceitar, em cada item, ou `productId` ou `{ name }` (produto digitado), e opcionalmente `leadId` para ligar direto ao lead da conversa em vez de procurar pelo telefone.
- Componente novo no chat: `tracking-chat/components/receipt-panel/` (formulário e prévia). Reaproveita a prévia do recibo da 0148.
- Guia do Astro: âncora no item "Recibo" do menu e no botão "Gerar e enviar" (Regra 21).

## 10. Changelog da spec

- 2026-11-20: criada a partir da decisão do Weydson no chat (ícone no menu de anexos, tela cheia pré-preenchida e editável, item digitado vira produto do catálogo).
- 2026-11-20: implementada. WhatsApp fica só para leitura na tela (é o número da conversa; trocar mudaria para quem o recibo vai). Item digitado mostra sugestões do catálogo enquanto escreve; escolher uma liga o item ao produto existente.
- 2026-11-20: ajuste do Weydson após teste. Telefone vem do cadastro do lead e, se vazio, pode ser digitado (decisão: gravar no próprio lead em vez de criar outro). Campo de item vira busca no catálogo, com aviso quando o nome não existe e vai ser criado.
