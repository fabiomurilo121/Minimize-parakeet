/* Parakeet Minimizer - Renderer (index.html)
   Logica completa: fila + presets + processamento real via IPC + modais. */

const api = window.electronAPI || {};
const HAS_IPC = !!api.openFilesDialog;

/* =============================================================
   1) Icones (inline SVG)
   ============================================================= */

const ICONS_THEME = {
  sun: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

function setTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  // Sincroniza o switch (checkbox)
  const input = document.getElementById('themeSwitchInput');
  if (input) input.checked = theme === 'dark';
  // Pinta os icones do switch
  const sun = document.getElementById('icoSun');
  const moon = document.getElementById('icoMoon');
  if (sun)  sun.innerHTML  = ICONS_THEME.sun;
  if (moon) moon.innerHTML = ICONS_THEME.moon;
  // Troca a logo entre clara e escura
  const logo = document.querySelector('.brand-logo-img');
  if (logo) {
    logo.src = theme === 'dark'
      ? '../assets/logos/logo-text-dark.png'
      : '../assets/logos/logo-text.png';
  }
  if (persist) {
    try { localStorage.setItem('pm-theme', theme); } catch {}
  }
}

function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  showToast('Tema ' + (next === 'dark' ? 'escuro' : 'claro') + ' ativado.', 'info');
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('pm-theme'); } catch {}
  if (!saved) {
    saved = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(saved, false);
}

// Expõe helpers de tema globalmente para outros scripts (settings.js)
window.PMTheme = { setTheme, getCurrentTheme, initTheme, toggleTheme, ICONS_THEME };

const ICONS = {
  activity: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  archive: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  barChart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  checkCircle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  crop: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>',
  external: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  fileText: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  folderOpen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  folderPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  help: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  helpCircle: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  image: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  maximize: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  refreshCw: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  rotate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  folderSm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  infoSm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  sliders: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  alertTriangle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  uploadCloud: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
function setIcon(id, key) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = ICONS[key] || '';
}

function paintIcons() {
  const map = {
    icoArrowLeft: 'arrowLeft', icoFolderOpen: 'folderOpen',
    icoSettings: 'settings', icoHelp: 'help', icoTrash: 'trash', icoLock: 'lock',
    icoFolder: 'folder', icoMaximize: 'maximize', icoArchive: 'archive',
    icoZap: 'zap', icoClock: 'clock', icoBarChart: 'barChart', icoCheck: 'check',
    icoExternal: 'external', icoFileText: 'fileText', icoHome: 'home', icoInfo: 'info',
    icoCrop: 'crop', icoX: 'x', icoSliders: 'sliders', icoCheckCircle: 'checkCircle',
    icoFolder2: 'folder', icoFolderPlus: 'folderPlus', icoPlay: 'play',
    icoPlus: 'plus', icoX2: 'x', icoX3: 'x', icoCheck2: 'check', icoRotate: 'rotate',
    icoX4: 'x', icoHelpCircle: 'helpCircle',
    icoRefreshCw: 'refreshCw', icoFolderSm: 'folderSm',
    icoUploadCloud: 'uploadCloud', icoInfoSm: 'infoSm',
  optIconWarn: 'alertTriangle', optIconCopy: 'copy',
  };
  for (const [id, key] of Object.entries(map)) setIcon(id, key);
}

/* =============================================================
   2) Estado
   ============================================================= */

const STATE = {
  files: [],
  lastOutputDir: null,
  lastResults: [],
  builtInPresets: [
    { id: 'hd',     label: 'HD (1920x1080)',      mode: 'pixels',  w: 1920, h: 1080, builtIn: true },
    { id: 'sd',     label: 'SD (1280x720)',       mode: 'pixels',  w: 1280, h: 720,  builtIn: true },
    { id: 'tablet', label: 'Tablet (1024x768)',   mode: 'pixels',  w: 1024, h: 768,  builtIn: true },
    { id: 'web',    label: 'Web (800x600)',       mode: 'pixels',  w: 800,  h: 600,  builtIn: true },
    { id: 'thumb',  label: 'Thumbnail (400x300)', mode: 'pixels',  w: 400,  h: 300,  builtIn: true },
    { id: 'half',   label: 'Reduzir 50%',         mode: 'percent', percent: 50,         builtIn: true },
    { id: 'qtr',    label: 'Reduzir 75%',         mode: 'percent', percent: 75,         builtIn: true },
  ],
  customPresets: [],
  presetActive: null,
  format: 'jpeg',
  quality: 85,
  fitMode: 'cover', // 'inside' | 'cover' | 'fill'
  allowEnlarge: false,
  width: '',
  height: '',
  destination: 'same',
  customDestPath: '',
  overwriteOriginal: false,
  saveRenamed: true,
  selectedPresetForQA: 'sd',
  currentPresetMode: 'pixels', // 'pixels' | 'percent'
  currentPresetPercent: 100,
};

