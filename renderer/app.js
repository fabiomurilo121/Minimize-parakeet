/* =============================================================
   Redutor de Imagens — Renderer (index.html)
   Lógica: roteamento por hash + fila + presets + processamento
   ============================================================= */

const api = window.electronAPI || {};

/* =============================================================
   1) Catálogo de ícones (Lucide-like inline SVG)
   ============================================================= */

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
  externalLink: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  fileText: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  folderOpen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M5 8l4 8h12l-4-8z" fill="currentColor" opacity=".15"/></svg>',
  folderPlus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  grid: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  help: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  helpCircle: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  image: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  maximize: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  monitor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  refresh: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  rotate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  sliders: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setIcon(id, key) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = ICONS[key] || '';
}

function paintIcons() {
  const map = {
    brandLogo: 'activity',
    icoArrowLeft: 'arrowLeft',
    icoFolderOpen: 'folderOpen',
    icoSettings: 'settings',
    icoHelp: 'help',
    icoTrash: 'trash',
    icoLock: 'lock',
    icoFolder: 'folder',
    icoMaximize: 'maximize',
    icoArchive: 'archive',
    icoZap: 'zap',
    icoClock: 'clock',
    icoBarChart: 'barChart',
    icoCheck: 'check',
    icoExternal: 'external',
    icoFileText: 'fileText',
    icoHome: 'home',
    icoInfo: 'info',
    icoCrop: 'crop',
    icoX: 'x',
    icoSliders: 'sliders',
    icoCheckCircle: 'checkCircle',
    icoFolder2: 'folder',
    icoFolderPlus: 'folderPlus',
    icoPlay: 'play',
    icoPlus: 'plus',
    icoX2: 'x',
    icoX3: 'x',
    icoCheck2: 'check',
    icoRotate: 'rotate',
    icoX4: 'x',
    icoHelpCircle: 'helpCircle',
    icoSettingsBig: 'settings',
    icoGrid: 'grid',
    icoMonitor: 'monitor',
    icoShield: 'shield',
    icoExternalLink: 'externalLink',
    icoRefresh: 'refresh',
    icoSave: 'save',
  };
  for (const [id, key] of Object.entries(map)) setIcon(id, key);
}

/* =============================================================
   2) Estado (em memória — substituir por IPC depois)
   ============================================================= */

const STATE = {
  files: [],                 // { id, name, ext, width, height, size, status, thumbnail, processed?, savedBytes? }
  presetActive: null,        // id do preset selecionado
  presets: [
    { id: 'hd',       label: 'HD (1920×1080)',         mode: 'pixels', w: 1920, h: 1080, builtIn: true },
    { id: 'sd',       label: 'SD (1280×720)',          mode: 'pixels', w: 1280, h: 720,  builtIn: true },
    { id: 'tablet',   label: 'Tablet (1024×768)',      mode: 'pixels', w: 1024, h: 768,  builtIn: true },
    { id: 'web',      label: 'Web (800×600)',          mode: 'pixels', w: 800,  h: 600,  builtIn: true },
    { id: 'thumb',    label: 'Thumbnail (400×300)',    mode: 'pixels', w: 400,  h: 300,  builtIn: true },
    { id: 'half',     label: 'Reduzir 50%',            mode: 'percent', pct: 50,        builtIn: true },
    { id: 'qtr',      label: 'Reduzir 75%',            mode: 'percent', pct: 75,        builtIn: true },
  ],
  customPresets: [],         // presets adicionados pelo usuário
  format: 'jpeg',
  quality: 85,
  keepAspect: true,
  width: '',
  height: '',
  lockAspect: true,
  destination: 'same',       // 'same' | 'custom'
  customDestPath: '',
  overwriteOriginal: false,
  saveRenamed: true,
  selectedPresetForQA: 'sd',
};

/* =============================================================
   3) Demo data (substituir por arquivos reais via IPC)
   ============================================================= */

