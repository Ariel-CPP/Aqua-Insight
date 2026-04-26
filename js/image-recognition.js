/* =========================
   APP STATE (MODULAR)
========================= */
const AppState = {
  referenceImage: null,
  targetImage: null,

  categories: [
    { id: 'A', name: 'Category A', color: '#49d6ff', polygons: [] },
    { id: 'B', name: 'Category B', color: '#48d597', polygons: [] },
    { id: 'C', name: 'Category C', color: '#ffb84d', polygons: [] }
  ],

  activeCategoryId: 'A',

  results: [],
  threshold: 50
};

/* =========================
   DOM ELEMENTS
========================= */
const referenceInput = document.getElementById('referenceInput');
const targetInput = document.getElementById('targetInput');

const uploadReferenceBtn = document.getElementById('uploadReferenceBtn');
const uploadTargetBtn = document.getElementById('uploadTargetBtn');

const referenceCanvas = document.getElementById('referenceCanvas');
const targetCanvas = document.getElementById('targetCanvas');

const referenceCtx = referenceCanvas.getContext('2d');
const targetCtx = targetCanvas.getContext('2d');

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  renderCategoryList();
});

/* =========================
   EVENT BINDING
========================= */
function bindEvents() {
  uploadReferenceBtn.onclick = () => referenceInput.click();
  uploadTargetBtn.onclick = () => targetInput.click();

  referenceInput.onchange = (e) => handleImageUpload(e, 'reference');
  targetInput.onchange = (e) => handleImageUpload(e, 'target');
}

/* =========================
   IMAGE UPLOAD
========================= */
function handleImageUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = function (e) {
    img.src = e.target.result;
  };

  img.onload = function () {
    if (type === 'reference') {
      AppState.referenceImage = img;
      drawImageToCanvas(img, referenceCanvas, referenceCtx);
    } else {
      AppState.targetImage = img;
      drawImageToCanvas(img, targetCanvas, targetCtx);
    }
  };

  reader.readAsDataURL(file);
}

/* =========================
   DRAW IMAGE
========================= */
function drawImageToCanvas(image, canvas, ctx) {
  const maxSize = 800; // downscale for performance

  let width = image.width;
  let height = image.height;

  const scale = Math.min(maxSize / width, maxSize / height, 1);

  width *= scale;
  height *= scale;

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
}

/* =========================
   CATEGORY UI
========================= */
function renderCategoryList() {
  const container = document.getElementById('categoryList');
  container.innerHTML = '';

  AppState.categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-item';
    div.style.borderLeft = `4px solid ${cat.color}`;
    div.textContent = cat.name;

    div.onclick = () => {
      AppState.activeCategoryId = cat.id;
      highlightActiveCategory();
    };

    container.appendChild(div);
  });

  highlightActiveCategory();
}

function highlightActiveCategory() {
  const items = document.querySelectorAll('.category-item');

  items.forEach((el, i) => {
    const cat = AppState.categories[i];
    el.style.background =
      cat.id === AppState.activeCategoryId
        ? 'rgba(73,214,255,0.1)'
        : 'transparent';
  });
}

/* =========================
   THRESHOLD CONTROL
========================= */
const thresholdSlider = document.getElementById('thresholdSlider');

thresholdSlider.oninput = () => {
  AppState.threshold = Number(thresholdSlider.value);
};

/* =========================
   POLYGON DRAW STATE
========================= */
let currentPolygon = [];
let isDrawing = false;

/* =========================
   INIT POLYGON EVENTS
========================= */
referenceCanvas.addEventListener('click', onCanvasClick);
referenceCanvas.addEventListener('dblclick', onCanvasDoubleClick);