/* =============================================================
   3) Helpers
   ============================================================= */

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}
function formatTime(s) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
function totalSize() { return STATE.files.reduce((a, f) => a + (f.size || 0), 0); }

function showToast(msg, kind = 'info') {
  const t = document.createElement('div');
  t.textContent = msg;
  const colors = { info: '#3B82F6', success: '#10B981', error: '#EF4444' };
  Object.assign(t.style, {
    position: 'fixed', bottom: '52px', right: '24px',
    background: colors[kind] || colors.info, color: 'white',
    padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '9999',
    opacity: '0', transition: 'opacity 200ms ease', maxWidth: '360px',
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 2400);
}

function updateStatusbar() {
  const el = $('#statusbarSelection');
  if (!el) return; // em outras views o seletor nao existe
  const n = STATE.files.length;
  const size = totalSize();
  el.textContent = `${n} ${n === 1 ? 'imagem selecionada' : 'imagens selecionadas'} (${formatBytes(size)})`;
}

function getCurrentOutputDir() {
  if (STATE.destination === 'custom' && STATE.customDestPath) {
    return STATE.customDestPath;
  }
  if (STATE.files.length > 0 && STATE.files[0].path) {
    const sep = STATE.files[0].path.includes('\\') ? '\\' : '/';
    const parts = STATE.files[0].path.split(/[\\/]/);
    parts.pop();
    return parts.join(sep);
  }
  return null;
}

function shortenPath(p, max = 50) {
  if (!p) return '';
  if (p.length <= max) return p;
  const sep = p.includes('\\') ? '\\' : '/';
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return parts[0] + sep + '...' + sep + parts.slice(-2).join(sep);
}

function updateOutputHint() {
  const el = $('#outputHintPath');
  if (!el) return;
  const dir = getCurrentOutputDir();
  if (dir) {
    el.textContent = shortenPath(dir);
    el.title = dir;
  } else {
    el.textContent = 'mesma pasta dos originais';
    el.title = '';
  }

  // Sincroniza tambem o card "Pasta Atual" no destino
  const cardEl = $('#destSamePath');
  if (cardEl) {
    if (STATE.destination === 'custom' && STATE.customDestPath) {
      cardEl.textContent = shortenPath(STATE.customDestPath, 38);
      cardEl.title = STATE.customDestPath;
      const title = cardEl.parentElement?.querySelector('.dest-card-title');
      if (title) title.textContent = 'Pasta Personalizada';
    } else if (dir) {
      cardEl.textContent = shortenPath(dir, 38);
      cardEl.title = dir;
      const title = cardEl.parentElement?.querySelector('.dest-card-title');
      if (title) title.textContent = 'Pasta Atual';
    } else {
      cardEl.textContent = 'A mesma pasta dos arquivos originais';
      cardEl.removeAttribute('title');
      const title = cardEl.parentElement?.querySelector('.dest-card-title');
      if (title) title.textContent = 'Pasta Atual';
    }
  }
}

/* =============================================================
   4) Adicionar arquivos
   ============================================================= */

function addFiles(newFiles) {
  if (!Array.isArray(newFiles) || newFiles.length === 0) return;
  for (const f of newFiles) {
    if (STATE.files.some(x => x.path && x.path === f.path)) continue; // dedupe
    STATE.files.push({
      id: f.id || ('f' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      name: f.name || 'arquivo',
      ext: f.ext || '',
      path: f.path || null,
      w: f.w || f.width || 0,
      h: f.h || f.height || 0,
      size: f.size || 0,
      status: 'pending',
    });
  }
  renderQueue();
  updateProcessBtn();
  updateStatusbar();
  updateOutputHint();
}

function clearFiles() {
  STATE.files = [];
  renderQueue();
  updateProcessBtn();
  updateStatusbar();
  updateOutputHint();
}

/* =============================================================
   5) Render da fila
   ============================================================= */

function renderQueue() {
  const body = $('#queueBody');
  const hint = $('#dropHint');
  const title = $('#dropHintTitle');
  const sub = $('#dropHintSub');
  body.innerHTML = '';
  if (STATE.files.length === 0) {
    body.innerHTML = `
      <div class="empty queue-empty-state clickable" id="emptyPickBtn" role="button" tabindex="0" title="Clique para abrir o Explorer">
        <div class="empty-icon">${ICONS.uploadCloud}</div>
        <h3>Solte suas imagens aqui</h3>
        <p>Arraste arquivos JPG, PNG ou WebP para começar<br>ou <b>clique aqui</b> para selecionar no Explorer.</p>
      </div>`;
    if (hint) hint.classList.remove('has-files');
    if (title) title.textContent = 'Arraste e solte imagens aqui';
    if (sub) sub.innerHTML = 'ou <b>clique aqui</b> para selecionar no Explorer · JPG, PNG e WebP';
    // Wire up do botao do empty state
    const ep = $('#emptyPickBtn');
    if (ep) {
      ep.addEventListener('click', openPicker);
      ep.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } });
    }
    return;
  }
  for (const f of STATE.files) {
    const row = document.createElement('div');
    row.className = 'queue-row';
    const dim = (f.w && f.h) ? `${f.w}x${f.h}` : '—';
    row.innerHTML = `
      <div class="queue-thumb"></div>
      <div class="queue-name">
        <span class="filename" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="ext">${escapeHtml(f.ext || 'IMG')}</span>
      </div>
      <div class="queue-dim">
        <span>${dim}</span>
        <small>Original</small>
      </div>
      <div>${formatBytes(f.size)}</div>
      <div><span class="badge badge-pending">Pendente</span></div>
      <div>
        <button class="btn-icon btn-remove" data-remove="${f.id}" title="Remover da fila" aria-label="Remover ${escapeHtml(f.name)}">
          ${ICONS.x}
        </button>
      </div>
    `;
    body.appendChild(row);
  }
  // Wire up dos botoes de remover
  body.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.remove;
      STATE.files = STATE.files.filter(x => x.id !== id);
      renderQueue();
      updateProcessBtn();
      updateStatusbar();
      updateOutputHint();
      showToast('Arquivo removido da fila.', 'info');
    });
  });
  if (hint) hint.classList.add('has-files');
  if (title) title.textContent = 'Arraste mais imagens para adicionar à fila';
  if (sub) sub.innerHTML = 'ou <b>clique aqui</b> para abrir o Explorer · JPG, PNG e WebP';
}