function loadDemoFiles() {
  const demo = [
    { name: 'ferias_verao_2024.jpg',         ext: 'jpg',  w: 4032, h: 3024, size: 4.2 * 1024 * 1024 },
    { name: 'projeto_final_render.png',      ext: 'png',  w: 1920, h: 1080, size: 12.5 * 1024 * 1024 },
    { name: 'documento_escaneado.jpeg',      ext: 'jpeg', w: 2480, h: 3508, size: 1.8 * 1024 * 1024 },
    { name: 'foto_perfil_v2.webp',           ext: 'webp', w: 1000, h: 1000, size: 450 * 1024 },
    { name: 'paisagem_montanha.jpg',         ext: 'jpg',  w: 6000, h: 4000, size: 18.2 * 1024 * 1024 },
    { name: 'logo_empresa_vetor.png',        ext: 'png',  w: 512,  h: 512,  size: 85 * 1024 },
    { name: 'casamento_ana_bruno.jpg',       ext: 'jpg',  w: 3000, h: 2000, size: 5.6 * 1024 * 1024 },
    { name: 'screenshot_desktop.png',        ext: 'png',  w: 1440, h: 900,  size: 1.2 * 1024 * 1024 },
  ];
  STATE.files = demo.map((f, i) => ({
    id: `f${i + 1}`,
    ...f,
    status: 'pending',
    thumbnail: `https://picsum.photos/seed/${i + 1}/96/96`,
  }));
}

/* =============================================================
   4) Helpers
   ============================================================= */

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatTime(secs) {
  secs = Math.max(0, Math.round(secs));
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function totalSelectionSize() {
  return STATE.files.reduce((acc, f) => acc + f.size, 0);
}

function updateStatusbar() {
  const count = STATE.files.length;
  const size = totalSelectionSize();
  $('#statusbarSelection').textContent =
    `${count} ${count === 1 ? 'imagem selecionada' : 'imagens selecionadas'} (${formatBytes(size)})`;
}

/* =============================================================
   5) Render: Fila
   ============================================================= */

function renderQueue() {
  const body = $('#queueBody');
  body.innerHTML = '';

  if (STATE.files.length === 0) {
    body.innerHTML = `
      <div class="empty">
        <div class="empty-icon">${ICONS.image}</div>
        <h3>Nenhuma imagem adicionada</h3>
        <p>Arraste arquivos aqui ou clique em <b>Abrir Arquivos</b>.</p>
      </div>`;
    return;
  }

  for (const f of STATE.files) {
    const row = document.createElement('div');
    row.className = 'queue-row';
    row.innerHTML = `
      <div class="queue-thumb" style="background-image: url('${f.thumbnail}')"></div>
      <div class="queue-name">
        <span class="filename">${f.name}</span>
        <span class="ext">${f.ext}</span>
      </div>
      <div class="queue-dim">
        <span>${f.w}×${f.h}</span>
        <small>Original</small>
      </div>
      <div>${formatBytes(f.size)}</div>
      <div><span class="badge badge-pending">Pendente</span></div>
    `;
    body.appendChild(row);
  }
}

/* =============================================================
   6) Render: Presets
   ============================================================= */

function renderPresets() {
  const grid = $('#presetGrid');
  grid.innerHTML = '';

  for (const p of STATE.presets) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn' + (STATE.presetActive === p.id ? ' active' : '');
    btn.textContent = p.label;
    btn.dataset.presetId = p.id;
    btn.addEventListener('click', () => selectPreset(p.id));
    grid.appendChild(btn);
  }

  // Manage button
  const manage = document.createElement('button');
  manage.className = 'preset-btn manage';
  manage.textContent = 'Gerenciar Presets...';
  manage.addEventListener('click', openPresetManager);
  grid.appendChild(manage);
}

function renderQAPresets() {
  const grid = $('#qaPresetGrid');
  grid.innerHTML = '';
  const all = [...STATE.presets, ...STATE.customPresets].slice(0, 6);
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
    list.innerHTML = `<p class="text-muted" style="text-align:center; padding: var(--sp-4);">Você ainda não criou presets customizados.</p>`;
    return;
  }

  for (const p of STATE.customPresets) {
    const item = document.createElement('div');
    item.className = 'preset-list-item';
    item.innerHTML = `
      <div>
        <div class="name">${p.label} <span class="badge badge-fixed">Fixo</span></div>
        <div class="meta">
          <span>${ICONS.maximize} ${p.mode === 'pixels' ? `${p.w} × ${p.h}` : p.pct + '%'}</span>
          <span>${ICONS.check} Manter Proporção</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn-icon" title="Editar">${ICONS.settings}</button>
        <button class="btn-icon" title="Remover">${ICONS.trash}</button>
      </div>
    `;
    list.appendChild(item);
  }
}

