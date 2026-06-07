import { kmeans } from 'ml-kmeans';

self.onmessage = async (e) => {
  const { imageData, kValue, foregroundMask, fgCount, skipL2Normalization, selectedFeatures } = e.data;
  const { rawBands, width, height, bands } = imageData;
  const numPixels = width * height;
  
  // Determine which band indices to use as features.
  // If selectedFeatures is provided (and non-empty), use only those bands.
  // Otherwise fall back to all bands.
  const featureBands = (selectedFeatures && selectedFeatures.length > 0)
    ? selectedFeatures
    : Array.from({ length: bands }, (_, i) => i);
  const numFeatures = featureBands.length;
  
  try {
    if (fgCount === 0) {
       self.postMessage({ error: "No foreground pixels to cluster." });
       return;
    }
    
    if (numFeatures === 0) {
       self.postMessage({ error: "No features selected. Please select at least one PCA component." });
       return;
    }
    
    self.postMessage({ status: `Preparing ${numFeatures} feature(s) for ${fgCount} pixels...` });
    
    const fgIndices = new Uint32Array(fgCount); 
    let fCount = 0;
    for (let i = 0; i < numPixels; i++) {
      if (foregroundMask[i] === 1) {
        fgIndices[fCount++] = i;
      }
    }
    
    const dataForKmeans = new Array(fgCount);
    
    for (let i = 0; i < fgCount; i++) {
      const pixelIdx = fgIndices[i];
      
      // Extract only the selected feature bands
      const featureVec = new Array(numFeatures);
      for (let f = 0; f < numFeatures; f++) {
        const b = featureBands[f];
        const val = rawBands[b * numPixels + pixelIdx];
        featureVec[f] = (Number.isFinite(val) && Math.abs(val) < 1e30) ? val : 0;
      }
      
      if (skipL2Normalization) {
        dataForKmeans[i] = featureVec;
      } else {
        // L2 normalize over the selected features only
        let sumSq = 0;
        for (let f = 0; f < numFeatures; f++) sumSq += featureVec[f] * featureVec[f];
        const mag = Math.sqrt(sumSq);
        dataForKmeans[i] = mag > 0 ? featureVec.map(v => v / mag) : featureVec;
      }
      
      // Progress update
      if (i > 0 && i % 20000 === 0) {
        self.postMessage({ status: `${skipL2Normalization ? 'Processed' : 'Normalized'} ${i}/${fgCount} pixels...` });
      }
    }
    
    self.postMessage({ status: `Running K-Means (K=${kValue}) on ${numFeatures} PCA component(s)...` });
    
    // Run ml-kmeans
    const result = kmeans(dataForKmeans, kValue, { maxIterations: 50, initialization: 'kmeans++' });
    const clusters = result.clusters; // array of cluster indices
    
    self.postMessage({ status: 'Generating final assignments...' });
    
    // Construct the final assignment array for all pixels.
    // Background = -1, Inks = 0 to k-1
    const finalAssignments = new Int8Array(numPixels);
    finalAssignments.fill(-1); // background
    
    for (let i = 0; i < fgCount; i++) {
      finalAssignments[fgIndices[i]] = clusters[i];
    }
    
    self.postMessage({ success: true, assignments: finalAssignments });
  } catch (error) {
    self.postMessage({ error: error.message || 'An error occurred during clustering' });
  }
};