// Abre o file picker do Explorer (reutilizado por botoes e drop areas)
async function openPicker() {
  if (!HAS_IPC || !api.openFilesDialog) {
    showToast('Disponivel apenas no Electron.', 'info');
    return;
  }
  try {
    const files = await api.openFilesDialog();
    addFiles(files);
  } catch (err) {
    showToast('Erro ao abrir o Explorer: ' + err.message, 'error');
  }
}

/* =============================================================
   6) Render dos presets
   ============================================================= */

function renderPresets() {
  const grid = $('#presetGrid');
  grid.innerHTML = '';
  for (const p of STATE.builtInPresets) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn' + (STATE.presetActive === p.id ? ' active' : '');
    btn.textContent = p.label;
    btn.dataset.presetId = p.id;
    btn.addEventListener('click', () => selectPreset(p));
    grid.appendChild(btn);
  }
  const manage = document.createElement('button');
  manage.className = 'preset-btn manage';
  manage.textContent = 'Gerenciar Presets...';
  manage.addEventListener('click', openPresetManager);
  grid.appendChild(manage);
}

function renderQAPresets() {
  const grid = $('#qaPresetGrid');
  grid.innerHTML = '';
  const all = [...STATE.builtInPresets, ...STATE.customPresets].slice(0, 6);
  for (const p of all) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn' + (STATE.selectedPresetForQA === p.id ? ' active' : '');
    btn.textContent = p.label.replace(/\s*\(\d+×\d+\)/, '').replace(/\s*\d+%\s*/, '');
    btn.dataset.presetId = p.id;
    btn.addEventListener('click', () => {
      STATE.selectedPresetForQA = p.id;
      renderQAPresets();
    });
    grid.appendChild(btn);
  }
}

function renderCustomPresetList() {
  const list = $('#customPresetList');
  list.innerHTML = '';
  if (STATE.customPresets.length === 0) {
    list.innerHTML = `<p class="text-muted" style="text-align:center; padding: var(--sp-4);">Voce ainda nao criou presets customizados.</p>`;
    return;
  }
  for (const p of STATE.customPresets) {
    const item = document.createElement('div');
    item.className = 'preset-list-item';
    item.innerHTML = `
      <div>
        <div class="name">${escapeHtml(p.label)} <span class="badge badge-fixed">Fixo</span></div>
        <div class="meta">
          <span>${ICONS.maximize} ${p.mode === 'pixels' ? `${p.w} x ${p.h}` : p.percent + '%'}</span>
          <span>${ICONS.check} Manter Proporcao</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn-icon" data-edit="${p.id}" title="Editar">${ICONS.settings}</button>
        <button class="btn-icon" data-remove="${p.id}" title="Remover">${ICONS.trash}</button>
      </div>
    `;
    list.appendChild(item);
  }
  list.querySelectorAll('[data-remove]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.remove;
      STATE.customPresets = STATE.customPresets.filter(p => p.id !== id);
      persistPresets();
      renderCustomPresetList();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function selectPreset(p) {
  STATE.presetActive = p.id;
  STATE.currentPresetMode = p.mode;
  if (p.mode === 'pixels') {
    STATE.width = p.w;
    STATE.height = p.h;
    $('#widthInput').value = p.w;
    $('#heightInput').value = p.h;
  } else if (p.mode === 'percent') {
    STATE.currentPresetPercent = p.percent;
    STATE.width = '';
    STATE.height = '';
    $('#widthInput').value = '';
    $('#heightInput').value = '';
  }
  renderPresets();
}

/* =============================================================
   7) Render da view de processamento
   ============================================================= */

function renderProcessList() {
  const list = $('#processList');
  list.innerHTML = '';
  STATE.files.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'process-item';
    let statusHtml = '';
    if (f.status === 'pending') {
      statusHtml = `<span class="label">Aguardando</span>
        <div class="process-item-progress"><div style="width: 0%"></div></div>`;
    } else if (f.status === 'processing') {
      statusHtml = `<span class="label">Processando...</span>
        <div class="process-item-progress"><div style="width: 100%"></div></div>`;
    } else if (f.status === 'done') {
      const pct = f.savedPct || 0;
      statusHtml = `<span class="label">Concluido</span>
        <div class="process-item-progress complete"><div style="width: 100%"></div></div>
        <span class="badge-percent">-${pct}%</span>`;
    } else if (f.status === 'error') {
      statusHtml = `<span class="badge badge-error">Erro</span>
        <small class="text-muted" style="font-size: var(--fs-xs);">${f.error || ''}</small>`;
    }
    item.innerHTML = `
      <div class="process-item-icon">${ICONS.image}</div>
      <div class="process-item-body">
        <div class="process-item-name">${escapeHtml(f.name)}</div>
        <div class="process-item-size">${formatBytes(f.size)}</div>
      </div>
      <div class="process-item-status">${statusHtml}</div>
    `;
    list.appendChild(item);
  });
}

