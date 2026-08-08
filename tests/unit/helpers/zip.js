'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { zipDirectoryContents } = require('../../../internal/utils/artifact/artifact');

/**
 * Cria diretorio temporario com arquivos e empacota em ZIP preservando paths relativos.
 * @param {Record<string, string|Buffer>} files mapa relPath -> conteudo
 * @returns {{ dir: string, zip: string }}
 */
function zipFromFiles(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-unit-'));
  const contentRoot = path.join(dir, 'content');
  fs.mkdirSync(contentRoot, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(contentRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  const zip = path.join(dir, 'artifact.zip');
  zipDirectoryContents(contentRoot, zip);
  return { dir, zip };
}

const unitFixtures = path.join(__dirname, '..', '..', 'fixtures', 'unit');

module.exports = { zipFromFiles, unitFixtures };
