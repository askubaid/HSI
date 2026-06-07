import React, { useState, useEffect } from 'react';

export default function SpectralChartControls({ 
  currentSpectralData, 
  lockedGraphs, 
  onLockGraph, 
  onRemoveGraph, 
  onClearAll 
}) {
  const [graphName, setGraphName] = useState('');
  const [graphColor, setGraphColor] = useState('');

  // Update default name and color when the number of locked graphs changes
  useEffect(() => {
    setGraphName('Graph ' + (lockedGraphs.length + 1));
    setGraphColor('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'));
  }, [lockedGraphs.length]);

  const handleLock = () => {
    if (!currentSpectralData) return;
    onLockGraph({
      id: Date.now().toString(),
      name: graphName || 'Unnamed Graph',
      color: graphColor,
      data: currentSpectralData
    });
  };

  return (
    <div style={{ padding: '15px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '20px' }}>
      <h4 style={{ margin: '0 0 15px 0', color: '#e0e0e0', fontSize: '15px' }}>Spectral Graph Controls</h4>
      
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
        <input 
          type="text" 
          value={graphName} 
          onChange={(e) => setGraphName(e.target.value)}
          placeholder="Graph Name"
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#111', color: '#fff', flex: 1 }}
        />
        <input 
          type="color" 
          value={graphColor}
          onChange={(e) => setGraphColor(e.target.value)}
          title="Select Graph Color"
          style={{ width: '40px', height: '34px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
        />
        <button 
          onClick={handleLock}
          disabled={!currentSpectralData}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: currentSpectralData ? '#4caf50' : '#333', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: currentSpectralData ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          Lock Graph
        </button>
      </div>

      {lockedGraphs.length > 0 && (
        <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ color: '#aaa', fontSize: '13px' }}>Locked Graphs ({lockedGraphs.length})</strong>
            <button 
              onClick={onClearAll}
              style={{ padding: '4px 10px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Clear All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lockedGraphs.map(graph => (
              <div key={graph.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: '8px 12px', borderRadius: '4px', borderLeft: `4px solid ${graph.color}` }}>
                <span style={{ color: '#eee', fontSize: '14px' }}>{graph.name}</span>
                <button 
                  onClick={() => onRemoveGraph(graph.id)}
                  style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
                  title="Remove graph"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
