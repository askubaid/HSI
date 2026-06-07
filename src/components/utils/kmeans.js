/**
 * 1D K-means clustering for foreground/background separation.
 * 
 * @param {Array<number>|Float32Array} data - Flat array of 1D pixel intensities.
 * @param {number} k - Number of clusters (e.g. 3)
 * @param {number} maxIterations - Maximum iterations.
 * @returns {object} { assignments: Array<number>, darkerClusterIndex: number }
 */
export function kmeans1D(data, k = 3, maxIterations = 20) {
  if (!data || data.length === 0) return { assignments: [], darkerClusterIndex: 0 };
  if (k < 1) k = 1;
  
  // Find min and max for initial centroids
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  if (min === max) {
    // All values are the same
    return { assignments: new Array(data.length).fill(0), darkerClusterIndex: 0 };
  }
  
  // Initialize centroids evenly spaced between min and max
  const centroids = new Float64Array(k);
  if (k === 1) {
    centroids[0] = (min + max) / 2;
  } else {
    for (let i = 0; i < k; i++) {
      centroids[i] = min + (i / (k - 1)) * (max - min);
    }
  }
  
  const assignments = new Uint8Array(data.length);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const sums = new Float64Array(k);
    const counts = new Uint32Array(k);
    
    let changed = false;
    
    // Assign points to nearest centroid
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      
      let bestCluster = 0;
      let minDistance = Math.abs(val - centroids[0]);
      
      for (let c = 1; c < k; c++) {
        const dist = Math.abs(val - centroids[c]);
        if (dist < minDistance) {
          minDistance = dist;
          bestCluster = c;
        }
      }
      
      if (assignments[i] !== bestCluster) {
        changed = true;
        assignments[i] = bestCluster;
      }
      
      sums[bestCluster] += val;
      counts[bestCluster]++;
    }
    
    if (!changed && iter > 0) break;
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = sums[c] / counts[c];
      }
    }
  }
  
  // Find the index of the cluster with the minimum centroid value (darkest)
  let darkerClusterIndex = 0;
  let minCentroid = centroids[0];
  for (let c = 1; c < k; c++) {
    if (centroids[c] < minCentroid) {
      minCentroid = centroids[c];
      darkerClusterIndex = c;
    }
  }
  
  return { assignments: Array.from(assignments), darkerClusterIndex };
}
