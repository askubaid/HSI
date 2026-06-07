# HSI React Viewer

A browser-based React application for rendering, exploring, and analyzing Hyperspectral Imaging (HSI) data. This is a semester project which I completed at the Institure of Space Technolog Islamabad under the supervision of Dr. Khurram Khushid.

---

## Application Layout

The application is divided into two main tabs that appear once an image is loaded:

- **ABCDE Tab (Spectral Analysis & Clustering):** Contains the full hyperspectral analysis workflow — band viewing, spectral signature extraction, foreground selection, and raw-band K-Means clustering.

- **FG Tab (Principal Component Analysis):** Contains the PCA workflow — dimensionality reduction, interactive component selection, foreground selection on PCA space, and K-Means clustering on principal components for separating inks.

---

## 1. Reading the HSI Image

The application supports reading raw Hyperspectral Image data in the standard **ENVI format** (a combination of a `.hdr` header file and a `.raw` binary file).

When a user uploads these files via the `ImageUpload` component, the heavy parsing logic is offloaded to a background Web Worker (`hsiParserWorker.js`) to keep the UI responsive:

1. **Metadata Parsing:** The `.hdr` text file is parsed to extract key metadata properties such as `samples` (width), `lines` (height), `bands` (depth), `data type` (e.g., float32, int16), and `byte order` (little vs. big endian).

2. **Binary Reading:** The corresponding `.raw` file is read into a Javascript `ArrayBuffer`. Using a `DataView`, the worker extracts the binary data pixel-by-pixel according to the metadata. 

3. **BSQ Storage:** The parsed values are stored in a flat, 1-dimensional JavaScript array named `rawBands` using the Band Sequential (BSQ) interleaving format. This means all the pixels for Band 1 are stored first, followed by all pixels for Band 2, and so on.

4. **Sentinel Handling:** ENVI files often encode "no-data" background pixels with a large sentinel constant (e.g., $-4.24 \times 10^{32}$). The application filters these out at every stage by rejecting any value with $|v| \geq 10^{30}$.

---

## 2. Generating Grayscale Band Images

Once the raw data is loaded, the application must translate abstract numeric values (which could represent reflectance, radiance, or other physical quantities) into visible pixels between 0 (black) and 255 (white). 

This computation is offloaded to a Web Worker (`bandRenderWorker.js`) which uses a **2nd and 98th Percentile Contrast Stretching** algorithm. For every band sequentially:

1. **Filtering:** We collect all finite, non-sentinel values from the raw data.
2. **Percentile Calculation:** We sort the data and extract the values at the 2nd percentile (`low`) and the 98th percentile (`high`).
3. **Clipping:** Any raw values below `low` are clamped to `low`. Any values above `high` are clamped to `high`. 
4. **Scaling:** The clipped values are mapped linearly into the 0-255 RGB range using the formula:
   ```javascript
   scaled_pixel = 255.0 * (clipped - low) / (high - low)
   ```
5. **Rendering:** The normalized RGB arrays are transferred back to the main thread, pushed into an offscreen HTML `<canvas>`, and generated into a base64 `.png` data URL. This asynchronous generation ensures the UI doesn't freeze while plotting 150+ hyperspectral bands.

---

## 3. Extracting and Plotting the Spectral Signature

When the user hovers over the image, a selection box (the "hoverbox") appears. Both the width (columns) and the height (rows) of this hoverbox can be adjusted dynamically via the UI sliders.

When the user clicks a pixel:
1. **Defining the Spatial Area:** The system takes the $(x, y)$ coordinate of the click and builds a bounding box centered on that point, constrained by the selected `selectionWidth` and `selectionHeight`.
2. **Averaging the Spectrum:** For every band (from $0$ to $TotalBands - 1$), the algorithm loops over all valid pixels *inside* the bounding box and calculates their mathematical average.
3. **Graphing:** The resulting array of averages is passed to the `SpectralChart` component (built with Recharts) to plot the signature.

### Graph Axes
* **X-Axis:** The Band Number (e.g., 1, 2, 3... up to the total number of bands).
* **Y-Axis:** The Intensity. This is the raw mathematical average of the sensor values (e.g., reflectance) within the selected area for that specific band, exactly as they were read from the `.raw` file before any visual scaling or contrast stretching was applied.

---

## 4. Foreground Selection

To isolate the "ink" or text from the underlying paper/background, the system uses a 1D K-Means clustering approach on a single, high-contrast band chosen by the user.

1. **Contrast Stretching:** The active band is normalized to a `[0, 255]` scale using the 2nd-to-98th percentile stretching method.
2. **1D K-Means:** The algorithm applies 1D K-Means (K=3) to cluster the normalized pixels into Darkest, Mid-tone, and Brightest groups.
3. **User Selection:** The UI presents a legend allowing the user to explicitly toggle which clusters constitute the "foreground". This is crucial because raw spectral intensity can vary wildly, and giving the user visual control prevents the algorithm from guessing wrong.
4. **Bypass:** A "Cluster All Pixels" button is also provided to bypass this step and treat the entire image as foreground.

