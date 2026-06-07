import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * SpectralChart — renders the spectral signature of the selected pixel area across bands.
 *
 * Props:
 *   spectralData  {array}   Data for the chart, e.g. [{ band: 1, intensity: 100 }, ...]
 *   clickedPixel  {object}  Contains information about the clicked pixel and extraction window
 */
export default function SpectralChart({ spectralData, lockedGraphs = [], clickedPixel }) {
  const mergedData = useMemo(() => {
    const baseData = spectralData || (lockedGraphs.length > 0 ? lockedGraphs[0].data : null);
    if (!baseData) return null;

    return baseData.map((point, index) => {
      const newObj = { band: point.band };
      if (spectralData) {
        newObj.Active = spectralData[index].intensity;
      }
      lockedGraphs.forEach(g => {
        if (g.data[index]) {
          newObj[g.id] = g.data[index].intensity;
        }
      });
      return newObj;
    });
  }, [spectralData, lockedGraphs]);

  if (!mergedData) {
    return (
      <div style={{ width: '100%', height: '390px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', borderRadius: '8px', border: '1px dashed #333', color: '#888' }}>
        Click on the image to extract a spectral signature
      </div>
    );
  }

  return (
    <div className="spectral-chart-container" style={{ width: '100%', padding: '20px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', boxSizing: 'border-box' }}>
      <h4 style={{ textAlign: 'center', marginBottom: '20px', color: '#e0e0e0', fontSize: '15px' }}>
        {clickedPixel && spectralData ? `Spectral Signature — ${clickedPixel.width}×${clickedPixel.height} Area near (X: ${clickedPixel.x}, Y: ${clickedPixel.y})` : 'Locked Spectral Signatures'}
      </h4>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={mergedData} margin={{ top: 5, right: 30, bottom: 30, left: 30 }}>
          <CartesianGrid stroke="#333" strokeDasharray="4 4" />
          <XAxis
            dataKey="band"
            label={{ value: 'Band Number', position: 'insideBottom', offset: -15, fill: '#aaa' }}
            tick={{ fill: '#aaa' }}
          />
          <YAxis
            label={{ value: 'Intensity', angle: -90, position: 'insideLeft', offset: 10, fill: '#aaa' }}
            tick={{ fill: '#aaa' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#222', border: '1px solid #555', color: '#eee' }}
            labelFormatter={(v) => `Band ${v}`}
          />
          {spectralData && (
            <Line type="monotone" name="Active Graph" dataKey="Active" stroke="#7c6fcd" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          )}
          {lockedGraphs.map(g => (
            <Line key={g.id} type="monotone" name={g.name} dataKey={g.id} stroke={g.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
