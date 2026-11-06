// Uso: node tools/hash-code.js MICODIGO
// Copia la huella que imprime y reemplázala en SECRET_CODES dentro de www/js/engine.js
const { hashCode } = require('../www/js/engine.js');
const code = process.argv[2];
if (!code) { console.log('Uso: node tools/hash-code.js MICODIGO'); process.exit(1); }
console.log(`Código "${code.trim().toUpperCase()}" → huella '${hashCode(code)}'`);
