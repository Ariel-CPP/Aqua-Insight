// Electrophoresis Logic

const LADDERS = {
  "100bp": [2000, 1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  "1kb": [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250]
};

let canvas, ctx, chartInstance;
let laneCount = 6;
let currentLadder = "100bp";
let isAddMode = true;

// Data structure for bands and curve
let calibrationCurve = { a: 0, b: 0, c: 0 }; // log10(MW) = a*Rf^2 + b*Rf + c
let sampleBands = []; // Array of { id, lane, rf, estimated_bp, y, rx, ry }
let manualLadderBands = []; // Array of { y, rf, mw, rx, ry }
let gelBackgroundImage = null;

// Image position and scale state
let imgX = 0;
let imgY = 0;
let imgScale = 1.0;

// Mouse drag states
let isDragging = false;
let startX, startY;
let startImgX, startImgY;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gel-canvas');
  ctx = canvas.getContext('2d');
  
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  
  initGel();
  
  // Listen for language changes to update localized dynamic content
  window.addEventListener('languageChanged', () => {
    drawGel();
    renderCalibrationChart();
    updateResultsTable();
  });
});

function toggleAddMode(btn) {
  btn.classList.toggle('active');
  isAddMode = btn.classList.contains('active');
  canvas.style.cursor = isAddMode ? 'crosshair' : 'default';
}

function changeLadder() {
  currentLadder = document.getElementById('ladder-type').value;
  sampleBands = []; // Clear samples when changing ladder
  updateResultsTable();
  initGel();
}

function initGel() {
  laneCount = parseInt(document.getElementById('lane-count').value) || 6;
  drawGel();
  renderCalibrationChart();
}

function resetLadder() {
  manualLadderBands = [];
  calibrationCurve = { a: 0, b: 0, c: 0, points: [] };
  
  // Re-estimate all sample bands
  sampleBands.forEach(b => b.estimated_bp = 0);
  
  updateResultsTable();
  drawGel();
  renderCalibrationChart();
}

function clearSamples() {
  sampleBands = [];
  manualLadderBands = [];
  calibrationCurve = { a: 0, b: 0, c: 0, points: [] };
  gelBackgroundImage = null;
  
  // Reset image offset and scale
  imgX = 0;
  imgY = 0;
  imgScale = 1.0;
  
  // Reset adjustment UI
  const adjustPanel = document.getElementById('image-adjustments');
  if (adjustPanel) adjustPanel.style.display = 'none';
  
  const zoomInput = document.getElementById('img-zoom');
  const zoomVal = document.getElementById('img-zoom-val');
  const offsetXInput = document.getElementById('img-offset-x');
  const offsetYInput = document.getElementById('img-offset-y');
  
  if (zoomInput) zoomInput.value = 100;
  if (zoomVal) zoomVal.textContent = '100%';
  if (offsetXInput) offsetXInput.value = 0;
  if (offsetYInput) offsetYInput.value = 0;
  
  const fileInput = document.getElementById('gel-image-upload');
  if (fileInput) fileInput.value = "";
  
  updateResultsTable();
  drawGel();
  renderCalibrationChart();
}

function handleGelImageUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      gelBackgroundImage = img;
      
      // Reset image positioning
      imgX = 0;
      imgY = 0;
      imgScale = 1.0;
      
      const zoomInput = document.getElementById('img-zoom');
      const zoomVal = document.getElementById('img-zoom-val');
      const offsetXInput = document.getElementById('img-offset-x');
      const offsetYInput = document.getElementById('img-offset-y');
      
      if (zoomInput) zoomInput.value = 100;
      if (zoomVal) zoomVal.textContent = '100%';
      if (offsetXInput) offsetXInput.value = 0;
      if (offsetYInput) offsetYInput.value = 0;
      
      const adjustPanel = document.getElementById('image-adjustments');
      if (adjustPanel) adjustPanel.style.display = 'block';
      
      drawGel();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Sliders bindings for direct repositioning
