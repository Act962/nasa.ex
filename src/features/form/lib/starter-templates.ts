import { v4 as uuidv4 } from "uuid";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { defaultBackgroundColor } from "@/features/form/constants";
import type { FormBlockInstance, FormBlockType } from "@/features/form/types";
import { STARTER_VEHICLE_MODELS } from "./starter-vehicle-models";

/**
 * Modelos de formulário prontos no sistema: aparecem ao criar um formulário e
 * na seção "Padrões". Cada bloco nasce do `createInstance` do próprio tipo
 * (herda os atributos padrão) e recebe o texto do modelo por cima.
 */

export interface StarterFormTemplate {
  id: string;
  name: string;
  description: string;
  /** Emoji do cartão do modelo. */
  emoji: string;
  primaryColor: string;
  backgroundColor: string;
  buildBlocks: () => FormBlockInstance[];
}

function block(blockType: FormBlockType, attributes: Record<string, unknown>): FormBlockInstance {
  const instance = FormBlocks[blockType].createInstance(uuidv4());
  return { ...instance, attributes: { ...instance.attributes, ...attributes } };
}

/** Cada pergunta no próprio grupo: é assim que o construtor e a página pública esperam. */
function group(...children: FormBlockInstance[]): FormBlockInstance {
  const layout = FormBlocks.RowLayout.createInstance(`layout-${uuidv4()}`);
  return { ...layout, childblocks: children };
}

function header(title: string, description: string): FormBlockInstance {
  const layout = group(
    block("Heading", { label: title, level: 1, fontSize: "4x-large", fontWeight: "normal" }),
    block("Paragraph", { label: "Descrição", text: description, fontSize: "small", fontWeight: "normal" }),
  );
  return { ...layout, isLocked: true };
}

const choices = (labels: string[]) => labels.map((label) => ({ id: uuidv4(), label }));
const radioChoices = (labels: string[]) => labels.map((value) => ({ value, tagId: null }));

