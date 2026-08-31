---
id: 0008
titulo: Anexos em lançamentos financeiros e biblioteca de documentos
dominio: payment
status: aprovada
autor: Weydson
criada: 2026-08-31
atualizada: 2026-08-31
branch: feature/W-payment-melhorias-financeiro-20260831
pr:
peso: completa
---

# 0008 — Anexos em lançamentos financeiros e biblioteca de documentos

---

## 1. Contexto

O modal **Nova Despesa** / **Nova Receita** (`entry-form.tsx`) coleta descrição,
valor, vencimento, categoria, conta, observações e opções avançadas — mas não
aceita **nenhum arquivo**. Na prática financeira, todo lançamento nasce de um
documento: nota fiscal, boleto, recibo, comprovante de transferência, contrato.

Hoje esses documentos vivem fora do sistema — no WhatsApp de quem pagou, no
e-mail do fornecedor, na pasta Downloads. Quando alguém precisa provar um
pagamento (auditoria, contestação, fechamento contábil), a busca é manual e
frequentemente falha.

O schema já tem `PaymentEntry.attachmentUrl` (`String?`), mas ele é:

- **único** — cabe um arquivo por lançamento, e uma despesa real costuma ter
  dois (boleto + comprovante);
- **sem metadados** — não guarda nome original, tipo, tamanho nem quem subiu;
- **não exposto no form** — só é preenchido pelo fluxo de Orçamento do chat
  (`BudgetPanel`), nunca pela tela de lançamento;
- **não pesquisável** — não existe tela que liste anexos.

## 2. Objetivo

Todo lançamento financeiro aceita múltiplos arquivos no momento da criação, e
esses arquivos ficam num acervo único da organização — pesquisável por nome,
tipo de documento, período e lançamento vinculado.

### Não-objetivos

- **OCR / leitura automática de nota fiscal** para preencher valor e vencimento.
  Fica para spec futura; aqui o arquivo é só armazenado e recuperado.
- **Versionamento de documento** (substituir mantendo histórico). Substituir =
  excluir + subir de novo.
- **Compartilhamento externo** por link público. Documento financeiro é privado
  à organização; link público exigiria spec própria de expiração e revogação.
- **Migrar o `attachmentUrl` legado** para o novo modelo. O campo continua onde
  está, alimentado pelo BudgetPanel; a leitura passa a considerar os dois
  (ver CB-7).
