import { useState, useRef } from 'react'
import './ImageUpload.css'

export default function ImageUpload({ onImageLoad }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const [uploadStatus, setUploadStatus] = useState('')

  const parseHdrFile = (headerText) => {
    const metadata = {}
    const lines = headerText.split('\n')

    let currentKey = null;
    let currentValue = '';

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(';')) continue

      const match = trimmed.match(/^\s*([a-zA-Z0-9_ ]+)\s*=\s*(.+)/)
      if (match) {
        if (currentKey) {
          metadata[currentKey] = currentValue.trim();
        }
        currentKey = match[1].trim().toLowerCase()
        currentValue = match[2].trim()
      } else if (currentKey) {
        currentValue += ' ' + trimmed;
      }
    }

    if (currentKey) {
      metadata[currentKey] = currentValue.trim();
    }

    return metadata
  }

  const processHdrRaw = async (hdrFile, rawFile) => {
    try {
      setUploadStatus('Reading HDR metadata...');
      const hdrText = await hdrFile.text();
      const metadata = parseHdrFile(hdrText);

      setUploadStatus('Loading RAW file into memory...');
      const arrayBuffer = await rawFile.arrayBuffer();

      setUploadStatus('Starting HSI parsing worker...');
      const worker = new Worker(new URL('./workers/hsiParserWorker.js', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        const { type, status, data, error } = e.data;

        if (type === 'progress') {
          setUploadStatus(status);
        } else if (type === 'success') {
          setUploadStatus('HSI image loaded successfully');
          setTimeout(() => setUploadStatus(''), 3000);
          onImageLoad(data);
          worker.terminate();
        } else if (type === 'error') {
          setUploadStatus('Failed to parse HDR/RAW files: ' + error);
          console.error('Worker error:', error);
          worker.terminate();
        }
      };

      worker.onerror = (error) => {
        setUploadStatus('Worker failed to execute');
        console.error('Worker fatal error:', error);
        worker.terminate();
      };

      worker.postMessage({
        metadata,
        arrayBuffer,
        fileName: hdrFile.name.replace('.hdr', '')
      }, [arrayBuffer]); // Transfer the arrayBuffer to avoid memory duplication

    } catch (error) {
      setUploadStatus('Failed to process files: ' + error.message);
      console.error('HDR/RAW process error:', error);
    }
  }

  const processImage = (file) => {
    const reader = new FileReader()
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isJson = file.type === 'application/json' || extension === 'json'
    const isHdr = extension === 'hdr'

    reader.onload = async (e) => {
      if (isJson) {
        try {
          const text = e.target?.result
          const data = JSON.parse(text)
          setUploadStatus('Image loaded successfully')
          setTimeout(() => setUploadStatus(''), 3000)
          onImageLoad(data)
        } catch (error) {
          setUploadStatus('Failed to parse JSON file')
          console.error('JSON parse error:', error)
        }
        return
      }

      if (isHdr) {
        // For HDR files, we need to also get the RAW file
        setUploadStatus('HDR file detected. Please also select the corresponding .raw file.')
        // Store the HDR file temporarily in a data attribute
        fileInputRef.current?.setAttribute('data-hdr-file', JSON.stringify({
          name: file.name,
          content: e.target?.result
        }))
        return
      }

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)

        const processedData = {
          width: img.width,
          height: img.height,
          pixels: imageData?.data || [],
          format: 'rgb',
          fileName: file.name
        }
        setUploadStatus('Image loaded successfully')
        setTimeout(() => setUploadStatus(''), 3000)
        onImageLoad(processedData)
      }
      img.onerror = () => {
        setUploadStatus('Failed to load image file')
      }
      img.src = e.target?.result
    }

    if (isJson) {
      reader.readAsText(file)
    } else if (isHdr) {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const extension = file.name.split('.').pop()?.toLowerCase()

      // Check if it's a RAW file and we have an HDR file stored
      if (extension === 'raw') {
        const hdrDataStr = fileInputRef.current?.getAttribute('data-hdr-file')
        if (hdrDataStr) {
          const hdrData = JSON.parse(hdrDataStr)
          // Create File objects from stored data
          const hdrFile = new File([hdrData.content], hdrData.name, { type: 'text/plain' })
          processHdrRaw(hdrFile, file)
          fileInputRef.current?.removeAttribute('data-hdr-file')
          return
        } else {
          setUploadStatus('Please select the .hdr file first, then the .raw file')
          return
        }
      }

      processImage(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (extension === 'hdr') {
        processImage(file)
      } else if (extension === 'raw') {
        handleFileSelect({ target: { files: files } })
      } else {
        processImage(file)
      }
    }
  }

  return (
    <div className="image-upload">

      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h3>Upload HSI Image or Data</h3>
          <p>Drag and drop your image or JSON HSI data here</p>
          <p className="upload-hint">or click to select</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.png,.jpg,.jpeg,.hdr,.raw"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
      {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
      <div className="upload-info">
        <h4>Supported Formats:</h4>
        <ul>
          <li>HDR + RAW - ENVI HSI format (select .hdr first, then .raw)</li>
        </ul>
      </div>
    </div>
  )
}
