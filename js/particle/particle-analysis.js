/* ==========================================================================
   AQUA INSIGHT - PARTICLE COUNTER MAIN CONTROLLER
   Manages image uploads, real-time procedural preset generation, camera snap,
   slider listeners, canvas draw states, and data table binding.
   ========================================================================== */

let originalImage = null; // Can be Image or Canvas
let grayData = null;
let binaryData = null;
let imageWidth = 0;
let imageHeight = 0;
let particlesList = [];
let filteredParticles = [];
let zoomPan = null;
let distChart = null;
let scatterChart = null;
let cameraStream = null;
let aiMode = false;
let isEyedropperActive = false;

// Overlay Drawing Options
const overlayOptions = {
  numbers: true,
  contours: true,
  centroids: true
};

// Calibration scales
const calibration = {
  scalePixel: 100,
  scaleUnitValue: 100,
  unit: "px", // px, µm, mm
  factor: 1.0 // 1 px = factor unit
};

// Default Segmentation Settings
const settings = {
  autoThreshold: true,
  thresholdVal: 128,
  bgCorrection: true,
  edgeExclusion: false,
  minSize: 10,
  maxSize: 10000,
  minCirc: 0.0,
  fillHoles: false,
  channel: 'gray',
  erosionIterations: 0,
  useColorRegion: false,
  colorRegionTolerance: 20
};

document.addEventListener("DOMContentLoaded", () => {
  initWorkspace();
});

function initWorkspace() {
  // Initialize zoom pan controls
  zoomPan = new window.AquaZoomPan("analysis-canvas", redrawCanvas);
  
  // Setup Dropzone
  const dropzone = document.getElementById("image-dropzone");
  const fileInput = document.getElementById("image-upload-input");
  
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
    
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });
    
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }
  
  // Initialize Calibration Tip
  updateScaleCalibration();
  
  // Setup Eyedropper click on canvas
  const canvas = document.getElementById("analysis-canvas");
  if (canvas) {
    canvas.addEventListener("click", handleCanvasClick);
  }
  
  // Draw Initial Empty Canvas State
  redrawCanvas();
}

// 1. Tab Switching
window.switchInputTab = function(tabId, btn) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");
  
  // Stop camera if leaving camera tab
  if (tabId !== "tab-camera" && cameraStream) {
    stopCamera();
  }
};

// 2. Camera snap handling
window.startCamera = async function() {
  const video = document.getElementById("camera-stream");
  const placeholder = document.getElementById("camera-placeholder");
  
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    if (video) {
      video.srcObject = cameraStream;
      video.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    }
  } catch (err) {
    console.error("Gagal mengakses kamera: ", err);
    alert("Tidak dapat mengakses kamera: " + err.message);
  }
};

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById("camera-stream");
  const placeholder = document.getElementById("camera-placeholder");
  if (video) {
    video.style.display = "none";
    video.srcObject = null;
  }
  if (placeholder) placeholder.style.display = "flex";
}

window.captureSnapshot = function() {
  const video = document.getElementById("camera-stream");
  if (!cameraStream || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    alert("Kamera belum aktif atau belum siap.");
    return;
  }
  
  const snapCanvas = document.createElement("canvas");
  snapCanvas.width = video.videoWidth;
  snapCanvas.height = video.videoHeight;
  const sCtx = snapCanvas.getContext("2d");
  sCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
  
  originalImage = snapCanvas;
  imageWidth = snapCanvas.width;
  imageHeight = snapCanvas.height;
  
  stopCamera();
  
  // Switch back to file tab indicator for cleanliness
  const fileTabBtn = document.querySelector(".tab-btn");
  if (fileTabBtn) switchInputTab('tab-upload', fileTabBtn);
  
  // Set UI statuses
  document.getElementById("hud-status").textContent = `Kamera: ${imageWidth}x${imageHeight}`;
  
  // Run Analysis
  analyzeImage();
};

