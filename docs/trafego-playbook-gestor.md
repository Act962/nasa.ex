# trafeGO — playbook do gestor

> Como operar um pedido do começo ao fim usando o tracking "TrafeGO", o painel admin e o
> Claude Code com o MCP da Meta. Escrito para quem nunca fez tráfego: cada coluna diz o que
> conferir e o que fazer para o card andar. Spec: [`specs/trafego/0009`](../specs/trafego/0009-trafego-operacao-inteligencia.md).

## Regras de ouro

1. **O card é o pedido.** Arrastar o card muda o status, atualiza o painel do cliente e dispara o
   aviso (WhatsApp + e-mail). Não precisa avisar à mão.
2. **Dinheiro não se arrasta.** Mover um card para "Pagamento confirmado" não confirma nada; só o
   Stripe ou o botão "Confirmar PIX" (na aba trafeGO do card, a partir da Fase B).
3. **Nome da campanha no Meta sempre com o código**: `TG-0007 — Padaria do Bairro — Leads`. É por
   esse nome que o painel do cliente passa a mostrar os números sozinho (Fase C). Uma campanha por
   código.
4. **Nunca peça senha.** Acesso à conta do cliente é por parceiro na BM (Business ID da Órbita).
5. **O apelido do card (`TG-0007`) diz qual pedido ele espelha.** Cliente antigo comprando de novo
   usa o mesmo card.

## Coluna por coluna

| Coluna | O que significa | O que conferir antes de mover | Para onde mover |
| --- | --- | --- | --- |
| **Aguardando pagamento** | Cliente parou no wizard ou escolheu PIX e ainda não pagou | Comprovante chegou na conversa? Confira **valor**, **data** e se a **referência** (`TGP-xxxx`) bate com a do card | Abra a aba **trafeGO** do card → **Confirmar PIX**. Valor diferente do pedido? Digite o que realmente caiu — fica marcado como divergência |
| **Pagamento confirmado** | Pago, cliente ainda não criou a senha | Link de ativação foi enviado (evento com "cliente avisado") | *Nada* — vira "Análise da conta" quando o cliente cria a conta |
| **Análise da conta de tráfego** | Pedido nasceu. Verificar conta de anúncios | O Briefing do card já traz o que o wizard verificou: conta do Instagram/Facebook encontrada, número na API Oficial e se o WhatsApp de contato foi confirmado. Cliente tem BM? Adicionou nosso Business ID como parceiro? No Claude Code: `ads_get_ad_accounts` mostra a conta? Conta sem restrição? Sem BM: criar BM + página (faz parte do setup). WhatsApp Oficial sem número: adquirir e habilitar o número na API (setup) | **Aguardando seus materiais** quando o acesso estiver OK. Conta restrita → **Ajustes solicitados** com o recado do que ele precisa resolver |
| **Aguardando seus materiais** | Cliente precisa subir criativos e copy | Abra a aba **Acessos** do painel dele pelo admin: o checklist mostra o que ele já marcou como liberado. O **Release** (se ele montou) diz o que a empresa vende e o que não pode ser dito — é o que você usa para julgar a copy. Nada a fazer no card; cobrar por WhatsApp se passar de 3 dias | *Nada* — vira "Materiais enviados" sozinho |
| **Materiais enviados** | Tem ≥1 criativo e ≥1 copy selecionada | Dar uma olhada prévia nos materiais | *Nada* — o cliente clica "Ativar" e o card vai para a fila |
| **Na fila da equipe** | Cliente ativou; é sua vez | Abrir o pedido no admin: criativos, copy, briefing, destino | **Em análise** ao começar a trabalhar |
| **Em análise** | Você está montando a campanha | O pedido traz o nível de política (OK/atenção) e as copies marcadas — comece por aí. Copy com selo "Sugerida pelo Astro" foi gerada do Release e **já passou** pela checagem determinística, mas ainda é você quem aprova. Criativo dentro das políticas? Copy sem promessa proibida? Destino funciona (site abre, WhatsApp responde)? Verba/dia faz sentido? | **Agendada** (campanha criada, com data) ou **Ajustes solicitados** (recado claro do que corrigir) |
| **Ajustes solicitados** | Devolvido ao cliente | O recado explica o que fazer? | *Nada* — quando ele corrigir e ativar de novo, volta para "Na fila" |
| **Agendada** | Campanha criada no Meta/Google, aguardando início | Nome com o código; orçamento diário; data de início | **No ar** quando começar a veicular |
| **No ar** | Veiculando | Primeiros 3 dias: aprovação dos anúncios, gasto real; depois: CPL/CPC, frequência | **Pausada** (problema) ou **Concluída** (fim do período) |
| **Pausada** | Parada por problema | Recado com o motivo | **No ar** ao resolver |
| **Concluída** | Período acabou | Relatório final no painel; oferecer recompra | — |

Cancelado / reembolsado não têm coluna: o card fica **perdido** com o motivo no histórico.

## Operando com o Claude Code + MCP da Meta

Abra o Claude Code na org da agência com o MCP da Meta conectado e cole o briefing do pedido
(admin → aba Briefing). Sequência típica:

1. **Conta** — `ads_get_ad_accounts` para confirmar que a conta do cliente aparece (acesso de
   parceiro concedido). Sem BM: criar a BM em nome do cliente e a página do Facebook (setup).
2. **Campanha** — pedir ao Claude para criar a campanha com o objetivo do pedido (Meta:
   `OUTCOME_LEADS`, `OUTCOME_SALES`…), **nome `TG-NNNN — Cliente — Objetivo`**, orçamento diário =
   verba ÷ dias do pedido, público conforme o briefing e o destino (site / WhatsApp / Instagram).
