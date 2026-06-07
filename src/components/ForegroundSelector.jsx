import React, { useState, useEffect, useRef } from 'react';
import './ForegroundSelector.css';
import { kmeans1D } from './utils/kmeans';
import Accordion from './Accordion';

const FG_COLORS = [
  [255, 50, 50],   // Cluster 1: Red (Darkest)
  [50, 255, 50],   // Cluster 2: Green (Mid)
  [50, 150, 255]   // Cluster 3: Blue (Brightest)
];

export default function ForegroundSelector({ imageData, activeBand, onProceed }) {
  const canvasRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [maskData, setMaskData] = useState(null);
  const [error, setError] = useState(null);
  const [visibleClusters, setVisibleClusters] = useState([true, false, false]);

  useEffect(() => {
    if (!imageData || !imageData.rawBands) return;
    
    setIsProcessing(true);
    setError(null);
    setMaskData(null);
    
    // Use timeout to allow UI to render the loading state
    const timer = setTimeout(() => {
      try {
        const { rawBands, width, height } = imageData;
        const numPixels = width * height;
        const validPixelMap = new Uint8Array(numPixels);
        const intensities = new Float32Array(numPixels);
        
        // 1. Extract intensities for activeBand
        let validCount = 0;
        for (let i = 0; i < numPixels; i++) {
          const val = rawBands[activeBand * numPixels + i];
          if (Number.isFinite(val) && Math.abs(val) < 1e35) {
            intensities[i] = val;
            validPixelMap[i] = 1;
            validCount++;
          } else {
            intensities[i] = NaN;
            validPixelMap[i] = 0;
          }
        }
        
        if (validCount === 0) {
          throw new Error("No valid pixels found in the active band.");
        }
        
        // 2. Compute grayscale first (contrast stretching)
        const validIntensities = [];
        const validIndices = [];
        for (let i = 0; i < numPixels; i++) {
          if (validPixelMap[i]) {
            validIntensities.push(intensities[i]);
            validIndices.push(i);
          }
        }
        
        validIntensities.sort((a, b) => a - b);
        let low = 0;
        let high = 255;
        if (validIntensities.length > 0) {
          const p2Index = Math.max(0, Math.floor(validIntensities.length * 0.02));
          const p98Index = Math.min(validIntensities.length - 1, Math.floor(validIntensities.length * 0.98));
          low = validIntensities[p2Index];
          high = validIntensities[p98Index];
          if (high === low) high = low + 1.0;
        }
        
        const grayscale = new Uint8Array(numPixels);
        const validGrayscales = []; // To store the 0-255 values for K-means
        
        for (let i = 0; i < numPixels; i++) {
          if (validPixelMap[i]) {
            const val = intensities[i];
            const clipped = Math.max(low, Math.min(high, val));
            let normalized = Math.round(255.0 * (clipped - low) / (high - low));
            const grayVal = Math.max(0, Math.min(255, normalized));
            grayscale[i] = grayVal;
            validGrayscales.push(grayVal);
          } else {
            grayscale[i] = 0;
          }
        }
        
        // 3. Run 1D K-means with K=3 on the GRAYSCALE values (0-255)
        const { assignments: bgAssignments } = kmeans1D(validGrayscales, 3, 20);
        
        // Calculate centroids to sort them by brightness (using grayscale values)
        const clusterSums = [0, 0, 0];
        const clusterCounts = [0, 0, 0];
        for (let i = 0; i < validGrayscales.length; i++) {
          const c = bgAssignments[i];
          clusterSums[c] += validGrayscales[i];
          clusterCounts[c]++;
        }
        
        const centroids = clusterSums.map((sum, i) => clusterCounts[i] ? sum / clusterCounts[i] : Infinity);
        const sortedIndices = centroids
          .map((val, idx) => ({ val, idx }))
          .sort((a, b) => a.val - b.val)
          .map(item => item.idx);
          
        const clusterMap = {};
        sortedIndices.forEach((origIdx, sortedIdx) => {
          clusterMap[origIdx] = sortedIdx;
        });
        
        // 4. Build assignments array
        const fullAssignments = new Int8Array(numPixels).fill(-1);
        for (let i = 0; i < validGrayscales.length; i++) {
          fullAssignments[validIndices[i]] = clusterMap[bgAssignments[i]];
        }
        
        setMaskData({ fullAssignments, grayscale, width, height, counts: clusterCounts });
        setVisibleClusters([true, false, false]); // Reset to darkest cluster
        setIsProcessing(false);
        
      } catch (err) {
        setError(err.message);
        setIsProcessing(false);
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [imageData, activeBand]);
  
  // Render the preview
  useEffect(() => {
    if (!maskData || !canvasRef.current) return;
    
    const { fullAssignments, grayscale, width, height } = maskData;
    const ctx = canvasRef.current.getContext('2d');
    const imgData = new ImageData(width, height);
    const data = imgData.data;
    
    for (let i = 0; i < fullAssignments.length; i++) {
      const idx = i * 4;
      const gray = grayscale[i];
      const clusterIdx = fullAssignments[i];
      
      const isVisible = clusterIdx !== -1 && visibleClusters[clusterIdx];
      
      if (isVisible) {
        // Overlay color
        const color = FG_COLORS[clusterIdx];
        data[idx] = Math.round(color[0] * 0.6 + gray * 0.4);
        data[idx + 1] = Math.round(color[1] * 0.6 + gray * 0.4);
        data[idx + 2] = Math.round(color[2] * 0.6 + gray * 0.4);
        data[idx + 3] = 255;
      } else {
        // Background
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  }, [maskData, visibleClusters]);
  
  const handleProceed = () => {
    if (!maskData) return;
    const { fullAssignments, grayscale, width, height } = maskData;
    const numPixels = width * height;
    const foregroundMask = new Uint8Array(numPixels);
    let fgCount = 0;
    for (let i = 0; i < numPixels; i++) {
      const clusterIdx = fullAssignments[i];
      if (clusterIdx !== -1 && visibleClusters[clusterIdx]) {
        foregroundMask[i] = 1;
        fgCount++;
      }
    }
    if (fgCount === 0) {
      alert('Please select at least one cluster to proceed.');
      return;
    }
    onProceed({ foregroundMask, grayscale, fgCount, width, height });
  };

  const handleClusterAll = () => {
    if (!imageData) return;
    const { rawBands, width, height } = imageData;
    const numPixels = width * height;
    
    // Build grayscale from active band for background rendering
    const { grayscale } = maskData || (() => {
      // fallback: build grayscale inline
      const g = new Uint8Array(numPixels);
      const bandOffset = 0;
      const vals = [];
      for (let i = 0; i < numPixels; i++) {
        const v = rawBands[bandOffset + i];
        if (Number.isFinite(v) && Math.abs(v) < 1e35) vals.push(v);
      }
      vals.sort((a, b) => a - b);
      const low = vals[Math.floor(vals.length * 0.02)] ?? 0;
      const high = vals[Math.floor(vals.length * 0.98)] ?? 255;
      const range = high === low ? 1 : high - low;
      for (let i = 0; i < numPixels; i++) {
        const v = rawBands[i];
        g[i] = Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(255 * (Math.max(low, Math.min(high, v)) - low) / range))) : 0;
      }
      return { grayscale: g };
    })();
    
    // All valid pixels become foreground
    const foregroundMask = new Uint8Array(numPixels);
    let fgCount = 0;
    for (let i = 0; i < numPixels; i++) {
      const val = rawBands[i]; // band 0 offset just for validity check
      if (Number.isFinite(val) && Math.abs(val) < 1e35) {
        foregroundMask[i] = 1;
        fgCount++;
      }
    }
    
    onProceed({ foregroundMask, grayscale, fgCount, width, height });
  };

  const toggleCluster = (index) => {
    setVisibleClusters(prev => {
      const newVisible = [...prev];
      newVisible[index] = !newVisible[index];
      return newVisible;
    });
  };
  
  return (
    <div className="foreground-selector-container">
      <Accordion title="Step 1: Foreground Selection Preview" defaultExpanded={true}>
        <div className="selector-content">
          <p className="description">
            Review the foreground mask. Ink pixels are highlighted in red.
            Change the Active Band in the slider above to improve contrast if needed.
          </p>
          
          {isProcessing && (
            <div className="processing-overlay">
              <div className="spinner"></div>
              <p>Extracting foreground...</p>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
            </div>
          )}
          
          <div className="canvas-wrapper">
            <canvas 
              ref={canvasRef}
              width={maskData ? maskData.width : 0}
              height={maskData ? maskData.height : 0}
              className={`preview-canvas ${isProcessing ? 'blur' : ''}`}
            />
          </div>
          
          <div className="legend-container" style={{ width: '100%', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#e0e0e0' }}>Select Foreground Clusters (Click to toggle)</h4>
            <div className="legend-items" style={{ display: 'flex', gap: '12px', userSelect: 'none' }}>
              {[
                { name: 'Cluster 1 (Darkest)', color: FG_COLORS[0] },
                { name: 'Cluster 2 (Mid-tone)', color: FG_COLORS[1] },
                { name: 'Cluster 3 (Brightest)', color: FG_COLORS[2] }
              ].map((c, i) => (
                <div 
                  key={i} 
                  className="legend-item"
                  onClick={() => toggleCluster(i)}
                  style={{ 
                    cursor: 'pointer', 
                    opacity: visibleClusters[i] ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: visibleClusters[i] ? 'rgba(255,255,255,0.05)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span 
                    className="color-swatch" 
                    style={{ 
                      backgroundColor: `rgba(${c.color[0]}, ${c.color[1]}, ${c.color[2]}, 1)`,
                      width: '16px', height: '16px', display: 'inline-block', borderRadius: '4px'
                    }}
                  ></span>
                  <span style={{ color: '#ccc', fontSize: '0.9rem' }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="action-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button
              className="proceed-button"
              style={{ background: '#555' }}
              onClick={handleClusterAll}
              disabled={!imageData}
              title="Run K-Means on all valid pixels in the image"
            >
              Cluster All Pixels
            </button>
            <button 
              className="proceed-button" 
              onClick={handleProceed}
              disabled={!maskData || isProcessing}
            >
              Proceed with Selected Clusters →
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
}