window.updateImageZoom = function(val) {
  imgScale = parseFloat(val) / 100;
  document.getElementById('img-zoom-val').textContent = val + '%';
  updateBandsFromImagePosition();
  drawGel();
};

window.updateImageOffsetX = function(val) {
  imgX = parseFloat(val);
  updateBandsFromImagePosition();
  drawGel();
};

window.updateImageOffsetY = function(val) {
  imgY = parseFloat(val);
  updateBandsFromImagePosition();
  drawGel();
};

// Update bands canvas-space Y and Rf from image-relative position
function updateBandsFromImagePosition() {
  const topMargin = 20;
  const usableHeight = canvas.height - 40;
  const h = canvas.height * imgScale;
  
  // Recalculate manual ladder bands canvas coordinates
  manualLadderBands.forEach(mb => {
    mb.y = imgY + mb.ry * h;
    mb.rf = (mb.y - (topMargin + 15)) / usableHeight;
  });
  
  // Recalculate sample bands canvas coordinates
  sampleBands.forEach(sb => {
    sb.y = imgY + sb.ry * h;
    sb.rf = (sb.y - (topMargin + 15)) / usableHeight;
  });
  
  // Recalculate regression calibration
  recalculateCalibrationFromManual();
}

// Calculate quadratic regression for ladder from manual points
function recalculateCalibrationFromManual() {
  if (manualLadderBands.length < 3) return; // need at least 3 points
  
  const dataPoints = manualLadderBands.map(mb => ({
    mw: mb.mw, logMW: Math.log10(mb.mw), rf: mb.rf
  }));
  
  // Quadratic regression: y = ax^2 + bx + c
  // where y = log10(MW), x = Rf
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
  const n = dataPoints.length;
  
  dataPoints.forEach(p => {
    sx += p.rf;
    sx2 += p.rf * p.rf;
    sx3 += Math.pow(p.rf, 3);
    sx4 += Math.pow(p.rf, 4);
    sy += p.logMW;
    sxy += p.rf * p.logMW;
    sx2y += p.rf * p.rf * p.logMW;
  });
  
  // Matrix solving via Cramer's rule for 3x3
  const det = n*(sx2*sx4 - sx3*sx3) - sx*(sx*sx4 - sx2*sx3) + sx2*(sx*sx3 - sx2*sx2);
  if (Math.abs(det) < 1e-12) return;
  
  const detA = sy*(sx2*sx4 - sx3*sx3) - sx*(sxy*sx4 - sx2y*sx3) + sx2*(sxy*sx3 - sx2y*sx2);
  const detB = n*(sxy*sx4 - sx2y*sx3) - sy*(sx*sx4 - sx2*sx3) + sx2*(sx*sx2y - sx2*sxy);
  const detC = n*(sx2*sx2y - sx3*sxy) - sx*(sx*sx2y - sx2*sxy) + sy*(sx*sx3 - sx2*sx2);
  
  calibrationCurve.c = detA / det;
  calibrationCurve.b = detB / det;
  calibrationCurve.a = detC / det;
  
  calibrationCurve.points = dataPoints;
  renderCalibrationChart();
  
  // Re-estimate all sample bands
  sampleBands.forEach(b => b.estimated_bp = estimateBP(b.rf));
  updateResultsTable();
}

function estimateBP(rf) {
  if (manualLadderBands.length < 3) return 0;
  // log10(MW) = a*Rf^2 + b*Rf + c
  const logMW = (calibrationCurve.a * rf * rf) + (calibrationCurve.b * rf) + calibrationCurve.c;
  return Math.pow(10, logMW);
}

