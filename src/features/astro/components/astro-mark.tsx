"use client";

import { type RefObject, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * O rosto do Astro: a marca da ÓRBITA, com os olhos vivos.
 *
 * O desenho todo é vetor: o arco e a lua foram medidos do bitmap original
 * (`astro-corpo.svg`, que segue no disco só para o widget externo) e cada um
 * ganhou movimento próprio — arco até perto da borda azul, olhos um pouco
 * além dele na direção do cursor, lua mais lenta. Uma trava mantém os olhos sempre afastados
 * da borda de dentro do arco.
 *
 * Cada movimento pede um pivô diferente, e é isso que explica as camadas:
 *
 *   <span>         treme quando zangado (chamando atenção)
 *     <g arco>     segue o ponteiro mais longe e mais devagar que os olhos
 *     <g lua>      a mais lenta, com uma órbita pequena que nunca para
 *     <g olhar>    translada os dois olhos juntos, seguindo o ponteiro
 *       <g piscar> achata em Y os dois juntos, na linha dos olhos
 *         <g olho> gira e engorda cada um em torno do próprio centro
 *
 * Três humores, e eles se excluem por construção: passar o mouse por cima
 * apaga a zanga (o ponteiro se moveu), e a alegria só existe sob o cursor.
 *
 * Tudo num `requestAnimationFrame` só, escrito direto no atributo. Fora do
 * React de propósito: isto roda a 60fps, e virar estado re-renderizaria a
 * árvore a cada quadro.
 */

/** Onde cada olho tem o centro, no viewBox de 1438 (lido dos clipPaths). */
const CENTRO_ESQ = { x: 551.06, y: 750.42 };
const CENTRO_DIR = { x: 810.07, y: 750.42 };

/**
 * O quanto o olhar viaja, em unidades do viewBox. Precisa ir MAIS longe que o
 * arco: em relação ao rosto, os olhos têm de avançar na direção do cursor —
 * com o arco andando mais, eles pareciam olhar para o lado oposto.
 */
const ALCANCE_X = 160;
const ALCANCE_Y = 132;

/**
 * O arco e a lua, medidos do desenho original (o bitmap de `astro-corpo.svg`,
 * girado 18,27° e reduzido a 0,939 dentro do viewBox de 1438).
 */
const ARCO_CENTRO = { x: 685.7, y: 734.9 };
const ARCO_RAIO_EXTERNO = 461.7;
const ARCO_RAIO_INTERNO = 367.3;
/** Pontas cortadas na diagonal, como no desenho: o vão fica no alto, à direita (sentido horário). */
const ARCO_INICIO_FORA_GRAUS = 3.6;
const ARCO_INICIO_DENTRO_GRAUS = 8.1;
const ARCO_FIM_FORA_GRAUS = 288.7;
const ARCO_FIM_DENTRO_GRAUS = 284.1;
const LUA_CENTRO = { x: 1027.6, y: 504.6 };
const LUA_RAIO = 151.6;
const COR_DO_CORPO = "#f7f7f7";

/**
 * Cada peça viaja um tanto e com o próprio atraso — é a diferença que dá
 * profundidade: o arco vai até perto da borda azul, os olhos vão um pouco além
 * dele (olhando para o cursor, sem encostar) e a lua, lenta, parece estar atrás.
 */
const ARCO_ALCANCE_X = 80;
const ARCO_ALCANCE_Y = 66;
const LUA_ALCANCE_X = 118;
const LUA_ALCANCE_Y = 98;
const SEGUIR_OLHAR = 0.12;
const SEGUIR_ARCO = 0.07;
const SEGUIR_LUA = 0.045;
/**
 * Distância máxima entre o deslocamento dos olhos e o do arco. O canto dos
 * olhos fica a ~232 do centro do arco e a borda de dentro dele a ~367: com no
 * máximo 100 de diferença, sobram uns 43 de folga — os olhos nunca encostam.
 */
const FOLGA_OLHOS_ARCO = 100;
/** A lua orbita de leve mesmo parada, para não parecer colada. */
const LUA_ORBITA_RAIO = 9;
const LUA_ORBITA_PERIODO = 6200;

function pontoDoArco(graus: number, raio: number) {
  const radianos = (graus * Math.PI) / 180;
  return `${(ARCO_CENTRO.x + raio * Math.cos(radianos)).toFixed(1)} ${(ARCO_CENTRO.y + raio * Math.sin(radianos)).toFixed(1)}`;
}

/** Borda de fora no sentido horário, ponta, borda de dentro de volta, ponta. */
const ARCO_TRACADO = [
  `M ${pontoDoArco(ARCO_INICIO_FORA_GRAUS, ARCO_RAIO_EXTERNO)}`,
  `A ${ARCO_RAIO_EXTERNO} ${ARCO_RAIO_EXTERNO} 0 1 1 ${pontoDoArco(ARCO_FIM_FORA_GRAUS, ARCO_RAIO_EXTERNO)}`,
  `L ${pontoDoArco(ARCO_FIM_DENTRO_GRAUS, ARCO_RAIO_INTERNO)}`,
  `A ${ARCO_RAIO_INTERNO} ${ARCO_RAIO_INTERNO} 0 1 0 ${pontoDoArco(ARCO_INICIO_DENTRO_GRAUS, ARCO_RAIO_INTERNO)}`,
  "Z",
].join(" ");

/**
 * A que distância do ponteiro o olhar já está no limite, em tamanhos do próprio
 * disco. Com um número fixo de pixels (eram 520), o cursor colado no ASTRO mal
 * movia os olhos; assim, a poucos centímetros dele, ele já olha de vez.
 */
const SATURACAO_EM_DISCOS = 1.25;
const SATURACAO_MINIMA_PX = 90;

/** Quanto a piscada dura, do aberto ao aberto de novo. */
const DURACAO_DA_PISCADA = 170;

/** A pausa entre piscadas é sorteada nesta faixa — regular demais vira robô. */
const PISCADA_MIN = 2600;
const PISCADA_MAX = 6400;

/**
 * Silêncio até o Astro se dar por ignorado.
 *
 * Os mesmos seis segundos que o painel espera por uma resposta: é o mesmo
 * sentimento medido de dois jeitos — ninguém respondeu, ninguém nem mexeu.
 */
const ESPERA_ATE_ZANGAR = 6000;

/** Quanto cada olho inclina quando zangado. A base vai para dentro. */
const ANGULO_ZANGADO = 14;

/** A cor do olho parado e a cor dele zangado. */
const OLHO_NORMAL = [254, 254, 254] as const;
const OLHO_ZANGADO = [255, 77, 77] as const;

/**
 * O tremor de quem quer atenção: um solavanco curto que se repete, e não um
 * chacoalhar contínuo — parado o mouse, contínuo nunca terminaria.
 */
/** A flutuação do disco: sobe e desce de leve, sem sair do lugar. */
const PERIODO_DA_FLUTUACAO = 4500;
const ALTURA_DA_FLUTUACAO = 3;

const TREMOR_DURACAO = 460;
const TREMOR_INTERVALO = 2600;
const TREMOR_AMPLITUDE = 3.2;

/** A alegria: o olho fecha um pouco e engorda, como quem sorri com os olhos. */
const ALEGRE_ACHATA = 0.42;
const ALEGRE_ENGORDA = 0.16;

function proximaPiscada(agora: number) {
  return agora + PISCADA_MIN + Math.random() * (PISCADA_MAX - PISCADA_MIN);
}

/** Branco → vermelho conforme a zanga sobe. */
function corDoOlho(zanga: number) {
  const canal = (i: number) =>
    Math.round(OLHO_NORMAL[i] + (OLHO_ZANGADO[i] - OLHO_NORMAL[i]) * zanga);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

/**
 * Os ids de clipPath são globais no documento: com dois Astros na mesma página
 * — o orb da plataforma e o widget do trafeGO — o segundo herdaria os recortes
 * do primeiro e os olhos sumiriam. `useId` dá um sufixo por instância.
 */

/** Branco de repouso dos olhos do ASTRO (marca); o laço de animação leva ao vermelho na zanga. */
const ASTRO_EYE_REST_COLOR = "#fefefe";
export function AstroMark({
  className,
  zangado = false,
  vigiaInercia = false,
  corpo,
}: {
  className?: string;
  /**
   * A zanga vinda de fora: o painel liga quando o Astro fala e ninguém
   * responde. É a única que existe dentro da conversa.
   */
  zangado?: boolean;
  /**
   * Liga a zanga por inércia — ninguém mexeu o ponteiro há um tempo.
   *
   * Só o botão flutuante usa: é ele que fica na tela sendo ignorado. No
   * cabeçalho do painel isso não faz sentido, porque lá a conversa já começou.
   */
  vigiaInercia?: boolean;
  /**
   * O elemento que treme e recebe o degradê da zanga.
   *
   * O botão passa a si mesmo, para o DISCO inteiro reagir — e não só o
   * desenho dentro dele. Sem isso, a marca sacudia sozinha dentro de um
   * círculo parado, que é estranho de ver.
   */
  corpo?: RefObject<HTMLElement | null>;
}) {
  const casaRef = useRef<HTMLSpanElement>(null);
  const olharRef = useRef<SVGGElement>(null);
  const arcoRef = useRef<SVGGElement>(null);
  const luaRef = useRef<SVGGElement>(null);
  const piscarRef = useRef<SVGGElement>(null);
  const olhoEsqRef = useRef<SVGGElement>(null);
  const olhoDirRef = useRef<SVGGElement>(null);
  const alvoRef = useRef<SVGSVGElement>(null);
  // `useId` traz dois-pontos, que quebram o `url(#…)`; só letras e números.
  const escopo = useId().replace(/[^a-zA-Z0-9]/g, "");

  // O laço lê a zanga por referência: ele roda a 60fps e não pode depender de
  // ser remontado a cada mudança de prop.
  const zangadoRef = useRef(zangado);
  useEffect(() => {
    zangadoRef.current = zangado;
  }, [zangado]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Sem cursor não há o que seguir nem sobre o que sorrir: no toque, o Astro
    // pisca e se zanga, mas não olha nem se alegra.
    const temPonteiro = window.matchMedia("(pointer: fine)").matches;
    const casa = casaRef.current;
    // Quem treme e ganha o degradê: o disco, quando o botão se identifica.
    const pele = corpo?.current ?? casa;
    // Só o botão flutua; a marca do cabeçalho fica quieta no lugar dela.
    const flutuante = !!corpo?.current;

    let raf = 0;
    let alvoX = 0;
    let alvoY = 0;
    let olharX = 0;
    let olharY = 0;
    let arcoX = 0;
    let arcoY = 0;
    let luaX = 0;
    let luaY = 0;
    let zanga = 0;
    let alegria = 0;
    let sobOCursor = false;
    let zangadoDesde = 0;
    let ultimoMovimento = performance.now();
    let piscaEm = proximaPiscada(performance.now());
    let piscandoDesde = 0;
    let ultimaRolagem = window.scrollY;

    const aoMover = (evento: PointerEvent) => {
      const svg = alvoRef.current;
      if (!svg) return;
      const caixa = svg.getBoundingClientRect();
      const saturacao = Math.max(caixa.width * SATURACAO_EM_DISCOS, SATURACAO_MINIMA_PX);
      const limite = (valor: number) => Math.max(-1, Math.min(1, valor / saturacao));

      alvoX =
        limite(evento.clientX - (caixa.left + caixa.width / 2)) * ALCANCE_X;
      alvoY =
        limite(evento.clientY - (caixa.top + caixa.height / 2)) * ALCANCE_Y;
      ultimoMovimento = performance.now();
    };

    const aoEntrar = () => {
      sobOCursor = true;
    };
    const aoSair = () => {
      sobOCursor = false;
    };

    const laco = () => {
      raf = requestAnimationFrame(laco);
      const agora = performance.now();

      /*
        Rolar é atenção — e a posição é lida, não escutada.

        A inércia media presença só pelo ponteiro, e quem lia a página inteira
        sem encostar no mouse era tomado por ausente: ele emburrava justamente
        com quem estava prestando atenção.

        Um ouvinte de `scroll` resolveria em quase todo lugar, menos onde mais
        importa: a home é conduzida pelo Lenis, que roda a viagem no próprio
        laço e NÃO emite `scroll` na janela — medido, zero eventos numa
        rolagem de dezessete mil pixels. Comparar a posição a cada quadro não
        depende de evento nenhum e vale para as duas páginas.
      */
      if (window.scrollY !== ultimaRolagem) {
        ultimaRolagem = window.scrollY;
        ultimoMovimento = agora;
      }

      // 1. o olhar persegue o ponteiro com atraso — é o que faz parecer olhar,
      //    e não espelhar o mouse.
      olharX += (alvoX - olharX) * SEGUIR_OLHAR;
      olharY += (alvoY - olharY) * SEGUIR_OLHAR;
      olharRef.current?.setAttribute(
        "transform",
        `translate(${olharX.toFixed(1)}, ${olharY.toFixed(1)})`,
      );

      // 1b. o arco segue o mesmo alvo, mais longe e mais devagar; a trava
      //     garante a folga — se a diferença para os olhos passar do limite,
      //     o arco é puxado de volta na direção deles.
      arcoX += ((alvoX / ALCANCE_X) * ARCO_ALCANCE_X - arcoX) * SEGUIR_ARCO;
      arcoY += ((alvoY / ALCANCE_Y) * ARCO_ALCANCE_Y - arcoY) * SEGUIR_ARCO;
      const diferencaX = arcoX - olharX;
      const diferencaY = arcoY - olharY;
      const diferenca = Math.hypot(diferencaX, diferencaY);
      if (diferenca > FOLGA_OLHOS_ARCO) {
        arcoX = olharX + (diferencaX / diferenca) * FOLGA_OLHOS_ARCO;
        arcoY = olharY + (diferencaY / diferenca) * FOLGA_OLHOS_ARCO;
      }
      arcoRef.current?.setAttribute(
        "transform",
        `translate(${arcoX.toFixed(1)}, ${arcoY.toFixed(1)})`,
      );

      // 1c. a lua: a mais lenta e a que vai mais longe, com uma órbita
      //     pequena que nunca para.
      luaX += ((alvoX / ALCANCE_X) * LUA_ALCANCE_X - luaX) * SEGUIR_LUA;
      luaY += ((alvoY / ALCANCE_Y) * LUA_ALCANCE_Y - luaY) * SEGUIR_LUA;
      const faseDaOrbita = (agora / LUA_ORBITA_PERIODO) * Math.PI * 2;
      luaRef.current?.setAttribute(
        "transform",
        `translate(${(luaX + Math.cos(faseDaOrbita) * LUA_ORBITA_RAIO).toFixed(1)}, ${(luaY + Math.sin(faseDaOrbita) * LUA_ORBITA_RAIO).toFixed(1)})`,
      );

      // 2. os humores. Alegria só sob o cursor; zanga só quando o painel diz —
      //    e passar o mouse por cima desarma a zanga, porque é interação.
      const querAlegria = temPonteiro && sobOCursor;
      alegria += ((querAlegria ? 1 : 0) - alegria) * 0.18;

      // Duas origens, e elas dizem a mesma coisa por caminhos diferentes: o
      // painel avisa que ninguém respondeu; a inércia percebe que ninguém
      // está nem mexendo o mouse nem rolando a página. Passar o cursor por
      // cima desarma as duas.
      const inerte =
        vigiaInercia &&
        temPonteiro &&
        agora - ultimoMovimento > ESPERA_ATE_ZANGAR;
      const querZanga = (zangadoRef.current || inerte) && !sobOCursor;
      /*
        Sobe devagar, desce rápido — e a assimetria não é enfeite.

        Emburrar leva tempo porque é um sentimento que se acumula. Sair da
        zanga é imediato porque ela some por um motivo: alguém respondeu, ou
        ele próprio começou a falar. Com a mesma taxa dos dois lados, ele
        continuava vermelho no meio da própria resposta — que é a cara de quem
        está bravo com quem acabou de lhe dar atenção.
      */
      zanga += ((querZanga ? 1 : 0) - zanga) * (querZanga ? 0.05 : 0.3);
      if (querZanga && !zangadoDesde) zangadoDesde = agora;
      if (!querZanga) zangadoDesde = 0;

      // 3. a piscada: a altura vai a zero e volta. O cosseno dá 1 → 0 → 1 sem
      //    precisar de duas curvas.
      let piscada = 1;
      if (piscandoDesde) {
        const progresso = (agora - piscandoDesde) / DURACAO_DA_PISCADA;
        if (progresso >= 1) {
          piscandoDesde = 0;
          piscaEm = proximaPiscada(agora);
        } else {
          piscada = Math.abs(Math.cos(progresso * Math.PI));
        }
      } else if (agora >= piscaEm) {
        piscandoDesde = agora;
      }

      // A piscada e o sorriso dividem o mesmo achatamento: um multiplica o
      // outro, então piscar de olho sorrindo continua fechando por completo.
      const escalaY = piscada * (1 - ALEGRE_ACHATA * alegria);
      piscarRef.current?.setAttribute(
        "transform",
        `translate(0, ${CENTRO_ESQ.y}) scale(1, ${escalaY.toFixed(3)}) translate(0, ${-CENTRO_ESQ.y})`,
      );

      // 4. cada olho gira (zanga) e engorda (alegria) em torno do próprio
      //    centro. Sinais opostos: a base do esquerdo vai para a direita e a do
      //    direito para a esquerda, então as duas convergem.
      const angulo = ANGULO_ZANGADO * zanga;
      const escalaX = (1 + ALEGRE_ENGORDA * alegria).toFixed(3);
      const gira = (centro: { x: number; y: number }, sinal: number) =>
        `translate(${centro.x}, ${centro.y}) rotate(${(sinal * angulo).toFixed(2)}) scale(${escalaX}, 1) translate(${-centro.x}, ${-centro.y})`;
      olhoEsqRef.current?.setAttribute("transform", gira(CENTRO_ESQ, -1));
      olhoDirRef.current?.setAttribute("transform", gira(CENTRO_DIR, 1));

      // 5. a cor dos olhos.
      if (casa) casa.style.color = corDoOlho(zanga);

      // 6. o corpo: flutuação, tremor e o degradê da zanga.
      if (pele) {
        let tremor = 0;
        if (zangadoDesde && zanga > 0.5) {
          const ciclo = (agora - zangadoDesde) % TREMOR_INTERVALO;
          if (ciclo < TREMOR_DURACAO) {
            // O seno externo é o envelope (entra e sai do solavanco); o
            // interno é a vibração em si.
            const envelope = Math.sin((ciclo / TREMOR_DURACAO) * Math.PI);
            tremor =
              Math.sin(ciclo * 0.09) * TREMOR_AMPLITUDE * envelope * zanga;
          }
        }

        /*
          A flutuação saiu do CSS e veio para cá.

          Ela era uma `animation`, e animação vence estilo em linha na cascata:
          o tremor escrito por JS simplesmente não aparecia enquanto o disco
          flutuava. Com os dois na mesma escrita, eles se somam em vez de
          disputar — e é por isso que o `transform` tem um dono só.
        */
        const flutua = flutuante
          ? Math.sin((agora / PERIODO_DA_FLUTUACAO) * Math.PI * 2) *
            ALTURA_DA_FLUTUACAO
          : 0;

        pele.style.transform =
          tremor || flutua
            ? `translate(${tremor.toFixed(2)}px, ${flutua.toFixed(2)}px)`
            : "";

        /*
          Zangado, o disco esquenta por cima: vermelho no topo desmaiando para
          a cor de sempre na metade de baixo. Só o `background-image` é escrito
          — a cor de fundo continua no CSS, então não há o que restaurar
          quando a zanga passa.
        */
        pele.style.backgroundImage =
          zanga > 0.01
            ? `linear-gradient(180deg, rgba(255, 77, 77, ${zanga.toFixed(3)}) 0%, rgba(255, 77, 77, 0) 55%)`
            : "";
      }
    };

    if (temPonteiro) {
      window.addEventListener("pointermove", aoMover, { passive: true });
      casa?.addEventListener("pointerenter", aoEntrar);
      casa?.addEventListener("pointerleave", aoSair);
    }
    raf = requestAnimationFrame(laco);
    return () => {
      window.removeEventListener("pointermove", aoMover);
      casa?.removeEventListener("pointerenter", aoEntrar);
      casa?.removeEventListener("pointerleave", aoSair);
      cancelAnimationFrame(raf);
    };
    // As duas são estáveis pela vida do componente — o botão nunca vira
    // cabeçalho no meio do caminho —, então listá-las não remonta o laço.
  }, [corpo, vigiaInercia]);

  return (
    <span
      ref={casaRef}
      // `color` inline: os olhos são `currentColor` e o laço escreve aqui a
      // cada quadro para levá-los ao vermelho. Branco é o repouso — e é o que
      // vale quando o laço nem roda, sob `prefers-reduced-motion`.
      style={{ color: ASTRO_EYE_REST_COLOR }}
      className={cn("relative block size-full", className)}
    >
      <svg
        ref={alvoRef}
        viewBox="0 0 1438.5 1438.499996"
        aria-hidden
        focusable="false"
        className="absolute inset-0 size-full object-contain"
      >
        <title>Astro</title>
        <defs>
          <clipPath id={`cb015b3e72-${escopo}`}>
            <path
              d="M 486.863281 615.246094 L 615.265625 615.246094 L 615.265625 885.59375 L 486.863281 885.59375 Z M 486.863281 615.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`2ebaf01eed-${escopo}`}>
            <path
              d="M 551.066406 615.246094 C 586.523438 615.246094 615.265625 643.988281 615.265625 679.445312 L 615.265625 821.0625 C 615.265625 856.519531 586.523438 885.265625 551.066406 885.265625 C 515.609375 885.265625 486.863281 856.519531 486.863281 821.0625 L 486.863281 679.445312 C 486.863281 643.988281 515.609375 615.246094 551.066406 615.246094 Z M 551.066406 615.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`9e7ab462dd-${escopo}`}>
            <rect x="0" width="130" y="0" height="271" />
          </clipPath>
          <clipPath id={`2372ccb790-${escopo}`}>
            <path
              d="M 0.863281 0.246094 L 129.265625 0.246094 L 129.265625 270.292969 L 0.863281 270.292969 Z M 0.863281 0.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`d6f25c8e6b-${escopo}`}>
            <path
              d="M 65.066406 0.246094 C 100.523438 0.246094 129.265625 28.988281 129.265625 64.445312 L 129.265625 206.0625 C 129.265625 241.519531 100.523438 270.265625 65.066406 270.265625 C 29.609375 270.265625 0.863281 241.519531 0.863281 206.0625 L 0.863281 64.445312 C 0.863281 28.988281 29.609375 0.246094 65.066406 0.246094 Z M 65.066406 0.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`734705ac02-${escopo}`}>
            <path
              d="M 745.867188 615.246094 L 874.273438 615.246094 L 874.273438 885.59375 L 745.867188 885.59375 Z M 745.867188 615.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`7eae265ee5-${escopo}`}>
            <path
              d="M 810.070312 615.246094 C 845.527344 615.246094 874.273438 643.988281 874.273438 679.445312 L 874.273438 821.0625 C 874.273438 856.519531 845.527344 885.265625 810.070312 885.265625 C 774.613281 885.265625 745.867188 856.519531 745.867188 821.0625 L 745.867188 679.445312 C 745.867188 643.988281 774.613281 615.246094 810.070312 615.246094 Z M 810.070312 615.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`30460f0805-${escopo}`}>
            <rect x="0" width="130" y="0" height="271" />
          </clipPath>
          <clipPath id={`054f27bc04-${escopo}`}>
            <path
              d="M 0.867188 0.246094 L 129.273438 0.246094 L 129.273438 270.292969 L 0.867188 270.292969 Z M 0.867188 0.246094 "
              clipRule="nonzero"
            />
          </clipPath>
          <clipPath id={`6e5622a88b-${escopo}`}>
            <path
              d="M 65.070312 0.246094 C 100.527344 0.246094 129.273438 28.988281 129.273438 64.445312 L 129.273438 206.0625 C 129.273438 241.519531 100.527344 270.265625 65.070312 270.265625 C 29.613281 270.265625 0.867188 241.519531 0.867188 206.0625 L 0.867188 64.445312 C 0.867188 28.988281 29.613281 0.246094 65.070312 0.246094 Z M 65.070312 0.246094 "
              clipRule="nonzero"
            />
          </clipPath>
        </defs>
        {/* Arco e lua em vetor (antes um bitmap só): cada um ganha movimento próprio. */}
        <g ref={arcoRef}>
          <path d={ARCO_TRACADO} fill={COR_DO_CORPO} />
        </g>
        <g ref={luaRef}>
          <circle cx={LUA_CENTRO.x} cy={LUA_CENTRO.y} r={LUA_RAIO} fill={COR_DO_CORPO} />
        </g>
        <g ref={olharRef}>
          <g ref={piscarRef}>
            <g ref={olhoEsqRef}>
              <g clipPath={`url(#cb015b3e72-${escopo})`}>
                <g clipPath={`url(#2ebaf01eed-${escopo})`}>
                  <g transform="matrix(1, 0, 0, 1, 486, 615)">
                    <g clipPath={`url(#9e7ab462dd-${escopo})`}>
                      <g clipPath={`url(#2372ccb790-${escopo})`}>
                        <g clipPath={`url(#d6f25c8e6b-${escopo})`}>
                          <path
                            fill="currentColor"
                            d="M 0.863281 0.246094 L 129.265625 0.246094 L 129.265625 270.089844 L 0.863281 270.089844 Z M 0.863281 0.246094 "
                            fillOpacity="1"
                            fillRule="nonzero"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
            <g ref={olhoDirRef}>
              <g clipPath={`url(#734705ac02-${escopo})`}>
                <g clipPath={`url(#7eae265ee5-${escopo})`}>
                  <g transform="matrix(1, 0, 0, 1, 745, 615)">
                    <g clipPath={`url(#30460f0805-${escopo})`}>
                      <g clipPath={`url(#054f27bc04-${escopo})`}>
                        <g clipPath={`url(#6e5622a88b-${escopo})`}>
                          <path
                            fill="currentColor"
                            d="M 0.867188 0.246094 L 129.273438 0.246094 L 129.273438 270.089844 L 0.867188 270.089844 Z M 0.867188 0.246094 "
                            fillOpacity="1"
                            fillRule="nonzero"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
