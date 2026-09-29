import "./load-env";
import { loadQaOrg } from "./qa-org";

// Garante as personas da org de QA (dono e Vendedor) e mostra os ids.
loadQaOrg().then((qaOrg) => {
  console.log(JSON.stringify(qaOrg));
  process.exit(0);
});