function drawGel() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (!gelBackgroundImage) {
    ctx.fillStyle = '#444';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    const isEn = (typeof window.AQUA_GET_LANG === "function") && window.AQUA_GET_LANG() === "en";
    const text = isEn ? 'Upload a gel photo to start analysis' : 'Unggah foto gel untuk memulai analisis';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    return;
  }
  
  // Draw uploaded image with scaling and offset
  const w = canvas.width * imgScale;
  const h = canvas.height * imgScale;
  ctx.drawImage(gelBackgroundImage, imgX, imgY, w, h);
  
  // Draw semi-transparent overlay for lane guides
  const laneWidth = canvas.width / (laneCount + 1);
  const topMargin = 20;
  
  // Draw well markers
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
  ctx.lineWidth = 1;
  for(let i=0; i<laneCount; i++) {
    const x = (i + 0.5) * laneWidth;
    ctx.strokeRect(x + laneWidth*0.1, topMargin, laneWidth*0.8, 12);
    ctx.fillStyle = 'rgba(0, 242, 254, 0.6)';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(i === 0 ? 'M' : `L${i}`, x + laneWidth/2, topMargin - 4);
  }
  
  // Draw manually marked ladder bands
  manualLadderBands.forEach(mb => {
    const mX = 0.5 * laneWidth;
    // Recalculate y based on relative position
    const yVal = imgY + mb.ry * h;
    ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
    ctx.fillRect(mX + laneWidth*0.1, yVal - 2, laneWidth*0.8, 4);
    ctx.fillStyle = '#00F2FE';
    ctx.font = '9px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(mb.mw + ' bp', mX + laneWidth + 4, yVal + 3);
  });
  
  // Draw Sample Bands
  sampleBands.forEach(band => {
    const sX = (band.lane - 1 + 0.5) * laneWidth;
    // Recalculate y based on relative position
    const yVal = imgY + band.ry * h;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(sX + laneWidth*0.1, yVal - 2, laneWidth*0.8, 4);
  });
}

function handleCanvasClick(e) {
  if(!isAddMode || !gelBackgroundImage || isDragging) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  
  const laneWidth = canvas.width / (laneCount + 1);
  const laneFloat = (x / laneWidth) - 0.5;
  const lane = Math.round(laneFloat) + 1;
  
  const topMargin = 20;
  const usableHeight = canvas.height - 40;
  
  if(y < topMargin + 15 || y > canvas.height - 10) return;
  const rf = (y - (topMargin + 15)) / usableHeight;
  
  // Calculate relative coordinate on the scaled image
  const w = canvas.width * imgScale;
  const h = canvas.height * imgScale;
  const rx = (x - imgX) / w;
  const ry = (y - imgY) / h;
  
  if (lane === 1) {
    // Clicking on marker/ladder lane
    const ladderBands = LADDERS[currentLadder];
    if (manualLadderBands.length >= ladderBands.length) {
      alert('Semua pita ladder sudah ditandai!');
      return;
    }
    
    // Add marked point with temporary MW and image-relative coordinates
    manualLadderBands.push({ y: y, rf: rf, mw: 0, rx: rx, ry: ry });
    
    // Automatically sort from top to bottom (y ascending)
    manualLadderBands.sort((a, b) => a.y - b.y);
    
    // Re-assign MW values in order of y position (smallest y gets highest MW)
    manualLadderBands.forEach((mb, idx) => {
      mb.mw = ladderBands[idx];
    });
    
    recalculateCalibrationFromManual();
  } else if (lane > 1 && lane <= laneCount) {
    const est_bp = estimateBP(rf);
    sampleBands.push({ id: Date.now(), lane: lane, rf: rf, estimated_bp: est_bp, y: y, rx: rx, ry: ry });
    sampleBands.sort((a, b) => a.lane === b.lane ? a.rf - b.rf : a.lane - b.lane);
    updateResultsTable();
  }
  
  drawGel();
}

// Direct Mouse Drag-to-Pan Event Handlers

function handleMouseDown(e) {
  if (isAddMode || !gelBackgroundImage) return;
  isDragging = true;
  canvas.style.cursor = 'grabbing';
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  startX = e.clientX * scaleX;
  startY = e.clientY * scaleY;
  startImgX = imgX;
  startImgY = imgY;
}