function pushLog(msg, isCurrent = false) {
  const stream = $('#logStream');
  if (!stream) return;
  const line = document.createElement('div');
  line.className = 'log-line' + (isCurrent ? ' cur' : '');
  const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  line.innerHTML = `<span class="ts">[${ts}]</span> ${escapeHtml(msg)}`;
  stream.appendChild(line);
  stream.scrollTop = stream.scrollHeight;
}

/* =============================================================
   8) Botao de processar
   ============================================================= */

function updateProcessBtn() {
  const n = STATE.files.length;
  const btn = $('#processBtn');
  const lbl = $('#processBtnLabel');
  btn.disabled = n === 0;
  lbl.textContent = `Processar ${n} ${n === 1 ? 'imagem' : 'imagens'}`;
}

/* =============================================================
   9) Processamento (real via IPC OU demo)
   ============================================================= */

function buildProcessOptions() {
  const opt = {
    format: STATE.format,
    quality: STATE.quality,
    fitMode: STATE.fitMode,
    allowEnlarge: STATE.allowEnlarge,
    overwriteOriginal: STATE.overwriteOriginal,
    saveRenamed: STATE.saveRenamed,
    destination: STATE.destination,
    customDestPath: STATE.customDestPath,
  };
  if (STATE.currentPresetMode === 'percent') {
    opt.mode = 'percent';
    opt.percent = STATE.currentPresetPercent;
  } else {
    opt.mode = 'pixels';
    opt.width = STATE.width || '';
    opt.height = STATE.height || '';
  }
  return opt;
}

function updateFitModeHint() {
  const el = $('#fitModeHintText');
  if (!el) return;
  const w = STATE.width || '?';
  const h = STATE.height || '?';
  const messages = {
    cover: `Recorte central preserva áreas de interesse. Saída sempre ${w}×${h}.`,
    inside: `Sem cortes — saída pode ser menor que ${w}×${h} se a proporção original for diferente.`,
    fill: `Estica para preencher exatamente ${w}×${h}. Pode distorcer.`,
  };
  el.textContent = messages[STATE.fitMode] || '';
}

