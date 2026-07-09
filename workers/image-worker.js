/* Parakeet Minimizer - Worker de processamento (sharp)
   Recebe { taskId, file, options } e devolve { taskId, status, ... } */

const { parentPort } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

if (!parentPort) {
  throw new Error('Este script deve ser executado dentro de um Worker thread.');
}

function uniquePath(dir, baseName, ext) {
  let candidate = path.join(dir, `${baseName}.${ext}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_${counter}.${ext}`);
    counter++;
  }
  return candidate;
}

async function processTask({ taskId, file, options }) {
  try {
    const inputPath = file.path;
    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error(`Arquivo nao encontrado: ${inputPath}`);
    }

    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    // Metadados originais
    const meta = await sharp(inputPath).metadata();

    // Calcula dimensoes alvo
    let targetW = options.width  ? parseInt(options.width,  10) : null;
    let targetH = options.height ? parseInt(options.height, 10) : null;

    if (options.mode === 'percent') {
      const pct = parseFloat(options.percent || 100) / 100;
      targetW = Math.round(meta.width  * pct);
      targetH = Math.round(meta.height * pct);
    }

    if (!targetW && !targetH) {
      targetW = meta.width;
      targetH = meta.height;
    }

    // Caminho de saida
    const ext = (options.format || 'jpeg').toLowerCase();
    const baseName = path.basename(file.name, path.extname(file.name));
    const dir = (options.destination === 'custom' && options.customDestPath)
      ? options.customDestPath
      : path.dirname(inputPath);
    const suffix = options.saveRenamed ? '_resized' : '';
    const outputPath = uniquePath(dir, `${baseName}${suffix}`, ext);

    // Garante que o diretorio de saida existe
    await fs.promises.mkdir(dir, { recursive: true });

    // Monta pipeline
    let pipeline = sharp(inputPath, { failOn: 'none' });

    // Modo de ajuste: 'inside' (preserva tudo, sem crop), 'cover' (preenche com recorte)
    // ou 'fill' (estica, pode distorcer). Fallback para 'cover' se nao especificado.
    const fitMode = options.fitMode
      || (options.keepAspect === false ? 'fill' : 'cover');
    const bothDims = targetW && targetH;

    if (fitMode === 'inside') {
      pipeline = pipeline.resize({
        width: targetW || null,
        height: targetH || null,
        fit: 'inside',
        withoutEnlargement: !options.allowEnlarge,
      });
    } else if (fitMode === 'fill') {
      pipeline = pipeline.resize(targetW, targetH, { fit: 'fill' });
    } else {
      // cover (default)
      pipeline = pipeline.resize({
        width: targetW,
        height: targetH,
        fit: 'cover',
        position: bothDims ? 'attention' : 'center',
        withoutEnlargement: !options.allowEnlarge,
      });
    }

    // Formato / qualidade
    const quality = parseInt(options.quality || 85, 10);
    if (ext === 'jpeg' || ext === 'jpg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true, progressive: true });
    } else if (ext === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    } else if (ext === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      throw new Error(`Formato nao suportado: ${ext}`);
    }

    // Sobrescrever original = escreve direto no path original
    const finalPath = options.overwriteOriginal ? inputPath : outputPath;
    if (options.overwriteOriginal) {
      // Para sobrescrever, salva em temp e renomeia
      const tmp = finalPath + '.tmp';
      await pipeline.toFile(tmp);
      fs.renameSync(tmp, finalPath);
    } else {
      await pipeline.toFile(finalPath);
    }

    const newMeta  = await sharp(finalPath).metadata();
    const newStats = fs.statSync(finalPath);

    parentPort.postMessage({
      taskId,
      status: 'done',
      outputPath: finalPath,
      outputDir: dir,
      outputSize: newStats.size,
      outputWidth: newMeta.width,
      outputHeight: newMeta.height,
      originalSize,
      savedBytes: originalSize - newStats.size,
    });
  } catch (err) {
    parentPort.postMessage({
      taskId,
      status: 'error',
      error: err.message || String(err),
    });
  }
}

parentPort.on('message', (msg) => {
  if (msg && msg.type === 'process') {
    processTask(msg);
  } else if (msg && msg.type === 'shutdown') {
    process.exit(0);
  }
});