/* =========================
   GET MOUSE POSITION
========================= */
function getMousePos(canvas, event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

/* =========================
   CLICK → ADD POINT
========================= */
function onCanvasClick(e) {
  if (!AppState.referenceImage) return;

  const pos = getMousePos(referenceCanvas, e);

  currentPolygon.push(pos);
  isDrawing = true;

  redrawReferenceCanvas();
}

/* =========================
   DOUBLE CLICK → FINISH
========================= */
function onCanvasDoubleClick() {
  if (currentPolygon.length < 3) return;

  const category = AppState.categories.find(
    c => c.id === AppState.activeCategoryId
  );

  category.polygons.push([...currentPolygon]);

  currentPolygon = [];
  isDrawing = false;

  redrawReferenceCanvas();
}

/* =========================
   REDRAW CANVAS
========================= */
function redrawReferenceCanvas() {
  if (!AppState.referenceImage) return;

  drawImageToCanvas(
    AppState.referenceImage,
    referenceCanvas,
    referenceCtx
  );

  drawSavedPolygons();
  drawCurrentPolygon();
}

/* =========================
   DRAW SAVED POLYGONS
========================= */
function drawSavedPolygons() {
  AppState.categories.forEach(cat => {
    referenceCtx.strokeStyle = cat.color;
    referenceCtx.lineWidth = 2;

    cat.polygons.forEach(poly => {
      referenceCtx.beginPath();

      poly.forEach((p, i) => {
        if (i === 0) {
          referenceCtx.moveTo(p.x, p.y);
        } else {
          referenceCtx.lineTo(p.x, p.y);
        }
      });

      referenceCtx.closePath();
      referenceCtx.stroke();
    });
  });
}

/* =========================
   DRAW CURRENT POLYGON
========================= */
function drawCurrentPolygon() {
  if (!isDrawing || currentPolygon.length === 0) return;

  referenceCtx.strokeStyle = '#ffffff';
  referenceCtx.lineWidth = 1.5;

  referenceCtx.beginPath();

  currentPolygon.forEach((p, i) => {
    if (i === 0) {
      referenceCtx.moveTo(p.x, p.y);
    } else {
      referenceCtx.lineTo(p.x, p.y);
    }
  });

  referenceCtx.stroke();

  // draw points
  currentPolygon.forEach(p => {
    referenceCtx.beginPath();
    referenceCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    referenceCtx.fillStyle = '#ffffff';
    referenceCtx.fill();
  });
}

/* =========================
   VIEWPORT STATE
========================= */
const ViewState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastX: 0,
  lastY: 0
};

/* =========================
   APPLY TRANSFORM
========================= */
function applyTransform(ctx) {
  ctx.setTransform(
    ViewState.scale,
    0,
    0,
    ViewState.scale,
    ViewState.offsetX,
    ViewState.offsetY
  );
}

/* =========================
   REDRAW WITH VIEW
========================= */
function redrawReferenceCanvas() {
  if (!AppState.referenceImage) return;

  const canvas = referenceCanvas;
  const ctx = referenceCtx;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  applyTransform(ctx);

  ctx.drawImage(AppState.referenceImage, 0, 0, canvas.width, canvas.height);

  drawSavedPolygons();
  drawCurrentPolygon();
}

/* =========================
   ZOOM (WHEEL)
========================= */
referenceCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const zoomFactor = 1.1;

  if (e.deltaY < 0) {
    ViewState.scale *= zoomFactor;
  } else {
    ViewState.scale /= zoomFactor;
  }

  redrawReferenceCanvas();
});

/* =========================
   PAN (DRAG)
========================= */
referenceCanvas.addEventListener('mousedown', (e) => {
  ViewState.isDragging = true;
  ViewState.lastX = e.clientX;
  ViewState.lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
  ViewState.isDragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (!ViewState.isDragging) return;

  const dx = e.clientX - ViewState.lastX;
  const dy = e.clientY - ViewState.lastY;

  ViewState.offsetX += dx;
  ViewState.offsetY += dy;

  ViewState.lastX = e.clientX;
  ViewState.lastY = e.clientY;

  redrawReferenceCanvas();
});

