/* Parakeet Minimizer - Removedor do menu de contexto do Windows */

const { app } = require('electron');

const VERB_NAME  = 'ReduzirComParakeetMinimizer';
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const HKCU_BASE  = 'HKCU\\Software\\Classes';

function reg(...args) {
  const { execFileSync } = require('child_process');
  return execFileSync('reg.exe', args, { encoding: 'utf-8' });
}

function uninstall() {
  for (const ext of EXTENSIONS) {
    const extKey = `${HKCU_BASE}\\${ext}\\shell\\${VERB_NAME}`;
    try { reg('DELETE', extKey, '/f'); } catch {}
  }
  const multiKey = `${HKCU_BASE}\\SystemFileAssociations\\image\\shell\\${VERB_NAME}`;
  try { reg('DELETE', multiKey, '/f'); } catch {}
  console.log('Menu de contexto removido.');
}

if (require.main === module || process.argv[1]?.endsWith('uninstall-context-menu.js')) {
  try { uninstall(); app?.quit(); }
  catch (err) {
    console.error('Falha ao remover menu de contexto:', err.message);
    process.exit(1);
  }
}

module.exports = { uninstall };