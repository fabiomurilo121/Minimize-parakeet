/**
 * Redutor de Imagens — Renderer Logic
 *
 * Gerencia dois modos:
 *  - Modo Main Window (URL hash padrão): fila + opções + processamento
 *  - Modo Quick Action (hash === '#quick-action'): modal compacto
 */

const api = window.api;
const isQuickMode = api.isQuickActionMode();

// ════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════
const state = {
  files: [],                  // [{ path, name, size, width, height, format, status, thumb }]
  presets: [],
  settings: null,
  selectedPresetId: null,
  outputFolder: '',           // '' = same as input
  currentJob: null,           // { jobId, startedAt, ... }
  jobStartTime: 0,
  jobBytesSaved: 0,
  jobItemsDone: 0,
};

// ════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════
async function boot() {
  state.presets = await api.getPresets();
  state.settings = await api.getSettings();

  if (isQuickMode) {
    initQuickAction();
  } else {
    initMain();
  }
}

document.addEventListener('DOMContentLoaded', boot);

// ════════════════════════════════════════════════════════════════════
// MAIN WINDOW
// ════════════════════════════════════════════════════════════════════
async function initMain() {
  setupTopbar();
  setupQueueHandlers();
  setupOptionsHandlers();
  setupProcessingOverlay();
  setupPresetModal();
  setupProgressListener();
  setupIncomingFilesListener();

  renderPresetGrid();
  updateFooter();
  setStatus('idle', 'Aguardando');
}

function setupTopbar() {
  document.getElementById('btnOpenFiles').addEventListener('click', openFiles);
  document.getElementById('btnSettings').addEventListener('click', () => api.openSettings());
  document.getElementById('btnHelp').addEventListener('click', () => {
    showToast('info', 'Redutor de Imagens v1.0 — arraste imagens, escolha um preset e clique em Processar.');
  });
  document.getElementById('btnClearList').addEventListener('click', () => {
    if (state.files.length === 0) return;
    if (confirm('Limpar toda a fila de imagens?')) {
      state.files = [];
      renderQueue();
      updateFooter();
    }
  });
  document.getElementById('btnChangeFolder').addEventListener('click', chooseOutputFolder);
  document.getElementById('btnAdvanced').addEventListener('click', () => api.openSettings());
  document.getElementById('btnManagePresets').addEventListener('click', openPresetModal);
  document.getElementById('btnProcess').addEventListener('click', startProcessing);
  document.getElementById('btnOpenOutput').addEventListener('click', openOutputFolder);
}

function setupQueueHandlers() {
  const wrap = document.querySelector('.queue-pane');

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => {
    wrap.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    wrap.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.remove('dragging');
    });
  });
  wrap.addEventListener('drop', async (e) => {
    const paths = [];
    for (const f of e.dataTransfer.files) {
      if (f.path) paths.push(f.path);
    }
    if (paths.length) await addFiles(paths);
  });

  // Drop anywhere on window
  document.body.addEventListener('dragover', (e) => e.preventDefault());
  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    const paths = [];
    for (const f of e.dataTransfer.files) {
      if (f.path) paths.push(f.path);
    }
    if (paths.length) await addFiles(paths);
  });
}

function setupOptionsHandlers() {
  document.getElementById('inputWidth').addEventListener('input', onDimsChange);
  document.getElementById('inputHeight').addEventListener('input', onDimsChange);
  document.getElementById('checkKeepRatio').addEventListener('change', () => {
    // atualiza ícone do lock visualmente (sem mexer em comportamento aqui;
    // a lógica de razão fica no main)
  });
  document.getElementById('checkUpscale').addEventListener('change', () => {});

  document.getElementById('selectFormat').addEventListener('change', (e) => {
    document.getElementById('formatHint').textContent =
      e.target.value === 'webp' ? 'Recomendado: WebP' :
      e.target.value === 'png'  ? 'Sem perda de qualidade' :
      'Boa compatibilidade';
  });

  const slider = document.getElementById('sliderQuality');
  slider.addEventListener('input', () => {
    document.getElementById('qualityValue').textContent = `${slider.value}%`;
  });

  document.getElementById('checkOverwrite').addEventListener('change', updateRenameHint);
  document.getElementById('selectNaming').addEventListener('change', updateRenameHint);
  updateRenameHint();
}