/* =========================
   CROSSHAIR (DYNAMIC)
========================= */
referenceCanvas.addEventListener('mousemove', (e) => {
  const wrapper = referenceCanvas.parentElement;

  const rect = wrapper.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  wrapper.style.setProperty('--crosshair-x', `${x}px`);
  wrapper.style.setProperty('--crosshair-y', `${y}px`);
});

/* =========================
   CSS SUPPORT (DYNAMIC)
========================= */
const style = document.createElement('style');
style.innerHTML = `
.canvas-wrapper::before,
.canvas-wrapper::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.canvas-wrapper::before {
  left: var(--crosshair-x);
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(73,214,255,0.4);
}

.canvas-wrapper::after {
  top: var(--crosshair-y);
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(73,214,255,0.4);
}
`;
document.head.appendChild(style);
/* =========================
   RUN DETECTION
========================= */
const runBtn = document.getElementById('runDetectionBtn');

runBtn.onclick = () => {
  if (!AppState.targetImage) return;

  AppState.results = [];

  detectObjects();
  alert('Detection complete');
};

/* =========================
   MAIN DETECTION
========================= */
function detectObjects() {
  const canvas = targetCanvas;
  const ctx = targetCtx;

  const width = canvas.width;
  const height = canvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const step = 12; // LARGE STEP = FAST
  const windowSize = 20;

  let idCounter = 1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {

      const feature = extractFeature(data, width, x, y, windowSize);

      const match = classifyFeature(feature);

      if (match.confidence > AppState.threshold) {

        AppState.results.push({
          id: idCounter++,
          x,
          y,
          width: windowSize,
          height: windowSize,
          category: match.category,
          confidence: match.confidence,
          area: windowSize * windowSize,
          circularity: calculateCircularity(windowSize)
        });

      }
    }
  }
}

/* =========================
   FEATURE EXTRACTION
========================= */
function extractFeature(data, width, startX, startY, size) {
  let r = 0, g = 0, b = 0;
  let count = 0;

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {

      const px = startX + x;
      const py = startY + y;

      const idx = (py * width + px) * 4;

      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];

      count++;
    }
  }

  return {
    r: r / count,
    g: g / count,
    b: b / count
  };
}

/* =========================
   CLASSIFICATION
========================= */
function classifyFeature(feature) {
  let bestMatch = {
    category: null,
    confidence: 0
  };

  AppState.categories.forEach(cat => {

    cat.polygons.forEach(poly => {

      const refFeature = getPolygonFeature(poly);

      const similarity = compareRGB(feature, refFeature);

      if (similarity > bestMatch.confidence) {
        bestMatch = {
          category: cat.name,
          confidence: similarity
        };
      }
    });

  });

  return bestMatch;
}

/* =========================
   POLYGON FEATURE (SIMPLE)
========================= */
function getPolygonFeature(poly) {
  let sumX = 0, sumY = 0;

  poly.forEach(p => {
    sumX += p.x;
    sumY += p.y;
  });

  return {
    r: sumX % 255,
    g: sumY % 255,
    b: (sumX + sumY) % 255
  };
}

/* =========================
   RGB SIMILARITY
========================= */
function compareRGB(a, b) {
  const diff =
    Math.abs(a.r - b.r) +
    Math.abs(a.g - b.g) +
    Math.abs(a.b - b.b);

  return 100 - (diff / 765) * 100;
}

/* =========================
   CIRCULARITY (APPROX)
========================= */
function calculateCircularity(size) {
  return (4 * Math.PI * size) / (size * size + 1);
}

/* =========================
   RESULT CANVAS
========================= */
const resultCanvas = document.getElementById('resultCanvas');
const resultCtx = resultCanvas.getContext('2d');

/* =========================
   RENDER RESULT
========================= */
function renderResults() {
  if (!AppState.targetImage) return;

  // resize canvas mengikuti target
  resultCanvas.width = targetCanvas.width;
  resultCanvas.height = targetCanvas.height;

  // draw original image dulu
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.drawImage(
    targetCanvas,
    0,
    0,
    resultCanvas.width,
    resultCanvas.height
  );

  drawBoundingBoxes();
}

