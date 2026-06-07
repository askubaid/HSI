import React, { useState, useEffect, useRef } from 'react';
import './KMeansHeatmap.css';
import Accordion from './Accordion';

const CLUSTER_COLORS = [
  [27, 27, 140, 255],    // 0: Midnight Blue
  [179, 0, 0, 255],      // 1: Crimson Red
  [0, 158, 0, 255],      // 2: Kelly Green
  [230, 0, 122, 255],    // 3: Bright Magenta
  [230, 159, 0, 255],    // 4: Golden Yellow
  [0, 166, 153, 255],    // 5: Electric Cyan
  [95, 25, 117, 255],    // 6: Royal Purple
  [130, 82, 39, 255],    // 7: Deep Brown
  [213, 94, 0, 255],     // 8: Burnt Orange
  [212, 18, 89, 255],    // 9: Hot Pink
];

export default function KMeansHeatmap({ imageData, kValue, foregroundMaskData, skipL2Normalization, selectedFeatures }) {
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const assignmentsRef = useRef(null);
  const grayscaleRef = useRef(null);
  
  const [isClustering, setIsClustering] = workerRef.current ? useState(true) : useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [visibleClusters, setVisibleClusters] = useState(Array(kValue).fill(true));
  const [showGrayscale, setShowGrayscale] = useState(true);
  
  useEffect(() => {
    setVisibleClusters(Array(kValue).fill(true));
  }, [kValue]);
  
  useEffect(() => {
    if (!imageData || !imageData.rawBands) return;
    
    setIsClustering(true);
    setStatus('Initializing worker...');
    setError(null);
    
    // Clear the canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, imageData.width, imageData.height);
    }
    
    // Terminate existing worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    // Create new worker
    const worker = new Worker(new URL('./workers/kmeansWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    
    worker.onmessage = (e) => {
      const { status: newStatus, error: workerError, success, assignments } = e.data;
      
      if (newStatus) {
        setStatus(newStatus);
      }
      
      if (workerError) {
        setError(workerError);
        setIsClustering(false);
      }
      
      if (success) {
        assignmentsRef.current = assignments;
        grayscaleRef.current = foregroundMaskData.grayscale;
        renderHeatmap();
        setIsClustering(false);
      }
    };
    
    // Post data to worker
    worker.postMessage({ 
      imageData, 
      kValue, 
      foregroundMask: foregroundMaskData.foregroundMask, 
      fgCount: foregroundMaskData.fgCount,
      skipL2Normalization,
      selectedFeatures
    });
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [imageData, kValue, foregroundMaskData, skipL2Normalization, selectedFeatures]);
  
  const renderHeatmap = () => {
    const assignments = assignmentsRef.current;
    const grayscale = grayscaleRef.current;
    const width = imageData ? imageData.width : 0;
    const height = imageData ? imageData.height : 0;
    
    if (!canvasRef.current || !assignments || !grayscale || width === 0) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const newImageData = new ImageData(width, height);
    const data = newImageData.data;
    
    for (let i = 0; i < assignments.length; i++) {
      const clusterIdx = assignments[i];
      const dataIdx = i * 4;
      const gray = grayscale[i];
      
      const isVisible = clusterIdx !== -1 && visibleClusters[clusterIdx];
      
      if (clusterIdx === -1 || !isVisible) {
        if (showGrayscale) {
          // Show underlying grayscale image
          data[dataIdx] = gray;
          data[dataIdx + 1] = gray;
          data[dataIdx + 2] = gray;
          data[dataIdx + 3] = 255;
        } else {
          // Transparent — checkerboard CSS shows through
          data[dataIdx] = 0;
          data[dataIdx + 1] = 0;
          data[dataIdx + 2] = 0;
          data[dataIdx + 3] = 0;
        }
      } else {
        // Ink Cluster - Alpha blend the cluster color with the grayscale image
        const color = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];
        const alpha = 0.6;
        const bg = showGrayscale ? gray : 0;
        data[dataIdx] = Math.round(color[0] * alpha + bg * (1 - alpha));
        data[dataIdx + 1] = Math.round(color[1] * alpha + bg * (1 - alpha));
        data[dataIdx + 2] = Math.round(color[2] * alpha + bg * (1 - alpha));
        data[dataIdx + 3] = 255;
      }
    }
    
    ctx.putImageData(newImageData, 0, 0);
  };
  
  useEffect(() => {
    if (!isClustering) {
      renderHeatmap();
    }
  }, [visibleClusters, showGrayscale]);
  
  const toggleCluster = (index) => {
    setVisibleClusters(prev => {
      const newVisible = [...prev];
      newVisible[index] = !newVisible[index];
      return newVisible;
    });
  };
  
  return (
    <div className="kmeans-heatmap-container">
      <Accordion title={`K-Means Ink Clustering (K=${kValue})`} defaultExpanded={true}>
        <div className="heatmap-content">
          
          {isClustering && (
            <div className="clustering-overlay">
              <div className="spinner"></div>
              <p>{status}</p>
            </div>
          )}
          
          {error && (
            <div className="clustering-error">
              <p>Error: {error}</p>
            </div>
          )}
          
          <div
            className="heatmap-canvas-wrapper"
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              background: showGrayscale
                ? '#111'
                : '#f5f5f5',
            }}
          >
            <canvas 
              ref={canvasRef}
              width={imageData ? imageData.width : 0}
              height={imageData ? imageData.height : 0}
              className={`heatmap-canvas ${isClustering ? 'blur' : ''}`}
            />
          </div>
          
          <div className="legend-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0 }}>Cluster Legend (Click to toggle)</h4>
              <button
                onClick={() => setShowGrayscale(prev => !prev)}
                style={{
                  padding: '4px 12px',
                  background: showGrayscale ? '#4a7c59' : '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'background 0.2s'
                }}
              >
                {showGrayscale ? '🖼 Grayscale ON' : '⬛ Grayscale OFF'}
              </button>
            </div>
            <div className="legend-items" style={{ userSelect: 'none' }}>
              {Array.from({ length: kValue }).map((_, i) => (
                <div 
                  key={i} 
                  className="legend-item"
                  onClick={() => toggleCluster(i)}
                  style={{ 
                    cursor: 'pointer', 
                    opacity: visibleClusters[i] ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: visibleClusters[i] ? 'rgba(255,255,255,0.05)' : 'transparent'
                  }}
                >
                  <span 
                    className="color-swatch" 
                    style={{ 
                      backgroundColor: `rgba(${CLUSTER_COLORS[i][0]}, ${CLUSTER_COLORS[i][1]}, ${CLUSTER_COLORS[i][2]}, 1)` 
                    }}
                  ></span>
                  <span>Cluster {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </Accordion>
    </div>
  );
}