function handleMouseMove(e) {
  if (!isDragging || !gelBackgroundImage) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const currentX = e.clientX * scaleX;
  const currentY = e.clientY * scaleY;
  
  const dx = currentX - startX;
  const dy = currentY - startY;
  
  // Calculate new position
  imgX = startImgX + dx;
  imgY = startImgY + dy;
  
  // Clamp Geser X and Y values to match slider limits (-300 to +300 px) for ui sync
  imgX = Math.max(-300, Math.min(300, imgX));
  imgY = Math.max(-300, Math.min(300, imgY));
  
  // Sync slider interface values
  const sliderX = document.getElementById('img-offset-x');
  const sliderY = document.getElementById('img-offset-y');
  if (sliderX) sliderX.value = Math.round(imgX);
  if (sliderY) sliderY.value = Math.round(imgY);
  
  updateBandsFromImagePosition();
  drawGel();
}

function handleMouseUp() {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = isAddMode ? 'crosshair' : 'default';
  }
}

function handleMouseLeave() {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = isAddMode ? 'crosshair' : 'default';
  }
}

function deleteBand(id) {
  sampleBands = sampleBands.filter(b => b.id !== id);
  updateResultsTable();
  drawGel();
}

function updateResultsTable() {
  const tbody = document.getElementById('results-tbody');
  const emptyState = document.getElementById('no-bands-state');
  
  tbody.innerHTML = '';
  
  if(sampleBands.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  const isEn = (typeof window.AQUA_GET_LANG === "function") && window.AQUA_GET_LANG() === "en";
  const isCalibrated = manualLadderBands.length >= 3;
  
  sampleBands.forEach(band => {
    const tr = document.createElement('tr');
    const estVal = isCalibrated 
      ? `${band.estimated_bp.toFixed(0)} bp` 
      : `<span style="color: var(--text-secondary); font-style: italic; font-size: 0.75rem;">${isEn ? 'Need calibration (min 3 marker bands)' : 'Butuh kalibrasi (min 3 pita marker)'}</span>`;
      
    tr.innerHTML = `
      <td>L${band.lane}</td>
      <td>${band.rf.toFixed(3)}</td>
      <td>${estVal}</td>
      <td>
        <button class="del-band-btn" onclick="deleteBand(${band.id})"><i class="fa-solid fa-xmark"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCalibrationChart() {
  const ctx = document.getElementById('calibration-chart');
  if (!ctx) return;
  
  if(chartInstance) {
    chartInstance.destroy();
  }
  
  const isEn = (typeof window.AQUA_GET_LANG === "function") && window.AQUA_GET_LANG() === "en";
  const lineLabel = isEn ? 'Quadratic Regression' : 'Regresi Kuadratik';
  const scatterLabel = isEn ? 'Marker Points' : 'Pita Marker';
  const xAxisTitle = isEn ? 'Relative Migration (Rf)' : 'Migrasi Relatif (Rf)';
  const yAxisTitle = isEn ? 'Log10(MW)' : 'Log10(MW)';
  
  // Scatter points from ladder
  let scatterData = [];
  if (calibrationCurve.points) {
    scatterData = calibrationCurve.points.map(p => ({ x: p.rf, y: p.logMW }));
  }
  
  // Curve points
  const curveData = [];
  if (calibrationCurve.points && calibrationCurve.points.length >= 3) {
    for(let rf=0; rf<=1; rf+=0.05) {
      const logMW = (calibrationCurve.a * rf * rf) + (calibrationCurve.b * rf) + calibrationCurve.c;
      curveData.push({ x: rf, y: logMW });
    }
  }
  
  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          type: 'line',
          label: lineLabel,
          data: curveData,
          borderColor: 'rgba(0, 242, 254, 0.5)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.4
        },
        {
          type: 'scatter',
          label: scatterLabel,
          data: scatterData,
          backgroundColor: '#00F2FE',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#9ca3af', boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const mw = Math.pow(10, ctx.raw.y);
              return `Rf: ${ctx.raw.x.toFixed(2)}, ~${mw.toFixed(0)} bp`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: xAxisTitle, color: '#9ca3af' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          title: { display: true, text: yAxisTitle, color: '#9ca3af' },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });
}
