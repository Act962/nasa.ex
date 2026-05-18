import { listNerpStocks } from "./list";

// Nerp expõe apenas `stocks.list`. Mutações ficam por conta dos endpoints
// específicos do nerp (`register-entry`, `register-output`, `register-purchase`)
// — quando NASA precisar, adicionar wrappers dedicados com nomes que reflitam
// a semântica de movimento (não CRUD).
export const nerpStocksRouter = {
  list: listNerpStocks,
};