function setupIncomingFilesListener() {
  api.onIncomingFiles(async (files) => {
    if (!files || files.length === 0) return;
    await addFiles(files);
  });

  // Quick action fechou e disparou processamento — sincronizar fila + iniciar
  api.onSyncQueueAndStart(async (payload) => {
    if (!payload?.files?.length) return;

    // Substitui a fila atual com os arquivos do quick action
    state.files = [];
    await addFiles(payload.files.map(f => f.path || f));

    // Aplica opções do quick action
    if (payload.options) {
      if (payload.options.format) {
        document.getElementById('selectFormat').value = payload.options.format;
      }
      if (payload.options.quality) {
        const s = document.getElementById('sliderQuality');
        s.value = payload.options.quality;
        document.getElementById('qualityValue').textContent = `${payload.options.quality}%`;
      }
      if (payload.options.keepRatio !== undefined) {
        document.getElementById('checkKeepRatio').checked = payload.options.keepRatio;
      }
      if (payload.options.width && payload.options.height) {
        document.getElementById('inputWidth').value = payload.options.width;
        document.getElementById('inputHeight').value = payload.options.height;
      }
      if (payload.options.outputDir) {
        state.outputFolder = payload.options.outputDir;
        updateOutputFolderDisplay();
      }
    }

    // Auto-inicia o processamento
    setTimeout(() => startProcessing(), 200);
  });
}

// ── File loading ─────────────────────────────────────────────────────
async function openFiles() {
  const selected = await api.openFileDialog();
  if (selected.length === 0) return;
  await addFiles(selected.map(f => f.path));
}

async function addFiles(paths) {
  const newItems = [];
  for (const p of paths) {
    if (state.files.some(f => f.path === p)) continue; // dedup
    newItems.push({ path: p, name: basename(p), status: 'loading' });
  }
  state.files.push(...newItems);
  renderQueue();
  updateFooter();

  // Carrega metadados em paralelo
  await Promise.all(newItems.map(async (item) => {
    const info = await api.readImageInfo(item.path);
    if (info.ok) {
      Object.assign(item, {
        size: info.size,
        width: info.width,
        height: info.height,
        format: info.format,
        status: 'pending',
      });
    } else {
      item.status = 'error';
      item.error = info.error;
    }
    // Thumbnail
    const thumb = await api.readThumbnail(item.path, 96);
    if (thumb.ok) item.thumb = thumb.dataUrl;
    renderQueue();
    updateFooter();
  }));
}

function basename(p) {
  return p.split(/[\\/]/).pop();
}