async function startProcessing() {
  if (STATE.files.length === 0) {
    showToast('Adicione imagens antes de processar.', 'error');
    return;
  }
  // Reseta estados
  STATE.files.forEach(f => { f.status = 'pending'; f.error = null; f.savedPct = null; f.outputPath = null; });
  STATE.lastOutputDir = null;
  STATE.lastResults = [];
  const n = STATE.files.length;
  location.hash = '#/processing';
  if (!location.hash.endsWith('/processing')) location.hash = '#/processing';
  $('#processingTitle').textContent = 'Reduzindo suas imagens...';
  $('#processingSubtitle').textContent = `Processando 0 de ${n} arquivos selecionados.`;
  $('#processingCounter').textContent = `0/${n}`;
  $('#globalProgress').style.width = '0%';
  $('#processingPercent').textContent = '0%';
  $('#metricSaved').textContent = '0 B';
  $('#metricSpeed').textContent = '0 img/s';
  $('#metricEta').textContent = '00:00';
  $('#metricRate').textContent = '0%';
  $('#taskDone').classList.add('hidden');
  $('#convertMoreBtn').classList.add('hidden');
  $('#outputFinalPath').textContent = '';
  $('#logStream').innerHTML = '';
  renderProcessList();

  const options = buildProcessOptions();
  const startTime = Date.now();
  pushLog('Iniciando motor de compressao...', true);

  if (HAS_IPC && api.processBatch) {
    // REAL
    let totalSaved = 0;
    const totalOriginal = STATE.files.reduce((a, f) => a + (f.size || 0), 0);

    // Marca todos como processing imediatamente
    STATE.files.forEach(f => f.status = 'processing');
    renderProcessList();

    if (api.onProcessProgress) {
      api.onProcessProgress((p) => {
        const f = STATE.files.find(x => x.id === p.file.id);
        if (!f) return;
        if (p.result.status === 'done') {
          f.status = 'done';
          f.savedPct = p.result.originalSize
            ? Math.round((p.result.savedBytes / p.result.originalSize) * 100)
            : 0;
          f.outputPath = p.result.outputPath;
          f.outputDir = p.result.outputDir;
          f.outputSize = p.result.outputSize;
          if (p.result.outputDir && !STATE.lastOutputDir) {
            STATE.lastOutputDir = p.result.outputDir;
          }
          totalSaved += (p.result.savedBytes || 0);
          STATE.lastResults.push(p.result);
          pushLog(`${f.name}: concluido -> ${p.result.outputPath}`);
        } else {
          f.status = 'error';
          f.error = p.result.error;
          pushLog(`${f.name}: ERRO - ${p.result.error}`, false);
          STATE.lastResults.push(p.result);
        }
        renderProcessList();
        const pct = Math.round((p.processed / p.total) * 100);
        $('#globalProgress').style.width = pct + '%';
        $('#processingPercent').textContent = pct + '%';
        $('#processingCounter').textContent = `${p.processed}/${p.total}`;
        $('#processingSubtitle').textContent = `Processando ${p.processed} de ${p.total} arquivos.`;
        $('#metricSaved').textContent = formatBytes(totalSaved);
        $('#metricSpeed').textContent = `${p.speed.toFixed(1)} img/s`;
        $('#metricEta').textContent = formatTime(p.eta);
        $('#metricRate').textContent = totalOriginal
          ? `${Math.round((totalSaved / totalOriginal) * 100)}%`
          : '0%';
      });
    }

    try {
      const r = await api.processBatch({ files: STATE.files, options });
      if (!r || !r.ok) {
        pushLog('Falha no processamento: ' + (r?.error || 'desconhecida'));
        showToast('Erro ao processar: ' + (r?.error || 'desconhecido'), 'error');
      } else {
        pushLog('Tarefa concluida.', true);
      }
    } catch (err) {
      pushLog('Erro: ' + err.message);
      showToast('Erro: ' + err.message, 'error');
    }
  } else {
    // DEMO (sem Electron)
    let totalSaved = 0;
    const totalOriginal = STATE.files.reduce((a, f) => a + f.size, 0);
    for (let i = 0; i < n; i++) {
      const f = STATE.files[i];
      f.status = 'processing';
      renderProcessList();
      pushLog(`${f.name}: otimizando...`, true);
      await sleep(400);
      const saved = f.size * (0.3 + Math.random() * 0.5);
      f.status = 'done';
      f.savedPct = Math.round((saved / f.size) * 100);
      f.outputSize = f.size - saved;
      totalSaved += saved;
      STATE.lastResults.push({ status: 'done', originalSize: f.size, savedBytes: saved });
      renderProcessList();
      pushLog(`${f.name}: concluido (-${f.savedPct}%)`);
      const processed = i + 1;
      const pct = Math.round((processed / n) * 100);
      $('#globalProgress').style.width = pct + '%';
      $('#processingPercent').textContent = pct + '%';
      $('#processingCounter').textContent = `${processed}/${n}`;
      $('#processingSubtitle').textContent = `Processando ${Math.min(i + 2, n)} de ${n} arquivos.`;
      const elapsed = (Date.now() - startTime) / 1000;
      $('#metricSaved').textContent = formatBytes(totalSaved);
      $('#metricSpeed').textContent = `${(processed / elapsed).toFixed(1)} img/s`;
      $('#metricEta').textContent = formatTime((n - processed) * (elapsed / processed));
      $('#metricRate').textContent = `${Math.round((totalSaved / totalOriginal) * 100)}%`;
    }
    pushLog('Tarefa concluida (demo).', true);
  }

  // UI pos-conclusao
  $('#taskDone').classList.remove('hidden');
  $('#convertMoreBtn').classList.remove('hidden');
  $('#processingTitle').textContent = 'Conversao concluida!';

  const okCount = STATE.files.filter(f => f.status === 'done').length;
  const errCount = STATE.files.filter(f => f.status === 'error').length;
  const totalBytes = STATE.lastResults
    .filter(r => r.status === 'done')
    .reduce((acc, r) => acc + (r.savedBytes || 0), 0);

  showToast(`Concluido: ${okCount} processados, ${errCount} erros, ${formatBytes(totalBytes)} economizados.`,
    errCount > 0 ? 'info' : 'success');

  if (STATE.lastOutputDir) {
    $('#outputFinalPath').textContent = `Pasta de saida: ${STATE.lastOutputDir}`;
  } else if (STATE.destination === 'custom' && STATE.customDestPath) {
    $('#outputFinalPath').textContent = `Pasta de saida: ${STATE.customDestPath}`;
  } else {
    $('#outputFinalPath').textContent = 'Pasta de saida: mesma pasta dos originais';
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* =============================================================
   10) Modais
   ============================================================= */

function openModal(id) {
  const m = document.getElementById(id)
          || document.getElementById(id + 'Modal')
          || document.querySelector(`[data-modal="${id}"]`);
  m?.classList.remove('hidden');
}
function closeModal(id) {
  const m = document.getElementById(id)
          || document.getElementById(id + 'Modal')
          || document.querySelector(`[data-modal="${id}"]`);
  m?.classList.add('hidden');
}
function openPresetManager() { renderCustomPresetList(); openModal('presetManagerModal'); }
function openQuickAction() { renderQAPresets(); openModal('quickActionModal'); }
function openHelp() { openModal('helpModal'); }

/* =============================================================
   11) Persistencia de presets
   ============================================================= */

async function persistPresets() {
  if (HAS_IPC && api.savePresets) {
    await api.savePresets({ builtIn: STATE.builtInPresets, custom: STATE.customPresets });
  }
}

async function loadPresets() {
  if (HAS_IPC && api.getPresets) {
    const data = await api.getPresets();
    if (data?.custom?.length) STATE.customPresets = data.custom;
    if (data?.builtIn?.length) STATE.builtInPresets = data.builtIn;
  }
}

/* =============================================================
   12) Hash routing
   ============================================================= */

function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const v = $('#view-' + name);
  if (v) v.classList.add('active');
  const back = $('#backLink');
  if (back) back.classList.toggle('hidden', name === 'main');

  // Marca ativo no topbar (settings)
  const settingsBtn = $('#settingsBtn');
  if (settingsBtn) settingsBtn.classList.toggle('active', name === 'settings');

  // Statusbar com contexto dinamico
  updateStatusbarContext(name);
}

