self.onmessage = (e) => {
  const { metadata, arrayBuffer, fileName } = e.data;
  
  try {
    const samples = parseInt(metadata.samples) || parseInt(metadata.cols);
    const lines = parseInt(metadata.lines) || parseInt(metadata.rows);
    const bands = parseInt(metadata.bands) || 1;
    const dataType = parseInt(metadata['data type']) || 4; // 4 = float32
    const byteOrder = parseInt(metadata['byte order']) || 0; // 0 = little-endian
    
    if (!samples || !lines) {
      throw new Error('Invalid HDR metadata: missing samples or lines');
    }

    const dataView = new DataView(arrayBuffer);
    const isLittleEndian = byteOrder === 0;
    
    let bytesPerSample = 4;
    if (dataType === 1) bytesPerSample = 1;
    else if (dataType === 2) bytesPerSample = 2;
    else if (dataType === 3) bytesPerSample = 4;
    else if (dataType === 4) bytesPerSample = 4;
    else if (dataType === 5) bytesPerSample = 8;
    
    const totalPixels = samples * lines * bands;
    const expectedBytes = totalPixels * bytesPerSample;
    
    if (arrayBuffer.byteLength < expectedBytes) {
      throw new Error(`RAW file too small. Expected ${expectedBytes} bytes, got ${arrayBuffer.byteLength}`);
    }

    let min = Infinity;
    let max = -Infinity;
    const rawData = [];
    
    // Process in chunks to avoid stack overflow for large files
    const chunkSize = 10000;
    for (let i = 0; i < totalPixels; i += chunkSize) {
      const endIdx = Math.min(i + chunkSize, totalPixels);
      for (let idx = i; idx < endIdx; idx++) {
        let value;
        const offset = idx * bytesPerSample;
        
        if (dataType === 1) {
          value = new Uint8Array(arrayBuffer)[idx];
        } else if (dataType === 2) {
          value = dataView.getInt16(offset, isLittleEndian);
        } else if (dataType === 3) {
          value = dataView.getInt32(offset, isLittleEndian);
        } else if (dataType === 4) {
          value = dataView.getFloat32(offset, isLittleEndian);
        } else if (dataType === 5) {
          value = dataView.getFloat64(offset, isLittleEndian);
        }
        
        if (Number.isFinite(value) && Math.abs(value) < 1e35) {
          if (value < min) min = value;
          if (value > max) max = value;
        }
        rawData.push(value);
      }
      
      // Post progress updates
      if (i > 0 && i % (chunkSize * 100) === 0) {
        self.postMessage({ type: 'progress', status: `Parsing RAW file... ${Math.round((i/totalPixels)*100)}%` });
      }
    }
    
    const range = max - min || 1;
    
    // Create RGB preview
    self.postMessage({ type: 'progress', status: `Generating preview...` });
    const pixels = new Uint8ClampedArray(samples * lines * 4);
    
    for (let y = 0; y < lines; y++) {
      for (let x = 0; x < samples; x++) {
        const pixelIndex = (y * samples + x) * 4;
        
        let r = 0, g = 0, b = 0;
        
        if (bands >= 3) {
          const rIdx = (0 * lines * samples) + (y * samples) + x;
          const gIdx = (1 * lines * samples) + (y * samples) + x;
          const bIdx = (2 * lines * samples) + (y * samples) + x;
          
          r = Math.round(((rawData[rIdx] - min) / range) * 255);
          g = Math.round(((rawData[gIdx] - min) / range) * 255);
          b = Math.round(((rawData[bIdx] - min) / range) * 255);
        } else if (bands === 1) {
          const idx = (y * samples) + x;
          const normalized = Math.round(((rawData[idx] - min) / range) * 255);
          r = g = b = normalized;
        }
        
        pixels[pixelIndex] = r;
        pixels[pixelIndex + 1] = g;
        pixels[pixelIndex + 2] = b;
        pixels[pixelIndex + 3] = 255;
      }
    }

    const processedData = {
      width: samples,
      height: lines,
      pixels: Array.from(pixels),
      format: bands > 1 ? 'multiband' : 'grayscale',
      fileName: fileName,
      bands: bands,
      rawBands: rawData,
      metadata: metadata,
      globalMin: min,
      globalMax: max,
      range: range
    };
    
    self.postMessage({ type: 'success', data: processedData });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