// ── Queue rendering ──────────────────────────────────────────────────
function renderQueue() {
  const empty = document.getElementById('emptyState');
  const wrap = document.getElementById('queueTableWrap');
  const list = document.getElementById('queueList');

  if (state.files.length === 0) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  list.innerHTML = '';
  for (let i = 0; i < state.files.length; i++) {
    const f = state.files[i];
    const row = document.createElement('div');
    row.className = 'queue-row';

    const thumbHtml = f.thumb
      ? `<img src="${f.thumb}" alt="">`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

    const dims = f.width ? `${f.width}×${f.height}` : '—';
    const statusLabel = {
      loading: 'Carregando...',
      pending: 'Pendente',
      processing: 'Processando',
      done: 'Concluído',
      error: 'Erro',
    }[f.status] || f.status;

    row.innerHTML = `
      <div class="queue-thumb">${thumbHtml}</div>
      <div class="queue-name">${escapeHtml(f.name)}<small>${(f.format || '').toUpperCase()}</small></div>
      <div class="queue-dims">${dims}<small>Original</small></div>
      <div class="queue-size">${f.size ? fmtBytes(f.size) : '—'}</div>
      <div><span class="status-badge ${f.status}">${statusLabel}</span></div>
      <div class="queue-actions">
        <button title="Visualizar" data-action="preview" data-i="${i}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="remove-btn" title="Remover" data-action="remove" data-i="${i}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.i, 10);
      state.files.splice(i, 1);
      renderQueue();
      updateFooter();
    });
  });
  list.querySelectorAll('[data-action="preview"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.currentTarget.dataset.i, 10);
      api.openInExplorer(state.files[i].path);
    });
  });
}

// ── Presets ──────────────────────────────────────────────────────────
function renderPresetGrid() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';
  for (const p of state.presets) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    if (state.selectedPresetId === p.id) btn.classList.add('active');
    btn.textContent = presetLabel(p);
    btn.dataset.id = p.id;
    btn.addEventListener('click', () => applyPreset(p));
    grid.appendChild(btn);
  }
}

function presetLabel(p) {
  if (p.type === 'percent') return `${p.name.replace('Reduzir ', '').replace('Reduzir ', '')}`;
  return p.name;
}

function applyPreset(p) {
  state.selectedPresetId = p.id;
  document.getElementById('checkKeepRatio').checked = p.keepRatio !== false;

  if (p.type === 'percent') {
    document.getElementById('inputWidth').value = '';
    document.getElementById('inputHeight').value = '';
    document.getElementById('inputWidth').placeholder = `${p.percent}%`;
    document.getElementById('inputHeight').placeholder = `${p.percent}%`;
    showToast('info', `Preset "${p.name}" — redimensionará para ${p.percent}% do tamanho original.`);
  } else {
    document.getElementById('inputWidth').value = p.width;
    document.getElementById('inputHeight').value = p.height;
  }
  renderPresetGrid();
}

function onDimsChange() {
  // Mudou dimensões manualmente → desativa preset ativo
  if (state.selectedPresetId) {
    state.selectedPresetId = null;
    renderPresetGrid();
  }
}

// ── Output folder ────────────────────────────────────────────────────
async function chooseOutputFolder() {
  const folder = await api.openFolderDialog();
  if (!folder) return;
  state.outputFolder = folder;
  updateOutputFolderDisplay();
}

function updateOutputFolderDisplay() {
  if (state.outputFolder) {
    document.getElementById('outputFolderName').textContent = 'Pasta Customizada';
    document.getElementById('outputFolderPath').textContent = state.outputFolder;
  } else {
    document.getElementById('outputFolderName').textContent = 'Pasta Atual';
    document.getElementById('outputFolderPath').textContent = 'Mesma pasta dos arquivos originais';
  }
}

function updateRenameHint() {
  const naming = document.getElementById('selectNaming').value;
  const hints = {
    resized: 'Ex: ferias_verao_resized.jpg',
    dimension: 'Ex: ferias_verao_1920x1080.jpg',
    keep: '⚠️ Mesmo nome do original (risco de sobrescrever)',
  };
  document.getElementById('renameHint').textContent = hints[naming] || '';
}

function openOutputFolder() {
  if (state.outputFolder) {
    api.openInExplorer(state.outputFolder);
  } else if (state.files.length > 0) {
    api.openInExplorer(state.files[0].path);
  } else {
    showToast('warn', 'Nenhum arquivo processado ainda.');
  }
}

// ── Footer / Status ──────────────────────────────────────────────────
function updateFooter() {
  const count = state.files.length;
  const totalSize = state.files.reduce((s, f) => s + (f.size || 0), 0);
  document.getElementById('footerCount').textContent =
    `${count} ${count === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  document.getElementById('footerSize').textContent = totalSize > 0 ? `(${fmtBytes(totalSize)})` : '';
  document.getElementById('processBtnLabel').textContent = `Processar ${count} ${count === 1 ? 'imagem' : 'imagens'}`;

  const btn = document.getElementById('btnProcess');
  btn.disabled = count === 0;
}

function setStatus(kind, label) {
  const pill = document.getElementById('statusPill');
  const dot = pill.querySelector('.status-dot');
  pill.lastChild.textContent = ` ${label}`;
  dot.className = `status-dot status-dot-${kind}`;
}

// ── Processing ───────────────────────────────────────────────────────
function setupProcessingOverlay() {
  document.getElementById('btnCancelProcess').addEventListener('click', async () => {
    if (state.currentJob) {
      await api.cancelProcess(state.currentJob.jobId);
      hideProcessing();
      showToast('warn', 'Processamento cancelado.');
    }
  });
  document.getElementById('btnRunInBg').addEventListener('click', () => {
    hideProcessing();
    showToast('info', 'Continuando em segundo plano. Acompanhe pela barra de tarefas.');
  });
}

function setupProgressListener() {
  api.onProcessProgress(handleProgressMessage);
}

async function startProcessing() {
  if (state.files.length === 0) return;
  const validFiles = state.files.filter(f => f.status !== 'error' && f.status !== 'loading');
  if (validFiles.length === 0) {
    showToast('warn', 'Nenhum arquivo válido para processar.');
    return;
  }

  // Confirma sobrescrita
  if (document.getElementById('checkOverwrite').checked) {
    if (!confirm('Sobrescrever os arquivos originais é uma ação irreversível. Continuar?')) return;
  }

  const options = collectOptions();
  const jobId = `job_${Date.now()}`;
  state.currentJob = { jobId, total: validFiles.length };
  state.jobStartTime = Date.now();
  state.jobBytesSaved = 0;
  state.jobItemsDone = 0;

  showProcessing(validFiles.length);
  setStatus('busy', 'Processando');

  try {
    await api.startProcess({
      jobId,
      files: validFiles.map(f => ({ path: f.path })),
      options,
    });
  } catch (err) {
    showToast('error', `Erro: ${err.message}`);
    hideProcessing();
  }
}

function collectOptions() {
  const w = parseInt(document.getElementById('inputWidth').value, 10) || null;
  const h = parseInt(document.getElementById('inputHeight').value, 10) || null;
  const sel = state.presets.find(p => p.id === state.selectedPresetId);
  const isPercent = sel && sel.type === 'percent';

  return {
    width: isPercent ? null : w,
    height: isPercent ? null : h,
    percent: isPercent ? sel.percent : null,
    presetType: isPercent ? 'percent' : 'pixels',
    keepRatio: document.getElementById('checkKeepRatio').checked,
    upscale: document.getElementById('checkUpscale').checked,
    format: document.getElementById('selectFormat').value,
    quality: parseInt(document.getElementById('sliderQuality').value, 10),
    outputDir: state.outputFolder,
    overwriteOriginal: document.getElementById('checkOverwrite').checked,
    namingMode: document.getElementById('selectNaming').value,
    preserveFolderStructure: false,
    maxParallel: state.settings?.threads > 0 ? state.settings.threads : 4,
  };
}

function showProcessing(total) {
  document.getElementById('processingOverlay').classList.remove('hidden');
  document.getElementById('processingSubtitle').textContent = `Processando 0 de ${total} imagens`;
  document.getElementById('processingPercent').textContent = '0%';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('metricSaved').textContent = '0 KB';
  document.getElementById('metricSpeed').textContent = '— img/s';
  document.getElementById('metricRemaining').textContent = '—';
  document.getElementById('metricRate').textContent = '—';
}

function hideProcessing() {
  document.getElementById('processingOverlay').classList.add('hidden');
  state.currentJob = null;
}

function handleProgressMessage(msg) {
  if (!state.currentJob || msg.jobId !== state.currentJob.jobId) return;

  switch (msg.type) {
    case 'item:start': {
      // Marca arquivo como processando
      const file = state.files.find(f => f.path === msg.file);
      if (file) { file.status = 'processing'; renderQueue(); }
      document.getElementById('processingSubtitle').textContent =
        `Processando item ${msg.index + 1} de ${msg.total}`;
      break;
    }

    case 'item:done': {
      const file = state.files.find(f => f.path === msg.file);
      if (file) {
        file.status = 'done';
        file.newSize = msg.newSize;
        file.newDims = msg.newDims;
      }
      state.jobBytesSaved += (msg.origSize - msg.newSize);
      state.jobItemsDone++;
      renderQueue();
      break;
    }

    case 'item:error': {
      const file = state.files.find(f => f.path === msg.file);
      if (file) { file.status = 'error'; renderQueue(); }
      showToast('error', `Falha em ${basename(msg.file)}: ${msg.error}`);
      state.jobItemsDone++;
      break;
    }

    case 'job:progress': {
      const pct = Math.round((msg.completed / msg.total) * 100);
      document.getElementById('progressFill').style.width = `${pct}%`;
      document.getElementById('processingPercent').textContent = `${pct}%`;

      const elapsed = (Date.now() - state.jobStartTime) / 1000;
      const speed = msg.completed / elapsed;
      const remaining = (msg.total - msg.completed) / speed;
      document.getElementById('metricSpeed').textContent = `${speed.toFixed(1)} img/s`;
      document.getElementById('metricRemaining').textContent = remaining > 0 ? fmtTime(remaining) : '—';
      document.getElementById('metricSaved').textContent = fmtBytes(state.jobBytesSaved);
      break;
    }

    case 'job:done': {
      const pct = Math.round((msg.completed / msg.total) * 100);
      document.getElementById('progressFill').style.width = `${pct}%`;
      document.getElementById('processingPercent').textContent = '100%';

      const savedMB = state.jobBytesSaved;
      const reduction = savedMB > 0 ? ((savedMB / state.jobBytesSaved) * 100).toFixed(1) : 0;
      document.getElementById('metricRate').textContent = `${reduction}%`;

      setTimeout(() => {
        hideProcessing();
        setStatus('idle', 'Pronto');
        const failed = msg.failed;
        if (failed > 0) {
          showToast('warn', `${msg.completed} processadas, ${failed} com erro.`);
        } else {
          showToast('success', `${msg.completed} imagens processadas — ${fmtBytes(state.jobBytesSaved)} economizados.`);
        }
      }, 600);
      break;
    }

    case 'error':
    case 'job:error': {
      showToast('error', msg.message || 'Erro desconhecido no processamento.');
      hideProcessing();
      setStatus('error', 'Erro');
      break;
    }
  }
}

// ── Preset modal ──────────────────────────────────────────────────────
function setupPresetModal() {
  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', closePresetModal);
  });
  document.getElementById('btnPresetCancel').addEventListener('click', resetPresetForm);
  document.getElementById('btnPresetSave').addEventListener('click', savePresetFromForm);
  document.getElementById('btnPresetDone').addEventListener('click', closePresetModal);
  document.getElementById('btnRestorePresets').addEventListener('click', restoreDefaultPresets);

  document.getElementById('presetMode').addEventListener('change', (e) => {
    const isPct = e.target.value === 'percent';
    document.getElementById('presetPixelsGroup').classList.toggle('hidden', isPct);
    document.getElementById('presetPercentGroup').classList.toggle('hidden', !isPct);
  });
  document.getElementById('presetPercent').addEventListener('input', (e) => {
    document.getElementById('presetPercentValue').textContent = `${e.target.value}%`;
  });
}