/* =========================
   DRAW BOXES
========================= */
function drawBoundingBoxes() {
  AppState.results.forEach(obj => {

    const color = getCategoryColor(obj.category);

    // BOX
    resultCtx.strokeStyle = color;
    resultCtx.lineWidth = 2;

    resultCtx.strokeRect(
      obj.x,
      obj.y,
      obj.width,
      obj.height
    );

    // LABEL BACKGROUND
    resultCtx.fillStyle = color;
    resultCtx.fillRect(
      obj.x,
      obj.y - 16,
      80,
      16
    );

    // TEXT
    resultCtx.fillStyle = '#000';
    resultCtx.font = '10px Arial';

    resultCtx.fillText(
      `${obj.id} (${Math.round(obj.confidence)}%)`,
      obj.x + 4,
      obj.y - 4
    );
  });
}

/* =========================
   CATEGORY COLOR
========================= */
function getCategoryColor(categoryName) {
  const cat = AppState.categories.find(c => c.name === categoryName);
  return cat ? cat.color : '#ffffff';
}

/* =========================
   TRIGGER RENDER AFTER DETECTION
========================= */
runBtn.onclick = () => {
  if (!AppState.targetImage) return;

  AppState.results = [];

  detectObjects();
  renderResults();
};

/* =========================
   RESET RESULT CANVAS
========================= */
function clearResults() {
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
}

/* =========================
   RESULT TABLE
========================= */
const resultTableBody = document.getElementById('resultTableBody');

/* =========================
   RENDER TABLE
========================= */
function renderResultTable() {
  if (!AppState.results || AppState.results.length === 0) {
    resultTableBody.innerHTML = `
      <tr>
        <td colspan="5">No data</td>
      </tr>
    `;
    return;
  }

  resultTableBody.innerHTML = '';

  AppState.results.forEach(obj => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${obj.id}</td>
      <td>${obj.category}</td>
      <td>${obj.area}</td>
      <td>${obj.circularity.toFixed(2)}</td>
      <td>${Math.round(obj.confidence)}%</td>
    `;

    // highlight on click
    row.onclick = () => highlightObject(obj);

    resultTableBody.appendChild(row);
  });
}

/* =========================
   HIGHLIGHT OBJECT
========================= */
function highlightObject(obj) {
  renderResults();

  resultCtx.strokeStyle = '#ffffff';
  resultCtx.lineWidth = 3;

  resultCtx.strokeRect(
    obj.x,
    obj.y,
    obj.width,
    obj.height
  );
}

/* =========================
   UPDATE AFTER DETECTION
========================= */
runBtn.onclick = () => {
  if (!AppState.targetImage) return;

  AppState.results = [];

  detectObjects();
  renderResults();
  renderResultTable();
};

/* =========================
   CLEAR TABLE
========================= */
function clearTable() {
  resultTableBody.innerHTML = `
    <tr>
      <td colspan="5">No data</td>
    </tr>
  `;
}

/* =========================
   FILTERED RESULTS
========================= */
function getFilteredResults() {
  return AppState.results.filter(
    obj => obj.confidence >= AppState.threshold
  );
}

/* =========================
   RENDER FILTERED RESULT
========================= */
function renderFilteredResults() {
  if (!AppState.targetImage) return;

  const filtered = getFilteredResults();

  // draw base image
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.drawImage(
    targetCanvas,
    0,
    0,
    resultCanvas.width,
    resultCanvas.height
  );

  // draw boxes
  filtered.forEach(obj => {
    const color = getCategoryColor(obj.category);

    resultCtx.strokeStyle = color;
    resultCtx.lineWidth = 2;

    resultCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);

    resultCtx.fillStyle = color;
    resultCtx.fillRect(obj.x, obj.y - 16, 80, 16);

    resultCtx.fillStyle = '#000';
    resultCtx.font = '10px Arial';

    resultCtx.fillText(
      `${obj.id} (${Math.round(obj.confidence)}%)`,
      obj.x + 4,
      obj.y - 4
    );
  });

  renderFilteredTable(filtered);
}

/* =========================
   TABLE FILTER
========================= */
function renderFilteredTable(filtered) {
  if (filtered.length === 0) {
    resultTableBody.innerHTML = `
      <tr>
        <td colspan="5">No data</td>
      </tr>
    `;
    return;
  }

  resultTableBody.innerHTML = '';

  filtered.forEach(obj => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${obj.id}</td>
      <td>${obj.category}</td>
      <td>${obj.area}</td>
      <td>${obj.circularity.toFixed(2)}</td>
      <td>${Math.round(obj.confidence)}%</td>
    `;

    resultTableBody.appendChild(row);
  });
}

