/* Redutor de Imagens - Settings renderer */
const api = window.electronAPI || {};
const $ = (s) => document.querySelector(s);

const svg = (path, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const I = {
  activity: svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  arrowLeft: svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>', 16),
  externalLink: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  folderOpen: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', 16),
  grid: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  monitor: svg('<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
  refresh: svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
  save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', 16),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  zap: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  check: svg('<polyline points="20 6 9 17 4 12"/>', 14),
};

const iconMap = {
  brandLogo: 'activity',
  icoArrowLeft: 'arrowLeft',
  icoFolderOpen: 'folderOpen',
  icoSettings: 'settings',
  icoHelp: 'help',
  icoSettingsBig: 'settings',
  icoExternalLink: 'externalLink',
  icoGrid: 'grid',
  icoMonitor: 'monitor',
  icoShield: 'shield',
  icoZap: 'zap',
  icoRefresh: 'refresh',
  icoInfo: 'info',
  icoSave: 'save',
};

function paintIcons() {
  Object.entries(iconMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && I[key]) el.innerHTML = I[key];
  });
}

function init() {
  paintIcons();

  // Slider live update
  const slider = $('#threadsSlider');
  const out = $('#threadsValue');
  if (slider && out) {
    slider.addEventListener('input', () => { out.textContent = slider.value; });
  }

  // Save
  $('#saveBtn')?.addEventListener('click', async () => {
    const data = collect();
    if (api.saveSettings) await api.saveSettings(data);
    flashToast('Configuracoes salvas');
  });

  // Discard
  $('#discardBtn')?.addEventListener('click', () => {
    if (confirm('Descartar todas as alteracoes nao salvas?')) {
      window.location.href = 'index.html';
    }
  });

  // Confirmacoes potencialmente perigosas
  $('#adminToggle')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!confirm('Executar como Administrador pode exigir reinstalacao. Continuar?')) {
        e.target.checked = false;
      }
    }
  });
}

function collect() {
  return {
    contextMenu:       $('#ctxMenuToggle')?.checked ?? true,
    desktopShortcut:   $('#desktopShortcutToggle')?.checked ?? false,
    runAsAdmin:        $('#adminToggle')?.checked ?? false,
    threads:           parseInt($('#threadsSlider')?.value || '4', 10),
    afterAction:       $('#afterActionSelect')?.value || 'open-output',
    autoUpdate:        $('#autoUpdateToggle')?.checked ?? true,
  };
}

function flashToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '60px', right: '24px',
    background: '#10B981', color: 'white', padding: '10px 16px',
    borderRadius: '6px', fontSize: '13px', fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '999',
    opacity: '0', transition: 'opacity 200ms ease',
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 1800);
}

document.addEventListener('DOMContentLoaded', init);