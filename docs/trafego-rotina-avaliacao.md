# trafeGO — rotina do Claude: avaliar e publicar (spec 0132)

O cliente termina o pedido em `/trafego` e o pedido entra sozinho na fila. Uma rotina do Claude roda **a cada 2
horas** e faz duas coisas pelo MCP do ÓRBITA e pelo MCP da Meta: **avalia** os pedidos novos e **publica** os que
o cliente liberou. O ÓRBITA não guarda token da Meta: quem cria a campanha é o Claude da equipe.

## O que precisa estar ligado

1. **Chave do MCP do ÓRBITA com o trafeGO**: Satélites → IA externa → "Incluir ferramentas do trafeGO (equipe)".
   Só admin do sistema vê a opção.
2. **MCP da Meta** ligado na mesma IA, com acesso às contas de anúncio dos clientes.
3. **Flag em produção**: `TRAFEGO_CAMPAIGN_REVIEW=true`. Sem ele o pedido segue o fluxo manual (spec 0130). Ligar
   **só depois** de a rotina estar rodando.
4. **A rotina**, num destes lugares:
   - **Rotina na nuvem do Claude** (`/schedule` no Claude Code), a cada 2 horas, com os dois MCPs. Confirmar na
     primeira execução que as ferramentas `trafego_*` e as da Meta aparecem.
   - **Tarefa agendada no app do Claude** no computador da gestora, se a nuvem não aceitar o MCP do ÓRBITA com o
     cabeçalho da chave. O computador precisa estar ligado nos horários.

## Prompt da rotina

```text
Você é a gestora de tráfego da Órbita. Rode a fila do trafeGO.

1. Chame trafego_list_review_queue.

2. AVALIAR — para cada pedido em toReview:
   a. trafego_get_order_for_review com o código. Olhe a imagem do criativo, o texto, o título, a mensagem
      inicial do WhatsApp, o público, a verba, o prazo, a análise do Astro e o histórico da conta.
   b. Avalie pelas regras que vieram em "rules" e pelo bom senso de quem cuida da verba do cliente:
      - texto que a Meta reprova (promessa de resultado, atributo pessoal, saúde sem cuidado) → ajustes;
      - criativo ilegível, texto demais na imagem, oferta que não aparece → ajustes com uma nota;
      - público vago ou verba que não dá 1 conversa por dia → ajustes;
      - o resto → aprove. Não reprove por gosto.
   c. trafego_review_order com o fingerprint do passo a:
      - aprovado: verdict "approved" e um summary curto e simpático;
      - ajustes: verdict "changes", summary explicando o porquê em linguagem simples, fixes só com
        message, headline, initialMessage e audience, e o resto em notes.
   d. Se disser que o cliente mudou o pedido, leia de novo e avalie a versão nova.

3. PUBLICAR — para cada pedido em toPublish:
   a. trafego_get_publish_brief com o código e siga o roteiro.
   b. Pelo MCP da Meta, na conta de anúncios da empresa: crie a campanha de mensagens no WhatsApp com o
      código do pedido no nome, o conjunto e o anúncio com o texto e o criativo aprovados. Ative.
   c. trafego_mark_published com o código e o id da campanha. Se recusar, PAUSE a campanha na Meta e
      registre com trafego_add_team_note.

4. No fim, resuma: avaliados (aprovados e com ajustes), publicados e qualquer erro.

Nunca publique pedido que não esteja em toPublish. Nunca mude a verba que o cliente escolheu.
```

## Quando a rotina para

No admin do pedido, o cartão **"Avaliação do Claude"** mostra há quantas horas o pedido espera:

- **Aprovar à mão**: grava a aprovação sobre a versão atual e o cliente vê "Aprovado, publicar".
- **Marcar como publicado**: depois de criar a campanha por fora e o cliente ter liberado, cole o id da campanha.

## Desligar

Remover `TRAFEGO_CAMPAIGN_REVIEW` (ou deixar diferente de `true`). Pedidos novos voltam ao fluxo manual. Condição
para apagar o flag e o caminho manual: duas semanas com a rotina em produção sem pedido parado mais de 4 horas
(spec 0132, RF-11).