3. **Criativos e copy** — usar os selecionados no pedido. Se o criativo tiver texto demais ou a
   copy tiver alegação proibida, devolver ao cliente por "Ajustes solicitados", não corrigir por
   conta própria.
4. **Revisão** — antes de ativar: pixel/conversão configurados, destino testado, orçamento certo.
5. **Card** — mover para "Agendada" e, quando começar a rodar, "No ar". O cliente é avisado nas
   duas.

## Release e recomendações — o que o cliente vê antes de você

Depois de pagar, o cliente entra num painel que já explica o que fazer. Você não precisa repetir
isso por WhatsApp; precisa saber o que ele leu.

- **Seus próximos passos** (topo do painel) — lista numerada do que depende dele, mais duas
  avaliações: formato de criativo recomendado e se a verba comporta o objetivo. Os números vêm de
  regra em código, não de modelo: R$ 300 em 30 dias no Meta aparece como **R$ 10,00/dia ·
  abaixo do mínimo**, sempre igual. Se ele te procurar dizendo "o sistema falou que minha verba é
  baixa", é isso.
- **Release** — ele aponta o site e sobe o catálogo em PDF; nós lemos e escrevemos um resumo da
  empresa. Instagram e Facebook ele pode adicionar, mas **não são lidos** (a Meta não permite) —
  ficam como referência para você abrir na mão. O Release só vale depois que ele **salva**: até
  lá é rascunho de máquina. Quando salva, o Briefing do card é atualizado sozinho.
- **Acessos** — checklist de página, Instagram, BM e acesso de parceiro, com o nosso Business ID
  pronto para copiar. É o que você confere na coluna "Análise da conta de tráfego". O checklist é
  **autodeclarado**: a prova continua sendo a conta aparecer no `ads_get_ad_accounts`.
- **Sugerir com o Astro** (aba Materiais) — cria até três copies a partir do Release, marcadas como
  sugestão e **nunca já selecionadas**. O cliente escolhe e edita.

## Quando o cliente cai na trava de políticas

O wizard verifica o que o cliente escreve contra as regras de Meta, Google e WhatsApp:

- **Bloqueado** — remédio sob prescrição (Mounjaro, Ozempic, canetas), vape, arma, aposta sem licença, réplica e promessa de emagrecimento com número/prazo. O checkout automático não abre; ele cai no seu WhatsApp. **Não libere por simpatia**: esses casos restringem a conta de anúncios, não só reprovam o anúncio. Se for falso positivo (ex.: uma loja de "vaporizador de ambiente"), crie a compra manualmente pelo admin.
- **Atenção** — resultado garantido, promessa de cura, antes/depois, renda com valor, álcool, suplemento, estética, crédito. O cliente paga depois de marcar que leu. Na sua revisão, confira se a copy corrigiu o ponto — se não corrigiu, devolva por "Ajustes solicitados".

As copies que o cliente salva no painel também são verificadas: a que tem problema aparece marcada no pedido.

## Confirmando um PIX

1. O card chega em **Aguardando pagamento** com o comprovante na conversa.
2. Abra a aba **trafeGO** do card. A cobrança aparece com a referência e o valor.
3. Compare a referência do comprovante com a do card. **Não confirme pela cara do valor** — dois clientes podem pagar o mesmo valor no mesmo dia.
4. Clique em **Confirmar PIX** e informe o valor que realmente caiu. Diferente do pedido? Digite o valor real: fica registrado como divergência e o pedido entra marcado para conferência antes de definir a verba.
5. Pronto: o cliente recebe o link de acesso por e-mail e WhatsApp, a venda é lançada no financeiro e o card vai para "Pagamento confirmado".

**Cobrança vencida ainda vale.** Depois da validade a cobrança vira "vencida" na fila, mas o botão continua lá — se o dinheiro caiu, confirme normalmente.

**Se aparecer "já foi paga no cartão"**: o cliente pagou duas vezes. Confirme com o financeiro e estorne uma das cobranças; os admins recebem uma notificação nesse caso.

## Disparo no WhatsApp Oficial — aquecimento

Número novo na API Oficial **não** dispara para a base inteira. A Meta libera por degraus
(~250 conversas/dia → 1.000 → 10.000 → 100.000), e cada degrau depende de alguns dias com boa
qualidade (gente respondendo, ninguém bloqueando). Monte o calendário em ondas com o cliente
**antes** de ativar: primeiro quem mais reconhece a marca, depois o resto. Isso já é explicado
no wizard, mas confirme na análise da conta para não gerar expectativa de "mando tudo amanhã".

## O que não fazer

- Não mudar status pelo admin **e** pelo card ao mesmo tempo — escolha um; o outro acompanha.
- Não mover o card do cliente para outro tracking (o pedido perde o espelho e o admin é avisado).
- Não confirmar PIX sem o comprovante na conversa do card.
- Não prometer prazo diferente do que o cliente aceitou no wizard (está no card, em "Prazo").

## Quando algo dá errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Movi o card e o painel do cliente não mudou | Coluna não mapeada no tracking (evento interno "Card movido no tracking") | Admin → trafeGO → Ajustes → Operação → "Conferir colunas" |
| Cliente não recebeu WhatsApp | Template não aprovado ou instância fora do ar; e-mail foi | Ver `reason` no evento; cadastrar/aprovar o template nos Ajustes |
| Comprovante criou outro card | Telefone do wizard diferente do WhatsApp que mandou | Mesclar à mão: mover a conversa/lead e apagar o duplicado |
| Card e pedido divergem | Alguém mudou por workflow/Astro | A varredura horária realinha; se o card mudou depois do pedido, chega notificação para o admin decidir |