async function openPresetModal() {
  document.getElementById('presetModal').classList.remove('hidden');
  renderPresetList();
}

function closePresetModal() {
  document.getElementById('presetModal').classList.add('hidden');
  resetPresetForm();
}

function renderPresetList() {
  const list = document.getElementById('presetList');
  list.innerHTML = '';
  document.getElementById('presetCount').textContent = `${state.presets.length} itens`;

  for (const p of state.presets) {
    const item = document.createElement('div');
    item.className = 'preset-item';
    const tagText = p.type === 'percent' ? '%' : 'Fixo';
    const metaText = p.type === 'percent'
      ? `${p.percent}% · ${p.keepRatio ? 'Manter Proporção' : 'Forçar'}`
      : `${p.width} × ${p.height} · ${p.keepRatio ? 'Manter Proporção' : 'Forçar'}`;
    item.innerHTML = `
      <div class="preset-item-info">
        <div class="preset-item-name">${escapeHtml(p.name)} <span class="tag-mini">${tagText}</span></div>
        <div class="preset-item-meta">${metaText}</div>
      </div>
      <div class="preset-item-actions">
        <button data-edit="${p.id}">Editar</button>
        <button class="remove" data-remove="${p.id}">Remover</button>
      </div>
    `;
    list.appendChild(item);
  }

  list.querySelectorAll('[data-remove]').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.target.dataset.remove;
      if (!confirm('Remover este preset?')) return;
      state.presets = state.presets.filter(p => p.id !== id);
      await api.setPresets(state.presets);
      renderPresetList();
      renderPresetGrid();
    });
  });
  list.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.target.dataset.edit;
      const p = state.presets.find(x => x.id === id);
      if (p) loadPresetIntoForm(p);
    });
  });
}

