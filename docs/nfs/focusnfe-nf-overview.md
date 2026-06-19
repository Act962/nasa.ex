# Notas Fiscais + FocusNFe — Conhecimento base e casos de uso (Forge + Financeiro)

> Documento **exploratório / educativo**. Objetivo: explicar o que é Nota Fiscal no Brasil, como a API do
> [FocusNFe](https://focusnfe.com.br/) funciona, e mapear onde isso encaixaria nos domínios `forge` e financeiro
> (`billing`/`payment`) do NASA. **Nada aqui é decisão de arquitetura nem plano de implementação** — é base de
> contexto para a gente decidir depois.
>
> Fontes: documentação oficial FocusNFe (`https://doc.focusnfe.com.br/`, índice em `/llms.txt`) + conhecimento
> fiscal geral. Datado de 2026-06-17.

---

## 1. O que é uma Nota Fiscal (e por que importa pro produto)

Nota Fiscal (NF) é o **documento fiscal eletrônico** que registra oficialmente uma operação de venda de
mercadoria ou prestação de serviço perante o fisco (SEFAZ estadual, prefeitura municipal ou ambiente nacional).
Ela é a prova legal de que houve a transação, é a base de cálculo dos impostos, e é obrigatória pra empresa
formalizada (com CNPJ) que vende algo.

Pro nosso contexto (SaaS B2B onde organizações vendem **serviços e produtos** pros clientes delas via Forge),
a NF entra no momento em que uma proposta vira venda/pagamento e a organização precisa **dar nota** pro cliente.

### Por que não emitir "na mão" / por que usar API
Emitir NF exige falar com o webservice da SEFAZ/prefeitura (cada uma com seu padrão XML, certificado digital
A1/A3, regras tributárias). É complexo e varia por município/estado. Gateways como FocusNFe, eNotas, NFe.io e
PlugNotas **abstraem** isso: você manda um JSON, eles cuidam do XML, assinatura, transmissão e retorno.

---

## 2. Tipos de Nota Fiscal (glossário rápido)

| Sigla | Nome | Quando se usa | Órgão | Relevância p/ NASA |
| --- | --- | --- | --- | --- |
| **NFe** | Nota Fiscal Eletrônica (modelo 55) | Venda de **mercadoria/produto físico** entre empresas (B2B) | SEFAZ estadual | Média — se a org vende produto físico via Forge |
| **NFCe** | NF de Consumidor Eletrônica (modelo 65) | Venda no **varejo ao consumidor final** (PDV) | SEFAZ estadual | Baixa — não é o nosso caso |
| **NFSe** | NF de **Serviço** Eletrônica | Prestação de **serviço** (consultoria, agência, software, etc) | Prefeitura municipal | **Alta** — é o caso típico de agência/serviço |
| **NFSe Nacional** | Padrão nacional pós-Reforma Tributária | Serviço, novo padrão centralizado | Ambiente nacional (Receita) | **Alta e crescente** — futuro do NFSe |
| **CTe / MDFe** | Transporte de carga / manifesto | Logística, transportadoras | SEFAZ | Nula |
| **NFCom / NFGás** | Telecom / gás canalizado | Setores específicos | SEFAZ | Nula |

> **Resumo p/ o NASA**: o caso dominante é **NFSe** (serviço). Secundariamente **NFe** se alguma org vender
> produto físico. NFCe/CTe/MDFe não fazem sentido pro perfil de cliente.

### Glossário de termos que vão aparecer

- **Emitente / Prestador**: quem emite a nota = a **organização** (CNPJ dela).
- **Tomador / Destinatário**: quem recebe = o **cliente** da organização (o `Lead` no Forge).
- **Chave de acesso**: identificador único de 44 dígitos da nota autorizada (NFe/NFCe).
- **DANFE / DANFSe**: o **PDF** "imprimível" da nota (representação gráfica). XML é o documento legal; PDF é
  a versão humana.
- **CNPJ / Inscrição Municipal (IM) / Inscrição Estadual (IE)**: cadastros fiscais do emitente. NFSe exige IM;
  NFe exige IE.
- **Regime tributário**: Simples Nacional, Lucro Presumido, Lucro Real — muda alíquotas e campos obrigatórios.
- **CFOP**: Código Fiscal de Operações (usado em NFe — natureza da operação).
- **NCM**: classificação da mercadoria (NFe).
- **Item da Lista de Serviço (LC 116/2003)**: código que classifica o tipo de serviço (NFSe). Ex: `1.07`,
  `17.01`. Cada prefeitura mapeia isso pro seu "código de serviço municipal".
- **ISS / ISSQN**: imposto municipal sobre serviço (incide na NFSe). Tem alíquota (%) e regra de retenção.
- **ICMS / IPI / PIS / COFINS**: impostos de mercadoria/federais (entram na NFe).
- **Reforma Tributária (CBS/IBS)**: nova estrutura de impostos em transição (2026+). É o motivo do **NFSe
  Nacional** estar substituindo gradualmente os padrões municipais — importante ter no radar.

---

## 3. A API FocusNFe

### 3.1 O que é
Gateway HTTP REST que abstrai a emissão dos vários documentos fiscais. Você envia JSON, ele devolve JSON e
arquivos (XML/PDF). Cuida de certificado digital, XML, assinatura e transmissão à SEFAZ/prefeitura.

### 3.2 Autenticação
- **HTTP Basic Auth** (RFC 7617). **Não** é Bearer token.
- O **token da empresa** vai como **usuário** do Basic Auth; **senha fica em branco**.
  - Header: `Authorization: Basic base64("<TOKEN>:")` (o `:` no fim é obrigatório).
  - cURL: `curl -u 'SEU_TOKEN:' https://...`
- O token é gerado no **painel FocusNFe** ao cadastrar a empresa.
- **Token é por empresa e por ambiente** (homologação e produção têm tokens diferentes).

### 3.3 Ambientes
| Ambiente | Base URL | Uso |
| --- | --- | --- |
| Homologação | `https://homologacao.focusnfe.com.br` | Testes — notas **sem valor fiscal** |
| Produção | `https://api.focusnfe.com.br` | Emissão real |

As rotas v2 ficam sob `/v2/...` (ex: `/v2/nfse`, `/v2/empresas`).

### 3.4 Fluxo geral de emissão (assíncrono)
A maioria dos documentos (NFe, NFSe, etc) é **assíncrona**. O padrão é:

1. **Você gera uma `ref`** — uma referência única **definida por você** (idempotência). Ex: `proposta-{id}` ou
   `fatura-{uuid}`. Ela identifica a nota nas chamadas seguintes.
2. **POST** o JSON da nota → `POST /v2/nfse?ref=SUA_REF` (resposta inicial: `processando_autorizacao`).
3. A FocusNFe processa na fila e fala com a prefeitura/SEFAZ.
4. **Você descobre o resultado** de uma das duas formas:
   - **Webhook** (recomendado): FocusNFe faz `POST` na sua URL quando o status muda.
   - **Polling**: `GET /v2/nfse/SUA_REF` consultando o status.
5. **Status finais** típicos:
   - `autorizado` → nota válida; retorna URL do XML e do PDF (DANFe/DANFSe).
   - `erro_autorizacao` → rejeitada (retorna mensagem da SEFAZ/prefeitura — ex: campo errado, cadastro).
   - `cancelado` → após cancelamento.
6. **Cancelamento**: `POST /v2/nfse/SUA_REF/cancelamento` (com janela de tempo e regras que variam — alguns
   municípios não permitem cancelar via webservice).

> NFCe é **síncrona** (retorno imediato, p/ PDV) — mas não é o nosso caso.

### 3.5 Endpoints principais (referência)
**Emissão / documentos**
- `POST /v2/nfse?ref=...` · `GET /v2/nfse/{ref}` · `POST /v2/nfse/{ref}/cancelamento` · `POST /v2/nfse/{ref}/email`
- `POST /v2/nfe?ref=...` · `GET /v2/nfe/{ref}` · `POST /v2/nfe/{ref}/cancelamento` · `POST /v2/nfe/{ref}/carta_correcao`
- `POST /v2/nfse_nacional?ref=...` · `GET /v2/nfse_nacional/{ref}` · `POST /v2/nfse_nacional/{ref}/cancelamento`

**Cadastro de empresa (emitente)**
- `POST /v2/empresas` · `GET /v2/empresas/{id}` · `PUT /v2/empresas/{id}` · `DELETE /v2/empresas/{id}`
- `dry_run=1` simula sem persistir.

**Webhooks (gatilhos)**
- `POST /v2/hooks` (criar) · `GET /v2/hooks` · `DELETE /v2/hooks/{id}`
- Reenvio de notificação: `POST /v2/nfse/{ref}/webhook_reenvio` (e equivalentes por tipo).

**Consultas auxiliares (úteis pra validar dados antes de emitir)**
- `GET /v2/cnpj/{numero}` · `GET /v2/cep/{codigo}` · `GET /v2/cfop/...` · `GET /v2/ncm/...`
- `GET /v2/municipios/{ibge}/servicos` (lista de itens de serviço da prefeitura — essencial p/ NFSe).

### 3.6 Esboço de payload NFSe (ilustrativo, não final)
```jsonc
{
  "data_emissao": "2026-06-17T10:00:00",
  "prestador": {                       // = a organização (CNPJ dela)
    "cnpj": "00000000000000",
    "inscricao_municipal": "12345",
    "codigo_municipio": "2304400"      // IBGE
  },
  "tomador": {                         // = o cliente (Lead)
    "cnpj": "11111111111111",          // ou "cpf"
    "razao_social": "Cliente LTDA",
    "email": "cliente@exemplo.com",
    "endereco": { "logradouro": "...", "numero": "...", "codigo_municipio": "...", "uf": "SP", "cep": "..." }
  },
  "servico": {
    "aliquota": 0.05,                  // ISS 5%
    "discriminacao": "Serviço de consultoria — Proposta #123",
    "iss_retido": false,
    "item_lista_servico": "17.01",     // LC 116
    "codigo_tributario_municipio": "...",
    "valor_servicos": 5000.00
  }
}
```
> Os campos **exatos variam por município**. Por isso `GET /municipios/{ibge}/servicos` e o ambiente de
> homologação são indispensáveis na fase de implementação.

---

## 4. Onde isso encaixa no NASA (mapeamento de domínios)

### 4.1 O que já existe hoje (estado atual, sem mudar nada)

**Forge** (`src/features/forge/`) — é o módulo de **CPQ / vendas**:
- `ForgeProduct` — catálogo de produtos/serviços (`name`, `sku`, `unit`, `value` Decimal, `description`).
- `ForgeProposal` — propostas pro `client` (que é um `Lead`), com `responsible`, `products`, `discount`,
  `validUntil`, `paymentLink`, `paymentGateway`, `status` (`RASCUNHO`…), e geração de **contrato** (`ForgeContract`).
- `ForgeSettings` — config por organização: `letterhead`, `logo`, comissão, `paymentGatewayConfigs` (Json).

**Financeiro** (não há feature `financeiro` literal — está espalhado):
- `billing/` — provavelmente assinatura/plano da própria plataforma.
- `payment/` — páginas e gates de pagamento.
- Já existe padrão de **config sensível criptografada por org**: `AiSettings.aiApiKey` (AES-256-GCM via
  `src/lib/crypto.ts`, chave `AI_SECRETS_KEY`). É exatamente o molde pra guardar o **token FocusNFe por org**.

### 4.2 Por que NFSe é o foco
O fluxo do Forge é: organização monta **proposta de serviço/produto** → cliente aceita/paga → precisa **emitir
nota**. Como o cliente final é uma empresa/pessoa comprando **serviço**, o documento natural é **NFSe** (ou
NFSe Nacional). Os dados já moram quase todos no schema: emitente = `Organization`, tomador = `Lead`/`client`,
itens = `ForgeProposalProduct`, valores = `value`/`discount`.

### 4.3 Multi-tenant: cada organização é um emitente
Ponto-chave de arquitetura: **cada `Organization` tem seu próprio CNPJ, inscrição municipal e token FocusNFe**.
Isso espelha o padrão "BYO" (bring-your-own) que já existe pra IA e pros gateways de pagamento
(`paymentGatewayConfigs`). Ou seja:
- Token + ambiente FocusNFe são **config por org** (criptografados, à la `AiSettings`).
- O cadastro da empresa na FocusNFe (`POST /empresas`) pode ser feito por org no onboarding fiscal.

---

## 5. Casos de uso candidatos (para discutir, sem comprometer)

### No Forge (vendas → nota)
1. **Emitir NFSe a partir de uma proposta aceita/paga**: botão "Emitir nota" numa `ForgeProposal` com status de
   ganho/pago. Mapeia produtos → `servico`, cliente → `tomador`, org → `prestador`.
2. **Emissão automática no pagamento**: quando o `paymentLink`/gateway confirma pagamento (webhook), dispara a
   emissão via Inngest (assíncrono — combina com o fluxo async do FocusNFe).
3. **Anexar DANFSe (PDF) e XML à proposta/contrato**: guardar URLs retornadas e mostrar pro cliente no portal
   público (`client-portal`).
4. **Status da nota visível na proposta**: badge `processando / autorizada / erro / cancelada`, alimentado por
   webhook FocusNFe.

### No Financeiro
5. **Painel de notas emitidas por organização**: listagem, filtros, reemissão de e-mail, download de XML/PDF,
   cancelamento dentro da janela.
6. **Conciliação**: vincular cada nota a uma fatura/pagamento (conciliação financeira / ECONF que a API expõe).
7. **Configuração fiscal por org**: tela em settings p/ cadastrar CNPJ, IM, regime tributário, item de serviço
   padrão (LC 116), alíquota ISS, e o token FocusNFe (criptografado).
8. **NFe para produto físico** (secundário): se a org vender produto, suportar modelo 55 com NCM/CFOP.

### Transversal
9. **Webhook receiver**: rota tipo `/api/focusnfe/webhook` que atualiza status das notas (espelha o padrão dos
   webhooks de Stripe/Stars já existentes no projeto).
10. **Inngest** pra orquestrar emissão assíncrona, retries em `erro_autorizacao` e polling de fallback.

---

## 6. Pontos de atenção / riscos a levantar antes de implementar

- **Variação municipal do NFSe**: cada prefeitura tem campos e códigos próprios. Testar por município em
  homologação é obrigatório. O **NFSe Nacional** reduz isso, mas a adoção ainda é parcial em 2026.
- **Reforma Tributária (CBS/IBS)**: campos e padrões em transição. Vale priorizar/avaliar NFSe Nacional.
- **Dados cadastrais do tomador**: NFSe pra PJ costuma exigir CNPJ, razão social, endereço completo. O `Lead`
  hoje pode não ter todos esses campos → provavelmente precisará enriquecer o cadastro de cliente.
- **Regime tributário e alíquota**: precisam vir da config fiscal da org, não hardcoded.
- **Segurança do token**: token FocusNFe é credencial sensível → criptografar (padrão `crypto.ts` /
  `AI_SECRETS_KEY`), nunca expor no client.
- **Idempotência via `ref`**: definir uma `ref` determinística por proposta/fatura pra evitar emissão dupla.
- **Cancelamento**: janela e permissão variam (alguns municípios não cancelam por webservice).
- **Custo**: FocusNFe cobra por nota/plano — entra no custo operacional por organização.
- **Onde mora o código**: pela arquitetura por features, o natural seria uma feature nova
  `src/features/nfs/` (ou `fiscal/`) com `server/`, `hooks/`, `schemas/`, `lib/` — consumida por `forge` e pelo
  financeiro, em vez de espalhar lógica fiscal dentro do Forge.

---

## 7. Próximos passos sugeridos (quando formos planejar de fato)

1. Definir escopo do MVP: **só NFSe**? Só NFSe Nacional? Incluir NFe?
2. Levantar os campos fiscais faltantes no `Lead` (tomador) e na `Organization` (prestador).
3. Conta sandbox no FocusNFe + token de homologação pra um município piloto.
4. Decidir o modelo de config por org (criptografia do token, ambiente, dados fiscais).
5. Desenhar o fluxo Inngest emissão + webhook receiver.
6. Só então abrir `/start fiscal nfse-focusnfe` e começar.

---

### Referências
- Documentação FocusNFe: https://doc.focusnfe.com.br/
- Índice machine-readable (p/ agentes): https://doc.focusnfe.com.br/llms.txt
- Autenticação: https://doc.focusnfe.com.br/reference/autenticacao.md
- NFSe: https://doc.focusnfe.com.br/reference/nfse.md
- Lei Complementar 116/2003 (lista de serviços / ISS)
