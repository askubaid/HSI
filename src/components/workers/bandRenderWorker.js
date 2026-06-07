self.onmessage = (e) => {
  const { rawBands, width, height, bands } = e.data;
  const count = width * height;

  const isValid = (v) => Number.isFinite(v) && Math.abs(v) < 1e30;

  for (let b = 0; b < bands; b++) {
    const bandOffset = b * count;
    
    // 1. Extract valid values and sort them to compute percentiles
    const validValues = [];
    for (let i = 0; i < count; i++) {
      const val = rawBands[bandOffset + i];
      if (isValid(val)) {
        validValues.push(val);
      }
    }

    const pixels = new Uint8ClampedArray(count * 4);

    // If there are no valid pixels, return an all-black image
    if (validValues.length === 0) {
      for (let i = 0; i < count; i++) {
        const idx = i * 4;
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 255;
      }
    } else {
      validValues.sort((a, b) => a - b);

      // 2. Find 2nd and 98th percentiles
      const p2Index = Math.max(0, Math.floor(validValues.length * 0.02));
      const p98Index = Math.min(validValues.length - 1, Math.floor(validValues.length * 0.98));
      
      let low = validValues[p2Index];
      let high = validValues[p98Index];
      
      // Prevent division by zero
      if (high === low) {
        high = low + 1.0;
      }

      // 3. Clip and Scale (Normalize) pixel data to 0-255
      for (let i = 0; i < count; i++) {
        const value = rawBands[bandOffset + i];

        let normalized = 0;
        if (isValid(value)) {
          const clipped = Math.max(low, Math.min(high, value));
          normalized = Math.round(255.0 * (clipped - low) / (high - low));
          normalized = Math.max(0, Math.min(255, normalized)); // Safety clamp
        }

        const idx = i * 4;
        pixels[idx] = normalized;     // R
        pixels[idx + 1] = normalized; // G
        pixels[idx + 2] = normalized; // B
        pixels[idx + 3] = 255;        // A
      }
    }

    self.postMessage({ type: 'band', bandIndex: b, pixels }, [pixels.buffer]);
  }

  self.postMessage({ type: 'done' });
};
