/* eslint-env node, es2020 */
// Ejecuta el interprete TypeScript del repositorio, no codigo contenido en el JSON.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const raiz = path.resolve(__dirname, '..');
require.extensions['.ts'] = (modulo, archivo) => {
  const codigo = ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  modulo._compile(codigo, archivo);
};

try {
  const archivo = process.argv[2];
  if (!archivo) {
    throw new Error('Uso: npm run reanalizar:dtc -- "C:\\ruta\\informe.json"');
  }
  const informe = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  if (
    !informe ||
    informe.versionEsquema !== 1 ||
    !Array.isArray(informe.capturas)
  ) {
    throw new Error('Informe DTC no reconocido.');
  }
  const { compararDtc } = require(path.join(
    raiz,
    'src/obd/dtc/CompararDtc.ts',
  ));
  const { esComandoDtc } = require(path.join(
    raiz,
    'src/obd/dtc/InterpretarDtc.ts',
  ));
  const resultados = informe.capturas
    .filter(c => c && esComandoDtc(c.comando))
    .map(captura => {
      if (
        !captura.respuesta ||
        typeof captura.respuesta.textoAscii !== 'string' ||
        !captura.contexto
      ) {
        return {
          numero: captura.numero,
          comando: captura.comando,
          error: captura.error || 'Captura sin respuesta o contexto.',
        };
      }
      return {
        numero: captura.numero,
        comando: captura.comando,
        fase: captura.fase,
        errorTransporte: captura.error,
        resultadoGuardado:
          (captura.comparacion && captura.comparacion.corregido) || null,
        reanalisis: compararDtc(
          captura.comando,
          captura.respuesta.textoAscii,
          captura.contexto,
        ),
      };
    });
  // Solo stdout: nunca sobrescribe el informe original.
  console.log(
    JSON.stringify(
      {
        versionPruebaOriginal: informe.versionPrueba,
        reanalizadoEn: new Date().toISOString(),
        resultados,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