function selectPreset(id) {
  STATE.presetActive = id;
  const p = STATE.presets.find(x => x.id === id);
  if (p) {
    if (p.mode === 'pixels') {
      $('#widthInput').value = p.w;
      $('#heightInput').value = p.h;
    } else if (p.mode === 'percent') {
      // deixa em branco — a lógica de processamento calcula a partir do original
      $('#widthInput').value = '';
      $('#heightInput').value = '';
    }
  }
  renderPresets();
  updateProcessBtn();
}

/* =============================================================
   7) Render: Processamento (lista + métricas + logs)
   ============================================================= */

function renderProcessList() {
  const list = $('#processList');
  list.innerHTML = '';
  STATE.files.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'process-item';
    const status = f.status;
    let statusHtml = '';
    if (status === 'pending') {
      statusHtml = `
        <span class="label">Aguardando</span>
        <div class="process-item-progress"><div style="width: 0%"></div></div>`;
    } else if (status === 'processing') {
      const pct = f.progress || 0;
      statusHtml = `
        <span class="label">Processando...</span>
        <div class="process-item-progress"><div style="width: ${pct}%"></div></div>
        <span class="pct">${pct}%</span>`;
    } else if (status === 'done') {
      const pct = f.savedPct || 0;
      statusHtml = `
        <span class="label">Concluído</span>
        <div class="process-item-progress complete"><div style="width: 100%"></div></div>
        <span class="badge-percent">−${pct}%</span>`;
    } else if (status === 'error') {
      statusHtml = `<span class="label text-muted">Erro</span>`;
    }
    item.innerHTML = `
      <div class="process-item-icon">${ICONS.image}</div>
      <div class="process-item-body">
        <div class="process-item-name">${f.name}</div>
        <div class="process-item-size">${formatBytes(f.size)}</div>
      </div>
      <div class="process-item-status">${statusHtml}</div>
    `;
    list.appendChild(item);
  });
}

function pushLog(msg, isCurrent = false) {
  const stream = $('#logStream');
  const line = document.createElement('div');
  line.className = 'log-line' + (isCurrent ? ' cur' : '');
  const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  line.innerHTML = `<span class="ts">[${ts}]</span> ${msg}`;
  stream.appendChild(line);
  stream.scrollTop = stream.scrollHeight;
}

/* =============================================================
   8) Processar (simulação)
   ============================================================= */

function updateProcessBtn() {
  const n = STATE.files.length;
  const btn = $('#processBtn');
  const lbl = $('#processBtnLabel');
  btn.disabled = n === 0;
  lbl.textContent = `Processar ${n} ${n === 1 ? 'imagem' : 'imagens'}`;
}

async function startProcessing() {
  if (STATE.files.length === 0) return;
  // Switch view
  location.hash = '#/processing';

  const n = STATE.files.length;
  $('#processingSubtitle').textContent = `Processando item 1 de ${n} arquivos selecionados.`;
  $('#processingCounter').textContent = `0/${n}`;
  $('#metricSaved').textContent = '0 MB';
  $('#metricSpeed').textContent = '0 img/s';
  $('#metricEta').textContent = '00:00';
  $('#metricRate').textContent = '0%';
  $('#globalProgress').style.width = '0%';
  $('#processingPercent').textContent = '0%';
  $('#taskDone').classList.add('hidden');
  $('#logStream').innerHTML = '';

  pushLog('Iniciando motor de compressão MozJPEG...', true);

  let done = 0;
  let totalSaved = 0;
  let totalOriginal = STATE.files.reduce((acc, f) => acc + f.size, 0);
  const startTime = Date.now();

  for (let i = 0; i < n; i++) {
    const f = STATE.files[i];
    f.status = 'processing';
    f.progress = 0;
    renderProcessList();
    pushLog(`${f.name}: Otimização iniciada.`, true);

    // Simula progresso em steps
    for (let p = 0; p <= 100; p += 20) {
      f.progress = Math.min(p, 100);
      renderProcessList();
      await sleep(120);
    }

    // Simula compressão
    const saved = f.size * (0.3 + Math.random() * 0.5);
    f.status = 'done';
    f.savedPct = Math.round((saved / f.size) * 100);
    f.processedSize = f.size - saved;
    totalSaved += saved;
    done++;
    renderProcessList();
    pushLog(`${f.name}: Redimensionado com sucesso. (−${f.savedPct}%)`);
    $('#processingCounter').textContent = `${done}/${n}`;
    const pct = Math.round((done / n) * 100);
    $('#globalProgress').style.width = pct + '%';
    $('#processingPercent').textContent = pct + '%';
    $('#processingSubtitle').textContent = `Processando item ${Math.min(i + 2, n)} de ${n} arquivos selecionados.`;

    // métricas
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = (done / elapsed).toFixed(1);
    const eta = (n - done) * (elapsed / done);
    $('#metricSaved').textContent = formatBytes(totalSaved);
    $('#metricSpeed').textContent = `${speed} img/s`;
    $('#metricEta').textContent = formatTime(eta);
    $('#metricRate').textContent = `${Math.round((totalSaved / totalOriginal) * 100)}%`;
  }

  pushLog('Tarefa concluída.', true);
  $('#taskDone').classList.remove('hidden');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* =============================================================
   9) Modal helpers
   ============================================================= */

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function openPresetManager() { renderCustomPresetList(); openModal('presetManagerModal'); }
function openQuickAction()   { renderQAPresets(); openModal('quickActionModal'); }
function openHelp()          { openModal('helpModal'); }

