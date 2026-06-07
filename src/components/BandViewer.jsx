import React, { useState } from 'react';

/**
 * Renders a single HSI band image with an interactive hover-selection box.
 * The box is centered on the cursor vertically, and full width horizontally.
 * Clicking fires onClickPixel(x, y) with the image-space coordinates.
 */
export default function BandViewer({
  bandIndex,
  dataUrl,
  onClickPixel,
  naturalWidth,
  naturalHeight,
  selectionHeight,
  foregroundMask, // { imageData, x, y }
}) {
  const [hoverBox, setHoverBox] = useState(null);
  const overlayCanvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (foregroundMask && foregroundMask.imageData) {
      ctx.putImageData(foregroundMask.imageData, foregroundMask.x, foregroundMask.y);
    }
  }, [foregroundMask, naturalWidth, naturalHeight]);

  const getCoords = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = naturalWidth / rect.width;
    const scaleY = naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    return { x, y, rect, scaleX, scaleY };
  };

  const handleMouseMove = (e) => {
    const { rect, scaleX, scaleY } = getCoords(e);
    // Map image-space selection dimensions to CSS-space dimensions
    const cssWidth = (naturalWidth / 3) / scaleX; // one third width
    const cssHeight = selectionHeight / scaleY;
    // Center the box on the cursor vertically and horizontally
    const cssX = (e.clientX - rect.left) - cssWidth / 2;
    const cssY = (e.clientY - rect.top) - cssHeight / 2;
    setHoverBox({ cssX, cssY, cssWidth, cssHeight });
  };

  const handleMouseLeave = () => setHoverBox(null);

  const handleClick = (e) => {
    const { x, y } = getCoords(e);
    onClickPixel(x, y);
  };

  return (
    <div style={{
      backgroundColor: '#111',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      borderRadius: '8px',
      border: '1px solid #333',
    }}>
      <span style={{ color: '#aaa', fontSize: '13px', padding: '10px 0', fontWeight: 'bold' }}>
        Band {bandIndex + 1}
      </span>
      <div style={{ width: '100%', maxHeight: '65vh', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: naturalWidth, height: naturalHeight, flexShrink: 0 }}>
          <img
            src={dataUrl}
            alt={`Band ${bandIndex + 1}`}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ width: naturalWidth, height: naturalHeight, cursor: 'crosshair', display: 'block' }}
            draggable={false}
          />
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: naturalWidth,
              height: naturalHeight,
              pointerEvents: 'none',
            }}
          />
          {hoverBox && (
            <div style={{
              position: 'absolute',
              left: hoverBox.cssX,
              top: hoverBox.cssY,
              width: hoverBox.cssWidth,
              height: hoverBox.cssHeight,
              border: '2px solid rgba(0, 255, 0, 0.8)',
              backgroundColor: 'rgba(0, 255, 0, 0.2)',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }} />
          )}
        </div>
      </div>
    </div>
  );
}