function loadPresetIntoForm(p) {
  document.getElementById('presetFormTitle').textContent = `Editar: ${p.name}`;
  document.getElementById('presetName').value = p.name;
  document.getElementById('presetMode').value = p.type;
  document.getElementById('presetMode').dispatchEvent(new Event('change'));
  document.getElementById('presetKeepRatio').checked = p.keepRatio !== false;
  if (p.type === 'percent') {
    document.getElementById('presetPercent').value = p.percent;
    document.getElementById('presetPercentValue').textContent = `${p.percent}%`;
  } else {
    document.getElementById('presetW').value = p.width;
    document.getElementById('presetH').value = p.height;
  }
  document.getElementById('btnPresetSave').dataset.editing = p.id;
}

function resetPresetForm() {
  document.getElementById('presetFormTitle').textContent = 'Novo Preset Customizado';
  document.getElementById('presetName').value = '';
  document.getElementById('presetMode').value = 'pixels';
  document.getElementById('presetMode').dispatchEvent(new Event('change'));
  document.getElementById('presetW').value = '';
  document.getElementById('presetH').value = '';
  document.getElementById('presetKeepRatio').checked = true;
  delete document.getElementById('btnPresetSave').dataset.editing;
}

async function savePresetFromForm() {
  const name = document.getElementById('presetName').value.trim();
  const mode = document.getElementById('presetMode').value;
  const keepRatio = document.getElementById('presetKeepRatio').checked;
  const editingId = document.getElementById('btnPresetSave').dataset.editing;

  if (!name) { showToast('warn', 'Dê um nome ao preset.'); return; }

  const preset = {
    id: editingId || `custom_${Date.now()}`,
    name,
    type: mode,
    keepRatio,
  };
  if (mode === 'percent') {
    preset.percent = parseInt(document.getElementById('presetPercent').value, 10);
  } else {
    const w = parseInt(document.getElementById('presetW').value, 10);
    const h = parseInt(document.getElementById('presetH').value, 10);
    if (!w || !h) { showToast('warn', 'Informe largura e altura.'); return; }
    preset.width = w;
    preset.height = h;
  }

  if (editingId) {
    const i = state.presets.findIndex(p => p.id === editingId);
    if (i >= 0) state.presets[i] = preset;
  } else {
    state.presets.push(preset);
  }
  await api.setPresets(state.presets);
  renderPresetList();
  renderPresetGrid();
  resetPresetForm();
  showToast('success', `Preset "${name}" salvo.`);
}