export const STARTER_FORM_TEMPLATES: StarterFormTemplate[] = [
  {
    id: "starter-orcamento",
    name: "Orçamento",
    description: "WhatsApp, serviço, prazo e detalhes do pedido",
    emoji: "💬",
    primaryColor: "#0f766e",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Peça seu orçamento", "Conte o que você precisa e respondemos em até 24 horas."),
      group(block("TextField", { label: "Nome da empresa", required: true, placeHolder: "Ex.: Wayne Enterprises" })),
      group(block("MaskedField", { label: "WhatsApp", helperText: "Com DDD", required: true, placeHolder: "(11) 99999-9999", format: "phone-br" })),
      group(block("Dropdown", { label: "Qual serviço você procura?", placeholder: "Selecione", required: true, options: choices(["Site", "Loja virtual", "Tráfego pago", "Redes sociais", "Outro"]) })),
      group(block("RadioSelect", { label: "Para quando você precisa?", required: true, options: radioChoices(["Até 15 dias", "Até 30 dias", "Sem pressa"]) })),
      group(block("TextArea", { label: "Detalhes do pedido", placeHolder: "Objetivo, referências, orçamento previsto…", rows: 4 })),
    ],
  },
  {
    id: "starter-inscricao",
    name: "Inscrição em evento",
    description: "Contato, turno, interesses e aceite",
    emoji: "🎟️",
    primaryColor: "#7c3aed",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Inscrição", "Garanta sua vaga — as vagas são limitadas."),
      group(block("MaskedField", { label: "E-mail", required: true, placeHolder: "voce@empresa.com", format: "email" })),
      group(block("RadioSelect", { label: "Melhor turno", required: true, options: radioChoices(["Manhã", "Tarde", "Noite"]) })),
      group(block("Checkbox", { label: "O que você quer aprender?", multiple: true, options: choices(["Vendas", "Marketing", "Atendimento", "Gestão"]) })),
      group(block("Checkbox", { label: "Termos", required: true, multiple: false, options: choices(["Aceito receber os materiais do evento por e-mail"]) })),
    ],
  },
  {
    id: "starter-satisfacao",
    name: "Pesquisa de satisfação",
    description: "Estrelas, recomendação e sugestão",
    emoji: "⭐",
    primaryColor: "#1447e6",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Pesquisa de satisfação", "Leva 1 minuto e nos ajuda a melhorar."),
      group(block("StarRating", { label: "Qual sua satisfação com a gente?", required: true, maxStars: 5 })),
      group(block("RadioSelect", { label: "Você nos recomendaria?", required: true, options: radioChoices(["Com certeza", "Provavelmente sim", "Talvez", "Não"]) })),
      group(block("TextArea", { label: "O que podemos melhorar?", placeHolder: "Sua sugestão…", rows: 4 })),
    ],
  },
  {
    id: "starter-cadastro",
    name: "Cadastro de cliente",
    description: "Empresa, CEP, segmento e canais",
    emoji: "📋",
    primaryColor: "#0284c7",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Cadastro de cliente", "Precisamos de alguns dados para começar."),
      group(block("TextField", { label: "Nome fantasia", required: true, placeHolder: "Como seus clientes te conhecem" })),
      group(block("MaskedField", { label: "CPF ou CNPJ do responsável", required: true, placeHolder: "000.000.000-00", format: "cpf" })),
      group(block("MaskedField", { label: "CEP", required: true, placeHolder: "00000-000", format: "cep" })),
      group(block("Dropdown", { label: "Segmento", placeholder: "Selecione", required: true, options: choices(["Saúde", "Educação", "Varejo", "Serviços", "Indústria", "Tecnologia"]) })),
      group(block("Checkbox", { label: "Por onde seus clientes chegam?", multiple: true, options: choices(["Instagram", "WhatsApp", "Google", "Indicação", "Site"]) })),
    ],
  },
  {
    id: "starter-checklist-os",
    name: "Checklist de O.S.",
    description: "Itens verificados, fotos e assinatura",
    emoji: "🔧",
    primaryColor: "#475569",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Checklist da ordem de serviço", "Preencha no local, antes de liberar o serviço."),
      group(block("TextField", { label: "Número da O.S.", required: true, placeHolder: "#00123", useAsResponseLabel: true })),
      group(block("Checkbox", { label: "Itens verificados", required: true, multiple: true, options: choices(["Equipamento limpo", "Peças conferidas", "Teste de funcionamento", "Área organizada"]) })),
      group(block("ImageUpload", { label: "Fotos do serviço" })),
      group(block("TextArea", { label: "Observações", rows: 3 })),
      group(block("SignatureClient", { label: "Assinatura do cliente" })),
    ],
  },
  {
    id: "starter-abertura-os",
    name: "Abertura de O.S.",
    description: "Orçamento da O.S.: cliente, veículo, fotos, serviços, valores e assinaturas",
    emoji: "🚗",
    primaryColor: "#1d4ed8",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => {
      const laborValue = block("NumberMeasure", { label: "Mão de obra / serviços", unitId: "brl", placeHolder: "0,00" });
      const partsValue = block("NumberMeasure", { label: "Peças", unitId: "brl", placeHolder: "0,00" });
      const previousServicesValue = block("NumberMeasure", { label: "Serviços anteriores", unitId: "brl", placeHolder: "0,00" });
      return [
        header("Orçamento da ordem de serviço", "Preencha ao receber o veículo. Estes dados são puxados depois pela ficha de consumo."),
        group(block("AutoNumber", { label: "Nº da O.S.", digits: 5, useAsResponseLabel: true, fieldKey: "os", isSearchable: true, showInList: true })),
        group(block("TextField", { label: "Cliente", required: true, prefillFromLead: "name", fieldKey: "cliente", isSearchable: true, showInList: true })),
        group(block("MaskedField", { label: "Fones", placeHolder: "(11) 99999-9999", format: "phone-br", prefillFromLead: "phone", fieldKey: "fones" })),
        group(block("TextField", { label: "Placa", required: true, placeHolder: "ABC1D23", fieldKey: "placa", isSearchable: true, showInList: true })),
        group(block("OrbitLookup", { label: "Veículo", required: true, placeHolder: "Ex.: Fiat Argo", helperText: "Escolha na lista ou digite o modelo.", source: "INLINE", inlineOptions: STARTER_VEHICLE_MODELS, fieldKey: "modelo", isSearchable: true, showInList: true })),
        group(block("TextField", { label: "Marca", placeHolder: "Ex.: Fiat", fieldKey: "marca" })),
        group(block("TextField", { label: "Ano", placeHolder: "Ex.: 2022/2023", fieldKey: "ano" })),
        group(block("TextField", { label: "Cor", placeHolder: "Ex.: Prata Bari", fieldKey: "cor", showInList: true })),
        group(block("TextField", { label: "Nº do chassi", fieldKey: "chassi" })),
        group(block("TextField", { label: "Quilometragem", placeHolder: "Ex.: 45.300", fieldKey: "quilometragem" })),
        group(block("DatePicker", { label: "Entrada", required: true, useAsReferenceDate: true, fieldKey: "data" })),
        group(block("DatePicker", { label: "Entrega prevista", fieldKey: "entrega" })),
        group(block("ImageUpload", { label: "Fotos do veículo na entrada", multiple: true })),
        group(block("VehicleDiagram", { label: "Avarias e peças a trabalhar", helperText: "Toque na peça para marcar e escreva o ponto de observação." })),
        group(block("TextArea", { label: "Serviços a realizar", required: true, placeHolder: "Um serviço por linha", rows: 6 })),
        group(laborValue),
        group(partsValue),
        group(previousServicesValue),
        group(block("Calculation", { label: "TOTAL", operation: "SUM", sourceBlockIds: [laborValue.id, partsValue.id, previousServicesValue.id], resultUnit: "brl", fieldKey: "valor_servico", showInList: true })),
        group(block("TextArea", { label: "Condições de pagamento", rows: 2 })),
        group(
          block("QrCodeMulti", {
            helperText: "Aponte a câmera para acompanhar o serviço e ver as fichas deste cliente.",
            items: [
              { id: `qr-${uuidv4()}`, title: "Fichas deste cliente", source: "client-records-link" },
              { id: `qr-${uuidv4()}`, title: "Acompanhamento do cliente", source: "client-link" },
            ],
          }),
        ),
        group(block("SignatureClient", { label: "Assinatura do cliente" })),
        group(block("SignatureUser", { label: "Assinatura da empresa" })),
      ];
    },
  },
  {
    id: "starter-controle-consumo",
    name: "Controle de consumo de materiais",
    description: "Itens usados por atendimento, com quantidade e total",
    emoji: "🧾",
    primaryColor: "#b45309",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Controle de consumo de materiais", "Busque a O.S. para puxar os dados do veículo, ou digite à mão."),
      group(block("OrbitLookup", { label: "Buscar O.S. (número ou placa)", placeHolder: "Digite o número da O.S. ou a placa", source: "RECORDS", helperText: "Nas propriedades deste campo, escolha o formulário de abertura de O.S." })),
      group(block("TextField", { label: "Cliente", required: true, prefillFromLead: "name", fieldKey: "cliente", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Nº da O.S.", required: true, useAsResponseLabel: true, fieldKey: "os", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Placa do veículo", fieldKey: "placa", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Modelo do veículo", fieldKey: "modelo", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Cor", fieldKey: "cor" })),
      group(block("DatePicker", { label: "Data", required: true, useAsReferenceDate: true, fieldKey: "data" })),
      group(block("NumberMeasure", { label: "Valor do serviço", unitId: "brl", placeHolder: "0,00", fieldKey: "valor_servico" })),
      group(block("ItemList", { label: "Materiais utilizados", twoColumns: true, helperText: "Informe só a quantidade. Os valores aparecem depois de salvar." })),
      group(block("VehicleDiagram", { label: "Peças trabalhadas", helperText: "Toque em cada peça pintada." })),
      group(block("Checkbox", { label: "Também foram feitos", multiple: true, options: choices(["Rodas", "Frisos", "Peças em preto fosco"]) })),
      group(block("TextArea", { label: "Técnicos por etapa", placeHolder: "Desmontagem: …\nFunilaria: …\nPreparação: …\nPintura: …\nMontagem: …\nPolimento: …", rows: 6 })),
    ],
  },
  // Par genérico para prestador de serviço (spec 0081): o item do cliente é cadastrado uma vez e
  // cada atendimento puxa os dados dele e leva a próxima data. Os rótulos são trocados pelo ramo
  // (aparelho/manutenção, veículo/revisão, imóvel/aplicação).
  {
    id: "starter-item-cliente",
    name: "Item do cliente",
    description: "Aparelho, veículo ou equipamento do cliente: foto, marca, local e instalação",
    emoji: "🧰",
    primaryColor: "#0e7490",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Item do cliente", "Cadastre uma vez o aparelho, veículo ou equipamento. O atendimento puxa estes dados depois."),
      group(block("TextField", { label: "Cliente", required: true, prefillFromLead: "name", fieldKey: "cliente", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Item", required: true, placeHolder: "Ex.: Ar condicionado da sala", useAsResponseLabel: true, fieldKey: "item", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Marca", placeHolder: "Ex.: LG", fieldKey: "marca", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Modelo", placeHolder: "Ex.: Dual Inverter 12.000 BTUs", fieldKey: "modelo" })),
      group(block("TextField", { label: "Local", placeHolder: "Ex.: sala, quarto, loja 2", fieldKey: "local", showInList: true })),
      group(block("DatePicker", { label: "Data de instalação", fieldKey: "instalacao" })),
      group(block("ImageUpload", { label: "Fotos do item", multiple: true })),
      group(block("TextArea", { label: "Observações", rows: 3 })),
    ],
  },
  {
    id: "starter-atendimento",
    name: "Atendimento",
    description: "Serviço feito no item do cliente, com valor e a data do próximo retorno",
    emoji: "🛠️",
    primaryColor: "#0e7490",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Atendimento", "Busque o item para puxar os dados, ou digite à mão."),
      group(block("OrbitLookup", { label: "Buscar item (nome, marca ou cliente)", placeHolder: "Digite o item, a marca ou o cliente", source: "RECORDS", helperText: "Nas propriedades deste campo, escolha o formulário de itens do cliente." })),
      group(block("TextField", { label: "Cliente", required: true, prefillFromLead: "name", fieldKey: "cliente", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Item", required: true, useAsResponseLabel: true, fieldKey: "item", isSearchable: true, showInList: true })),
      group(block("TextField", { label: "Marca", fieldKey: "marca" })),
      group(block("TextField", { label: "Local", fieldKey: "local" })),
      group(block("DatePicker", { label: "Data do atendimento", required: true, useAsReferenceDate: true, fieldKey: "data" })),
      group(block("TextArea", { label: "Serviço realizado", required: true, placeHolder: "O que foi feito", rows: 4 })),
      group(block("ItemList", { label: "Serviços e peças", helperText: "Informe só a quantidade. Os valores aparecem depois de salvar." })),
      group(block("ImageUpload", { label: "Fotos do atendimento", multiple: true })),
      group(block("DatePicker", { label: "Próximo atendimento", helperText: "Em branco, fica para 6 meses depois deste.", useAsNextDate: true, nextDateAfterMonths: 6, fieldKey: "proximo" })),
      group(block("SignatureClient", { label: "Assinatura do cliente" })),
    ],
  },
  {
    id: "starter-agendamento",
    name: "Agendamento",
    description: "Serviço, data, horário e contato",
    emoji: "📅",
    primaryColor: "#db2777",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Agende seu horário", "Escolha o melhor dia — confirmamos pelo WhatsApp."),
      group(block("Dropdown", { label: "Serviço", placeholder: "Selecione", required: true, options: choices(["Consulta", "Avaliação", "Retorno", "Outro"]) })),
      group(block("DatePicker", { label: "Data desejada", required: true, withTime: false })),
      group(block("RadioSelect", { label: "Horário", required: true, options: radioChoices(["Manhã", "Tarde", "Noite"]) })),
      group(block("MaskedField", { label: "WhatsApp", required: true, placeHolder: "(11) 99999-9999", format: "phone-br" })),
    ],
  },
  {
    id: "starter-feedback",
    name: "Feedback do atendimento",
    description: "Nota, resolução e comentário",
    emoji: "🙌",
    primaryColor: "#ea580c",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Como foi o atendimento?", "Sua resposta vai direto para o gestor."),
      group(block("StarRating", { label: "Nota do atendimento", required: true, maxStars: 5 })),
      group(block("RadioSelect", { label: "Seu problema foi resolvido?", required: true, options: radioChoices(["Sim, totalmente", "Em parte", "Não"]) })),
      group(block("TextArea", { label: "Quer deixar um comentário?", rows: 3 })),
    ],
  },
  {
    id: "starter-contato",
    name: "Contato do site",
    description: "Assunto e mensagem — o mais simples",
    emoji: "✉️",
    primaryColor: "#111827",
    backgroundColor: defaultBackgroundColor,
    buildBlocks: () => [
      header("Fale com a gente", "Respondemos em horário comercial."),
      group(block("Dropdown", { label: "Assunto", placeholder: "Selecione", required: true, options: choices(["Dúvida", "Orçamento", "Suporte", "Parceria"]) })),
      group(block("TextArea", { label: "Mensagem", required: true, placeHolder: "Escreva aqui…", rows: 5 })),
    ],
  },
];
