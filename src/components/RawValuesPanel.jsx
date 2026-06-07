/**
 * RawValuesPanel — renders a raw grid of values for the given band for debugging purposes.
 *
 * Props:
 *   imageData     {object}  The main image data object with rawBands, width, height, etc.
 *   debouncedBand {number}  The current zero-based band index (debounced for performance)
 */
export default function RawValuesPanel({ imageData, debouncedBand }) {
  if (!imageData || !imageData.rawBands) return null;

  return (
    <div className="debug-band-values" style={{ padding: '20px', backgroundColor: '#111', borderRadius: '8px', border: '1px solid #333' }}>
      <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#e0e0e0' }}>
        Raw Values (Band {debouncedBand + 1}) — {imageData.width} cols × {imageData.height} rows
      </h4>
      <p style={{ textAlign: 'center', color: '#888', fontSize: '12px', marginBottom: '10px' }}>
        Values are rounded to 4 decimal places for readability. Sentinel/NoData values are shown as NaN.
      </p>
      <div style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '500px', backgroundColor: '#000', padding: '10px' }}>
        <pre style={{ color: '#0f0', fontSize: '10px', margin: 0, fontFamily: 'monospace' }}>
          {(() => {
            const { width, height, rawBands } = imageData;
            const bandOffset = debouncedBand * width * height;
            const lines = [];
            for (let y = 0; y < height; y++) {
              let row = [];
              for (let x = 0; x < width; x++) {
                const val = rawBands[bandOffset + y * width + x];
                if (Number.isFinite(val) && Math.abs(val) < 1e35) {
                  row.push(val.toFixed(4).padStart(8, ' '));
                } else {
                  row.push('     NaN');
                }
              }
              lines.push(row.join(' '));
            }
            return lines.join('\n');
          })()}
        </pre>
      </div>
    </div>
  );
}
