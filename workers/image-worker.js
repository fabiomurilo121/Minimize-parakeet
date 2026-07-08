/**
 * Image Worker Thread
 *
 * Roda em thread separada pra não bloquear UI. Recebe arquivos + opções,
 * processa cada um com sharp, e emite mensagens de progresso pro main.
 */

const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const sharp = require('sharp');

const { jobId, files, options } = workerData;

// ── Helpers ───────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function buildOutputPath(filePath, options, targetWidth, targetHeight) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  let suffix = '';
  if (options.namingMode === 'dimension') {
    suffix = `_${targetWidth}x${targetHeight}`;
  } else if (options.namingMode === 'resized') {
    suffix = '_resized';
  } // 'keep' = no suffix

  const newExt = options.format === 'jpeg' ? '.jpg'
              : options.format === 'png'  ? '.png'
              : '.webp';

  let outDir = dir;
  if (options.outputDir && options.outputDir.trim() !== '') {
    outDir = options.outputDir;
  } else if (options.overwriteOriginal) {
    // sobrescreve no mesmo lugar
  }

  // Preserva estrutura de pastas se input veio de subdir
  if (options.preserveFolderStructure && options.outputDir && filePath.includes(path.sep)) {
    // já tratado pelo outputDir do usuário
  }

  return path.join(outDir, `${base}${suffix}${newExt}`);
}

async function processOne(file, options, index, total) {
  const start = Date.now();
  const srcStat = await fsp.stat(file.path);

  const meta = await sharp(file.path).metadata();
  const origWidth = meta.width;
  const origHeight = meta.height;

  // ── Cálculo de dimensões alvo ──
  let targetW, targetH;
  if (options.presetType === 'percent') {
    targetW = Math.round(origWidth * (options.percent / 100));
    targetH = Math.round(origHeight * (options.percent / 100));
  } else {
    targetW = options.width || origWidth;
    targetH = options.height || origHeight;

    if (options.keepRatio !== false) {
      const ratio = origWidth / origHeight;
      if (options.width && !options.height) {
        targetH = Math.round(options.width / ratio);
      } else if (options.height && !options.width) {
        targetW = Math.round(options.height * ratio);
      } else if (options.width && options.height) {
        // Ajusta para caber dentro do box sem distorcer
        if (origWidth / origHeight > options.width / options.height) {
          targetH = Math.round(options.width / ratio);
        } else {
          targetW = Math.round(options.height * ratio);
        }
      }
    }
  }

  if (options.upscale === false && (targetW > origWidth || targetH > origHeight)) {
    targetW = origWidth;
    targetH = origHeight;
  }

  // ── Pipeline sharp ──
  let pipeline = sharp(file.path).rotate(); // respeita EXIF orientation

  // Só aplica resize se mudou
  if (targetW !== origWidth || targetH !== origHeight) {
    pipeline = pipeline.resize(targetW, targetH, {
      fit: options.keepRatio === false ? 'fill' : 'inside',
      withoutEnlargement: !options.upscale,
    });
  }

  // Aplica formato de saída
  const quality = Math.max(10, Math.min(100, options.quality || 85));
  switch (options.format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true, progressive: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, palette: quality < 90 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    default:
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  // Metadados: remove EXIF pesado mas mantém orientação (já aplicada)
  // Por padrão sharp preserva; aqui só logamos

  // ── Caminho de saída ──
  const outPath = buildOutputPath(file.path, options, targetW, targetH);

  // Evita colisão: se for sobrescrever o original com mesma extensão,
  // já tá OK. Caso contrário, garante nome único.
  let finalOutPath = outPath;
  if (fs.existsSync(finalOutPath) && finalOutPath !== file.path) {
    const dir = path.dirname(finalOutPath);
    const ext = path.extname(finalOutPath);
    const base = path.basename(finalOutPath, ext);
    let i = 1;
    while (fs.existsSync(path.join(dir, `${base}_${i}${ext}`))) i++;
    finalOutPath = path.join(dir, `${base}_${i}${ext}`);
  }

  // ── Escrita ──
  parentPort.postMessage({
    jobId,
    type: 'item:start',
    index,
    total,
    file: file.path,
    targetW,
    targetH,
  });

  const info = await pipeline.toFile(finalOutPath);
  const elapsed = Date.now() - start;
  const outStat = await fsp.stat(finalOutPath);
  const reduction = ((1 - outStat.size / srcStat.size) * 100).toFixed(1);

  parentPort.postMessage({
    jobId,
    type: 'item:done',
    index,
    total,
    file: file.path,
    output: finalOutPath,
    origSize: srcStat.size,
    newSize: outStat.size,
    reduction: parseFloat(reduction),
    origDims: `${origWidth}×${origHeight}`,
    newDims: `${info.width}×${info.height}`,
    elapsedMs: elapsed,
  });
}

// ── Loop principal ─────────────────────────────────────────────────────
(async () => {
  parentPort.postMessage({
    jobId,
    type: 'job:start',
    total: files.length,
    startedAt: Date.now(),
  });

  // Limite de concorrência baseado em opções
  const maxParallel = Math.max(1, options.maxParallel || 4);
  let completed = 0;
  let failed = 0;

  // Processa em chunks
  const queue = files.map((f, i) => ({ f, i }));
  const inFlight = new Set();

  async function runOne() {
    while (queue.length > 0) {
      const { f, i } = queue.shift();
      try {
        await processOne(f, options, i, files.length);
        completed++;
      } catch (err) {
        failed++;
        parentPort.postMessage({
          jobId,
          type: 'item:error',
          index: i,
          total: files.length,
          file: f.path,
          error: err.message,
        });
      }
      parentPort.postMessage({
        jobId,
        type: 'job:progress',
        completed,
        failed,
        total: files.length,
      });
    }
  }

  const workers = [];
  for (let i = 0; i < maxParallel; i++) workers.push(runOne());
  await Promise.all(workers);

  parentPort.postMessage({
    jobId,
    type: 'job:done',
    completed,
    failed,
    total: files.length,
    finishedAt: Date.now(),
  });

  process.exit(0);
})().catch(err => {
  parentPort.postMessage({
    jobId,
    type: 'job:error',
    error: err.message,
  });
  process.exit(1);
});