// 4. File selection
function handleFileSelect(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Silakan unggah file gambar yang valid.");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Use exact original image size as requested by user
      originalImage = img;
      imageWidth = img.width;
      imageHeight = img.height;
      
      document.getElementById("hud-status").textContent = `Berkas: ${file.name} (${imageWidth}x${imageHeight})`;
      
      // Analyze
      analyzeImage();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// 5. Image Core Analysis Orchestration
window.analyzeImage = function() {
  if (!originalImage) return;
  
  // Show spinner
  document.getElementById("canvas-loading-spinner").style.display = "flex";
  
  // Wait minor ticks for browser to render spinner
  setTimeout(() => {
    try {
      // Create offscreen analysis canvas
      const offCanvas = document.createElement("canvas");
      offCanvas.width = imageWidth;
      offCanvas.height = imageHeight;
      const oCtx = offCanvas.getContext("2d");
      oCtx.drawImage(originalImage, 0, 0, imageWidth, imageHeight);
      
      const imgData = oCtx.getImageData(0, 0, imageWidth, imageHeight);
      
      // 1. Thresholding or Color Segmentation
      let grayData, binaryData;
      if (settings.useColorRegion) {
        // Fast color region growing (bypasses erosion and thresholding steps)
        particlesList = window.AquaDetection.analyzeByColor(imgData, imageWidth, imageHeight, calibration.factor, calibration.unit, settings.colorRegionTolerance, settings.minSize, settings.maxSize);
      } else {
        if (settings.autoThreshold) {
          grayData = window.AquaDetection.toGrayscale(imgData, settings.channel);
          settings.thresholdVal = window.AquaDetection.computeOtsuThreshold(grayData);
          document.getElementById('manual-threshold').value = settings.thresholdVal;
          document.getElementById('manual-threshold-val').textContent = settings.thresholdVal;
          binaryData = window.AquaDetection.threshold(grayData, imageWidth, imageHeight, settings.thresholdVal, settings.bgCorrection);
        } else {
          grayData = window.AquaDetection.toGrayscale(imgData, settings.channel);
          binaryData = window.AquaDetection.threshold(grayData, imageWidth, imageHeight, settings.thresholdVal, settings.bgCorrection);
        }
        
        // 2. Morphological Erosion (Separate touching particles)
        if (settings.erosionIterations > 0) {
          binaryData = window.AquaDetection.erode(binaryData, imageWidth, imageHeight, settings.erosionIterations);
        }
        
        // 4. Custom Labeling, Contour, and profiling
        particlesList = window.AquaDetection.analyze(binaryData, imageWidth, imageHeight, calibration.factor, calibration.unit, imgData, settings.fillHoles);
      }
      
      // 5. Filter lists
      applyFilters();
      
      // Reset canvas Zoom on new file loading
      zoomPan.reset();
      
    } catch (err) {
      console.error(err);
      alert("Kesalahan pengolahan citra:\n" + err.stack);
    } finally {
      document.getElementById("canvas-loading-spinner").style.display = "none";
    }
  }, 50);
};

// 6. Filter particles list based on size & circularity sliders
function applyFilters() {
  filteredParticles = particlesList.filter(p => {
    // Edge exclusion check
    if (settings.edgeExclusion && p.touchesEdge) return false;
    
    // Area filters (using pixels for filter boundaries)
    if (p.areaPx < settings.minSize || p.areaPx > settings.maxSize) return false;
    
    // Circularity check
    if (p.circularity < settings.minCirc) return false;
    
    return true;
  });
  
  // Re-adjust indexes for display
  filteredParticles.forEach((p, idx) => {
    p.index = idx + 1;
  });
  
  // Render Summary metrics cards
  updateSummaryMetrics();
  
  // Bind Table
  bindTableData();
  
  // Draw Chart
  renderHistogramChart();
  renderScatterChart();
  
  // Redraw
  redrawCanvas();
}

// 7. Update Summary quantitative panels
function updateSummaryMetrics() {
  document.getElementById("summary-count").textContent = filteredParticles.length;
  
  // Area Coverage %
  const totalImageArea = imageWidth * imageHeight;
  const totalParticleAreaPx = filteredParticles.reduce((acc, p) => acc + p.areaPx, 0);
  const coveragePercent = totalImageArea === 0 ? 0 : (totalParticleAreaPx / totalImageArea) * 100;
  document.getElementById("summary-coverage").textContent = `${coveragePercent.toFixed(2)} %`;
  
  // Average size with selected unit
  const avgSize = filteredParticles.length === 0 ? 0 : filteredParticles.reduce((acc, p) => acc + p.area, 0) / filteredParticles.length;
  document.getElementById("summary-size-label").textContent = `Rata-rata Ukuran (${calibration.unit}²)`;
  document.getElementById("summary-avg-size").textContent = `${avgSize.toFixed(1)} ${calibration.unit}²`;
}

// 8. Rebuild Data table
function bindTableData() {
  const tbody = document.getElementById("particle-table-body");
  if (!tbody) return;
  
  if (filteredParticles.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Tidak ada partikel yang cocok dengan kriteria filter saat ini.</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = filteredParticles.map(p => {
    // Safe Fallbacks (Robust State Management)
    const cx = Math.round(p.centroid?.x || 0);
    const cy = Math.round(p.centroid?.y || 0);
    const area = (p.area || 0).toFixed(2);
    const perimeter = (p.perimeter || 0).toFixed(2);
    const w = ((p.bbox?.w || 0) * calibration.factor).toFixed(2);
    const h = ((p.bbox?.h || 0) * calibration.factor).toFixed(2);
    const circ = (p.circularity || 0).toFixed(3);
    const aspect = (p.aspectRatio || 0).toFixed(2);
    const solidity = p.cvFeatures?.solidity ?? '-';
    const contrast = p.cvFeatures?.texture?.contrast ?? '-';
    const r = p.rgb?.r ?? 0;
    const g = p.rgb?.g ?? 0;
    const b = p.rgb?.b ?? 0;
    const isEdge = p.touchesEdge ? 'Tepi' : 'Bebas';
    const edgeClass = p.touchesEdge ? 'edge-touch' : 'edge-free';
    
    return `
      <tr id="table-row-${p.index}" onmouseenter="highlightRowOnCanvas(${p.index}, true)" onmouseleave="highlightRowOnCanvas(${p.index}, false)">
        <td>${p.index}</td>
        <td>(${cx}, ${cy})</td>
        <td>${area}</td>
        <td>${perimeter}</td>
        <td>${w}</td>
        <td>${h}</td>
        <td>${circ}</td>
        <td>${aspect}</td>
        <td>${solidity}</td>
        <td>${contrast}</td>
        <td>
          <span class="color-badge">
            <span class="color-dot" style="background-color: rgb(${r}, ${g}, ${b});"></span>
            rgb(${r},${g},${b})
          </span>
        </td>
        <td>
          <span class="status-badge ${edgeClass}">${isEdge}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// Highlight single particle on canvas hover in table
let highlightedIndex = -1;
window.highlightRowOnCanvas = function(index, highlight) {
  highlightedIndex = highlight ? index : -1;
  redrawCanvas();
};

// 9. Size distribution chart using Chart.js
function renderHistogramChart() {
  const ctx = document.getElementById("particle-dist-chart");
  if (!ctx) return;
  
  // Reset existing chart
  if (distChart) {
    distChart.destroy();
  }
  
  if (filteredParticles.length === 0) return;
  
  // Build histogram bins safely (avoiding spread operator crash on >65k items)
  const sizes = filteredParticles.map(p => p.area);
  let min = sizes[0];
  let max = sizes[0];
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] < min) min = sizes[i];
    if (sizes[i] > max) max = sizes[i];
  }
  const numBins = 7;
  const binWidth = (max - min) / numBins || 1.0;
  
  const bins = [];
  const frequencies = new Array(numBins).fill(0);
  
  for (let i = 0; i < numBins; i++) {
    bins.push(min + i * binWidth);
  }
  
  sizes.forEach(sz => {
    let binIdx = Math.floor((sz - min) / binWidth);
    if (binIdx >= numBins) binIdx = numBins - 1;
    frequencies[binIdx]++;
  });
  
  // Use chart-utils helper
  distChart = window.AquaChart.createHistogram(
    ctx, 
    bins, 
    frequencies, 
    "Distribusi Ukuran Partikel", 
    `Luas (${calibration.unit}²)`, 
    "Fungsi Kerapatan"
  );
}

// 9.5 Scatter Plot Chart (Area vs Circularity)
function renderScatterChart() {
  const ctx = document.getElementById("particle-scatter-chart");
  if (!ctx) return;
  
  if (scatterChart) scatterChart.destroy();
  if (filteredParticles.length === 0) return;
  
  const dataPoints = filteredParticles.map(p => ({
    x: p.area,
    y: p.circularity,
    r: 5,
    bgCol: `rgba(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}, 0.7)`,
    borderCol: `rgb(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b})`,
    particleRef: p
  }));
  
  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Partikel',
        data: dataPoints,
        backgroundColor: dataPoints.map(d => d.bgCol),
        borderColor: dataPoints.map(d => d.borderCol),
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const p = context.raw.particleRef;
              return `ID: ${p.index} | Luas: ${p.area.toFixed(1)} | Circ: ${p.circularity.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: `Luas (${calibration.unit}²)`, color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          title: { display: true, text: 'Sirkularitas', color: '#9ca3af' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af' },
          min: 0, max: 1
        }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const p = dataPoints[idx].particleRef;
          highlightRowOnCanvas(p.index, true);
          const row = document.getElementById(`table-row-${p.index}`);
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  });
}

// 10. Canvas Drawing loop
function redrawCanvas() {
  const canvas = document.getElementById("analysis-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Set dimensions based on wrapper width or source image size
  const wrapper = canvas.parentElement;
  if (!originalImage) {
    canvas.width = wrapper.clientWidth;
    canvas.height = Math.max(350, wrapper.clientHeight);
    
    // Draw welcome guidelines
    ctx.fillStyle = "#040811";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "14px Outfit";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText("Seret atau pilih citra laboratorium untuk memulai analisis otomatis.", canvas.width/2, canvas.height/2);
    return;
  }
  
  // Set canvas size match original source image size to maintain high resolution processing
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  // Apply Zoom & Pan offsets
  zoomPan.applyTransform(ctx);
  
  // Draw raw image
  ctx.drawImage(originalImage, 0, 0, imageWidth, imageHeight);
  
  // Draw Overlays
  filteredParticles.forEach(p => {
    const isHovered = p.index === highlightedIndex;
    
    // Draw Contours (Outer + nested holes)
    if (overlayOptions.contours) {
      ctx.beginPath();
      // Outer
      p.contour.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      
      // Style contours
      ctx.strokeStyle = isHovered ? "#F43F5E" : "rgba(0, 242, 254, 0.75)";
      ctx.lineWidth = isHovered ? 4 : 2;
      ctx.stroke();
      
      // Draw holes contours in dark gray/white
      p.holes.forEach(hc => {
        ctx.beginPath();
        hc.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    
    // Draw Centroids
    if (overlayOptions.centroids) {
      ctx.beginPath();
      const cSize = 4;
      ctx.moveTo(p.centroid.x - cSize, p.centroid.y);
      ctx.lineTo(p.centroid.x + cSize, p.centroid.y);
      ctx.moveTo(p.centroid.x, p.centroid.y - cSize);
      ctx.lineTo(p.centroid.x, p.centroid.y + cSize);
      ctx.strokeStyle = isHovered ? "#F43F5E" : "#10B981";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    
    // Draw Index Numbers
    if (overlayOptions.numbers) {
      ctx.fillStyle = isHovered ? "#F43F5E" : "#00F2FE";
      ctx.font = "bold 10px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Draw background circle for text readability
      ctx.beginPath();
      ctx.arc(p.centroid.x, p.centroid.y - 12, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(7, 14, 27, 0.85)";
      ctx.fill();
      ctx.strokeStyle = isHovered ? "#F43F5E" : "rgba(0, 242, 254, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = isHovered ? "#F43F5E" : "#ffffff";
      ctx.fillText(p.index, p.centroid.x, p.centroid.y - 12);
    }
  });
  
  ctx.restore();
}

window.resetZoom = function() {
  if (zoomPan) zoomPan.reset();
};

// 11. Control switches hooks
window.toggleAutoThreshold = function() {
  const btn = document.getElementById("toggle-auto-threshold");
  const manualGroup = document.getElementById("manual-threshold-group");
  
  settings.autoThreshold = btn.classList.toggle("active");
  
  if (settings.autoThreshold) {
    if (manualGroup) manualGroup.style.display = "none";
  } else {
    if (manualGroup) manualGroup.style.display = "block";
  }
  analyzeImage();
};

window.setChannel = function(channelName, btnElement) {
  settings.channel = channelName;
  document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  if (originalImage) analyzeImage();
};

window.updateErosion = function(val) {
  document.getElementById('erosion-val').textContent = val;
  settings.erosionIterations = parseInt(val);
  if (originalImage) analyzeImage();
};

window.updateDetectionMethod = function(val) {
  settings.useColorRegion = (val === 'color_region');
  const binGroup = document.getElementById("binary-settings-group");
  const colorGroup = document.getElementById("color-settings-group");
  
  if (settings.useColorRegion) {
    if (binGroup) binGroup.style.display = 'none';
    if (colorGroup) colorGroup.style.display = 'block';
  } else {
    if (binGroup) binGroup.style.display = 'block';
    if (colorGroup) colorGroup.style.display = 'none';
  }
  if (originalImage) analyzeImage();
};

window.updateColorRegionTolerance = function(val) {
  document.getElementById("color-region-val").textContent = val;
  settings.colorRegionTolerance = parseInt(val);
  if (originalImage) analyzeImage();
};

window.updateManualThreshold = function(val) {
  document.getElementById("manual-threshold-val").textContent = val;
  settings.thresholdVal = parseInt(val);
  analyzeImage();
};

window.toggleBackgroundCorrection = function() {
  const btn = document.getElementById("toggle-bg-correction");
  settings.bgCorrection = btn.classList.toggle("active");
  analyzeImage();
};

window.toggleFillHoles = function() {
  const btn = document.getElementById("toggle-fill-holes");
  settings.fillHoles = btn.classList.toggle("active");
  analyzeImage();
};

window.toggleEyedropper = function() {
  const btn = document.getElementById("btn-eyedropper");
  isEyedropperActive = !isEyedropperActive;
  
  if (isEyedropperActive) {
    btn.classList.add("active");
    btn.style.color = "#00f2fe";
    document.getElementById("analysis-canvas").style.cursor = "crosshair";
  } else {
    btn.classList.remove("active");
    btn.style.color = "";
    document.getElementById("analysis-canvas").style.cursor = "default";
  }
};

function handleCanvasClick(e) {
  if (!originalImage) return;
  const canvas = document.getElementById("analysis-canvas");
  const rect = canvas.getBoundingClientRect();
  
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  
  if (zoomPan) {
    const pt = zoomPan.inverseTransform({x, y});
    x = pt.x;
    y = pt.y;
  }
  
  // Interactive Particle Selection
  if (!isEyedropperActive) {
    let clickedParticle = null;
    for (let i = filteredParticles.length - 1; i >= 0; i--) {
      const p = filteredParticles[i];
      if (x >= p.bbox.x && x <= p.bbox.x + p.bbox.w && y >= p.bbox.y && y <= p.bbox.y + p.bbox.h) {
         // Point in polygon verification
         const offCanvas = document.createElement("canvas");
         const oCtx = offCanvas.getContext("2d");
         oCtx.beginPath();
         p.contour.forEach((pt, idx) => {
           if (idx === 0) oCtx.moveTo(pt.x, pt.y);
           else oCtx.lineTo(pt.x, pt.y);
         });
         oCtx.closePath();
         if (oCtx.isPointInPath(x, y)) {
           clickedParticle = p;
           break;
         }
      }
    }
    
    if (clickedParticle) {
       highlightRowOnCanvas(clickedParticle.index, true);
       const row = document.getElementById(`table-row-${clickedParticle.index}`);
       if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
       highlightRowOnCanvas(-1, false);
    }
    return;
  }
  
  // Eyedropper routine
  const offCanvas = document.createElement("canvas");
  offCanvas.width = imageWidth;
  offCanvas.height = imageHeight;
  const oCtx = offCanvas.getContext("2d");
  oCtx.drawImage(originalImage, 0, 0, imageWidth, imageHeight);
  
  const px = oCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  
  // Convert to hex
  const r = px[0].toString(16).padStart(2, '0');
  const g = px[1].toString(16).padStart(2, '0');
  const b = px[2].toString(16).padStart(2, '0');
  const hex = `#${r}${g}${b}`;
  
  document.getElementById("bg-color-picker").value = hex;
  updateBgColor(hex);
  
  // Turn off eyedropper
  toggleEyedropper();
}

window.toggleEdgeExclusion = function() {
  const btn = document.getElementById("toggle-edge-exclusion");
  settings.edgeExclusion = btn.classList.toggle("active");
  applyFilters();
};

window.updateMinSizeFilter = function(val) {
  document.getElementById("min-size-val").textContent = `${val} px`;
  settings.minSize = parseInt(val);
  applyFilters();
};

window.updateMaxSizeFilter = function(val) {
  const valSpan = document.getElementById("max-size-val");
  if (parseInt(val) >= 500000) {
    valSpan.textContent = "Tanpa Batas";
    settings.maxSize = 100000000;
  } else {
    valSpan.textContent = `${val} px`;
    settings.maxSize = parseInt(val);
  }
  applyFilters();
};

window.updateMinCircFilter = function(val) {
  const ratio = parseFloat(val) / 100;
  document.getElementById("min-circ-val").textContent = ratio.toFixed(2);
  settings.minCirc = ratio;
  applyFilters();
};

// Scale conversions update
window.updateScaleCalibration = function() {
  const pVal = parseFloat(document.getElementById("scale-pixel").value) || 100;
  const uVal = parseFloat(document.getElementById("scale-unit-value").value) || 100;
  const unit = document.getElementById("scale-unit").value;
  
  calibration.scalePixel = pVal;
  calibration.scaleUnitValue = uVal;
  calibration.unit = unit;
  
  if (unit === "px") {
    calibration.factor = 1.0;
    document.getElementById("calibration-summary").textContent = "Rasio: 1 px = 1 px";
  } else {
    calibration.factor = uVal / pVal;
    document.getElementById("calibration-summary").textContent = `Rasio: 1 px = ${calibration.factor.toFixed(4)} ${unit}`;
  }
  
  // Re-run filter maps to trigger conversions
  if (originalImage) {
    // Remap sizes based on pixels
    filteredParticles.forEach(p => {
      p.area = p.areaPx * Math.pow(calibration.factor, 2);
      p.perimeter = p.perimeterPx * calibration.factor;
    });
    
    // Update headers of tables dynamically
    document.getElementById("th-area").innerHTML = `Luas (${calibration.unit}²) <i class="fa-solid fa-sort"></i>`;
    document.getElementById("th-perimeter").innerHTML = `Keliling (${calibration.unit}) <i class="fa-solid fa-sort"></i>`;
    
    updateSummaryMetrics();
    bindTableData();
    renderHistogramChart();
    renderScatterChart();
    redrawCanvas();
  }
};

window.toggleOverlayOption = function(option) {
  overlayOptions[option] = !overlayOptions[option];
  const btn = document.getElementById(`btn-overlay-${option}`);
  if (btn) {
    btn.classList.toggle("active", overlayOptions[option]);
  }
  redrawCanvas();
};

// AI Mode toggler
window.toggleAIMode = async function() {
  const btn = document.getElementById("btn-ai-mode");
  aiMode = btn.classList.toggle("active");
  
  if (!originalImage) {
    alert("Silakan unggah citra terlebih dahulu.");
    btn.classList.remove("active");
    aiMode = false;
    return;
  }
  
  if (aiMode) {
    document.getElementById("canvas-loading-spinner").style.display = "flex";
    
    try {
      const dummyAI = await window.AquaDetection.runAIInference("analysis-canvas", (msg) => {
        document.querySelector("#canvas-loading-spinner p").textContent = msg;
      });
      
      // Inject AI count mockup into results
      alert(`[Mode AI] Simulasi Model ONNX Segmentasi sukses!\nTerdeteksi ${dummyAI.length} target patologis/biologis spesifik.`);
      
    } catch (err) {
      alert("Gagal memuat Model AI: " + err.message);
    } finally {
      document.getElementById("canvas-loading-spinner").style.display = "none";
      document.querySelector("#canvas-loading-spinner p").textContent = "Memproses gambar...";
    }
  }
};

// 12. Search & Sort in Lembar Data table
window.filterTable = function(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll("#particle-table-body tr");
  rows.forEach(row => {
    if (row.cells.length < 2) return; // skip no data rows
    const indexCol = row.cells[0].textContent;
    if (q === "" || indexCol.includes(q)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
};

let sortDirection = false;
window.sortTable = function(colIdx) {
  sortDirection = !sortDirection;
  
  filteredParticles.sort((a, b) => {
    let valA, valB;
    switch(colIdx) {
      case 0: valA = a.index; valB = b.index; break;
      case 1: valA = a.centroid.x; valB = b.centroid.x; break;
      case 2: valA = a.area; valB = b.area; break;
      case 3: valA = a.perimeter; valB = b.perimeter; break;
      case 4: valA = a.circularity; valB = b.circularity; break;
      case 5: valA = a.aspectRatio; valB = b.aspectRatio; break;
      case 7: valA = a.touchesEdge ? 1 : 0; valB = b.touchesEdge ? 1 : 0; break;
      case 10: valA = a.bbox.w; valB = b.bbox.w; break;
      case 11: valA = a.bbox.h; valB = b.bbox.h; break;
      default: return 0;
    }
    
    return sortDirection ? valA - valB : valB - valA;
  });
  
  bindTableData();
};

// 13. Data Export functions
window.exportParticleExcel = function() {
  if (filteredParticles.length === 0) {
    alert("Tidak ada data partikel untuk diekspor.");
    return;
  }
  
  // Gather settings
  const fullSettings = {
    ...settings,
    imageWidth,
    imageHeight
  };
  
  window.AquaParticleExport.exportToExcel(filteredParticles, calibration, fullSettings, "aqua_insight_morfometri_partikel.xlsx");
};

window.exportParticlePNG = function() {
  if (!originalImage) {
    alert("Tidak ada gambar untuk diekspor.");
    return;
  }
  
  // Render high-res canvas composite (includes overlay) on a separate export canvas
  const expCanvas = document.createElement("canvas");
  expCanvas.width = imageWidth;
  expCanvas.height = imageHeight;
  const expCtx = expCanvas.getContext("2d");
  
  // Draw base image
  expCtx.drawImage(originalImage, 0, 0, imageWidth, imageHeight);
  
  // Draw overlays on top (without zoom pan offsets, direct pixel mapping!)
  filteredParticles.forEach(p => {
    if (overlayOptions.contours) {
      expCtx.beginPath();
      p.contour.forEach((pt, idx) => {
        if (idx === 0) expCtx.moveTo(pt.x, pt.y);
        else expCtx.lineTo(pt.x, pt.y);
      });
      expCtx.closePath();
      expCtx.strokeStyle = "rgba(0, 242, 254, 0.8)";
      expCtx.lineWidth = 2;
      expCtx.stroke();
      
      p.holes.forEach(hc => {
        expCtx.beginPath();
        hc.forEach((pt, idx) => {
          if (idx === 0) expCtx.moveTo(pt.x, pt.y);
          else expCtx.lineTo(pt.x, pt.y);
        });
        expCtx.closePath();
        expCtx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        expCtx.lineWidth = 1.5;
        expCtx.stroke();
      });
    }
    
    if (overlayOptions.centroids) {
      expCtx.beginPath();
      const cSize = 4;
      expCtx.moveTo(p.centroid.x - cSize, p.centroid.y);
      expCtx.lineTo(p.centroid.x + cSize, p.centroid.y);
      expCtx.moveTo(p.centroid.x, p.centroid.y - cSize);
      expCtx.lineTo(p.centroid.x, p.centroid.y + cSize);
      expCtx.strokeStyle = "#10B981";
      expCtx.lineWidth = 1.5;
      expCtx.stroke();
    }
    
    if (overlayOptions.numbers) {
      expCtx.fillStyle = "rgba(7, 14, 27, 0.85)";
      expCtx.beginPath();
      expCtx.arc(p.centroid.x, p.centroid.y - 12, 7, 0, Math.PI * 2);
      expCtx.fill();
      expCtx.strokeStyle = "rgba(0, 242, 254, 0.5)";
      expCtx.lineWidth = 1;
      expCtx.stroke();
      
      expCtx.fillStyle = "#ffffff";
      expCtx.font = "bold 10px Inter";
      expCtx.textAlign = "center";
      expCtx.textBaseline = "middle";
      expCtx.fillText(p.index, p.centroid.x, p.centroid.y - 12);
    }
  });
  
  // Download PNG
  const url = expCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `aqua_insight_particles_analyzed.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
