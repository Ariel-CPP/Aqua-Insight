/* =============================================================
   Fish Hematology Analyzer - Core JS Engine
   Mendukung deteksi sel darah ikan interaktif, indeks eritrosit,
   diferensiasi leukosit, dan diagnosis klinis.
   ============================================================= */

// ── State ──────────────────────────────────────────────────────
let originalImage = null;
let detectedCells = []; // Array of {x, y, r, type, area, circularity, color}
let selectedCellIndex = null;
let microscopeCanvas = null;
let ctx = null;
let activeTab = 'micro-tab';
let bloodType = 'fish'; // 'fish' or 'mammal'

// ── Reference Database (Teleost Reference Default) ─────────────
const DEFAULT_REF = {
  rbc: { min: 1.0, max: 3.0, unit: "10⁶ sel/µL", label: "Eritrosit (RBC)" },
  wbc: { min: 20000, max: 150000, unit: "sel/µL", label: "Leukosit (WBC)" },
  hb: { min: 5.0, max: 12.0, unit: "g/dL", label: "Hemoglobin" },
  ht: { min: 20.0, max: 45.0, unit: "%", label: "Hematokrit" },
  lym: { min: 60.0, max: 85.0, unit: "%", label: "Limfosit" },
  neu: { min: 5.0, max: 25.0, unit: "%", label: "Neutrofil" },
  mon: { min: 1.0, max: 5.0, unit: "%", label: "Monosit" },
  eos: { min: 0.0, max: 2.0, unit: "%", label: "Eosinofil" }
};

const MAMMAL_REF = {
  rbc: { min: 4.0, max: 6.0, unit: "10⁶ sel/µL", label: "Eritrosit (RBC)" },
  wbc: { min: 4000, max: 11000, unit: "sel/µL", label: "Leukosit (WBC)" },
  hb: { min: 12.0, max: 17.5, unit: "g/dL", label: "Hemoglobin" },
  ht: { min: 36.0, max: 50.0, unit: "%", label: "Hematokrit" },
  lym: { min: 20.0, max: 40.0, unit: "%", label: "Limfosit" },
  neu: { min: 40.0, max: 70.0, unit: "%", label: "Neutrofil" },
  mon: { min: 2.0, max: 8.0, unit: "%", label: "Monosit" },
  eos: { min: 1.0, max: 4.0, unit: "%", label: "Eosinofil" }
};

// ── Accordion & Tab Swapping ───────────────────────────────────
window.toggleAccordion = function() {
  const content = document.getElementById('accordion-content');
  const icon = document.getElementById('accordion-icon');
  if (content.style.display === 'none') {
    content.style.display = 'flex';
    icon.className = 'fa-solid fa-chevron-up';
  } else {
    content.style.display = 'none';
    icon.className = 'fa-solid fa-chevron-down';
  }
};

window.switchHemaTab = function(tabId, btn) {
  activeTab = tabId;
  document.querySelectorAll('.tab-pane').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  const targetPane = document.getElementById(tabId);
  if (targetPane) {
    targetPane.style.display = 'flex';
    targetPane.classList.add('active');
  }

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (tabId === 'micro-tab') {
    drawCanvas();
  }
};

// ── DOM Initializer ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  microscopeCanvas = document.getElementById('microscope-canvas');
  ctx = microscopeCanvas.getContext('2d');

  // Set up uploader drag and drop
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  // Canvas click to select cell
  microscopeCanvas.addEventListener('click', handleCanvasClick);
  // Canvas double click to add cell
  microscopeCanvas.addEventListener('dblclick', handleCanvasDblClick);
});

// ── Image Handling ─────────────────────────────────────────────
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Harap unggah berkas gambar usap darah mikroskopis.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      document.getElementById('canvas-placeholder').style.display = 'none';
      document.getElementById('clear-btn').disabled = false;
      
      // Auto run analysis
      processUploadedImage();
    };
    img.src = e.target.result;
  };
  reader.readAsText(file); // fallback triggers load, but we want DataURL:
  const readerData = new FileReader();
  readerData.onload = e => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      document.getElementById('canvas-placeholder').style.display = 'none';
      document.getElementById('clear-btn').disabled = false;
      
      // Auto run analysis
      processUploadedImage();
    };
    img.src = e.target.result;
  };
  readerData.readAsDataURL(file);
}

window.clearSmear = function() {
  originalImage = null;
  detectedCells = [];
  selectedCellIndex = null;
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);
  document.getElementById('canvas-placeholder').style.display = 'flex';
  document.getElementById('stats-bar').style.display = 'none';
  document.getElementById('selection-card').style.display = 'none';
  document.getElementById('clear-btn').disabled = true;
  document.getElementById('no-report-state').style.display = 'block';
  document.getElementById('report-content').style.display = 'none';
  document.getElementById('file-input').value = '';
};

// ── State Tambahan untuk Parameter Deteksi ─────────────────────
let detectionSettings = {
  method: 'rb-ratio',
  thresholdVal: 200,
  minSize: 40,
  maxSize: 1500
};

let customBgColor = { r: 240, g: 234, b: 242 }; // default pink-gray
let isEyedropperActive = false;

window.updateThresholdVal = function(val) {
  document.getElementById('detect-threshold-val').textContent = val;
  detectionSettings.thresholdVal = parseInt(val);
  debouncedProcess();
};

window.updateMinSizeVal = function(val) {
  document.getElementById('detect-min-size-val').textContent = val;
  detectionSettings.minSize = parseInt(val);
  debouncedProcess();
};

window.updateMaxSizeVal = function(val) {
  document.getElementById('detect-max-size-val').textContent = val;
  detectionSettings.maxSize = parseInt(val);
  debouncedProcess();
};

window.updateDetectionParams = function() {
  detectionSettings.method = document.getElementById('detect-method').value;
  const eyedropperGroup = document.getElementById('eyedropper-group');
  if (detectionSettings.method === 'custom-color') {
    eyedropperGroup.style.display = 'flex';
  } else {
    eyedropperGroup.style.display = 'none';
  }
  debouncedProcess();
};

window.changeBloodType = function() {
  const select = document.getElementById('blood-type-select');
  bloodType = select.value;

  const ref = bloodType === 'mammal' ? MAMMAL_REF : DEFAULT_REF;
  document.getElementById('ref-rbc-min').value = ref.rbc.min;
  document.getElementById('ref-rbc-max').value = ref.rbc.max;
  document.getElementById('ref-wbc-min').value = ref.wbc.min;
  document.getElementById('ref-wbc-max').value = ref.wbc.max;
  document.getElementById('ref-hb-min').value = ref.hb.min;
  document.getElementById('ref-hb-max').value = ref.hb.max;
  document.getElementById('ref-ht-min').value = ref.ht.min;
  document.getElementById('ref-ht-max').value = ref.ht.max;
  document.getElementById('ref-lym-min').value = ref.lym.min;
  document.getElementById('ref-lym-max').value = ref.lym.max;
  document.getElementById('ref-neu-min').value = ref.neu.min;
  document.getElementById('ref-neu-max').value = ref.neu.max;
  document.getElementById('ref-mon-min').value = ref.mon.min;
  document.getElementById('ref-mon-max').value = ref.mon.max;
  document.getElementById('ref-eos-min').value = ref.eos.min;
  document.getElementById('ref-eos-max').value = ref.eos.max;

  if (bloodType === 'mammal') {
    document.getElementById('hb-input').value = "14.5";
    document.getElementById('ht-input').value = "42.0";
  } else {
    document.getElementById('hb-input').value = "8.0";
    document.getElementById('ht-input').value = "30.0";
  }

  if (originalImage) {
    processUploadedImage();
  }
};

