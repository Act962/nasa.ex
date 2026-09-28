"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const TERMS = {
  campaign: {
    label: "Campanha",
    description:
      "Conjunto de anúncios configurados para alcançar um objetivo, como gerar contatos, visitas ou vendas.",
  },
  paidTraffic: {
    label: "Tráfego pago",
    description:
      "Visitas e contatos obtidos por anúncios pagos em plataformas como Meta, Google ou WhatsApp.",
  },
  bm: {
    label: "BM (Business Manager)",
    description:
      "Central da Meta que reúne sua página, Instagram, conta de anúncios e permissões. A empresa continua sendo proprietária dos ativos.",
  },
  adAccount: {
    label: "Conta de anúncios",
    description:
      "Cadastro dentro da plataforma onde ficam campanhas, forma de pagamento, histórico e resultados dos anúncios.",
  },
  prospecting: {
    label: "Prospecção",
    description:
      "Campanha criada para apresentar sua empresa a pessoas novas que ainda não conhecem seu negócio.",
  },
  remarketing: {
    label: "Remarketing",
    description:
      "Anúncios para pessoas que já visitaram seu site, falaram com a empresa ou interagiram com seu conteúdo.",
  },
  lead: {
    label: "Lead",
    description:
      "Pessoa que demonstrou interesse e deixou um contato ou iniciou uma conversa com a empresa.",
  },
  creative: {
    label: "Criativo",
    description:
      "Imagem ou vídeo que o público vê no anúncio. É a parte visual da campanha.",
  },
  destinationLink: {
    label: "Link de destino",
    description:
      "Página aberta depois do clique no anúncio, como seu site, uma página de produto ou o WhatsApp.",
  },
  release: {
    label: "Release",
    description:
      "Resumo de referência sobre a empresa, produtos, público, diferenciais e tom de voz usado para preparar os anúncios.",
  },
  copy: {
    label: "Copy",
    description:
      "Texto persuasivo do anúncio: mensagem principal, título, descrição e chamada para ação.",
  },
  cta: {
    label: "CTA",
    description:
      "Chamada para ação. É o botão ou convite que orienta a pessoa, como “Saiba mais” ou “Enviar mensagem”.",
  },
  segmentation: {
    label: "Segmentação",
    description:
      "Definição de quem deve receber o anúncio com base em localização, perfil, interesses e comportamento.",
  },
  audience: {
    label: "Público",
    description:
      "Grupo de pessoas que a campanha pretende alcançar e transformar em clientes.",
  },
  optimization: {
    label: "Otimização",
    description:
      "Ajustes feitos na campanha para melhorar os resultados usando os dados coletados durante a veiculação.",
  },
  adBudget: {
    label: "Verba de tráfego",
    description:
      "Valor enviado à plataforma para distribuir os anúncios. Não inclui a taxa de serviço da agência.",
  },
  setup: {
    label: "Setup",
    description:
      "Configuração inicial necessária para deixar contas, permissões e integrações prontas para anunciar.",
  },
  impression: {
    label: "Impressões",
    description:
      "Quantidade de vezes que o anúncio apareceu. A mesma pessoa pode gerar mais de uma impressão.",
  },
  reach: {
    label: "Alcance",
    description:
      "Quantidade estimada de pessoas diferentes que viram o anúncio.",
  },
  click: {
    label: "Cliques",
    description: "Quantidade de vezes que as pessoas clicaram no anúncio.",
  },
  ctr: {
    label: "Taxa de cliques (CTR)",
    description:
      "Percentual de impressões que viraram clique. Ajuda a indicar se o anúncio desperta interesse.",
  },
  conversion: {
    label: "Conversão",
    description:
      "Ação valiosa concluída depois do anúncio, como uma compra, cadastro ou contato.",
  },
  cpc: {
    label: "Custo por clique (CPC)",
    description:
      "Valor médio da verba gasto para gerar cada clique no anúncio.",
  },
} as const;

export type TechnicalTermKey = keyof typeof TERMS;

export function TechnicalTerm({
  term,
  className,
}: {
  term: TechnicalTermKey;
  className?: string;
}) {
  const content = TERMS[term];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "ml-1 inline-flex size-4 shrink-0 translate-y-[2px] items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={`O que significa ${content.label}?`}
          onClick={(event) => event.stopPropagation()}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(20rem,calc(100vw-2rem))] p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold">{content.label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {content.description}
        </p>
      </PopoverContent>
    </Popover>
  );
}
