/**
 * ControlsPanel — renders the Band slider alongside the Selection Height and Width sliders.
 *
 * Props:
 *   activeBand       {number}   Current zero-based band index
 *   numBands         {number}   Total number of bands
 *   onBandChange     {function} Called with new band index (number)
 *   selectionHeight  {number}   Current selection height in image rows
 *   selectionWidth   {number}   Current selection width in image columns
 *   maxHeight        {number}   Maximum allowed selection height (image height)
 *   maxWidth         {number}   Maximum allowed selection width (image width)
 *   onHeightChange   {function} Called with new height value (number)
 *   onWidthChange    {function} Called with new width value (number)
 */
export default function ControlsPanel({
  activeBand,
  numBands,
  onBandChange,
  selectionHeight,
  maxHeight,
  onHeightChange,
}) {
  return (
    <div
      className="controls"
      style={{
        width: '100%',
        marginBottom: '12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '24px',
        alignItems: 'end',
      }}
    >
      {/* Band Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#110101ff', fontSize: '15px' }}>
          <span>Band: <strong style={{ color: '#ee0909ff' }}>{activeBand + 1}</strong></span>
          <span>Total Bands: <strong style={{ color: '#f10808ff' }}>{numBands}</strong></span>
        </div>
        <input
          type="range"
          min="0"
          max={numBands - 1}
          value={activeBand}
          onChange={(e) => onBandChange(parseInt(e.target.value, 10))}
          style={{ width: '100%' }}
          className="band-slider"
        />
      </div>

      {/* Selection Size Sliders */}
      <div style={{ minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#ccc', fontSize: '13px' }}>
            <span>Selection Height:</span>
            <strong style={{ color: '#7c6fcd' }}>{selectionHeight} rows</strong>
          </div>
          <input
            type="range"
            min="1"
            max={maxHeight}
            value={selectionHeight}
            onChange={(e) => onHeightChange(parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
            className="band-slider"
          />
        </div>

      </div>
    </div>
  );
}
