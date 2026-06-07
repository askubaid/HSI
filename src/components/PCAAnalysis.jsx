import React, { useState, useRef, useEffect } from 'react';
import './PCAAnalysis.css';

export default function PCAAnalysis({ imageData, activeBand, onSelectBand, onPCAComplete }) {
  const [numComponents, setNumComponents] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [componentImages, setComponentImages] = useState([]); // array of data URLs
  const workerRef = useRef(null);

  // Terminate worker on unmount or imageData change
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [imageData]);

  const handleRunPCA = () => {
    if (!imageData || !imageData.rawBands) return;

    // Terminate any existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setIsRunning(true);
    setError(null);
    setComponentImages([]);
    setStatus('Starting PCA worker...');

    const worker = new Worker(
      new URL('./workers/pcaWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, status: s, componentPixels, componentArrays, width, height, numComponents: K, error: err } = e.data;

      if (type === 'progress') {
        setStatus(s);
      } else if (type === 'error') {
        setError(err);
        setIsRunning(false);
        worker.terminate();
        workerRef.current = null;
      } else if (type === 'success') {
        setStatus('Done!');
        setIsRunning(false);
        worker.terminate();
        workerRef.current = null;

        // Construct pcaImageData
        if (onPCAComplete && componentArrays) {
          const totalPixels = width * height;
          const pcaRawBands = new Float32Array(totalPixels * K);
          for (let k = 0; k < K; k++) {
            pcaRawBands.set(componentArrays[k], k * totalPixels);
          }
          
          const pcaImageData = {
            width,
            height,
            bands: K,
            rawBands: pcaRawBands,
            format: 'Float32 (PCA)'
          };
          onPCAComplete(pcaImageData);
        }

        // Convert each Uint8ClampedArray to a data URL via an offscreen canvas
        const urls = componentPixels.map((rgba) => {
          const offscreen = document.createElement('canvas');
          offscreen.width = width;
          offscreen.height = height;
          const ctx = offscreen.getContext('2d');
          const imgData = new ImageData(rgba, width, height);
          ctx.putImageData(imgData, 0, 0);
          return offscreen.toDataURL('image/png');
        });
        setComponentImages(urls);
      }
    };

    worker.onerror = (err) => {
      setError(`Worker error: ${err.message}`);
      setIsRunning(false);
      workerRef.current = null;
    };

    worker.postMessage({
      rawBands: imageData.rawBands,
      width: imageData.width,
      height: imageData.height,
      bands: imageData.bands,
      numComponents
    });
  };

  return (
    <div className="pca-container">
      <div className="pca-header">
        <h3>Principal Component Analysis (PCA)</h3>
      </div>

      <div className="pca-controls">
        <label htmlFor="pca-slider">
          Number of Components: <strong>{numComponents}</strong>
        </label>
        <input
          id="pca-slider"
          type="range"
          min={1}
          max={10}
          value={numComponents}
          onChange={(e) => setNumComponents(parseInt(e.target.value))}
          disabled={isRunning}
        />
        <button
          className="pca-run-btn"
          onClick={handleRunPCA}
          disabled={isRunning || !imageData}
        >
          {isRunning ? 'Running...' : 'Run PCA'}
        </button>
      </div>

      {error && (
        <div className="pca-error">⚠ {error}</div>
      )}

      {isRunning && (
        <div className="pca-spinner-overlay">
          <div className="pca-spinner" />
          <span>{status}</span>
        </div>
      )}

      {!isRunning && componentImages.length > 0 && (
        <div className="pca-grid">
          {componentImages.map((url, i) => (
            <div 
              className="pca-component-card" 
              key={i}
              onClick={() => onSelectBand && onSelectBand(i)}
              style={{
                cursor: 'pointer',
                border: activeBand === i ? '2px solid #4CAF50' : '1px solid #444',
                boxShadow: activeBand === i ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <img
                src={url}
                alt={`Principal Component ${i + 1}`}
                style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }}
              />
              <div className="pca-component-label">
                Principal Component {i + 1}
                {activeBand === i && <span style={{ color: '#4CAF50', marginLeft: '5px', fontWeight: 'bold' }}>(Active)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