async function restoreDefaultPresets() {
  if (!confirm('Restaurar os 7 presets padrão? Seus customizados serão perdidos.')) return;
  state.presets = await api.setPresets([
    { id: 'hd',      name: 'HD (1920×1080)',  type: 'pixels', width: 1920, height: 1080, keepRatio: true },
    { id: 'sd',      name: 'SD (1280×720)',   type: 'pixels', width: 1280, height: 720,  keepRatio: true },
    { id: 'tablet',  name: 'Tablet (1024×768)', type: 'pixels', width: 1024, height: 768, keepRatio: true },
    { id: 'web',     name: 'Web (800×600)',   type: 'pixels', width: 800,  height: 600,  keepRatio: true },
    { id: 'thumb',   name: 'Thumbnail (400×300)', type: 'pixels', width: 400, height: 300, keepRatio: true },
    { id: 'half',    name: 'Reduzir 50%',     type: 'percent', percent: 50, keepRatio: true },
    { id: 'quarter', name: 'Reduzir 75%',     type: 'percent', percent: 75, keepRatio: true },
  ]);
  renderPresetList();
  renderPresetGrid();
  showToast('success', 'Presets padrão restaurados.');
}

// ── Toast ────────────────────────────────────────────────────────────
function showToast(kind, msg) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

