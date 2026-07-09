/* Parakeet Minimizer - Instalador do menu de contexto do Windows
   Adiciona verb "Reduzir com Parakeet Minimizer" para arquivos JPG/PNG/WebP.
   Executado pelo main process via child_process.execFile(process.execPath, [this]). */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const VERB_NAME  = 'ReduzirComParakeetMinimizer';
const MENU_TEXT  = 'Reduzir com Parakeet Minimizer';
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const HKCU_BASE  = 'HKCU\\Software\\Classes';

function reg(...args) {
  const { execFileSync } = require('child_process');
  return execFileSync('reg.exe', args, { encoding: 'utf-8' });
}

function exePath() {
  // Quando executado dentro do Electron, process.execPath aponta para o electron.exe
  // Em producao (instalado), aponta para o Parakeet Minimizer.exe
  return process.execPath;
}

function appPath() {
  // Diretorio onde o executavel esta
  return path.dirname(process.execPath);
}

function makeCommand(quotedPaths) {
  // "%V" = arquivo selecionado (Explorer)
  // Em producao, o .exe recebe os paths como argv e dispara a segunda instancia
  return `"${exePath()}" "${appPath()}" "%V"`;
}

function install() {
  // Cria a chave do verb em HKCU\Software\Classes\*\shell\<VERB>
  for (const ext of EXTENSIONS) {
    const extKey = `${HKCU_BASE}\\${ext}\\shell\\${VERB_NAME}`;
    reg('ADD', extKey, '/ve', '/d', MENU_TEXT, '/f');
    reg('ADD', extKey, '/v', 'Icon', '/d', `"${exePath()}",0`, '/f');
    reg('ADD', `${extKey}\\command`, '/ve', '/d', makeCommand(), '/f');
  }

  // Tambem para varios arquivos
  const multiKey = `${HKCU_BASE}\\SystemFileAssociations\\image\\shell\\${VERB_NAME}`;
  reg('ADD', multiKey, '/ve', '/d', MENU_TEXT, '/f');
  reg('ADD', multiKey, '/v', 'Icon', '/d', `"${exePath()}",0`, '/f');
  reg('ADD', `${multiKey}\\command`, '/ve', '/d', makeCommand(), '/f');

  console.log('Menu de contexto instalado com sucesso.');
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

if (require.main === module || process.argv[1]?.endsWith('install-context-menu.js')) {
  try { install(); app?.quit(); }
  catch (err) {
    console.error('Falha ao instalar menu de contexto:', err.message);
    process.exit(1);
  }
}

module.exports = { install, uninstall };