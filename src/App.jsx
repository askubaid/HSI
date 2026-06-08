import { useState, useEffect } from 'react'
import './App.css'
import ImageUpload from './components/ImageUpload'
import ImageDisplay from './components/ImageDisplay'
import KMeansHeatmap from './components/KMeansHeatmap'
import ForegroundSelector from './components/ForegroundSelector'
import PCAAnalysis from './components/PCAAnalysis'
import istLogo from './IST-logo.png'
function App() {
  const [imageData, setImageData] = useState(null)
  const [kValue, setKValue] = useState(3)
  const [activeBand, setActiveBand] = useState(0)
  const [foregroundMaskData, setForegroundMaskData] = useState(null)
  const [activeTab, setActiveTab] = useState('ABCDE')

  // PCA specific state
  const [pcaImageData, setPcaImageData] = useState(null)
  const [pcaActiveBand, setPcaActiveBand] = useState(0)
  const [pcaForegroundMaskData, setPcaForegroundMaskData] = useState(null)
  const [pcaKValue, setPcaKValue] = useState(3)
  const [pcaSelectedFeatures, setPcaSelectedFeatures] = useState([]) // which PCA bands to cluster on
  const [pcaSkipL2, setPcaSkipL2] = useState(true) // default to skip L2 for PCA

  const handleImageLoad = (data) => {
    setImageData(data)
    setActiveBand(0)
    setForegroundMaskData(null)
    setActiveTab('ABCDE')

    // Reset PCA state
    setPcaImageData(null)
    setPcaActiveBand(0)
    setPcaForegroundMaskData(null)
    setPcaSelectedFeatures([])
    setPcaSkipL2(true)
  }

  const handleReset = () => {
    setImageData(null)
    setActiveBand(0)
    setForegroundMaskData(null)
    setActiveTab('ABCDE')

    // Reset PCA state
    setPcaImageData(null)
    setPcaActiveBand(0)
    setPcaForegroundMaskData(null)
    setPcaSelectedFeatures([])
    setPcaSkipL2(true)
  }

  // Reset clustering if active band changes
  useEffect(() => {
    setForegroundMaskData(null)
  }, [activeBand])

  // Reset PCA clustering if active PCA band changes
  useEffect(() => {
    setPcaForegroundMaskData(null)
  }, [pcaActiveBand])

  return (
    <div className="app">


      <main className="main-container">
        <section className="content">
          {!imageData ? (
            <ImageUpload onImageLoad={handleImageLoad} />
          ) : (
            <>
              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                <button
                  onClick={() => setActiveTab('ABCDE')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeTab === 'ABCDE' ? '#4CAF50' : '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'ABCDE' ? 'bold' : 'normal'
                  }}
                >
                  ABCDE (Spectral Analysis & Clustering)
                </button>
                <button
                  onClick={() => setActiveTab('FG')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: activeTab === 'FG' ? '#4CAF50' : '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'FG' ? 'bold' : 'normal'
                  }}
                >
                  FG (Principal Component Analysis)
                </button>
              </div>

              {activeTab === 'ABCDE' && (
                <>
                  <ImageDisplay
                    imageData={imageData}
                    activeBand={activeBand}
                    setActiveBand={setActiveBand}
                  />

                  {!foregroundMaskData ? (
                    <ForegroundSelector
                      imageData={imageData}
                      activeBand={activeBand}
                      onProceed={setForegroundMaskData}
                    />
                  ) : (
                    <>
                      <div className="k-means-controls" style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-panel, #2a2a2a)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#e0e0e0' }}>Step 2: Ink Clustering</h3>
                          <button
                            onClick={() => setForegroundMaskData(null)}
                            style={{ padding: '6px 12px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            ← Back to Selection
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <label htmlFor="k-slider" style={{ color: '#ccc' }}>Number of Inks (K): {kValue}</label>
                          <input
                            id="k-slider"
                            type="range"
                            min="2"
                            max="40"
                            value={kValue}
                            onChange={(e) => setKValue(parseInt(e.target.value))}
                            style={{ flex: 1, maxWidth: '300px' }}
                          />
                        </div>
                      </div>

                      <KMeansHeatmap
                        imageData={imageData}
                        kValue={kValue}
                        foregroundMaskData={foregroundMaskData}
                      />
                    </>
                  )}
                </>
              )}

              {activeTab === 'FG' && (
                <>
                  <PCAAnalysis
                    imageData={imageData}
                    activeBand={pcaActiveBand}
                    onSelectBand={setPcaActiveBand}
                    onPCAComplete={(pcaData) => {
                      setPcaImageData(pcaData)
                      setPcaForegroundMaskData(null)
                      // Default: select ALL components
                      setPcaSelectedFeatures(Array.from({ length: pcaData.bands }, (_, i) => i))
                    }}
                  />

                  {pcaImageData && (
                    <div style={{ marginTop: '40px', borderTop: '2px solid #444', paddingTop: '20px' }}>
                      <h3 style={{ color: '#e0e0e0', marginBottom: '16px' }}>PCA Band Analysis & Clustering</h3>

                      {!pcaForegroundMaskData ? (
                        <ForegroundSelector
                          imageData={pcaImageData}
                          activeBand={pcaActiveBand}
                          onProceed={setPcaForegroundMaskData}
                        />
                      ) : (
                        <>
                          <div className="k-means-controls" style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-panel, #2a2a2a)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#e0e0e0' }}>Step 2: PCA Ink Clustering</h3>
                              <button
                                onClick={() => setPcaForegroundMaskData(null)}
                                style={{ padding: '6px 12px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                ← Back to Selection
                              </button>
                            </div>

                            {/* PCA Feature Selector */}
                            <div style={{ marginBottom: '16px', padding: '12px', background: '#1e1e1e', borderRadius: '6px', border: '1px solid #555' }}>
                              <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#aaa' }}>
                                🔬 <strong style={{ color: '#e0e0e0' }}>Feature Selection:</strong> Uncheck <strong>PC1</strong> to remove intensity variance and cluster on chemical composition only.
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {Array.from({ length: pcaImageData.bands }, (_, i) => (
                                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: pcaSelectedFeatures.includes(i) ? '#4CAF50' : '#888', fontWeight: pcaSelectedFeatures.includes(i) ? 'bold' : 'normal', transition: 'color 0.2s' }}>
                                    <input
                                      type="checkbox"
                                      checked={pcaSelectedFeatures.includes(i)}
                                      onChange={(ev) => {
                                        setPcaSelectedFeatures(prev =>
                                          ev.target.checked
                                            ? [...prev, i].sort((a, b) => a - b)
                                            : prev.filter(x => x !== i)
                                        )
                                        setPcaForegroundMaskData(old => old) // re-run clustering
                                      }}
                                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    PC{i + 1}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* L2 Normalization Toggle */}
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ccc', fontSize: '0.9rem' }}>
                                <input
                                  type="checkbox"
                                  checked={!pcaSkipL2}
                                  onChange={(ev) => setPcaSkipL2(!ev.target.checked)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span>L2 Normalization</span>
                              </label>
                              <span style={{ color: '#666', fontSize: '0.8rem' }}>(normalizes each pixel vector to unit length before clustering)</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <label htmlFor="pca-k-slider" style={{ color: '#ccc' }}>Number of Inks (K): {pcaKValue}</label>
                              <input
                                id="pca-k-slider"
                                type="range"
                                min="2"
                                max="40"
                                value={pcaKValue}
                                onChange={(e) => setPcaKValue(parseInt(e.target.value))}
                                style={{ flex: 1, maxWidth: '300px' }}
                              />
                            </div>
                          </div>

                          <KMeansHeatmap
                            imageData={pcaImageData}
                            kValue={pcaKValue}
                            foregroundMaskData={pcaForegroundMaskData}
                            skipL2Normalization={pcaSkipL2}
                            selectedFeatures={pcaSelectedFeatures}
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer className='footer'>
            <div>
              <img className='ist-logo' width={"50px"} src={istLogo} alt="IST Logo" />
              <p>Course: Pattern Recognition</p>
              <p>Submitted to: Dr. Khurram Khurshid</p>
              <p>Developed By: Ubaid Ur Rehman</p>
              <p>Institute of Space Technology Islamabad Pakistan</p>
            </div>

          </footer>
        </section>

      </main>
    </div>
  )
}

export default App
