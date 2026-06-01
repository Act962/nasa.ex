// Stub do "server-only" — substitui o módulo via require hook nos
// scripts standalone. O módulo real do "server-only" do Next.js
// throw() ao ser importado fora de Server Components, impedindo
// que scripts tsx usem helpers internos que têm o `import "server-only"`.
//
// Esse arquivo é vazio de propósito (só exporta {}) — o hook em
// `scripts/_setup-server-only.cjs` redireciona qualquer
// `require("server-only")` pra cá.
module.exports = {};
