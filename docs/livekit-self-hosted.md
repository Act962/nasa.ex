# LiveKit na VPS própria (Coolify)

O LiveKit Cloud acabava rápido. A decisão (spec [0119](../specs/orbita-station/0119-orbita-station-etapa-2-estacao-da-empresa.md), D-3) é rodar o servidor do LiveKit na nossa VPS, pelo Coolify.

O uso inicial é pequeno: **até ~20 pessoas ao mesmo tempo**, trocando só posição (cerca de 20 bytes por mensagem), sem vídeo. Um único servidor do LiveKit dá conta com folga, sem Redis e sem cluster.

## Como o LiveKit usa a rede

| Porta | Protocolo | Para quê | Passa pelo proxy do Coolify? |
| --- | --- | --- | --- |
| 7880 | HTTP/WebSocket | Sinalização: o navegador conecta em `wss://livekit.<domínio>` | **Sim** (Traefik, com o certificado do Coolify) |
| 7881 | TCP | Mídia e dados quando a rede bloqueia UDP | Não: porta aberta direto na VPS |
| 50000–50100 | UDP | Mídia e dados (o caminho normal) | Não: portas abertas direto na VPS |

As faixas UDP e a 7881 **não passam pelo proxy**: o navegador fala direto com o IP da VPS. Uma faixa de 100 portas UDP basta para algumas centenas de conexões simultâneas.

## Passo a passo no Coolify

1. **DNS:** crie `livekit.<domínio>` apontando (registro A) para o IP da VPS.
2. **Chaves:** gere um par de chave e segredo:

   ```bash
   docker run --rm livekit/livekit-server generate-keys
   ```

3. **Recurso novo no Coolify:** do tipo *Docker Compose*, com o `docker-compose.yml` e o `livekit.yaml` abaixo. Troque a chave e o segredo pelos gerados no passo 2.
4. **Domínio do serviço:** no Coolify, aponte `https://livekit.<domínio>` para a porta **7880** do serviço `livekit`. O Coolify emite o certificado.
5. **Firewall da VPS** (e do provedor, se houver): libere **7881/tcp** e **50000–50100/udp** de entrada.
6. **Variáveis do app NASA:**

   | Variável | Valor | Observação |
   | --- | --- | --- |
   | `LIVEKIT_API_KEY` | a chave gerada | servidor |
   | `LIVEKIT_API_SECRET` | o segredo gerado | servidor; nunca com prefixo `NEXT_PUBLIC_` |
   | `LIVEKIT_WS_URL` | `wss://livekit.<domínio>` | servidor |
   | `NEXT_PUBLIC_LIVEKIT_URL` | `wss://livekit.<domínio>` | vai no bundle do navegador: precisa estar no secret `NEXT_PUBLIC_ENV` **na hora do build** (CLAUDE.md, regra 24b) |

7. **Deploy do app.** As outras telas que usam LiveKit (reunião com lead) passam a usar o servidor novo junto, porque leem as mesmas variáveis.

### `docker-compose.yml`

```yaml
services:
  livekit:
    # Fixe a versão estável do dia do deploy (veja as tags em hub.docker.com/r/livekit/livekit-server).
    image: livekit/livekit-server:v1.8.4
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    ports:
      - "7881:7881/tcp"
      - "50000-50100:50000-50100/udp"
    expose:
      - "7880"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    mem_limit: 512m
```

### `livekit.yaml`

```yaml
port: 7880
log_level: info
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  # Descobre o IP público da VPS para anunciar aos navegadores (atrás do Docker o IP interno não serve).
  use_external_ip: true
keys:
  TROQUE_PELA_CHAVE: TROQUE_PELO_SEGREDO
room:
  # Limite da estação (spec 0119, RNF-4). Sala vazia fecha em 5 min.
  max_participants: 30
  empty_timeout: 300
```

## Como conferir que funcionou

1. `https://livekit.<domínio>` responde `OK` no navegador.
2. Faça um teste de conexão no [connection test do LiveKit](https://livekit.io/connection-test) com um token gerado pelo app, ou entre numa reunião com lead. O teste mostra se a conexão saiu por UDP (o esperado) ou caiu para TCP.
3. Com duas pessoas na estação, depois da etapa 2: os personagens se veem andando.

## Riscos conhecidos

- **Redes corporativas que bloqueiam UDP e a porta 7881:** a conexão falha. A solução é ligar o TURN do LiveKit na porta 443 com um domínio próprio (`turn.<domínio>`). Fica para quando aparecer o caso: com até 20 usuários, é provável que ninguém precise.
- **Vídeo e áudio no futuro:** com 20 pessoas em vídeo, o consumo de banda e CPU sobe bastante. Medir antes de ligar e, se precisar, separar o LiveKit numa VPS própria.
- **A VPS cai:** a estação continua abrindo sozinha, sem os colegas (spec 0119, CB-7).