/* =============================================================
   10) Hash routing
   ============================================================= */

function route() {
  const hash = location.hash || '#/';
  const main = $('#view-main');
  const proc = $('#view-processing');
  const back = $('#backLink');

  if (hash.startsWith('#/processing')) {
    main.classList.remove('active');
    proc.classList.add('active');
    back.classList.remove('hidden');
  } else if (hash.startsWith('#/settings')) {
    window.location.href = 'settings.html';
    return;
  } else if (hash.startsWith('#/quick-action')) {
    openQuickAction();
    // não muda a view principal
  } else {
    main.classList.add('active');
    proc.classList.remove('active');
    back.classList.add('hidden');
  }
}

/* =============================================================
   11) Listeners
   ============================================================= */

function attachListeners() {
  // Brand / back
  $('#backLink').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/';
  });

  // Topbar
  $('#openFilesBtn').addEventListener('click', () => {
    if (api.openFilesDialog) api.openFilesDialog();
    else alert('IPC openFilesDialog não conectado (demo).');
  });
  $('#settingsBtn').addEventListener('click', () => { location.href = 'settings.html'; });
  $('#helpBtn').addEventListener('click', openHelp);

  // Clear list
  $('#clearBtn').addEventListener('click', () => {
    STATE.files = [];
    renderQueue();
    updateProcessBtn();
    updateStatusbar();
  });

  // Width/height inputs
  $('#widthInput').addEventListener('input', () => {
    STATE.width = $('#widthInput').value;
    STATE.presetActive = null;
    renderPresets();
  });
  $('#heightInput').addEventListener('input', () => {
    STATE.height = $('#heightInput').value;
    STATE.presetActive = null;
    renderPresets();
  });
  $('#keepAspect').addEventListener('change', e => STATE.keepAspect = e.target.checked);
  $('#lockAspectBtn').addEventListener('click', () => {
    STATE.lockAspect = !STATE.lockAspect;
    $('#lockAspectBtn').style.color = STATE.lockAspect ? 'var(--primary)' : 'var(--text-muted)';
  });

  // Format & quality
  $('#formatSelect').addEventListener('change', e => {
    STATE.format = e.target.value;
    const rec = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', jpg: 'JPG' }[e.target.value];
    $('#formatRecommended').textContent = `Recomendado: ${rec}`;
  });
  $('#qualitySlider').addEventListener('input', e => {
    STATE.quality = +e.target.value;
    $('#qualityValue').textContent = STATE.quality + '%';
    const pct = ((STATE.quality - 10) / 90) * 100;
    e.target.style.backgroundSize = pct + '% 100%';
  });
  // init slider fill
  const initSlider = $('#qualitySlider');
  initSlider.style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';

  // Destination
  $('#changeDestBtn').addEventListener('click', () => {
    if (api.pickFolder) api.pickFolder().then(p => {
      if (p) {
        STATE.destination = 'custom';
        STATE.customDestPath = p;
        $('#destSamePath').textContent = p;
      }
    });
  });
  $('#overwriteOriginal').addEventListener('change', e => {
    STATE.overwriteOriginal = e.target.checked;
    if (e.target.checked && !confirm('Sobrescrever os originais é irreversível. Continuar?')) {
      e.target.checked = false;
      STATE.overwriteOriginal = false;
    }
  });
  $('#saveRenamed').addEventListener('change', e => STATE.saveRenamed = e.target.checked);

  // Process
  $('#processBtn').addEventListener('click', startProcessing);

  // Modals — close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  // Backdrop click closes
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.add('hidden');
    });
  });
  // ESC fecha qualquer modal aberto
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $$('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }
  });

  // Preset manager
  $('#savePresetBtn').addEventListener('click', () => {
    const name = $('#newPresetName').value.trim();
    const w = parseInt($('#newPresetW').value, 10);
    const h = parseInt($('#newPresetH').value, 10);
    const mode = $('#newPresetMode').value;
    if (!name || (!w || !h)) {
      alert('Preencha o nome e as dimensões.');
      return;
    }
    STATE.customPresets.push({
      id: 'c' + Date.now(),
      label: name,
      mode,
      w: mode === 'pixels' ? w : null,
      h: mode === 'pixels' ? h : null,
      pct: mode === 'percent' ? w : null,
      builtIn: false,
    });
    $('#newPresetName').value = '';
    $('#newPresetW').value = '';
    $('#newPresetH').value = '';
    renderCustomPresetList();
  });
  $('#restoreDefaults').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Restaurar a lista de presets padrão? Seus presets customizados serão removidos.')) {
      STATE.customPresets = [];
      renderCustomPresetList();
    }
  });

  // Quick action: format / quality
  $('#qaFormat').addEventListener('change', e => STATE.format = e.target.value);
  $('#qaQuality').addEventListener('input', e => {
    STATE.quality = +e.target.value;
    $('#qaQualityValue').textContent = STATE.quality + '%';
    const pct = ((STATE.quality - 10) / 90) * 100;
    e.target.style.backgroundSize = pct + '% 100%';
  });
  $('#qaQuality').style.backgroundSize = ((STATE.quality - 10) / 90) * 100 + '% 100%';

  // Quick action: destination cards
  $('#qaDestSame').addEventListener('click', () => {
    STATE.destination = 'same';
    $('#qaDestSame').classList.add('selected');
    $('#qaDestCustom').classList.remove('selected');
  });
  $('#qaDestCustom').addEventListener('click', () => {
    STATE.destination = 'custom';
    $('#qaDestCustom').classList.add('selected');
    $('#qaDestSame').classList.remove('selected');
  });

  $('#qaReduceBtn').addEventListener('click', () => {
    closeModal('quickActionModal');
    if (STATE.files.length === 0) {
      // Demo: se não houver arquivos na fila, simula 3
      loadDemoFiles();
      renderQueue();
      updateProcessBtn();
      updateStatusbar();
    }
    startProcessing();
  });

  // Hash routing
  window.addEventListener('hashchange', route);

  // Drag & drop no dropzone
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.add('dropzone-active');
  }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('dropzone-active');
  }));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    // se IPC estiver disponível, usar; senão, ignorar (demo)
    if (api.handleDroppedFiles) api.handleDroppedFiles(files.map(f => f.path));
    else console.log('arquivos arrastados:', files.map(f => f.name));
  });

  // Statusbar
  $('#openOutputBtn').addEventListener('click', e => {
    e.preventDefault();
    if (api.openOutputFolder) api.openOutputFolder();
  });
}

/* =============================================================
   12) Boot
   ============================================================= */

function boot() {
  paintIcons();
  loadDemoFiles();
  renderQueue();
  renderPresets();
  updateProcessBtn();
  updateStatusbar();
  attachListeners();

  // Auto-abre Quick Action se vier com hash específico
  if (location.hash === '#/quick-action') openQuickAction();
  // Detecta invocação via context menu (IPC do main process)
  if (api.onQuickAction) {
    api.onQuickAction((files) => {
      STATE.files = files.map((f, i) => ({ ...f, id: 'q' + i, status: 'pending' }));
      renderQueue();
      updateProcessBtn();
      updateStatusbar();
      openQuickAction();
    });
  }
  if (api.onFilesFromArgv) {
    api.onFilesFromArgv((files) => {
      STATE.files = files.map((f, i) => ({ ...f, id: 'a' + i, status: 'pending' }));
      renderQueue();
      updateProcessBtn();
      updateStatusbar();
    });
  }
}

document.addEventListener('DOMContentLoaded', boot);