window.activateEyedropper = function() {
  isEyedropperActive = true;
  microscopeCanvas.style.cursor = 'crosshair';
  const btn = document.getElementById('eyedropper-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pilih di Kanvas...';
  btn.classList.add('active');
};

let debounceTimeout = null;
function debouncedProcess() {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (originalImage) {
      processUploadedImage();
    }
  }, 150);
}

// ── Process Uploaded Image (Real Computer Vision) ──────────────
function processUploadedImage() {
  if (!originalImage) return;

  // Set standard dimensions for processing
  microscopeCanvas.width = 650;
  microscopeCanvas.height = 450;

  if (originalImage === "DEMO") {
    drawSyntheticSmear();
  } else {
    ctx.drawImage(originalImage, 0, 0, microscopeCanvas.width, microscopeCanvas.height);
  }

  // Get pixel data
  const imgData = ctx.getImageData(0, 0, microscopeCanvas.width, microscopeCanvas.height);
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  // 1. Thresholding to create binary mask
  const binary = new Uint8Array(width * height);
  const threshold = detectionSettings.thresholdVal;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx+1];
    const b = data[idx+2];

    if (detectionSettings.method === 'grayscale') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      binary[i] = (gray < threshold) ? 1 : 0;
    } else if (detectionSettings.method === 'saturation') {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : ((max - min) / max) * 255;
      binary[i] = (sat > threshold) ? 1 : 0;
    } else if (detectionSettings.method === 'custom-color') {
      const dist = Math.sqrt(
        Math.pow(r - customBgColor.r, 2) + 
        Math.pow(g - customBgColor.g, 2) + 
        Math.pow(b - customBgColor.b, 2)
      );
      binary[i] = (dist > (threshold * 1.5)) ? 1 : 0;
    } else { // 'rb-ratio'
      // Green channel absorbs red (hemoglobin) and blue (nuclei) stained light strongly.
      // So cells appear dark in the green channel.
      binary[i] = (g < threshold) ? 1 : 0;
    }
  }

  // 2. Connected Component Labeling using BFS
  const visited = new Uint8Array(width * height);
  const components = [];
  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const startIdx = y * width + x;
      if (binary[startIdx] === 1 && visited[startIdx] === 0) {
        const pixels = [];
        const queue = [startIdx];
        visited[startIdx] = 1;
        let qHead = 0;

        while (qHead < queue.length) {
          const curr = queue[qHead++];
          pixels.push(curr);

          if (pixels.length > 5000) break; // Limit huge blobs

          const cx = curr % width;
          const cy = Math.floor(curr / width);

          for (let i = 0; i < 4; i++) {
            const nx = cx + dx[i];
            const ny = cy + dy[i];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (binary[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }

        if (pixels.length >= detectionSettings.minSize && pixels.length <= detectionSettings.maxSize) {
          components.push(pixels);
        }
      }
    }
  }

  // 3. Feature Extraction and Classification
  detectedCells = [];
  components.forEach((pixels, idx) => {
    let sumX = 0, sumY = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let rSum = 0, gSum = 0, bSum = 0;

    pixels.forEach(p => {
      const px = p % width;
      const py = Math.floor(p / width);
      sumX += px;
      sumY += py;

      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      const idx4 = p * 4;
      rSum += data[idx4];
      gSum += data[idx4+1];
      bSum += data[idx4+2];
    });

    const area = pixels.length;
    const cx = sumX / area;
    const cy = sumY / area;

    const avgR = rSum / area;
    const avgG = gSum / area;
    const avgB = bSum / area;

    // Calculate boundary and circularity
    let borderCount = 0;
    const pixelSet = new Set(pixels);
    pixels.forEach(p => {
      const px = p % width;
      const py = Math.floor(p / width);
      if (px === 0 || px === width - 1 || py === 0 || py === height - 1) {
        borderCount++;
      } else {
        if (!pixelSet.has(p - 1) || !pixelSet.has(p + 1) || !pixelSet.has(p - width) || !pixelSet.has(p + width)) {
          borderCount++;
        }
      }
    });

    const circularity = borderCount === 0 ? 0 : Math.min(1.0, (4 * Math.PI * area) / (borderCount * borderCount));
    const radius = Math.max(4, Math.round(Math.sqrt(area / Math.PI)));

    // Rule-based classification
    let type = 'RBC';
    let color = '#EF4444';

    // A. Thrombocytes are very small
    if (area < 65) {
      type = 'Thrombocyte';
      color = '#06B6D4';
    }
    // B. WBCs are larger and have deep purple/blue staining (lower overall brightness, relatively high blue/red ratio)
    else if (area > 220) {
      color = '#A855F7';
      // Subclassify WBCs
      if (circularity > 0.76 && area < 450) {
        type = 'Lymphocyte';
      } else if (area > 550 && circularity < 0.62) {
        type = 'Monocyte';
      } else if (avgR > avgB * 1.15) {
        type = 'Eosinophil'; // Stained pinkish-orange granules
      } else {
        type = 'Neutrophil'; // Default segment-lobed
      }
    }
    // C. RBCs are medium size
    else {
      type = 'RBC';
      color = '#EF4444';
    }

    detectedCells.push({
      x: cx,
      y: cy,
      r: radius,
      type: type,
      area: area,
      circularity: circularity.toFixed(2),
      color: color
    });
  });

  drawCanvas();
  updateMicroscopeStats();
}

