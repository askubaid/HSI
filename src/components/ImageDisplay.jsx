import React, { useState, useEffect, useMemo } from 'react';
import './ImageDisplay.css';

import { bandToDataUrl } from './utils/bandToDataUrl';
import { kmeans1D } from './utils/kmeans';
import BandViewer from './BandViewer';
import ControlsPanel from './ControlsPanel';
import SpectralChart from './SpectralChart';
import RawValuesPanel from './RawValuesPanel';
import Accordion from './Accordion';
import MetadataDisplay from './MetadataDisplay';
import SpectralChartControls from './SpectralChartControls';

export default function ImageDisplay({ imageData, activeBand, setActiveBand }) {
  const [debouncedBand, setDebouncedBand] = useState(0);
  const [clickedPixel, setClickedPixel] = useState(null);
  const [spectralData, setSpectralData] = useState(null);
  const [foregroundMask, setForegroundMask] = useState(null);
  const [selectionHeight, setSelectionHeight] = useState(32);
  const [lockedGraphs, setLockedGraphs] = useState([]);
  const [bandDataUrls, setBandDataUrls] = useState([]);
  const [isRenderingBands, setIsRenderingBands] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const handleLockGraph = (graphInfo) => {
    setLockedGraphs(prev => [...prev, graphInfo]);
  };

  const handleRemoveGraph = (id) => {
    setLockedGraphs(prev => prev.filter(g => g.id !== id));
  };

  const handleClearAllGraphs = () => {
    setLockedGraphs([]);
  };

  // Debounce the band index so the heavy raw data printout doesn't lag the slider
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedBand(activeBand);
    }, 150);
    return () => clearTimeout(handler);
  }, [activeBand]);

  // Render bands asynchronously using Web Worker
  useEffect(() => {
    if (!imageData || !imageData.rawBands) {
      setBandDataUrls([]);
      return;
    }

    setIsRenderingBands(true);
    setRenderProgress(0);
    setBandDataUrls(new Array(imageData.bands).fill(null));

    const worker = new Worker(new URL('./workers/bandRenderWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      if (e.data.type === 'band') {
        const { bandIndex, pixels } = e.data;

        // Convert raw pixels to data URL on the main thread
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        const imgData = new ImageData(pixels, imageData.width, imageData.height);
        ctx.putImageData(imgData, 0, 0);
        const url = canvas.toDataURL('image/png');

        setBandDataUrls(prev => {
          const next = [...prev];
          next[bandIndex] = url;
          return next;
        });

        setRenderProgress(prev => prev + 1);
      } else if (e.data.type === 'done') {
        setIsRenderingBands(false);
        worker.terminate();
      }
    };

    worker.postMessage({
      rawBands: imageData.rawBands,
      width: imageData.width,
      height: imageData.height,
      bands: imageData.bands
    });

    return () => worker.terminate();
  }, [imageData]);

  // Fallback for non-HSI (RGB) images
  if (!imageData.rawBands) {
    const renderRgbImage = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(imageData.width, imageData.height);
      imgData.data.set(new Uint8ClampedArray(imageData.pixels));
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL();
    };
    return (
      <div className="image-display">
        <div className="image-container">
          <img src={renderRgbImage()} alt="Uploaded RGB" className="display-image" />
          <div className="image-info">
            <p><strong>File:</strong> {imageData.fileName || 'Uploaded Image'}</p>
            <p><strong>Dimensions:</strong> {imageData.width}×{imageData.height}</p>
            <p><strong>Format:</strong> {imageData.format}</p>
          </div>
        </div>
      </div>
    );
  }

  const numBands = imageData.bands || 1;

  const extractSpectralSignature = (x, y) => {
    const { width, height, bands, rawBands } = imageData;
    const signature = [];

    // User-controlled rectangle centered on the clicked pixel (x, y)
    // Width is now locked to one third width
    const windowWidth = Math.floor(width / 3);
    const windowHeight = selectionHeight;
    const halfHeight = Math.floor(windowHeight / 2);
    const halfWidth = Math.floor(windowWidth / 2);

    const startX = Math.max(0, x - halfWidth);
    const endX = Math.min(width - 1, x + halfWidth);
    const startY = Math.max(0, y - halfHeight);
    const endY = Math.min(height - 1, y + halfHeight);

    // 1. Gather valid pixels in the active band for K-means clustering
    const activeBandOffset = activeBand * height * width;
    const validPixels = [];
    const validCoords = [];

    for (let wy = startY; wy <= endY; wy++) {
      for (let wx = startX; wx <= endX; wx++) {
        const val = rawBands[activeBandOffset + wy * width + wx];
        if (Number.isFinite(val) && Math.abs(val) < 1e30) {
          validPixels.push(val);
          validCoords.push({ wx, wy });
        }
      }
    }

    if (validPixels.length === 0) {
      setSpectralData(null);
      setForegroundMask(null);
      return;
    }

    // 2. Run k-means (k=2) on the active band to separate foreground (text) from background
    const { assignments, darkerClusterIndex } = kmeans1D(validPixels, 2, 20);

    const isForeground = new Uint8Array(validPixels.length);
    let foregroundCount = 0;
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] === darkerClusterIndex) {
        isForeground[i] = 1;
        foregroundCount++;
      }
    }

    if (foregroundCount === 0) {
      setSpectralData(null);
      setForegroundMask(null);
      return;
    }

    // 3. Generate Foreground Mask (Red Overlay)
    const maskWidth = endX - startX + 1;
    const maskHeight = endY - startY + 1;
    const maskImageData = new ImageData(maskWidth, maskHeight);

    for (let i = 0; i < validCoords.length; i++) {
      if (isForeground[i] === 1) {
        const { wx, wy } = validCoords[i];
        const localX = wx - startX;
        const localY = wy - startY;
        const idx = (localY * maskWidth + localX) * 4;
        maskImageData.data[idx] = 255;     // R
        maskImageData.data[idx + 1] = 0;   // G
        maskImageData.data[idx + 2] = 0;   // B
        maskImageData.data[idx + 3] = 128; // A (semi-transparent red)
      }
    }

    setForegroundMask({ imageData: maskImageData, x: startX, y: startY });

    // 4. Calculate Spectral Signature for Foreground Pixels Only
    for (let b = 0; b < bands; b++) {
      let sum = 0;
      let count = 0;
      const bandOffset = b * height * width;

      for (let i = 0; i < validCoords.length; i++) {
        if (isForeground[i] === 1) {
          const { wx, wy } = validCoords[i];
          const val = rawBands[bandOffset + wy * width + wx];
          if (Number.isFinite(val) && Math.abs(val) < 1e30) {
            sum += val;
            count++;
          }
        }
      }

      const avgVal = count > 0 ? sum / count : 0;
      signature.push({ band: b + 1, intensity: avgVal });
    }

    setClickedPixel({ x, y, width: windowWidth, height: windowHeight, fgCount: foregroundCount });
    setSpectralData(signature);
  };

  return (
    <div className="image-display hsi-display" style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: 'var(--bg-primary)' }}>

      {/* <Accordion title="Image Metadata" defaultExpanded={true}> */}
      <MetadataDisplay imageData={imageData} />
      {/* </Accordion> */}



      {/* Main content area: Single Image and Chart side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', gap: '24px', alignItems: 'center' }}>

        {/* Single Band Display */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, position: 'relative' }}>

          {/* Controls Panel */}
          <ControlsPanel
            activeBand={activeBand}
            numBands={numBands}
            onBandChange={setActiveBand}
            selectionHeight={selectionHeight}
            maxHeight={imageData.height}
            onHeightChange={setSelectionHeight}
          />

          {isRenderingBands && renderProgress < numBands && (
            <div style={{ position: 'absolute', top: 80, left: 10, background: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', color: '#fff', zIndex: 10, fontSize: '12px' }}>
              Rendering bands... {renderProgress} / {numBands}
            </div>
          )}
          {bandDataUrls[activeBand] ? (
            <BandViewer
              bandIndex={activeBand}
              dataUrl={bandDataUrls[activeBand]}
              onClickPixel={extractSpectralSignature}
              naturalWidth={imageData.width}
              naturalHeight={imageData.height}
              selectionHeight={selectionHeight}
              foregroundMask={foregroundMask}
            />
          ) : (
            <div style={{ width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', border: '1px dashed #444', borderRadius: '8px' }}>
              <div className="spinner" style={{ width: '30px', height: '30px', marginRight: '10px' }}></div>
              <span style={{ color: '#888' }}>Rendering band {activeBand + 1}...</span>
            </div>
          )}
        </div>

        {/* Spectral signature chart */}
        <div style={{ minWidth: 0 }}>
          <SpectralChartControls
            currentSpectralData={spectralData}
            lockedGraphs={lockedGraphs}
            onLockGraph={handleLockGraph}
            onRemoveGraph={handleRemoveGraph}
            onClearAll={handleClearAllGraphs}
          />
          <SpectralChart
            spectralData={spectralData}
            lockedGraphs={lockedGraphs}
            clickedPixel={clickedPixel}
          />
        </div>

      </div>

      {/* Image metadata
      <div className="image-info" style={{ marginTop: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>
        <p><strong>Dimensions:</strong> {imageData.width}×{imageData.height} &nbsp;|&nbsp; <strong>Bands:</strong> {imageData.bands}</p>
      </div> */}

      {/* Debug: Print raw values of the current active band */}
      {/* <Accordion title={`Raw Values (Band ${debouncedBand + 1})`}>
        <RawValuesPanel imageData={imageData} debouncedBand={debouncedBand} />
      </Accordion> */}




    </div>
  );
}
