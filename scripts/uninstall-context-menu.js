#!/usr/bin/env node
/**
 * Uninstall Windows Context Menu entry for Redutor de Imagens.
 *
 * Remove as chaves de registry criadas pelo install-context-menu.js.
 */

const { execSync } = require('child_process');

const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const VERB = 'ReduzirImagens';

function reg(command) {
  try {
    return execSync(`reg ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return err.stdout || err.message;
  }
}

function run() {
  console.log('Removendo menu de contexto...');

  for (const ext of EXTENSIONS) {
    const key = `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\${VERB}`;
    reg(`DELETE "${key}" /f`);
    console.log(`  ✓ ${ext}`);
  }

  console.log('\n✅ Menu de contexto removido.');
}

if (require.main === module) {
  try {
    run();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

module.exports = { run };