- **Assinatura digital / validação de XML de NF-e.**

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O form de lançamento (`Nova Despesa` e `Nova Receita`) aceita anexar N arquivos antes de salvar. |
| RF-2 | O upload acontece no ato da seleção; ao salvar o lançamento, os anexos já enviados são vinculados a ele. |
| RF-3 | Cada anexo guarda: nome original, MIME type, tamanho em bytes, tipo de documento, quem subiu e quando. |
| RF-4 | O tipo de documento é classificável: Nota fiscal, Boleto, Recibo, Comprovante, Contrato, Outro. Default `OUTRO`. |
| RF-5 | Em lançamento parcelado (N parcelas), o anexo vincula-se a **todas** as parcelas do grupo. |
| RF-6 | Existe uma aba **Documentos** no módulo financeiro listando todos os anexos da organização. |
| RF-7 | A busca da aba Documentos filtra por texto livre (nome do arquivo, descrição, descrição do lançamento vinculado). |
| RF-8 | A aba Documentos filtra por tipo de documento, por natureza (a pagar / a receber / sem vínculo) e por período de criação. |
| RF-9 | Cada item da lista permite visualizar/baixar o arquivo e navegar para o lançamento vinculado. |
| RF-10 | É possível anexar arquivo a um lançamento já existente, pelo dialog de edição. |
| RF-11 | É possível excluir um anexo; a exclusão remove o registro e o objeto no bucket. |
| RF-12 | É possível renomear o anexo e trocar seu tipo de documento sem reenviar o arquivo. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O arquivo nunca é servido por URL pública do bucket — o acesso passa por rota autenticada que valida organização e PaymentAccess. |
| RNF-2 | Teto de 16MB por arquivo, alinhado ao `MAX_SCRIPT_VIDEO_BYTES` já adotado no projeto. |
| RNF-3 | O upload não depende de CORS no bucket R2 (pendência conhecida, ver `CLOUDFLARE_R2_CORS_PENDING.md`). |
| RNF-4 | A listagem da aba Documentos pagina; nunca carrega o acervo inteiro de uma vez. |
| RNF-5 | Permissões reaproveitam o recurso `entries` do `PaymentAccess` — sem novo recurso na matriz. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado o modal Nova Despesa aberto, quando o usuário seleciona dois PDFs e salva, então a despesa é criada e os dois arquivos aparecem vinculados a ela.
- [ ] **CA-2** — Dado um arquivo de 20MB, quando o usuário tenta anexar, então o upload é recusado com mensagem citando o limite de 16MB, e o form continua utilizável.
- [ ] **CA-3** — Dado um lançamento em 3 parcelas com um anexo, quando salvo, então o anexo é encontrável a partir de qualquer uma das 3 parcelas.
- [ ] **CA-4** — Dado um acervo com anexos, quando o usuário digita parte do nome na busca da aba Documentos, então só os anexos correspondentes são listados.
- [ ] **CA-5** — Dado um usuário sem PaymentAccess autorizado, quando ele requisita a rota de download de um anexo, então recebe 403 e nenhum byte do arquivo.
- [ ] **CA-6** — Dado um anexo de outra organização, quando o usuário requisita seu download, então recebe 404 (não 403 — não confirma existência).
- [ ] **CA-7** — Dado um anexo excluído, quando a exclusão retorna sucesso, então o registro sumiu da listagem e o objeto não existe mais no bucket.
- [ ] **CA-8** — Dado o upload concluído mas o lançamento **não** salvo (usuário cancela), então o anexo não fica visível como documento vinculado (ver CB-3).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Arquivo com nome duplicado no mesmo lançamento | Aceita. A chave no bucket é UUID; o nome original é só metadado. |
| CB-2 | Upload falha no meio (rede cai) | O chip do arquivo mostra estado de erro com botão "tentar de novo". O form não trava nem perde os outros campos. |
| CB-3 | Usuário sobe arquivo e cancela o modal | O anexo fica órfão (`entryId = null`) e aparece na aba Documentos como "Sem vínculo". Não é lixo invisível: é recuperável e excluível de lá. |
| CB-4 | Lançamento excluído com anexos | Os anexos **sobrevivem** com `entryId = null` (`onDelete: SetNull`). Documento fiscal não deve evaporar junto com o registro contábil. |
| CB-5 | MIME type não permitido (ex.: `.exe`) | Recusado no servidor com 415, antes de tocar o bucket. Validação no cliente é conveniência, não barreira. |
| CB-6 | Bucket R2 indisponível / env faltando | Rota devolve 503 com a lista de variáveis ausentes, mesmo padrão do `/api/s3/upload`. O lançamento ainda pode ser salvo sem anexo. |
| CB-7 | Lançamento legado com `attachmentUrl` preenchido | A UI do lançamento mostra esse arquivo junto dos anexos novos, marcado como "Orçamento". Não é migrado nem duplicado. |
| CB-8 | Nome de arquivo com acento, espaço ou emoji | Preservado no metadado; a chave no bucket usa só o UUID + extensão. |
| CB-9 | Arquivo sem extensão | Aceito; a chave usa `bin` e o ícone cai no genérico. |
| CB-10 | Dois uploads simultâneos do mesmo arquivo | Geram dois registros distintos. Deduplicar exigiria hash de conteúdo — fora de escopo. |

## 6. Decisões de design

### D-1 — Tabela dedicada em vez de esticar `attachmentUrl`

- **Escolha**: novo modelo `PaymentAttachment`, 1:N com `PaymentEntry`.
- **Alternativas descartadas**: (a) transformar `attachmentUrl` em `String[]` —
  resolveria a cardinalidade mas não os metadados, e deixaria a busca por nome
  impossível; (b) reaproveitar `LeadFile` — acoplaria dois domínios sem relação.
- **Consequência**: o campo legado continua existindo. A leitura de um
  lançamento precisa considerar as duas fontes (CB-7) até uma spec de migração.

### D-2 — Upload streaming pelo servidor, não presign no browser

- **Escolha**: `POST /api/payment/attachments/upload` recebe `multipart/form-data`
  e faz `Upload` (lib-storage) direto pro R2.
- **Alternativas descartadas**: presign via `/api/s3/upload` — hoje quebra no
  browser porque o bucket `nasa-ex` está sem regra de CORS, pendência
  documentada e fora do alcance desta spec.
- **Consequência**: os bytes passam pelo servidor Next. Aceitável no teto de
  16MB. Segue o precedente da spec 0004 (`upload-script-video`).

