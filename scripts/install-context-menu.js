#!/usr/bin/env node
/**
 * Install Windows Context Menu entry for Redutor de Imagens.
 *
 * Adiciona a opção "Reduzir com Redutor de Imagens" no menu de contexto
 * (botão direito) para arquivos .jpg, .jpeg, .png, .webp.
 *
 * Para rodar:
 *   - Instalado: rode como usuário comum (HKCU não precisa de admin)
 *   - Portable:  é só executar este script via npm ou node
 *
 * Registry path usado:
 *   HKCU\Software\Classes\SystemFileAssociations\<ext>\shell\ReduzirImagens
 *
 * (HKCU = HKEY_CURRENT_USER, escopo por usuário — não requer privilégio admin)
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const VERB = 'ReduzirImagens';
const MENU_TEXT = 'Reduzir com Redutor de Imagens';

function reg(command) {
  try {
    return execSync(`reg ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return err.stdout || err.message;
  }
}

function getExecutablePath() {
  // Em dev: o caminho aponta pro electron.exe + main.js
  // Em produção: aponta pro .exe empacotado
  if (process.env.REDUTOR_DEV === '1' || process.argv.includes('--dev')) {
    const electron = require('electron');
    return `"${electron}" "${path.resolve(__dirname, '..')}" "%1"`;
  }

  // Produção: o exe fica em resources/app/ dentro do pacote, ou direto
  // Quando rodando empacotado, process.execPath é o próprio exe.
  // Como nosso exe chama a si mesmo com arquivos, basta "%1" como arg.
  return `"${process.execPath}" "%1"`;
}

function run() {
  const exeCommand = getExecutablePath();
  const iconPath = process.execPath.replace(/\\/g, '\\\\');

  console.log('Instalando menu de contexto...');
  console.log(`  Comando: ${exeCommand}`);

  for (const ext of EXTENSIONS) {
    const key = `HKCU\\Software\\Classes\\SystemFileAssociations\\${ext}\\shell\\${VERB}`;
    const cmdKey = `${key}\\command`;

    // Chave do verbo (nome visível + ícone)
    reg(`ADD "${key}" /ve /d "${MENU_TEXT}" /f`);
    reg(`ADD "${key}" /v Icon /d "${iconPath}" /f`);

    // Comando a executar (passa o arquivo selecionado como %1)
    reg(`ADD "${cmdKey}" /ve /d "${exeCommand}" /f`);

    console.log(`  ✓ ${ext}`);
  }

  console.log('\n✅ Menu de contexto instalado.');
  console.log('   Agora clique com o botão direito em uma imagem JPEG/PNG/WebP no Explorer.');
}

// Auto-elevate para admin se quiser HKLM (all users). Aqui ficamos em HKCU.
if (require.main === module) {
  try {
    run();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

module.exports = { run };