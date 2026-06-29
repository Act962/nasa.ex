import OpenAI from "openai";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "listWorkspaces",
      description: "Lista os workspaces disponíveis na organização.",
    },
  },
  {
    type: "function",
    function: {
      name: "listColumns",
      description: "Lista as colunas de um workspace específico.",
      parameters: {
        type: "object",
        properties: {
          workspaceId: {
            type: "string",
            description: "O ID do workspace.",
          },
        },
        required: ["workspaceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchActions",
      description:
        "Pesquisa ações (eventos) existentes por título ou descrição.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "O termo de pesquisa." },
          workspaceId: {
            type: "string",
            description: "Opcional: filtrar por workspace.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createAction",
      description: "Cria uma nova ação em um workspace e coluna específicos.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "O título da ação." },
          description: {
            type: "string",
            description: "Descrição detalhada da ação.",
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            description: "Nível de prioridade da ação.",
          },
          workspaceId: {
            type: "string",
            description: "O ID do workspace de destino.",
          },
          columnId: {
            type: "string",
            description: "O ID da coluna de destino.",
          },
          dueDate: {
            type: "string",
            description: "Data de entrega (ISO string).",
          },
        },
        required: ["title", "workspaceId", "columnId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archiveAction",
      description: "Arquiva uma ação existente.",
      parameters: {
        type: "object",
        properties: {
          actionId: {
            type: "string",
            description: "O ID da ação a ser arquivada.",
          },
        },
        required: ["actionId"],
      },
    },
  },
];
