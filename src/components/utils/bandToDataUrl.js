/**
 * Pre-renders a single HSI band to a grayscale data URL using an offscreen canvas.
 * Applies statistical contrast stretching (2nd and 98th percentiles) to maximize visible detail,
 * matching the logic from How_To.md.
 *
 * @param {object} imageData - The full HSI imageData object (width, height, rawBands).
 * @param {number} bandIndex - Zero-based index of the band to render.
 * @returns {string} A PNG data URL string.
 */
export function bandToDataUrl(imageData, bandIndex) {
  const { width, height, rawBands } = imageData;
  const bandOffset = bandIndex * height * width;
  const count = width * height;

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  const imgData = ctx.createImageData(width, height);

  const isValid = (v) => Number.isFinite(v) && Math.abs(v) < 1e35;

  // 1. Extract valid values and sort them to compute percentiles
  const validValues = [];
  for (let i = 0; i < count; i++) {
    const val = rawBands[bandOffset + i];
    if (isValid(val)) {
      validValues.push(val);
    }
  }

  // If there are no valid pixels, return an all-black image
  if (validValues.length === 0) {
    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      imgData.data[idx] = 0;
      imgData.data[idx + 1] = 0;
      imgData.data[idx + 2] = 0;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return offscreen.toDataURL('image/png');
  }

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
    imgData.data[idx] = normalized;     // R
    imgData.data[idx + 1] = normalized; // G
    imgData.data[idx + 2] = normalized; // B
    imgData.data[idx + 3] = 255;        // A
  }

  ctx.putImageData(imgData, 0, 0);
  return offscreen.toDataURL('image/png');
}