// ── Synthetic Smear Slide Renderer (Real Stained Slide Look) ─────
function drawSyntheticSmear() {
  if (bloodType === 'mammal') {
    // 1. Draw light pink-gray background (simulating a stained smear field of view)
    ctx.fillStyle = '#f5f0f7';
    ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);
    
    // Draw some subtle vignette / background shading
    const bgGrad = ctx.createRadialGradient(
      microscopeCanvas.width/2, microscopeCanvas.height/2, 100,
      microscopeCanvas.width/2, microscopeCanvas.height/2, 400
    );
    bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    bgGrad.addColorStop(1, 'rgba(225, 210, 230, 0.45)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);

    // 2. Draw Mammalian RBCs - circular, pink with lighter center
    const rbcCount = 80;
    for (let i = 0; i < rbcCount; i++) {
      const cx = 30 + Math.random() * (microscopeCanvas.width - 60);
      const cy = 30 + Math.random() * (microscopeCanvas.height - 60);
      const r = 9 + Math.random() * 2;
      
      // Draw outer pink cytoplasm
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#e5a4b4'; // pink-red stained erythrocyte cytoplasm
      ctx.fill();
      ctx.strokeStyle = '#c9788a';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw central pallor (lighter center)
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, 2 * Math.PI);
      ctx.fillStyle = '#f5f0f7'; // matches bg
      ctx.fill();
    }
    
    // 3. Draw Lymphocytes (WBC) - large round dark purple
    const lymCount = 2;
    for (let i = 0; i < lymCount; i++) {
      const cx = 80 + Math.random() * (microscopeCanvas.width - 160);
      const cy = 80 + Math.random() * (microscopeCanvas.height - 160);
      const r = 13 + Math.random() * 2;
      
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#dcbcdb'; // light purple cytoplasm
      ctx.fill();
      ctx.strokeStyle = '#b68fb5';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      
      // Huge dark nucleus filling 85%
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, 2 * Math.PI);
      ctx.fillStyle = '#26123e'; // very dark purple
      ctx.fill();
    }
    
    // 4. Draw Neutrophils (WBC) - 3 or 4 lobed nucleus
    const neuCount = 3;
    for (let i = 0; i < neuCount; i++) {
      const ncx = 100 + Math.random() * (microscopeCanvas.width - 200);
      const ncy = 100 + Math.random() * (microscopeCanvas.height - 200);
      const nr = 16;
      ctx.beginPath();
      ctx.arc(ncx, ncy, nr, 0, 2 * Math.PI);
      ctx.fillStyle = '#ebdbeb'; // light lavender
      ctx.fill();
      ctx.strokeStyle = '#baa6ba';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      
      // 3 or 4 distinct lobes
      ctx.fillStyle = '#2c0c46';
      const lobes = 3 + Math.floor(Math.random() * 2);
      for (let j = 0; j < lobes; j++) {
        const lobeAngle = (j * 2 * Math.PI) / lobes;
        const lx = ncx + Math.cos(lobeAngle) * (nr * 0.4);
        const ly = ncy + Math.sin(lobeAngle) * (nr * 0.4);
        ctx.beginPath();
        ctx.arc(lx, ly, nr * 0.28, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 5. Draw Platelets - tiny purple fragments
    const pltCount = 15;
    for (let i = 0; i < pltCount; i++) {
      const cx = 40 + Math.random() * (microscopeCanvas.width - 80);
      const cy = 40 + Math.random() * (microscopeCanvas.height - 80);
      const r = 2.5 + Math.random() * 1.5;
      
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#834dc2'; // purple-blue stained platelet
      ctx.fill();
      ctx.strokeStyle = '#6d3ea3';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  } else {
    // 1. Draw light pink-gray background (simulating a stained smear field of view)
    ctx.fillStyle = '#f0eaf2';
    ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);
    
    // Draw some subtle vignette / background shading
    const bgGrad = ctx.createRadialGradient(
      microscopeCanvas.width/2, microscopeCanvas.height/2, 100,
      microscopeCanvas.width/2, microscopeCanvas.height/2, 400
    );
    bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    bgGrad.addColorStop(1, 'rgba(220, 205, 225, 0.4)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);

    // 2. Draw RBCs (Eritrosit) - oval, pink with dark purple nucleus
    const rbcCount = 50;
    for (let i = 0; i < rbcCount; i++) {
      const cx = 40 + Math.random() * (microscopeCanvas.width - 80);
      const cy = 40 + Math.random() * (microscopeCanvas.height - 80);
      const r = 11 + Math.random() * 3;
      const angle = Math.random() * Math.PI; // random orientation
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      // Draw outer pink cytoplasm
      ctx.beginPath();
      ctx.scale(1.3, 1.0);
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#df8f9f'; // stained erythrocyte cytoplasm (pink-red)
      ctx.fill();
      ctx.strokeStyle = '#c5687a';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw dark purple/blue nucleus in center
      ctx.beginPath();
      ctx.scale(0.8, 0.8);
      ctx.arc(0, 0, r * 0.45, 0, 2 * Math.PI);
      ctx.fillStyle = '#2d2554'; // dark nucleus
      ctx.fill();
      
      ctx.restore();
    }
    
    // 3. Draw Lymphocytes (WBC) - large round dark purple
    const wbcCount = 4;
    for (let i = 0; i < wbcCount; i++) {
      const cx = 60 + Math.random() * (microscopeCanvas.width - 120);
      const cy = 60 + Math.random() * (microscopeCanvas.height - 120);
      const r = 14 + Math.random() * 2;
      
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#d2b9d9'; // light purple cytoplasm
      ctx.fill();
      ctx.strokeStyle = '#a885b5';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      
      // Huge dark nucleus filling 80%
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.8, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e0c38'; // very dark purple
      ctx.fill();
    }
    
    // 4. Draw Neutrophil (WBC) - 3 lobed nucleus
    const ncx = 120 + Math.random() * (microscopeCanvas.width - 240);
    const ncy = 100 + Math.random() * (microscopeCanvas.height - 200);
    const nr = 18;
    ctx.beginPath();
    ctx.arc(ncx, ncy, nr, 0, 2 * Math.PI);
    ctx.fillStyle = '#e8dbe8'; // light lavender
    ctx.fill();
    ctx.strokeStyle = '#b29bb2';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    // 3 distinct lobes
    ctx.fillStyle = '#25073f';
    for (let j = 0; j < 3; j++) {
      const lobeAngle = (j * 2 * Math.PI) / 3;
      const lx = ncx + Math.cos(lobeAngle) * (nr * 0.4);
      const ly = ncy + Math.sin(lobeAngle) * (nr * 0.4);
      ctx.beginPath();
      ctx.arc(lx, ly, nr * 0.3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 5. Draw Monocyte (WBC) - kidney nucleus
    const mcx = 100 + Math.random() * (microscopeCanvas.width - 200);
    const mcy = 100 + Math.random() * (microscopeCanvas.height - 200);
    const mr = 20;
    ctx.beginPath();
    ctx.arc(mcx, mcy, mr, 0, 2 * Math.PI);
    ctx.fillStyle = '#e0d8e8';
    ctx.fill();
    ctx.strokeStyle = '#a69bb8';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    // kidney shaped nucleus
    ctx.save();
    ctx.translate(mcx, mcy);
    ctx.beginPath();
    ctx.arc(0, 0, mr * 0.65, -Math.PI * 0.2, Math.PI * 1.2);
    ctx.fillStyle = '#220938';
    ctx.fill();
    ctx.restore();

    // 6. Draw Thrombocytes - small spindly purple-blue
    const tcCount = 6;
    for (let i = 0; i < tcCount; i++) {
      const cx = 50 + Math.random() * (microscopeCanvas.width - 100);
      const cy = 50 + Math.random() * (microscopeCanvas.height - 100);
      const r = 5.5 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(2.0, 0.75); // spindly
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#a6b0c2'; // grayish blue
      ctx.fill();
      ctx.strokeStyle = '#75839c';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = '#1c2135';
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── Synthetic Smear Generator (Demo Mode) ──────────────────────
window.loadDemoSmear = function() {
  originalImage = "DEMO";
  document.getElementById('canvas-placeholder').style.display = 'none';
  document.getElementById('clear-btn').disabled = false;

  microscopeCanvas.width = 650;
  microscopeCanvas.height = 450;

  // Run the binarization on the newly drawn synthetic smear
  processUploadedImage();
};

// ── Draw Microscope Canvas ─────────────────────────────────────
function drawCanvas() {
  if (!originalImage) return;

  ctx.clearRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);

  if (originalImage === "DEMO") {
    // Draw synthetic stained blood smear background
    const gradient = ctx.createRadialGradient(
      microscopeCanvas.width/2, microscopeCanvas.height/2, 50,
      microscopeCanvas.width/2, microscopeCanvas.height/2, 400
    );
    gradient.addColorStop(0, '#120f1a');
    gradient.addColorStop(1, '#050308');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, microscopeCanvas.width, microscopeCanvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < microscopeCanvas.width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, microscopeCanvas.height); ctx.stroke();
    }
    for (let y = 0; y < microscopeCanvas.height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(microscopeCanvas.width, y); ctx.stroke();
    }
  } else {
    // Draw uploaded image
    ctx.drawImage(originalImage, 0, 0, microscopeCanvas.width, microscopeCanvas.height);
  }

  // Draw detected cells
  detectedCells.forEach((cell, idx) => {
    ctx.save();
    
    // Draw cell body
    ctx.beginPath();
    if (cell.type === 'RBC') {
      if (bloodType === 'mammal') {
        // Mammalian RBC: Circular disc with central pallor
        ctx.arc(cell.x, cell.y, cell.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Central pallor (lighter center)
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, cell.r * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(240, 234, 242, 0.7)';
        ctx.fill();
      } else {
        // RBC is nucleated oval in fish
        ctx.translate(cell.x, cell.y);
        ctx.scale(1.3, 1.0); // oval stretch
        ctx.arc(0, 0, cell.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw dark nucleus in the center
        ctx.beginPath();
        ctx.scale(0.8, 0.8);
        ctx.arc(0, 0, cell.r * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = '#1e1b4b'; // dark blue/purple nucleus
        ctx.fill();
      }
    } 
    else if (cell.type === 'Thrombocyte') {
      if (bloodType === 'mammal') {
        // Platelets: small round/irregular purple dots
        ctx.arc(cell.x, cell.y, cell.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(124, 58, 237, 0.7)'; // purple stained platelet
        ctx.fill();
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Spindle shape
        ctx.translate(cell.x, cell.y);
        ctx.scale(1.8, 0.6); // highly elongated
        ctx.arc(0, 0, cell.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        
        // small dark nucleus
        ctx.beginPath();
        ctx.arc(0, 0, cell.r * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      }
    }
    else {
      // WBC (round, larger)
      ctx.arc(cell.x, cell.y, cell.r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw nucleuses based on cell sub-type
      ctx.beginPath();
      if (cell.type === 'Lymphocyte') {
        // large round nucleus filling almost the entire cell
        ctx.arc(cell.x, cell.y, cell.r * 0.8, 0, 2 * Math.PI);
        ctx.fillStyle = '#4c1d95';
        ctx.fill();
      } 
      else if (cell.type === 'Neutrophil') {
        // segmented lobed nucleus (3 lobes)
        ctx.fillStyle = '#3b0764';
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI) / 3;
          const nx = cell.x + Math.cos(angle) * (cell.r * 0.4);
          const ny = cell.y + Math.sin(angle) * (cell.r * 0.4);
          ctx.beginPath();
          ctx.arc(nx, ny, cell.r * 0.3, 0, 2 * Math.PI);
          ctx.fill();
        }
      } 
      else if (cell.type === 'Monocyte') {
        // large kidney/horseshoe shaped nucleus
        ctx.arc(cell.x, cell.y, cell.r * 0.6, 0, Math.PI);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
      }
      else if (cell.type === 'Eosinophil') {
        // Granulated cytoplasm + segmented nucleus
        ctx.fillStyle = '#581c87';
        ctx.arc(cell.x - cell.r*0.3, cell.y, cell.r * 0.35, 0, 2*Math.PI);
        ctx.arc(cell.x + cell.r*0.3, cell.y, cell.r * 0.35, 0, 2*Math.PI);
        ctx.fill();
        // small red granules in cytoplasm
        for (let j = 0; j < 8; j++) {
          const ga = Math.random() * 2 * Math.PI;
          const gd = 5 + Math.random() * (cell.r - 8);
          ctx.beginPath();
          ctx.arc(cell.x + Math.cos(ga)*gd, cell.y + Math.sin(ga)*gd, 1.2, 0, 2*Math.PI);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
        }
      }
    }
    
    ctx.restore();

    // Draw visual label/index number if hovered/selected
    if (selectedCellIndex === idx) {
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, cell.r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#00F2FE';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Index flag
      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`#${idx + 1}`, cell.x - 10, cell.y - cell.r - 8);
    }
  });
}

function updateMicroscopeStats() {
  const rbc = detectedCells.filter(c => c.type === 'RBC').length;
  const wbc = detectedCells.filter(c => c.type !== 'RBC' && c.type !== 'Thrombocyte').length;
  const plt = detectedCells.filter(c => c.type === 'Thrombocyte').length;

  document.getElementById('lbl-rbc-count').textContent = rbc;
  document.getElementById('lbl-wbc-count').textContent = wbc;
  document.getElementById('lbl-plt-count').textContent = plt;
  document.getElementById('stats-bar').style.display = 'flex';
}

// ── Interactive Cell Selection & Inspection ──────────────────
function handleCanvasClick(e) {
  // Get mouse coordinates relative to canvas
  const rect = microscopeCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // If Eyedropper is active, intercept click to sample color
  if (isEyedropperActive) {
    const scaleX = microscopeCanvas.width / rect.width;
    const scaleY = microscopeCanvas.height / rect.height;
    const clickX = Math.round(x * scaleX);
    const clickY = Math.round(y * scaleY);

    try {
      const pData = ctx.getImageData(clickX, clickY, 1, 1).data;
      customBgColor = { r: pData[0], g: pData[1], b: pData[2] };

      // Update indicator background color and select mode
      const hex = '#' + ((1 << 24) + (pData[0] << 16) + (pData[1] << 8) + pData[2]).toString(16).slice(1);
      document.getElementById('custom-color-indicator').style.backgroundColor = hex;

      // Update dropdown selection
      document.getElementById('detect-method').value = 'custom-color';
      detectionSettings.method = 'custom-color';

      // Reset eyedropper state
      isEyedropperActive = false;
      microscopeCanvas.style.cursor = 'default';
      const btn = document.getElementById('eyedropper-btn');
      btn.innerHTML = '<i class="fa-solid fa-eye-dropper"></i> Ambil Warna Latar';
      btn.classList.remove('active');

      // Rerun analysis
      processUploadedImage();
    } catch (err) {
      console.error("Gagal mengambil warna Eyedropper:", err);
    }
    return;
  }

  if (!detectedCells.length) return;

  // Find nearest cell
  let nearestIdx = -1;
  let minDist = 30; // maximum click radius in pixels

  detectedCells.forEach((cell, idx) => {
    const dist = Math.sqrt((cell.x - x) ** 2 + (cell.y - y) ** 2);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = idx;
    }
  });

  if (nearestIdx !== -1) {
    selectedCellIndex = nearestIdx;
    const cell = detectedCells[nearestIdx];

    document.getElementById('inspect-idx').textContent = nearestIdx + 1;
    document.getElementById('inspect-type').textContent = getCellTypeLabel(cell.type);
    document.getElementById('inspect-area').textContent = cell.area;
    document.getElementById('inspect-circ').textContent = cell.circularity;
    document.getElementById('inspect-reclassify-select').value = cell.type;

    document.getElementById('selection-card').style.display = 'block';
  } else {
    selectedCellIndex = null;
    document.getElementById('selection-card').style.display = 'none';
  }

  drawCanvas();
}

window.reclassifySelectedCell = function(newType) {
  if (selectedCellIndex === null || !detectedCells[selectedCellIndex]) return;

  const cell = detectedCells[selectedCellIndex];
  cell.type = newType;
  
  // Update color
  if (newType === 'RBC') cell.color = '#EF4444';
  else if (newType === 'Thrombocyte') cell.color = '#06B6D4';
  else cell.color = '#A855F7';

  // Redraw and update counts
  drawCanvas();
  updateMicroscopeStats();
  document.getElementById('inspect-type').textContent = getCellTypeLabel(newType);

  // If tab 2 has already run, recalculate results
  if (document.getElementById('report-content').style.display === 'flex') {
    calculateResults(false); // silent recalculation
  }
};

function getCellTypeLabel(type) {
  switch (type) {
    case 'RBC': return 'Eritrosit (RBC)';
    case 'Lymphocyte': return 'Limfosit (WBC)';
    case 'Neutrophil': return 'Neutrofil (WBC)';
    case 'Monocyte': return 'Monosit (WBC)';
    case 'Eosinophil': return 'Eosinofil (WBC)';
    case 'Thrombocyte': return 'Trombosit';
    default: return type;
  }
}

// ── Hematology Logic and Reporting ────────────────────────────
window.runHematologyAnalysis = function() {
  if (!detectedCells.length) {
    alert("Belum ada data usap darah. Harap unggah gambar atau pilih 'Sampel Demo' terlebih dahulu.");
    return;
  }

  // 1. Validasi Input Parameter Normal Rujukan
  const ref = getNormalThresholds();
  if (Object.values(ref).some(val => isNaN(val.min) || isNaN(val.max))) {
    alert("Pastikan semua ambang batas rujukan normal diisi dengan angka.");
    return;
  }

  // 2. Kumpulkan metrik
  calculateResults(true);
};

function getNormalThresholds() {
  return {
    rbc: { min: parseFloat(document.getElementById('ref-rbc-min').value), max: parseFloat(document.getElementById('ref-rbc-max').value), unit: "10⁶ sel/µL", label: "Eritrosit (RBC)" },
    wbc: { min: parseFloat(document.getElementById('ref-wbc-min').value), max: parseFloat(document.getElementById('ref-wbc-max').value), unit: "sel/µL", label: "Leukosit (WBC)" },
    hb: { min: parseFloat(document.getElementById('ref-hb-min').value), max: parseFloat(document.getElementById('ref-hb-max').value), unit: "g/dL", label: "Hemoglobin" },
    ht: { min: parseFloat(document.getElementById('ref-ht-min').value), max: parseFloat(document.getElementById('ref-ht-max').value), unit: "%", label: "Hematokrit" },
    lym: { min: parseFloat(document.getElementById('ref-lym-min').value), max: parseFloat(document.getElementById('ref-lym-max').value), unit: "%", label: "Limfosit" },
    neu: { min: parseFloat(document.getElementById('ref-neu-min').value), max: parseFloat(document.getElementById('ref-neu-max').value), unit: "%", label: "Neutrofil" },
    mon: { min: parseFloat(document.getElementById('ref-mon-min').value), max: parseFloat(document.getElementById('ref-mon-max').value), unit: "%", label: "Monosit" },
    eos: { min: parseFloat(document.getElementById('ref-eos-min').value), max: parseFloat(document.getElementById('ref-eos-max').value), unit: "%", label: "Eosinofil" }
  };
}

function calculateResults(switchTabFlag = true) {
  // Get lab inputs
  const hb = parseFloat(document.getElementById('hb-input').value);
  const ht = parseFloat(document.getElementById('ht-input').value);

  if (isNaN(hb) || isNaN(ht)) {
    alert("Pastikan nilai Hemoglobin (Hb) dan Hematokrit (Ht) terisi dengan benar.");
    return;
  }

  // Count cells in field of view
  const rbcField = detectedCells.filter(c => c.type === 'RBC').length;
  const pltField = detectedCells.filter(c => c.type === 'Thrombocyte').length;
  
  // WBC subtypes
  const lymField = detectedCells.filter(c => c.type === 'Lymphocyte').length;
  const neuField = detectedCells.filter(c => c.type === 'Neutrophil').length;
  const monField = detectedCells.filter(c => c.type === 'Monocyte').length;
  const eosField = detectedCells.filter(c => c.type === 'Eosinophil').length;
  const wbcField = lymField + neuField + monField + eosField;

  // Scale counts to physiological equivalents
  let rbcVal, wbcVal;
  if (bloodType === 'mammal') {
    // Mammal scaling: 1 RBC ≈ 0.04 * 10^6/µL, 1 WBC ≈ 4,000/µL
    rbcVal = rbcField * 0.04;
    wbcVal = wbcField * 4000;
  } else {
    // Fish scaling
    rbcVal = rbcField * 0.05;
    wbcVal = wbcField * 15000;
  }

  // Calculate percentages for WBC Differential
  const totalWBCSub = Math.max(1, wbcField);
  const lymPct = (lymField / totalWBCSub) * 100;
  const neuPct = (neuField / totalWBCSub) * 100;
  const monPct = (monField / totalWBCSub) * 100;
  const eosPct = (eosField / totalWBCSub) * 100;

  // Calculate Erythrocyte Indices
  // MCV = (Ht * 10) / RBC
  const mcvVal = rbcVal > 0 ? (ht * 10) / rbcVal : 0;
  // MCH = (Hb * 10) / RBC
  const mchVal = rbcVal > 0 ? (hb * 10) / rbcVal : 0;
  // MCHC = (Hb * 100) / Ht
  const mchcVal = ht > 0 ? (hb * 100) / ht : 0;

  // Render Laporan
  renderDiagnosticTables({ rbcVal, wbcVal, hb, ht, mcvVal, mchVal, mchcVal, lymPct, neuPct, monPct, eosPct });

  // Render RBC Size Histogram
  const rbcCells = detectedCells.filter(c => c.type === 'RBC');
  renderRbcHistogram(rbcCells);

  // Generate Verbal Diagnostics
  generateVerbalReport({ rbcVal, wbcVal, hb, ht, mcvVal, mchVal, mchcVal, lymPct, neuPct, monPct, eosPct });

  // Show Report Area
  document.getElementById('no-report-state').style.display = 'none';
  document.getElementById('report-content').style.display = 'flex';

  if (switchTabFlag) {
    const reportBtn = document.getElementById('btn-tab-report');
    switchHemaTab('report-tab', reportBtn);
  }
}

function renderDiagnosticTables(data) {
  const ref = getNormalThresholds();

  // 1. Profil Hematologi Utama
  const mainTbody = document.querySelector('#main-profile-table tbody');
  const mainParams = [
    { key: 'rbc', label: 'Eritrosit (RBC)', val: data.rbcVal, dec: 2, unit: '×10⁶/µL' },
    { key: 'wbc', label: 'Leukosit (WBC)', val: data.wbcVal, dec: 0, unit: 'sel/µL' },
    { key: 'hb',  label: 'Hemoglobin (Hb)', val: data.hb,    dec: 1, unit: 'g/dL' },
    { key: 'ht',  label: 'Hematokrit (Ht)', val: data.ht,    dec: 1, unit: '%' }
  ];

  mainTbody.innerHTML = mainParams.map(p => {
    const limits = ref[p.key];
    const status = getStatus(p.val, limits.min, limits.max);
    const badgeClass = status === 'Normal' ? 'normal' : (status === 'Rendah' ? 'low' : 'high');
    return `
      <tr>
        <td class="param-name">${p.label}</td>
        <td style="font-family: monospace; font-weight:700;">${p.val.toFixed(p.dec)}</td>
        <td style="font-size: 0.75rem; color: var(--text-secondary);">${limits.min.toFixed(p.dec)} - ${limits.max.toFixed(p.dec)}</td>
        <td><span class="status-badge ${badgeClass}">${status}</span></td>
      </tr>
    `;
  }).join('');

  // 2. Indeks Eritrosit
  let mcvMin = 80, mcvMax = 250;
  let mchMin = 20, mchMax = 70;
  let mchcMin = 22, mchcMax = 35;
  if (bloodType === 'mammal') {
    mcvMin = 80; mcvMax = 100;
    mchMin = 27; mchMax = 33;
    mchcMin = 32; mchcMax = 36;
  }
  const mcvStatus = getStatus(data.mcvVal, mcvMin, mcvMax);
  const mchStatus = getStatus(data.mchVal, mchMin, mchMax);
  const mchcStatus = getStatus(data.mchcVal, mchcMin, mchcMax);

  indexTbody.innerHTML = `
    <tr>
      <td class="param-name">MCV <span style="font-size: 0.65rem; color: var(--text-secondary); font-weight:normal;">(Mean Corpuscular Vol)</span></td>
      <td style="font-family: monospace; font-weight:700;">${data.mcvVal.toFixed(1)} <span style="font-size:0.65rem; font-weight:normal;">fL</span></td>
      <td style="font-size: 0.75rem; color: var(--text-secondary);">${mcvMin.toFixed(1)} - ${mcvMax.toFixed(1)}</td>
      <td><span class="status-badge ${mcvStatus === 'Normal' ? 'normal' : (mcvStatus === 'Rendah' ? 'low' : 'high')}">${mcvStatus}</span></td>
    </tr>
    <tr>
      <td class="param-name">MCH <span style="font-size: 0.65rem; color: var(--text-secondary); font-weight:normal;">(Mean Corpuscular Hb)</span></td>
      <td style="font-family: monospace; font-weight:700;">${data.mchVal.toFixed(1)} <span style="font-size:0.65rem; font-weight:normal;">pg</span></td>
      <td style="font-size: 0.75rem; color: var(--text-secondary);">${mchMin.toFixed(1)} - ${mchMax.toFixed(1)}</td>
      <td><span class="status-badge ${mchStatus === 'Normal' ? 'normal' : (mchStatus === 'Rendah' ? 'low' : 'high')}">${mchStatus}</span></td>
    </tr>
    <tr>
      <td class="param-name">MCHC <span style="font-size: 0.65rem; color: var(--text-secondary); font-weight:normal;">(Hb Concentration)</span></td>
      <td style="font-family: monospace; font-weight:700;">${data.mchcVal.toFixed(1)} <span style="font-size:0.65rem; font-weight:normal;">%</span></td>
      <td style="font-size: 0.75rem; color: var(--text-secondary);">${mchcMin.toFixed(1)} - ${mchcMax.toFixed(1)}</td>
      <td><span class="status-badge ${mchcStatus === 'Normal' ? 'normal' : (mchcStatus === 'Rendah' ? 'low' : 'high')}">${mchcStatus}</span></td>
    </tr>
  `;

  // 3. Diferensiasi Leukosit
  const diffTbody = document.querySelector('#diff-wbc-table tbody');
  const wbcParams = [
    { key: 'lym', label: 'Limfosit', val: data.lymPct },
    { key: 'neu', label: 'Neutrofil', val: data.neuPct },
    { key: 'mon', label: 'Monosit', val: data.monPct },
    { key: 'eos', label: 'Eosinofil', val: data.eosPct }
  ];

  diffTbody.innerHTML = wbcParams.map(p => {
    const limits = ref[p.key];
    const status = getStatus(p.val, limits.min, limits.max);
    const badgeClass = status === 'Normal' ? 'normal' : (status === 'Rendah' ? 'low' : 'high');
    return `
      <tr>
        <td class="param-name">${p.label}</td>
        <td style="font-family: monospace; font-weight:700;">${p.val.toFixed(1)}%</td>
        <td style="font-size: 0.75rem; color: var(--text-secondary);">${limits.min.toFixed(0)}% - ${limits.max.toFixed(0)}%</td>
        <td><span class="status-badge ${badgeClass}">${status}</span></td>
      </tr>
    `;
  }).join('');
}

function getStatus(val, min, max) {
  if (val < min) return 'Rendah';
  if (val > max) return 'Tinggi';
  return 'Normal';
}

function generateVerbalReport(data) {
  const ref = getNormalThresholds();
  let reports = [];

  // 1. RBC/Anemia Diagnosis
  const rbcStatus = getStatus(data.rbcVal, ref.rbc.min, ref.rbc.max);
  const hbStatus = getStatus(data.hb, ref.hb.min, ref.hb.max);
  const htStatus = getStatus(data.ht, ref.ht.min, ref.ht.max);

  if (rbcStatus === 'Rendah' || hbStatus === 'Rendah' || htStatus === 'Rendah') {
    // Determine Anemia Morphological Classification
    const mcvMin = bloodType === 'mammal' ? 80 : 80;
    const mcvMax = bloodType === 'mammal' ? 100 : 250;
    const mchMin = bloodType === 'mammal' ? 27 : 20;
    const mchMax = bloodType === 'mammal' ? 33 : 70;
    const mcvStatus = getStatus(data.mcvVal, mcvMin, mcvMax);
    const mchStatus = getStatus(data.mchVal, mchMin, mchMax);
    
    let type = "";
    if (mcvStatus === 'Rendah' && mchStatus === 'Rendah') {
      type = "Mikrositik Hipokromik";
    } else if (mcvStatus === 'Tinggi') {
      type = "Makrositik";
    } else {
      type = "Normositik Normokromik";
    }
    
    if (bloodType === 'mammal') {
      reports.push(`<strong>🚨 Klasifikasi Anemia: Anemia ${type}</strong>\n` + 
                   `- Nilai Eritrosit (${data.rbcVal.toFixed(2)}), Hb (${data.hb.toFixed(1)} g/dL), atau Hematokrit (${data.ht.toFixed(1)}%) berada di bawah ambang batas normal.\n` + 
                   `- Anemia ${type} pada mamalia/manusia umumnya berasosiasi dengan defisiensi zat besi, asam folat, vitamin B12, gangguan sumsum tulang belakang, pendarahan kronis, atau anemia penyakit kronis.`);
    } else {
      reports.push(`<strong>🚨 Klasifikasi Anemia: Anemia ${type}</strong>\n` + 
                   `- Nilai Eritrosit (${data.rbcVal.toFixed(2)}), Hb (${data.hb.toFixed(1)} g/dL), atau Hematokrit (${data.ht.toFixed(1)}%) berada di bawah ambang batas normal.\n` + 
                   `- Anemia ${type} biasanya berasosiasi dengan defisiensi nutrisi pakan (kurang zat besi/asam folat), gangguan pembentukan sel darah di ginjal/limpa, pendarahan akibat gigitan ektoparasit (seperti *Argulus* atau *Lernaea*), atau stres air kronis.`);
    }
  } else if (rbcStatus === 'Tinggi' || hbStatus === 'Tinggi' || htStatus === 'Tinggi') {
    if (bloodType === 'mammal') {
      reports.push(`<strong>⚠️ Klasifikasi Eritrosit: Eritrositosis (Polisitemia)</strong>\n` + 
                   `- Kadar eritrosit, Hb, atau Ht meningkat di atas normal.\n` + 
                   `- Hal ini sering disebabkan oleh dehidrasi (hemokonsentrasi), penyakit paru kronis, penyakit jantung bawaan, atau kelainan klonal sumsum tulang (Polisitemia Vera).`);
    } else {
      reports.push(`<strong>⚠️ Klasifikasi Eritrosit: Polisitemia</strong>\n` + 
                   `- Kadar eritrosit, Hb, atau Ht meningkat di atas normal.\n` + 
                   `- Hal ini sering disebabkan oleh respon kompensasi fisiologis ikan terhadap kondisi lingkungan hipoksia (DO rendah), tingkat salinitas tinggi (dehidrasi osmotik), atau stres lingkungan akut.`);
    }
  } else {
    reports.push(`<strong>✅ Klasifikasi Eritrosit: Normal</strong>\n` + 
                 `- Profil sel darah merah (RBC, Hemoglobin, Hematokrit) dalam keadaan seimbang dan cocok untuk spesimen ini.`);
  }

  // 2. WBC Diagnosis
  const wbcStatus = getStatus(data.wbcVal, ref.wbc.min, ref.wbc.max);
  if (wbcStatus === 'Tinggi') {
    if (bloodType === 'mammal') {
      reports.push(`<strong>🚨 Klasifikasi Leukosit: Leukositosis</strong>\n` + 
                   `- Jumlah total leukosit melampaui batas atas rujukan normal.\n` + 
                   `- Ini mengindikasikan respon imun aktif terhadap infeksi bakteri/virus akut, inflamasi sistemik, nekrosis jaringan, atau reaksi alergi hebat.`);
    } else {
      reports.push(`<strong>🚨 Klasifikasi Leukosit: Leukositosis</strong>\n` + 
                   `- Jumlah total leukosit melampaui batas atas rujukan normal.\n` + 
                   `- Ini mengindikasikan adanya respon imun aktif atau reaksi inflamasi akibat paparan agen infeksius seperti bakteri patogen (*Aeromonas*, *Pseudomonas*) atau infestasi parasit kulit/insang.`);
    }
  } else if (wbcStatus === 'Rendah') {
    if (bloodType === 'mammal') {
      reports.push(`<strong>⚠️ Klasifikasi Leukosit: Leukopenia</strong>\n` + 
                   `- Jumlah total leukosit lebih rendah dari batas normal.\n` + 
                   `- Mengarah pada penurunan daya tahan tubuh (imunodefisiensi), yang dapat disebabkan oleh infeksi virus tertentu, penyakit autoimun, efek toksik obat/zat kimia, atau gangguan fungsi sumsum tulang.`);
    } else {
      reports.push(`<strong>⚠️ Klasifikasi Leukosit: Leukopenia</strong>\n` + 
                   `- Jumlah total leukosit lebih rendah dari batas normal.\n` + 
                   `- Hal ini mengarah pada kondisi imunosupresi (penurunan sistem kekebalan tubuh), yang sering diinduksi oleh stres kronis jangka panjang (kadar kortisol plasma tinggi secara konstan) atau keracunan amonia/nitrit.`);
    }
  } else {
    reports.push(`<strong>✅ Klasifikasi Leukosit: Normal</strong>\n` + 
                 `- Jumlah total sel pertahanan darah berada pada rentang aman.`);
  }

  // 3. Differential WBC Count (Stress/Bacterial response)
  const neuStatus = getStatus(data.neuPct, ref.neu.min, ref.neu.max);
  const lymStatus = getStatus(data.lymPct, ref.lym.min, ref.lym.max);

  if (neuStatus === 'Tinggi' && lymStatus === 'Rendah') {
    if (bloodType === 'mammal') {
      reports.push(`<strong>⚠️ Deteksi Rasio Neutrofil/Limfosit (N/L): Indikasi Stres Fisiologis Tinggi</strong>\n` + 
                   `- Peningkatan rasio N/L merupakan biomarker klinis untuk stres psikologis/fisik berat, trauma, atau peningkatan kadar glukokortikoid (stres hormonal) pada tubuh.`);
    } else {
      reports.push(`<strong>⚠️ Deteksi Rasio Neutrofil/Limfosit (N/L): Tingkat Stres Tinggi</strong>\n` + 
                   `- Peningkatan persentase neutrofil bersamaan dengan penurunan limfosit merupakan biomarker stres fisiologis klasik pada ikan.\n` + 
                   `- Menunjukkan adanya stres lingkungan hebat, fluktuasi suhu ekstrim, atau penanganan (*handling*) tambak yang kurang hati-hati.`);
    }
  } else if (neuStatus === 'Tinggi') {
    reports.push(`<strong>🦠 Deteksi Neutrofilia (Bakteri/Inflamasi)</strong>\n` + 
                 `- Proporsi neutrofil tinggi menunjukkan mobilisasi pertahanan seluler lini pertama terhadap infeksi bakteri akut atau kerusakan jaringan.`);
  }

  // Add recommendations
  if (bloodType === 'mammal') {
    reports.push(`<strong>🔍 Rekomendasi Manajemen Kesehatan:</strong>\n` +
                 `1. Konsultasikan dengan dokter spesialis atau dokter hewan untuk pemeriksaan hematologi lanjutan (kadar feritin serum, serum iron, TIBC).\n` +
                 `2. Pastikan asupan nutrisi seimbang (tingkatkan konsumsi zat besi heme, asam folat, dan Vitamin B12).\n` +
                 `3. Lakukan evaluasi klinis menyeluruh untuk mencari sumber pendarahan tersembunyi atau faktor inflamasi kronis.`);
  } else {
    reports.push(`<strong>🔍 Rekomendasi Manajemen Kesehatan Ikan:</strong>\n` +
                 `1. Evaluasi kualitas air kolam secara ketat (pastikan Oksigen Terlarut > 5 mg/L, Amonia Bebas < 0.02 ppm).\n` +
                 `2. Tambahkan suplemen Vitamin C dan imunostimulan (Beta-Glukan) pada pakan untuk meningkatkan kekebalan leukosit.\n` +
                 `3. Lakukan pemeriksaan sediaan basah mikroskopis (Wet Mount) pada lendir kulit dan filamen insang untuk menyingkirkan kemungkinan ektoparasit jika terindikasi anemia.`);
  }

  document.getElementById('clinical-report-text').innerHTML = reports.join('\n\n');
}

// ── Export and PDF Printing Features ─────────────────────────
window.downloadSmearPng = function() {
  if (!detectedCells.length) return;
  const link = document.createElement('a');
  link.download = `fish_hematology_smear_${Date.now()}.png`;
  link.href = microscopeCanvas.toDataURL('image/png');
  link.click();
};

window.exportHematologyExcel = function() {
  if (!detectedCells.length) return;
  try {
    // Build array of data rows
    const dataRows = detectedCells.map((cell, idx) => ({
      "Indeks Sel": idx + 1,
      "Tipe Sel": getCellTypeLabel(cell.type),
      "Koordinat X": cell.x.toFixed(1),
      "Koordinat Y": cell.y.toFixed(1),
      "Ukuran Area (px)": cell.area,
      "Sirkularitas (Kebulatan)": parseFloat(cell.circularity)
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sel Darah Terdeteksi");
    XLSX.writeFile(wb, `aqua_insight_hematologi_${Date.now()}.xlsx`);
  } catch (err) {
    console.error("Gagal ekspor Excel:", err);
    alert("Gagal mengekspor data ke Excel.");
  }
};

window.exportHematologyCSV = function() {
  if (!detectedCells.length) return;
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Indeks Sel,Tipe Sel,Koordinat X,Koordinat Y,Ukuran Area (px),Sirkularitas\n";
  
  detectedCells.forEach((cell, idx) => {
    csvContent += `${idx + 1},"${getCellTypeLabel(cell.type)}",${cell.x.toFixed(1)},${cell.y.toFixed(1)},${cell.area},${cell.circularity}\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `aqua_insight_hematologi_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.printHematologyPDF = function() {
  window.print();
};

// ── Penambahan Sel Manual (Double-Click) ────────────────────────
let lastDblClickCoord = { x: 0, y: 0 };

function handleCanvasDblClick(e) {
  if (!originalImage) return;

  const rect = microscopeCanvas.getBoundingClientRect();
  const scaleX = microscopeCanvas.width / rect.width;
  const scaleY = microscopeCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  lastDblClickCoord = { x, y };

  const popup = document.getElementById('cell-add-popup');
  popup.style.left = `${e.clientX + window.scrollX}px`;
  popup.style.top = `${e.clientY + window.scrollY}px`;
  popup.style.display = 'flex';

  e.preventDefault();
}

// Sembunyikan popup tambah sel saat klik di luar
document.addEventListener('click', function(e) {
  const popup = document.getElementById('cell-add-popup');
  if (popup && popup.style.display === 'flex') {
    if (!popup.contains(e.target) && e.target !== microscopeCanvas) {
      popup.style.display = 'none';
    }
  }
});

window.addManualCell = function(type) {
  const popup = document.getElementById('cell-add-popup');
  popup.style.display = 'none';

  if (lastDblClickCoord.x === 0 && lastDblClickCoord.y === 0) return;

  let color = '#EF4444';
  let radius = 12;
  let area = Math.round(Math.PI * radius * radius);

  if (type === 'Thrombocyte') {
    color = '#06B6D4';
    radius = 6;
    area = Math.round(Math.PI * radius * radius);
  } else if (type !== 'RBC') {
    color = '#A855F7';
    radius = 16;
    area = Math.round(Math.PI * radius * radius);
  }

  detectedCells.push({
    x: lastDblClickCoord.x,
    y: lastDblClickCoord.y,
    r: radius,
    type: type,
    area: area,
    circularity: (type === 'Thrombocyte') ? "0.50" : (type === 'RBC' ? "0.75" : "0.85"),
    color: color
  });

  drawCanvas();
  updateMicroscopeStats();

  if (document.getElementById('report-content').style.display === 'flex') {
    calculateResults(false);
  }
};

// ── Penghapusan Sel Terpilih ────────────────────────────────────
window.deleteSelectedCell = function() {
  if (selectedCellIndex === null || selectedCellIndex < 0 || selectedCellIndex >= detectedCells.length) return;

  detectedCells.splice(selectedCellIndex, 1);
  selectedCellIndex = null;
  document.getElementById('selection-card').style.display = 'none';

  drawCanvas();
  updateMicroscopeStats();

  if (document.getElementById('report-content').style.display === 'flex') {
    calculateResults(false);
  }
};

// ── Perhitungan RDW & Histogram Eritrosit ───────────────────────
let rbcChartInstance = null;

function calculateRdw(rbcCells) {
  if (rbcCells.length < 2) return 0;

  const areas = rbcCells.map(c => c.area);
  const mean = areas.reduce((sum, a) => sum + a, 0) / areas.length;

  if (mean === 0) return 0;

  const sumSqDiff = areas.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0);
  const sd = Math.sqrt(sumSqDiff / (areas.length - 1));

  return (sd / mean) * 100;
}

function renderRbcHistogram(rbcCells) {
  const canvasHist = document.getElementById('rbc-histogram');
  if (!canvasHist) return;
  
  const ctxHist = canvasHist.getContext('2d');

  // Hitung RDW
  const rdwVal = calculateRdw(rbcCells);
  const lblRdw = document.getElementById('lbl-rdw-val');
  if (lblRdw) {
    lblRdw.textContent = rdwVal > 0 ? `${rdwVal.toFixed(1)}%` : '—';
    if (rdwVal > 15) {
      lblRdw.style.color = '#F43F5E'; // High variation (Anisocytosis)
    } else {
      lblRdw.style.color = '#00F2FE'; // Normal
    }
  }

  if (rbcChartInstance) {
    rbcChartInstance.destroy();
  }

  if (rbcCells.length === 0) return;

  // Buat bin ukuran sel (luas area dalam px)
  const binMin = 40;
  const binMax = 240;
  const binCount = 10;
  const binWidth = (binMax - binMin) / binCount;

  const binLabels = [];
  const binData = new Array(binCount).fill(0);

  for (let i = 0; i < binCount; i++) {
    const start = binMin + i * binWidth;
    const end = start + binWidth;
    binLabels.push(`${start}-${end}`);
  }

  rbcCells.forEach(cell => {
    const area = cell.area;
    let binIdx = Math.floor((area - binMin) / binWidth);
    if (binIdx < 0) binIdx = 0;
    if (binIdx >= binCount) binIdx = binCount - 1;
    binData[binIdx]++;
  });

  rbcChartInstance = new Chart(ctxHist, {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [{
        label: 'Eritrosit',
        data: binData,
        backgroundColor: 'rgba(239, 68, 68, 0.45)',
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 9 } },
          title: { display: true, text: 'Ukuran Sel (px²)', color: 'rgba(255, 255, 255, 0.6)', font: { size: 9 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 9 } },
          title: { display: true, text: 'Frekuensi', color: 'rgba(255, 255, 255, 0.6)', font: { size: 9 } }
        }
      }
    }
  });
}
