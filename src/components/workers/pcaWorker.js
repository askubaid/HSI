import { Matrix, EigenvalueDecomposition } from 'ml-matrix';

const BATCH_SIZE = 20000;

self.onmessage = async (e) => {
  const { rawBands, width, height, bands, numComponents } = e.data;

  try {
    const totalPixels = width * height;
    const PROGRESS_STEP = Math.max(1, Math.floor(totalPixels / 20));

    // ─── 0. Identify valid pixels (exclude sentinels like -4.24e32) ───
    self.postMessage({ type: 'progress', status: 'Filtering valid pixels...' });
    const isValidPixel = new Uint8Array(totalPixels);
    let validPixelCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      let valid = true;
      for (let b = 0; b < bands; b++) {
        const val = rawBands[b * totalPixels + i];
        if (!Number.isFinite(val) || Math.abs(val) >= 1e30) {
          valid = false;
          break;
        }
      }
      if (valid) {
        isValidPixel[i] = 1;
        validPixelCount++;
      }
    }

    if (validPixelCount === 0) {
      throw new Error("No valid pixels found. All pixels were filtered out as sentinel values.");
    }

    // ─── 1. Compute per-band mean vector ONLY for valid pixels ────────
    self.postMessage({ type: 'progress', status: `Computing band means (${validPixelCount.toLocaleString()} valid pixels)...` });

    const mean = new Float64Array(bands);
    for (let i = 0; i < totalPixels; i++) {
      if (isValidPixel[i]) {
        for (let b = 0; b < bands; b++) {
          mean[b] += rawBands[b * totalPixels + i];
        }
      }
    }
    for (let b = 0; b < bands; b++) mean[b] /= validPixelCount;

    // ─── 2. Compute covariance matrix incrementally ───────────────────
    self.postMessage({ type: 'progress', status: 'Computing covariance matrix...' });

    const cov = [];
    for (let b = 0; b < bands; b++) cov.push(new Float64Array(bands));

    let processedValid = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (!isValidPixel[i]) continue;

      const v = new Float64Array(bands);
      for (let b = 0; b < bands; b++) {
        v[b] = rawBands[b * totalPixels + i] - mean[b];
      }
      for (let b1 = 0; b1 < bands; b1++) {
        for (let b2 = b1; b2 < bands; b2++) {
          cov[b1][b2] += v[b1] * v[b2];
        }
      }
      
      processedValid++;
      if (processedValid % PROGRESS_STEP === 0) {
        const pct = Math.round((processedValid / validPixelCount) * 55);
        self.postMessage({ type: 'progress', status: `Computing covariance matrix... ${pct}%` });
      }
    }

    const covRows = [];
    const normFactor = validPixelCount > 1 ? (validPixelCount - 1) : 1;
    for (let b1 = 0; b1 < bands; b1++) {
      const row = new Array(bands);
      for (let b2 = 0; b2 < bands; b2++) {
        row[b2] = b1 <= b2 ? cov[b1][b2] / normFactor : cov[b2][b1] / normFactor;
      }
      covRows.push(row);
    }

    // ─── 3. Eigendecomposition ────────────────────────────────────────
    self.postMessage({ type: 'progress', status: 'Computing eigenvectors...' });

    const covMatrix = new Matrix(covRows);
    const evd = new EigenvalueDecomposition(covMatrix, { assumeSymmetric: true });

    const eigenvalues = evd.realEigenvalues;
    const eigenvectors = evd.eigenvectorMatrix;

    const sortedIdx = eigenvalues
      .map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .map(x => x.idx)
      .slice(0, numComponents);

    const VK_data = [];
    for (let b = 0; b < bands; b++) {
      const row = new Array(numComponents);
      for (let k = 0; k < numComponents; k++) {
        row[k] = eigenvectors.get(b, sortedIdx[k]);
      }
      VK_data.push(row);
    }
    const VK = new Matrix(VK_data);

    // ─── 4. Project pixels ────────────────────────────────────────────
    const componentArrays = Array.from({ length: numComponents }, () => new Float32Array(totalPixels));
    const totalBatches = Math.ceil(totalPixels / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalPixels);
      const batchLen = end - start;

      const batchRows = [];
      for (let i = start; i < end; i++) {
        const row = new Array(bands);
        if (isValidPixel[i]) {
          for (let b = 0; b < bands; b++) {
            row[b] = rawBands[b * totalPixels + i] - mean[b];
          }
        } else {
          for (let b = 0; b < bands; b++) row[b] = 0;
        }
        batchRows.push(row);
      }

      const batchMatrix = new Matrix(batchRows);
      const proj = batchMatrix.mmul(VK);

      for (let k = 0; k < numComponents; k++) {
        const col = proj.getColumn(k);
        for (let i = 0; i < batchLen; i++) {
          componentArrays[k][start + i] = isValidPixel[start + i] ? col[i] : NaN;
        }
      }

      const pct = 55 + Math.round(((batchIdx + 1) / totalBatches) * 35);
      self.postMessage({ type: 'progress', status: `Projecting pixels... ${pct}%` });
    }

    // ─── 5. Normalize ─────────────────────────────────────────────────
    self.postMessage({ type: 'progress', status: 'Rendering component images...' });

    const componentPixels = [];
    for (let k = 0; k < numComponents; k++) {
      const arr = componentArrays[k];

      const validValues = [];
      for (let i = 0; i < totalPixels; i++) {
        if (isValidPixel[i]) {
          validValues.push(arr[i]);
        }
      }

      const rgba = new Uint8ClampedArray(totalPixels * 4);

      if (validValues.length === 0) {
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          rgba[idx] = 0; rgba[idx + 1] = 0; rgba[idx + 2] = 0; rgba[idx + 3] = 255;
        }
      } else {
        validValues.sort((a, b) => a - b);

        const p2Index = Math.max(0, Math.floor(validValues.length * 0.02));
        const p98Index = Math.min(validValues.length - 1, Math.floor(validValues.length * 0.98));
        
        let low = validValues[p2Index];
        let high = validValues[p98Index];
        
        if (high === low) {
          high = low + 1.0;
        }

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          if (isValidPixel[i]) {
            const value = arr[i];
            const clipped = Math.max(low, Math.min(high, value));
            let normalized = Math.round(255.0 * (clipped - low) / (high - low));
            normalized = Math.max(0, Math.min(255, normalized));
            rgba[idx] = normalized; rgba[idx + 1] = normalized; rgba[idx + 2] = normalized;
          } else {
            rgba[idx] = 0; rgba[idx + 1] = 0; rgba[idx + 2] = 0;
          }
          rgba[idx + 3] = 255;
        }
      }
      componentPixels.push(rgba);
    }

    const transferList = [
      ...componentPixels.map(a => a.buffer),
      ...componentArrays.map(a => a.buffer)
    ];
    self.postMessage({ type: 'success', componentPixels, componentArrays, width, height, numComponents }, transferList);

  } catch (err) {
    self.postMessage({ type: 'error', error: err.message + '\n' + err.stack });
  }
};