/* =========================
   SLIDER EVENT
========================= */
thresholdSlider.oninput = () => {
  AppState.threshold = Number(thresholdSlider.value);
  renderFilteredResults();
};

/* =========================
   UPDATE AFTER DETECTION
========================= */
runBtn.onclick = () => {
  if (!AppState.targetImage) return;

  AppState.results = [];

  detectObjects();

  renderResults();
  renderResultTable();

  renderFilteredResults(); // apply filter langsung
};

/* =========================
   PERFORMANCE CONFIG
========================= */
const PerformanceConfig = {
  maxImageSize: 600,     // downscale lebih kecil untuk mobile
  maxResults: 300,       // limit hasil
  baseStep: 12           // default scan step
};

/* =========================
   ADAPTIVE STEP
========================= */
function getAdaptiveStep(width) {
  if (width > 800) return 16;
  if (width > 500) return 12;
  return 8;
}

/* =========================
   OPTIMIZED DRAW IMAGE
========================= */
function drawImageToCanvas(image, canvas, ctx) {
  const maxSize = PerformanceConfig.maxImageSize;

  let width = image.width;
  let height = image.height;

  const scale = Math.min(maxSize / width, maxSize / height, 1);

  width *= scale;
  height *= scale;

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
}

/* =========================
   OPTIMIZED DETECTION
========================= */
function detectObjects() {
  const canvas = targetCanvas;
  const ctx = targetCtx;

  const width = canvas.width;
  const height = canvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const step = getAdaptiveStep(width);
  const windowSize = 20;

  let idCounter = 1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {

      if (AppState.results.length > PerformanceConfig.maxResults) return;

      const feature = extractFeature(data, width, x, y, windowSize);
      const match = classifyFeature(feature);

      if (match.confidence > AppState.threshold) {

        AppState.results.push({
          id: idCounter++,
          x,
          y,
          width: windowSize,
          height: windowSize,
          category: match.category,
          confidence: match.confidence,
          area: windowSize * windowSize,
          circularity: calculateCircularity(windowSize)
        });

      }
    }
  }
}

/* =========================
   TOUCH SUPPORT (PAN)
========================= */
referenceCanvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  ViewState.isDragging = true;
  ViewState.lastX = t.clientX;
  ViewState.lastY = t.clientY;
});

referenceCanvas.addEventListener('touchmove', (e) => {
  if (!ViewState.isDragging) return;

  const t = e.touches[0];

  const dx = t.clientX - ViewState.lastX;
  const dy = t.clientY - ViewState.lastY;

  ViewState.offsetX += dx;
  ViewState.offsetY += dy;

  ViewState.lastX = t.clientX;
  ViewState.lastY = t.clientY;

  redrawReferenceCanvas();
});

referenceCanvas.addEventListener('touchend', () => {
  ViewState.isDragging = false;
});

/* =========================
   PREVENT SCROLL WHEN ZOOM
========================= */
referenceCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
}, { passive: false });

/* =========================
   SIMPLE MEMORY CLEANUP
========================= */
function resetApp() {
  AppState.results = [];
  clearResults();
  clearTable();
}

