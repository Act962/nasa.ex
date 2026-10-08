/** Ponte entre os nós do React Flow e o editor: o React Flow monta os nós sem repassar callbacks por props. */

export interface MindMapEditorActions {
  addChild: (nodeId: string) => void;
  addSibling: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  changeColor: (nodeId: string, color: string) => void;
  toggleCollapse: (nodeId: string) => void;
  finishEdit: (nodeId: string, label: string) => void;
  cancelEdit: (nodeId: string) => void;
  generateAI: (nodeId: string) => void;
  createPost: (nodeId: string, label: string) => void;
}

let registeredActions: MindMapEditorActions | null = null;

/** Devolve a função que desfaz o registro (para o cleanup do efeito). */
export function registerMindMapEditorActions(actions: MindMapEditorActions) {
  registeredActions = actions;
  return () => {
    if (registeredActions === actions) registeredActions = null;
  };
}

export function getMindMapEditorActions() {
  return registeredActions;
}