function updateStatusbarContext(view) {
  const left = $('#statusbarContext');
  const versionEl = $('#statusbarVersion');
  if (!left) return;
  if (view === 'settings') {
    const cores = navigator.hardwareConcurrency || 4;
    left.innerHTML = `<span>THREADS DE PROCESSAMENTO: <strong>${cores}</strong></span>`;
    if (versionEl) versionEl.textContent = 'v1.0.1';
  } else {
    left.innerHTML = `
      <span id="statusbarSelection">${STATE.files.length} ${STATE.files.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'} (${formatBytes(totalSize())})</span>
      <span class="status-dot" id="statusbarReady">
        <span class="status-dot-mark" style="width:8px;height:8px;border-radius:50%;background: var(--success);"></span>
        Pronto para processar
      </span>`;
  }
}

function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/processing')) showView('processing');
  else if (hash.startsWith('#/quick-action')) { showView('main'); openQuickAction(); }
  else if (hash.startsWith('#/settings')) showView('settings');
  else showView('main');
}

/* =============================================================
   13) Listeners
   ============================================================= */

function attachListeners() {
  // Brand / back link
  $('#backLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/';
  });

  // Open files
  $('#openFilesBtn').addEventListener('click', async () => {
    if (HAS_IPC) {
      try {
        const files = await api.openFilesDialog();
        addFiles(files);
      } catch (err) {
        showToast('Erro ao abrir dialogo: ' + err.message, 'error');
      }
    } else {
      showToast('Modo demo: use o console ou o botao Limpar Lista.', 'info');
    }
  });

  // Settings / Help
  $('#settingsBtn').addEventListener('click', () => { location.hash = '#/settings'; });
  $('#helpBtn').addEventListener('click', openHelp);
  $('#themeSwitchInput').addEventListener('change', () => {
    const next = $('#themeSwitchInput').checked ? 'dark' : 'light';
    setTheme(next);
    showToast('Tema ' + (next === 'dark' ? 'escuro' : 'claro') + ' ativado.', 'info');
  });

  // Clear list
  $('#clearBtn').addEventListener('click', () => {
    if (STATE.files.length === 0) return;
    if (confirm('Limpar todas as imagens da fila?')) clearFiles();
  });

  // Width / Height / Lock
  $('#widthInput').addEventListener('input', (e) => {
    STATE.width = e.target.value;
    STATE.presetActive = null;
    STATE.currentPresetMode = 'pixels';
    renderPresets();
  });
  $('#heightInput').addEventListener('input', (e) => {
    STATE.height = e.target.value;
    STATE.presetActive = null;
    STATE.currentPresetMode = 'pixels';
    renderPresets();
  });
  $('#fitModeSelect').addEventListener('change', (e) => {
    STATE.fitMode = e.target.value;
    updateFitModeHint();
  });
  updateFitModeHint();

  // Mantem o botao de "cadeado" por compatibilidade: alterna entre cover <-> inside
  $('#lockAspectBtn').addEventListener('click', () => {
    STATE.fitMode = STATE.fitMode === 'cover' ? 'inside' : 'cover';
    const sel = $('#fitModeSelect');
    if (sel) sel.value = STATE.fitMode;
    updateFitModeHint();
    $('#lockAspectBtn').style.color = STATE.fitMode === 'cover' ? 'var(--primary)' : 'var(--text-muted)';
  });

  // Format & quality
  $('#formatSelect').addEventListener('change', (e) => {
    STATE.format = e.target.value;
    const rec = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', jpg: 'JPG' }[e.target.value];
    $('#formatRecommended').textContent = `Recomendado: ${rec}`;
  });
  const qSlider = $('#qualitySlider');
  const syncQuality = () => {
    STATE.quality = +qSlider.value;
    $('#qualityValue').textContent = STATE.quality + '%';
    qSlider.style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';
  };
  qSlider.addEventListener('input', syncQuality);
  qSlider.style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';

  // Destination - clicar no card "Pasta Atual" reverte para "mesma pasta dos originais"
  $('#destSameFolder').addEventListener('click', (e) => {
    // Ignora se o clique foi no botao "Alterar"
    if (e.target.closest('#changeDestBtn')) return;
    STATE.destination = 'same';
    STATE.customDestPath = '';
    updateOutputHint();
  });

  // Destination
  $('#changeDestBtn').addEventListener('click', async () => {
    if (HAS_IPC && api.pickFolder) {
      const startDir = getCurrentOutputDir();
      const p = await api.pickFolder(startDir);
      if (p) {
        STATE.destination = 'custom';
        STATE.customDestPath = p;
        updateOutputHint();
      }
    } else {
      showToast('Selecao de pasta disponivel apenas no Electron.', 'info');
    }
  });
  $('#overwriteOriginal').addEventListener('change', (e) => {
    if (e.target.checked && !confirm('Sobrescrever os originais e IRREVERSIVEL. Continuar?')) {
      e.target.checked = false;
      return;
    }
    STATE.overwriteOriginal = e.target.checked;
  });
  $('#saveRenamed').addEventListener('change', (e) => { STATE.saveRenamed = e.target.checked; });

  // Process
  $('#processBtn').addEventListener('click', startProcessing);

  // Converter novos arquivos (apos conclusao)
  $('#convertMoreBtn').addEventListener('click', async () => {
    clearFiles();
    location.hash = '#/';
    if (HAS_IPC && api.openFilesDialog) {
      const files = await api.openFilesDialog();
      addFiles(files);
    }
  });

  // Abrir pasta de saida (apos conclusao)
  $('#openOutputFolderBtn').addEventListener('click', async () => {
    const target = STATE.lastOutputDir
      || STATE.customDestPath
      || (STATE.files[0]?.path ? STATE.files[0].path.replace(/[\\/][^\\/]+$/, '') : null);
    if (!target) {
      showToast('Caminho de saida nao disponivel.', 'error');
      return;
    }
    if (HAS_IPC && api.openFolder) {
      await api.openFolder(target);
    } else {
      showToast('Disponivel apenas no Electron.', 'info');
    }
  });

  // Ver relatorio (mostra caminho dos arquivos gerados)
  $('#openOutputFileBtn').addEventListener('click', () => {
    if (STATE.lastResults.length === 0) {
      showToast('Nenhum resultado para mostrar.', 'info');
      return;
    }
    const lines = STATE.lastResults.map(r => {
      if (r.status === 'done') {
        const pct = r.originalSize ? Math.round((r.savedBytes / r.originalSize) * 100) : 0;
        return `[OK] ${r.outputPath}  (${formatBytes(r.originalSize)} -> ${formatBytes(r.outputSize)}, -${pct}%)`;
      }
      return `[ERRO] ${r.error || 'desconhecido'}`;
    });
    pushLog('--- Relatorio ---');
    lines.forEach(l => pushLog(l));
    showToast('Relatorio exibido nos logs.', 'info');
  });

  // Modal close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  });

  // Preset manager
  $('#savePresetBtn').addEventListener('click', async () => {
    const name = $('#newPresetName').value.trim();
    const w = parseInt($('#newPresetW').value, 10);
    const h = parseInt($('#newPresetH').value, 10);
    const mode = $('#newPresetMode').value;
    if (!name || (!w && mode === 'pixels')) {
      showToast('Preencha o nome e as dimensoes.', 'error');
      return;
    }
    STATE.customPresets.push({
      id: 'c' + Date.now(),
      label: name,
      mode,
      w: mode === 'pixels' ? w : null,
      h: mode === 'pixels' ? h : null,
      percent: mode === 'percent' ? w : null,
      builtIn: false,
    });
    $('#newPresetName').value = '';
    $('#newPresetW').value = '';
    $('#newPresetH').value = '';
    renderCustomPresetList();
    await persistPresets();
    showToast('Preset salvo!', 'success');
  });
  $('#restoreDefaults').addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Restaurar a lista de presets? Seus customizados serao removidos.')) {
      STATE.customPresets = [];
      renderCustomPresetList();
      await persistPresets();
    }
  });

  // Quick action
  $('#qaFormat').addEventListener('change', (e) => { STATE.format = e.target.value; });
  const qaQ = $('#qaQuality');
  const syncQaQuality = () => {
    STATE.quality = +qaQ.value;
    $('#qaQualityValue').textContent = STATE.quality + '%';
    qaQ.style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';
  };
  qaQ.addEventListener('input', syncQaQuality);
  qaQ.style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';
  $('#qaFitModeSelect').addEventListener('change', (e) => { STATE.fitMode = e.target.value; });

  $('#qaDestSame').addEventListener('click', () => {
    STATE.destination = 'same';
    $('#qaDestSame').classList.add('selected');
    $('#qaDestCustom').classList.remove('selected');
  });
  $('#qaDestCustom').addEventListener('click', async () => {
    if (HAS_IPC && api.pickFolder) {
      const startDir = getCurrentOutputDir();
      const p = await api.pickFolder(startDir);
      if (p) {
        STATE.destination = 'custom';
        STATE.customDestPath = p;
        $('#qaDestSame').classList.remove('selected');
        $('#qaDestCustom').classList.add('selected');
        updateOutputHint();
      }
    } else {
      showToast('Selecao disponivel apenas no Electron.', 'info');
    }
  });

  $('#qaReduceBtn').addEventListener('click', async () => {
    closeModal('quickActionModal');
    if (STATE.files.length === 0 && HAS_IPC) {
      // Tenta abrir dialogo se nao tem arquivos
      try {
        const files = await api.openFilesDialog();
        addFiles(files);
      } catch {}
    }
    if (STATE.files.length === 0) {
      showToast('Adicione imagens antes de reduzir.', 'error');
      return;
    }
    startProcessing();
  });

  // Drop-hint clicavel: abre o file picker
  $('#dropHint').addEventListener('click', openPicker);
  $('#dropHint').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  });

  // Hash routing
  window.addEventListener('hashchange', route);

  // Drag & drop
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.add('dropzone-active');
  }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('dropzone-active');
  }));
  dz.addEventListener('drop', async (e) => {
    e.preventDefault();
    const fileList = Array.from(e.dataTransfer?.files || []);
    if (fileList.length === 0) return;
    if (HAS_IPC) {
      // Obtem paths reais via webUtils
      const paths = fileList.map(f => api.getDroppedPath ? api.getDroppedPath(f) : f.path).filter(Boolean);
      if (paths.length === 0) {
        showToast('Nao foi possivel obter o caminho dos arquivos.', 'error');
        return;
      }
      try {
        const files = await api.filesFromPaths(paths);
        addFiles(files);
        showToast(`${files.length} arquivo(s) adicionado(s).`, 'success');
      } catch (err) {
        showToast('Erro: ' + err.message, 'error');
      }
    } else {
      showToast('Drag & drop requer Electron. Use o botao Abrir Arquivos.', 'info');
    }
  });

  // Statusbar
  $('#openOutputBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (HAS_IPC && api.openFolder) {
      const target = getCurrentOutputDir();
      if (!target) {
        showToast('Adicione imagens antes de abrir a pasta de saida.', 'info');
        return;
      }
      await api.openFolder(target);
    } else {
      showToast('Disponivel apenas no Electron.', 'info');
    }
  });
}