### D-3 — Arquivo privado, servido por rota autenticada

- **Escolha**: o banco guarda a **chave** do objeto (`fileKey`), nunca uma URL
  pública. `GET /api/payment/attachments/[id]` valida sessão, organização e
  PaymentAccess, e só então redireciona para uma presigned URL de 5 minutos.
- **Alternativas descartadas**: usar `getPublicMediaUrl` (CDN público) — expõe
  nota fiscal e comprovante bancário a quem tiver o link.
- **Consequência**: um custo de request a mais por visualização, e o link
  copiado da barra de endereço expira. É o comportamento desejado.

### D-4 — Anexo do grupo de parcelas, não da parcela

- **Escolha**: quando o lançamento é parcelado, o anexo é gravado uma vez por
  parcela criada, apontando para a **mesma** `fileKey`.
- **Alternativas descartadas**: vincular ao `installmentGroupId` — mais
  normalizado, mas exigiria `OR` em toda query de anexo e quebraria o caso de
  lançamento avulso.
- **Consequência**: N registros para o mesmo objeto no bucket. A exclusão do
  objeto só ocorre quando o **último** registro que o referencia é excluído.

### D-5 — Permissão reaproveita o recurso `entries`

- **Escolha**: `requirePaymentAccess("entries", ...)` nas procedures de anexo.
- **Alternativas descartadas**: novo recurso `attachments` na matriz —
  obrigaria a mexer em `PAYMENT_RESOURCES`, nos defaults de role e na tela de
  permissões, com ganho nulo: quem pode ver um lançamento pode ver o documento
  que o originou.
- **Consequência**: não há como dar acesso a documentos sem dar acesso a
  lançamentos. Se isso for pedido, vira spec própria.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

Detalhe:

- **Schema**: enum `PaymentAttachmentKind` + model `PaymentAttachment`; relações
  novas em `Organization`, `PaymentEntry` e `User`. Migration aditiva.
- **oRPC**: `payment.listAttachments`, `payment.createAttachment`,
  `payment.updateAttachment`, `payment.deleteAttachment`. `createPaymentEntry`
  ganha o campo opcional `attachmentIds: string[]`.
- **Env vars**: nenhuma nova — reusa `AWS_*` e `NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES`.

## 8. Plano de testes

O projeto ainda não tem runner instalado (deriva conhecida, CLAUDE.md item 20),
então a verificação é manual e roteirizada.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Nova Despesa → anexar 2 PDFs → salvar → abrir o lançamento e conferir os 2 anexos. |
| CA-2 | manual | Anexar arquivo > 16MB → conferir toast com o limite e o form intacto. |
| CA-3 | manual | Criar despesa em 3x com anexo → abrir a 2ª parcela → o anexo aparece. |
| CA-4 | manual | Aba Documentos → digitar parte do nome → conferir a filtragem. |
| CA-5 | manual | `curl` na rota de download com sessão sem PaymentAccess → 403. |
| CA-6 | manual | `curl` na rota com id de anexo de outra org → 404. |
| CA-7 | manual | Excluir anexo → sumir da lista → `HeadObject` no bucket devolve 404. |
| CA-8 | manual | Anexar e cancelar o modal → conferir o item como "Sem vínculo" na aba Documentos. |

## 9. Riscos e rollback

**Migration reversível?** Sim. É puramente aditiva: cria um enum e uma tabela,
e adiciona três relações que não alteram colunas existentes. O rollback é
`DROP TABLE payment_attachments` + `DROP TYPE "PaymentAttachmentKind"`; nenhum
dado pré-existente é tocado.

**Riscos:**

1. **Órfãos no bucket** — anexo criado e modal cancelado (CB-3) deixa objeto
   pago sem uso. Mitigação: ele fica visível e excluível na aba Documentos, em
   vez de invisível. Uma rotina de limpeza é candidata a spec futura.
2. **Custo de banda** — o upload passa pelo servidor (D-2). No teto de 16MB e
   no volume esperado de lançamentos, é irrelevante; se o volume crescer, a
   saída é destravar o CORS do bucket e migrar para presign.
3. **Exclusão do objeto com múltiplos registros** (D-4) — apagar o objeto do
   bucket enquanto outra parcela ainda o referencia deixaria link quebrado.
   Mitigação: a exclusão só toca o bucket quando nenhum outro registro aponta
   para aquela `fileKey`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-31 | Weydson | Criada |
