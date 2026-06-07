import React, { useMemo } from 'react';

// Map a wavelength (nm) to an approximate visible-spectrum RGB color.
// Out-of-visible-range bands (UV <380, NIR >700) get a neutral grey.
function wavelengthToRgb(nm) {
  const w = parseFloat(nm);
  if (isNaN(w)) return 'hsl(0,0%,40%)';

  if (w < 380) return 'hsl(270,60%,25%)';           // deep UV — dark purple
  if (w < 440) return `hsl(${270 + (440 - w) / 60 * 30},80%,50%)`; // violet
  if (w < 490) return `hsl(${240 - (w - 440) / 50 * 60},100%,50%)`; // blue
  if (w < 510) return `hsl(${180 - (w - 490) / 20 * 60},100%,45%)`; // cyan→green
  if (w < 580) return `hsl(${120 + (w - 510) / 70 * 60},100%,40%)`; // green→yellow
  if (w < 645) return `hsl(${60 - (w - 580) / 65 * 60},100%,45%)`;  // yellow→orange→red
  if (w <= 700) return 'hsl(0,90%,40%)';            // red
  return 'hsl(0,0%,35%)';                           // NIR — dark grey
}

export default function MetadataDisplay({ imageData }) {
  if (!imageData) return null;

  const { width, height, bands, metadata, fileName } = imageData;

  const { wavelengths, units } = useMemo(() => {
    let wls = [];
    let u = 'nm';
    if (metadata) {
      if (metadata['wavelength units']) u = metadata['wavelength units'];
      const raw = metadata.wavelength || metadata.wavelengths;
      if (raw) {
        const cleaned = raw.replace(/[{}]/g, '');
        wls = (cleaned.includes(',')
          ? cleaned.split(',')
          : cleaned.split(/\s+/)
        ).map(s => s.trim()).filter(s => s.length > 0).map(Number).filter(v => !isNaN(v));
      }
    }
    return { wavelengths: wls, units: u };
  }, [metadata]);

  const hasWavelengths = wavelengths.length > 0;
  const minWl = hasWavelengths ? Math.min(...wavelengths) : 0;
  const maxWl = hasWavelengths ? Math.max(...wavelengths) : 0;
  const rangeWl = maxWl - minWl || 1;

  // SVG dimensions
  const SVG_W = 800;
  const BAR_H = 36;
  const TICK_H = 10;
  const LABEL_Y = BAR_H + TICK_H + 14;
  const SVG_H = LABEL_Y + 6;
  const PAD_L = 30;
  const PAD_R = 30;
  const PLOT_W = SVG_W - PAD_L - PAD_R;

  // Decide which band indices to label (avoid crowding)
  const labeledIndices = useMemo(() => {
    if (!hasWavelengths) return [];
    const maxLabels = 15;
    const step = Math.max(1, Math.ceil(wavelengths.length / maxLabels));
    const result = [];
    for (let i = 0; i < wavelengths.length; i += step) result.push(i);
    // Always include last
    if (result[result.length - 1] !== wavelengths.length - 1) {
      result.push(wavelengths.length - 1);
    }
    return result;
  }, [wavelengths, hasWavelengths]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '16px',
      border: '1px solid #2a2a4a',
      color: '#e0e0e0',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* File Name */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', color: '#7a7aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>File</span>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#c8d8ff', marginTop: '2px', wordBreak: 'break-all' }}>
          {fileName || 'Uploaded Image'}
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', marginBottom: hasWavelengths ? '24px' : '0' }}>
        {[
          { label: 'Width', value: `${width} px` },
          { label: 'Height', value: `${height} px` },
          { label: 'Dimensions', value: `${width} × ${height}` },
          { label: 'Spectral Bands', value: bands },
          ...(hasWavelengths ? [
            { label: 'Wavelength Range', value: `${minWl.toFixed(1)} – ${maxWl.toFixed(1)} ${units}` },
          ] : []),
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: '#7a7aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e0e0e0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Spectrum Bar */}
      {hasWavelengths && (
        <div>
          <div style={{ fontSize: '11px', color: '#7a7aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Spectral Coverage ({units})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ width: '100%', minWidth: '320px', display: 'block' }}
            >
              {/* Gradient spectrum bar — one rect per band */}
              {wavelengths.map((wl, i) => {
                const x = PAD_L + (wl - minWl) / rangeWl * PLOT_W;
                const nextWl = wavelengths[i + 1] ?? wl + (rangeWl / wavelengths.length);
                const nextX = PAD_L + (nextWl - minWl) / rangeWl * PLOT_W;
                const rectW = Math.max(nextX - x, 0.5);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={0}
                    width={rectW}
                    height={BAR_H}
                    fill={wavelengthToRgb(wl)}
                  />
                );
              })}

              {/* Bar outline */}
              <rect x={PAD_L} y={0} width={PLOT_W} height={BAR_H} fill="none" stroke="#444" strokeWidth="1" rx="3" />

              {/* Tick marks + labels */}
              {labeledIndices.map(i => {
                const wl = wavelengths[i];
                const x = PAD_L + (wl - minWl) / rangeWl * PLOT_W;
                const isFirst = i === 0;
                const isLast = i === wavelengths.length - 1;
                const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                return (
                  <g key={i}>
                    <line x1={x} y1={BAR_H} x2={x} y2={BAR_H + TICK_H} stroke="#888" strokeWidth="1" />
                    <text
                      x={x}
                      y={LABEL_Y}
                      textAnchor={anchor}
                      fontSize="10"
                      fill="#aaa"
                      fontFamily="monospace"
                    >
                      {parseFloat(wl.toFixed(1))}
                    </text>
                    {/* Band index label above bar */}
                    <text
                      x={x}
                      y={BAR_H - 4}
                      textAnchor="middle"
                      fontSize="8"
                      fill="rgba(255,255,255,0.55)"
                      fontFamily="monospace"
                    >
                      B{i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