// ── Utils ────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b || b < 0) return '0 KB';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function fmtTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}


// ════════════════════════════════════════════════════════════════════
// QUICK ACTION MODE
// ════════════════════════════════════════════════════════════════════
async function initQuickAction() {
  state.presets = await api.getPresets();
  state.settings = await api.getSettings();
  renderQuickPresetGrid();

  document.getElementById('quickClose').addEventListener('click', () => api.closeWindow());
  document.getElementById('quickCancel').addEventListener('click', () => api.closeWindow());
  document.getElementById('quickManagePresets').addEventListener('click', () => api.openSettings());
  document.getElementById('quickAdvanced').addEventListener('click', async () => {
    // Fecha este modal e abre main com os arquivos
    const files = state.files.map(f => f.path);
    await api.openQuickAction([]); // placeholder
    // Como main precisa dos arquivos via second-instance,
    // mandamos via IPC alternativo:
    document.dispatchEvent(new CustomEvent('quick-send-to-main'));
  });
  document.getElementById('quickQuality').addEventListener('input', (e) => {
    document.getElementById('quickQualityValue').textContent = `${e.target.value}%`;
  });

  document.getElementById('quickSubmit').addEventListener('click', submitQuick);

  api.onQuickActionSetFiles(async (files) => {
    if (!files || files.length === 0) return;
    await addFiles(files);
    updateQuickSubtitle();
    if (state.files[0]) {
      document.getElementById('quickSamePath').textContent =
        state.files[0].path.replace(/[\\/][^\\/]*$/, '');
    }
  });
}

function updateQuickSubtitle() {
  const n = state.files.length;
  document.getElementById('quickSubtitle').textContent =
    `${n} ${n === 1 ? 'arquivo selecionado' : 'arquivos selecionados'} do Explorer`;
}

function renderQuickPresetGrid() {
  const grid = document.getElementById('quickPresetGrid');
  grid.innerHTML = '';
  for (const p of state.presets) {
    const btn = document.createElement('button');
    btn.textContent = presetLabel(p);
    btn.dataset.id = p.id;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedPresetId = p.id;
    });
    grid.appendChild(btn);
  }
}

async function submitQuick() {
  if (state.files.length === 0) {
    showToast('warn', 'Nenhum arquivo para processar.');
    return;
  }
  const sel = state.presets.find(p => p.id === state.selectedPresetId);
  const isPercent = sel && sel.type === 'percent';

  const options = {
    width: isPercent ? null : (sel?.width || null),
    height: isPercent ? null : (sel?.height || null),
    percent: isPercent ? sel.percent : null,
    presetType: isPercent ? 'percent' : 'pixels',
    keepRatio: document.getElementById('quickKeepRatio').checked,
    upscale: false,
    format: document.getElementById('quickFormat').value,
    quality: parseInt(document.getElementById('quickQuality').value, 10),
    outputDir: '',
    overwriteOriginal: false,
    namingMode: 'resized',
    preserveFolderStructure: false,
    maxParallel: state.settings?.threads > 0 ? state.settings.threads : 4,
  };

  const destRadio = document.querySelector('input[name="quickDest"]:checked');
  if (destRadio?.value === 'custom') {
    const folder = await api.openFolderDialog();
    if (folder) options.outputDir = folder;
  }

  api.closeWindow();

  // Dispara processamento via main process — ele encaminha pro main window
  // (que mostra o overlay de progresso automaticamente)
  api.startProcessFromQuick({
    jobId: `quick_${Date.now()}`,
    files: state.files.map(f => ({ path: f.path })),
    options,
  }).catch(err => {
    // Se main window estiver fechada, cai no próprio quick window
    // (que já fechou, então erro é silencioso no user-facing)
    console.error('Quick process error:', err);
  });
}