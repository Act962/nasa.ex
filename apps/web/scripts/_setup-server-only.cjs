// Carregue ANTES de qualquer script que use módulos do `src/features/**`
// que tenham `import "server-only"` no topo. Usa Module._resolveFilename
// hook pra redirecionar a resolução do "server-only" pro nosso stub vazio.
//
// USO: pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/seu-script.ts
const Module = require("node:module");
const path = require("node:path");

const stubPath = path.resolve(__dirname, "_server-only-stub.cjs");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "server-only") {
    return stubPath;
  }
  return orig.call(this, request, parent, ...rest);
};