/* =============================================================
   14) Boot
   ============================================================= */

async function boot() {
  try { initTheme(); }
  catch (err) { console.error('[initTheme]', err); }

  try { paintIcons(); }
  catch (err) { console.error('[paintIcons]', err); }

  try { await loadPresets(); }
  catch (err) { console.error('[loadPresets]', err); }

  try {
    renderQueue();
    renderPresets();
    updateProcessBtn();
    updateStatusbar();
    updateOutputHint();
  } catch (err) {
    console.error('[initial render]', err);
  }

  try { attachListeners(); }
  catch (err) { console.error('[attachListeners]', err); }

  // Auto abre Quick Action se veio via hash
  if (location.hash === '#/quick-action') openQuickAction();

  // Arquivos vindos do argv (segunda instancia)
  if (HAS_IPC && api.onFilesFromArgv) {
    api.onFilesFromArgv((files) => {
      addFiles(files);
      showToast(`${files.length} arquivo(s) recebido(s) do Explorer.`, 'success');
    });
  }

  // Navegacao para settings via IPC (ex: menu nativo)
  if (HAS_IPC && api.onNavigateSettings) {
    api.onNavigateSettings(() => { location.hash = '#/settings'; });
  }

  // Aplica visual inicial do botao processar
  updateProcessBtn();

  // Roteia para a view correta caso a pagina carregue com um hash
  route();

  console.log('[Parakeet Minimizer] Boot OK. HAS_IPC =', HAS_IPC);
}

document.addEventListener('DOMContentLoaded', boot);