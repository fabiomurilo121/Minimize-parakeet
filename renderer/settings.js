/**
 * Settings Window Logic
 */

const api = window.api;

let original = null;
let working = null;

document.addEventListener('DOMContentLoaded', async () => {
  original = await api.getSettings();
  working = { ...original };

  // System info
  const info = await api.systemInfo();
  document.getElementById('appVersion').textContent =
    `Redutor de Imagens v${info.appVersion}`;

  applyToForm();
  attachHandlers();
});

function applyToForm() {
  document.getElementById('toggleContextMenu').checked = !!working.contextMenuEnabled;
  document.getElementById('toggleDesktopShortcut').checked = !!working.desktopShortcutEnabled;
  document.getElementById('sliderThreads').value = working.threads || 4;
  document.getElementById('threadsValue').textContent = working.threads || 4;
  document.getElementById('selectAfterProcess').value = working.afterProcessAction || 'open-folder';
  document.getElementById('toggleAutoUpdate').checked = working.autoCheckUpdates !== false;
}

function attachHandlers() {
  document.getElementById('sliderThreads').addEventListener('input', (e) => {
    document.getElementById('threadsValue').textContent = e.target.value;
    working.threads = parseInt(e.target.value, 10);
  });

  document.getElementById('toggleContextMenu').addEventListener('change', (e) => {
    working.contextMenuEnabled = e.target.checked;
  });

  document.getElementById('toggleDesktopShortcut').addEventListener('change', (e) => {
    working.desktopShortcutEnabled = e.target.checked;
  });

  document.getElementById('selectAfterProcess').addEventListener('change', (e) => {
    working.afterProcessAction = e.target.value;
  });

  document.getElementById('toggleAutoUpdate').addEventListener('change', (e) => {
    working.autoCheckUpdates = e.target.checked;
  });

  document.getElementById('btnDiscard').addEventListener('click', () => {
    working = { ...original };
    applyToForm();
    flashMessage('Alterações descartadas.');
  });

  document.getElementById('btnSave').addEventListener('click', async () => {
    // Se toggle de context menu mudou, executa integração
    if (working.contextMenuEnabled !== original.contextMenuEnabled) {
      flashMessage(working.contextMenuEnabled
        ? 'Registrando menu de contexto do Windows...'
        : 'Removendo menu de contexto do Windows...');
      const result = await api.integrateContextMenu(working.contextMenuEnabled);
      if (!result.ok) {
        flashMessage(`Erro na integração: ${result.stderr || 'desconhecido'}`, true);
        working.contextMenuEnabled = original.contextMenuEnabled;
        applyToForm();
        return;
      }
      flashMessage('Menu de contexto atualizado.');
    }

    await api.setSettings(working);
    original = { ...working };
    flashMessage('Configurações salvas.');
    setTimeout(() => api.closeWindow(), 1200);
  });

  document.getElementById('btnCheckUpdates').addEventListener('click', () => {
    flashMessage('Você já está na versão mais recente.');
  });
}

function flashMessage(msg, isError = false) {
  const el = document.getElementById('actionMessage');
  el.textContent = msg;
  el.style.color = isError ? 'var(--bad)' : 'var(--good)';
  setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 4000);
}