---

## 5. Ink Clustering (Multi-band K-Means)

Once the foreground mask is established, the application analyzes the hyperspectral cube to separate the ink into distinct classes (up to K=10) based on material/chemical composition. This is executed in a background Web Worker (`kmeansWorker.js`) to keep the UI responsive.

1. **L2 Normalization (Pixel-wise):** 
   Before clustering, the spectral vector for each foreground pixel is normalized to unit length using the **L2 Norm** (dividing the pixel vector by its magnitude). 
   This ensures that K-Means clusters the pixels based on the *shape* of their spectral signature (e.g., red ink vs. blue ink) rather than their *intensity* (e.g., lightly pressed ink vs. heavily pressed ink).
2. **Clustering:** The normalized spectral vectors are fed into the `ml-kmeans` library using the K-Means++ initialization strategy.
3. **Heatmap Rendering:** The resulting cluster assignments are returned to the main thread. The `KMeansHeatmap` component alpha-blends distinct, high-contrast cluster colors (e.g., Midnight Blue, Crimson Red, Kelly Green) over the original grayscale image.
4. **Display Toggles:** Users can independently toggle the visibility of specific ink clusters, and switch the underlying grayscale image on or off (revealing a clean, paper-white `#f5f5f5` background) to meticulously verify the clustering accuracy.

---

## 6. Principal Component Analysis (PCA)

The PCA component offers a complementary view of the hyperspectral cube by reducing the full band space down to the most information-rich directions. This is handled by the `PCAAnalysis` component and the background `pcaWorker.js`.

### How it works
1. **Sentinel Filtering:** The worker scans the entire image to flag valid pixels, rigorously ignoring ENVI "no-data" or sentinel values (e.g. pixels with values $\geq 10^{30}$) so they do not corrupt the statistical modeling.
2. **Incremental Covariance:** Instead of allocating a massive $N \times B$ pixel matrix, the algorithm computes the per-band means and the $B \times B$ covariance matrix incrementally. This requires only $O(B^2)$ memory space, completely eliminating out-of-memory crashes on massive 250,000+ pixel images.
3. **Eigendecomposition:** The covariance matrix is fed into the `ml-matrix` library's `EigenvalueDecomposition` algorithm to solve for the top $K$ principal eigenvectors.
4. **Batched Projection:** The valid pixels are projected onto the top $K$ eigenvectors in batches of 20,000 pixels at a time using matrix multiplication, ensuring the main thread and garbage collector remain stable.
5. **Normalization & Display:** Each of the $K$ resulting scalar-field arrays is contrast-stretched (2nd–98th percentile computed strictly over valid data) and rendered as a 0–255 grayscale image. These are displayed side-by-side in a responsive CSS grid. Clicking a card selects it as the **Active Band**.

### Usage
The user selects the number of components (1–10) via a slider, then clicks the **Run PCA** button. The UI remains fully responsive while the worker runs, displaying live progress messages.

---

## 7. PCA-Based Ink Clustering (Metameric Ink Separation)

This workflow, available in the **FG Tab**, extends the PCA results with foreground selection and K-Means clustering performed entirely within the reduced PCA space. It is specifically designed to separate **metameric inks** — inks that appear visually identical but have different chemical compositions detectable in the near-infrared spectrum.

### Why raw-band clustering fails for metameric inks
Standard K-Means on all $N$ hyperspectral bands is dominated by **PC1 variance** (overall ink brightness/thickness). Since both inks have the same color, their intensity profiles are nearly identical, so the algorithm clusters "light ink" vs. "heavy ink" instead of "Ink A" vs. "Ink B". PCA-space clustering solves this by making the chemical variance explicit.

### Workflow
1. **Run PCA** to generate $K$ principal components.
2. **Click a PCA component card** (typically PC1) to set the Active Band for foreground selection.
3. **Foreground Selection** runs on the selected PCA band — the ink/paper separation is clearest here.
4. **Feature Selection Panel:** A checkbox list shows every generated PCA component (PC1, PC2, …). 
   - **Uncheck PC1** to strip out the intensity variance from the clustering.
   - K-Means will then cluster exclusively on the chemical information encoded in PC2, PC3, etc.
5. **L2 Normalization Toggle:** Optionally enable L2 normalization within the truncated PCA subspace to further normalize the chemical variance vectors before clustering.
6. **K-Means Clustering** runs only on the selected subset of principal components, producing a heatmap that distinguishes inks by material rather than by color or intensity.

### Recommended settings for metameric ink separation
| Setting | Value |
|---|---|
| PCA Components | 7-10 |
| Foreground Band | PC1,PC2, PC3 |
| Clustering Features | PC4 and onwards (uncheck PC1, PC2 and PC3) |
| L2 Normalization | Off (default) |
| K value | 10 |


### License
This is done as a part of academic coursework under the supervision of Dr. Khurram Khushid at IST, Islamabad. It is for educational purposes only. Its a gift from IST for the Machine Learning students.
