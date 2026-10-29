# Protótipo do Órbita Station 3D (referência temporária)

> ⚠️ **Apagar esta pasta inteira** quando o Órbita Station 3D tiver portado tudo, ou quase tudo, da lista "Ainda só existe aqui" abaixo. Ela não é código do produto: é a referência visual e de comportamento validada com o time. Mantida aqui só porque o artifact original pode ser apagado ou sobrescrito.

| | |
| --- | --- |
| Arquivo | `orbita-station.prototipo-v33.html`: o fonte do protótipo, versão 33 |
| Original | Artifact no claude.ai: https://claude.ai/artifact/MgADsrrtfnAPs2WESNUz8b (privado) |
| Specs que nasceram dele | [0117](../../../specs/orbita-station/0117-orbita-station-3d-etapa-1.md), [0118](../../../specs/orbita-station/0118-loja-orbita-itens-na-estacao.md) e [0119](../../../specs/orbita-station/0119-orbita-station-etapa-2-estacao-da-empresa.md) |
| Código do produto | `src/features/orbita-station/` (ver [docs/orbita-station-overview.md](../../orbita-station-overview.md)) |

## Ele não roda sozinho

O fonte espera três marcadores no lugar dos modelos 3D, que o artifact recebia embutidos em base64 (cerca de 8 MB):

- `__AVATAR_GLB_BASE64__`
- `__FURNITURE_BUNDLE__`
- `__KAYKIT_BUNDLE__`

Os modelos já estão no repositório, em `public/orbita-station/models/`. Para **ver** o protótipo funcionando, abra o artifact. Para **ler** como algo foi feito, use este arquivo: procure pelo nome da seção (os blocos começam com `// ================= Nome =================`).

É um HTML de um arquivo só, com Three.js r147 carregado de CDN, dados de exemplo e tudo gravado no navegador. Nada daqui deve ser copiado como está: o código do produto segue as specs, o Three.js atual e o banco.

## Já portado para o produto

Estrutura e salas dos 8 modelos de estação, móveis, personagem e estúdio, câmera, modo mapa, acabamento (luz, reflexo, brilho), print simples, estação da empresa no banco e colegas ao vivo.

## Ainda só existe aqui

Consulte o protótipo ao fazer estas partes. Quando quase tudo estiver portado, apague a pasta.

- [ ] Loja e inventário (spec 0118): seções `Loja`, `Catálogo da Loja` e `Menu de contexto do mapa`
- [ ] Editor de decoração (modo Decorar) e planta 2D: seções `Decoração` e `Editor (planta 2D)`
- [ ] Salas trancadas por permissão (porta que treme, aviso): `canEnter`, `bumpLockedDoor`
- [ ] Pessoas nos postos e fila de leads do NasaChat: seções `Pessoas (exemplo)` e `Leads do NasaChat`
- [ ] Portais de teletransporte pela porta da sala: seção `Portal de teletransporte`
- [ ] Painel do gestor ("O que pede atenção") e painel lateral das salas: seções `Painel lateral` e `HUD`
- [ ] Interação por proximidade ("Falar com…", "Ver sala"): seção `Interação por proximidade`
- [ ] Poses, fundos e miniaturas renderizadas no estúdio: seção `Personagem: estúdio`
- [ ] Partículas e emotes: seções `Partículas` e `Animação`
