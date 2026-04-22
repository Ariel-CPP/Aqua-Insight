const AppState = {
  referenceImage: null,
  referenceCanvas: null,
  referenceContext: null,

  resultCanvas: null,
  resultContext: null,

  batchImages: [],
  currentImageIndex: 0,

  categories: {
    A: { name: 'Category A', polygons: [] },
    B: { name: 'Category B', polygons: [] },
    C: { name: 'Category C', polygons: [] }
  },

  activeCategory: 'A',

  isDrawing: false,
  currentPolygon: []
};

document.addEventListener('DOMContentLoaded', () => {
  initializeCanvas();
  initializeUpload();
  initializeCategory();
  initializePolygonDrawing();
  initializeZoomPan();
  initializeNavigation();
});

/* ================= INIT ================= */

function initializeCanvas() {
  AppState.referenceCanvas = document.getElementById('referenceCanvas');
  AppState.referenceContext = AppState.referenceCanvas.getContext('2d');

  AppState.resultCanvas = document.getElementById('resultCanvas');
  AppState.resultContext = AppState.resultCanvas.getContext('2d');
}

/* ================= UPLOAD ================= */

function initializeUpload() {
  const refBtn = document.getElementById('uploadReferenceBtn');
  const refInput = document.getElementById('referenceInput');

  refBtn.addEventListener('click', () => refInput.click());

  refInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    loadImage(file).then(img => {
      AppState.referenceImage = img;
      renderReferenceImage();
      updateStatus('Reference Loaded');
    });
  });

  const batchBtn = document.getElementById('uploadBatchBtn');
  const batchInput = document.getElementById('batchInput');

  batchBtn.addEventListener('click', () => batchInput.click());

  batchInput.addEventListener('change', e => {
    const files = Array.from(e.target.files);

    AppState.batchImages = [];

    Promise.all(files.map(loadImage)).then(images => {
      AppState.batchImages = images;
      AppState.currentImageIndex = 0;

      updateStatus(`${images.length} Images Loaded`);
    });
  });
}

/* ================= CATEGORY ================= */

function initializeCategory() {
  const items = document.querySelectorAll('.category-item');

  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('active-category'));

      item.classList.add('active-category');

      AppState.activeCategory = item.dataset.category;
    });

    const input = item.querySelector('input');

    input.addEventListener('input', () => {
      const cat = item.dataset.category;
      AppState.categories[cat].name = input.value;
    });
  });
}

/* ================= IMAGE LOADER ================= */

function loadImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

/* ================= RENDER ================= */

function renderReferenceImage() {
  const canvas = AppState.referenceCanvas;
  const ctx = AppState.referenceContext;
  const img = AppState.referenceImage;

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
}

/* ================= STATUS ================= */

function updateStatus(text) {
  const chip = document.getElementById('statusChip');
  if (chip) chip.textContent = text;
}
/* ================= POLYGON DRAW ================= */

function initializePolygonDrawing() {
  const canvas = AppState.referenceCanvas;

  canvas.addEventListener('mousedown', handleCanvasClick);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('dblclick', finishPolygon);
}

/* ================= CLICK ================= */

function handleCanvasClick(e) {
  if (!AppState.referenceImage) return;

  const pos = getMousePos(e);

  AppState.currentPolygon.push(pos);
  AppState.isDrawing = true;

  renderReferenceWithOverlay();
}

/* ================= MOUSE MOVE ================= */

function handleMouseMove(e) {
  if (!AppState.isDrawing) return;

  const pos = getMousePos(e);

  renderReferenceWithOverlay(pos);
}

/* ================= FINISH POLYGON ================= */

function finishPolygon() {
  if (AppState.currentPolygon.length < 3) {
    AppState.currentPolygon = [];
    AppState.isDrawing = false;
    return;
  }

  const category = AppState.activeCategory;

  AppState.categories[category].polygons.push([
    ...AppState.currentPolygon
  ]);

  AppState.currentPolygon = [];
  AppState.isDrawing = false;

  updatePolygonInfo();
  renderReferenceWithOverlay();
}

/* ================= RENDER OVERLAY ================= */

function renderReferenceWithOverlay(mousePos = null) {
  const ctx = AppState.referenceContext;
  const canvas = AppState.referenceCanvas;
  const img = AppState.referenceImage;

  if (!img) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  // draw saved polygons
  Object.keys(AppState.categories).forEach(cat => {
    const color = getCategoryColor(cat);

    AppState.categories[cat].polygons.forEach(poly => {
      drawPolygon(ctx, poly, color);
    });
  });

  // draw current polygon
  if (AppState.currentPolygon.length > 0) {
    const color = getCategoryColor(AppState.activeCategory);

    drawPolygon(ctx, AppState.currentPolygon, color, true);

    if (mousePos) {
      const last = AppState.currentPolygon[AppState.currentPolygon.length - 1];

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/* ================= DRAW FUNCTION ================= */

function drawPolygon(ctx, points, color, isOpen = false) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  if (!isOpen) ctx.closePath();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = color + '33';
  ctx.fill();
}

/* ================= HELPERS ================= */

function getMousePos(e) {
  const rect = AppState.referenceCanvas.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left) * (AppState.referenceCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (AppState.referenceCanvas.height / rect.height)
  };
}

function getCategoryColor(cat) {
  if (cat === 'A') return '#49d6ff';
  if (cat === 'B') return '#ffb84d';
  if (cat === 'C') return '#48d597';
  return '#ffffff';
}

/* ================= INFO ================= */

function updatePolygonInfo() {
  const container = document.getElementById('polygonInfo');

  container.innerHTML = `
    <p>A: ${AppState.categories.A.polygons.length} polygons</p>
    <p>B: ${AppState.categories.B.polygons.length} polygons</p>
    <p>C: ${AppState.categories.C.polygons.length} polygons</p>
  `;
}
/* ================= ZOOM & PAN ================= */

AppState.viewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastX: 0,
  lastY: 0
};

function initializeZoomPan() {
  const canvas = AppState.referenceCanvas;

  canvas.addEventListener('wheel', handleZoom);
  canvas.addEventListener('mousedown', startPan);
  canvas.addEventListener('mousemove', handlePan);
  canvas.addEventListener('mouseup', endPan);
  canvas.addEventListener('mouseleave', endPan);
}

/* ================= ZOOM ================= */

function handleZoom(e) {
  e.preventDefault();

  const zoomFactor = 1.1;
  const { offsetX, offsetY } = e;

  const scale = AppState.viewport.scale;

  const newScale = e.deltaY < 0
    ? scale * zoomFactor
    : scale / zoomFactor;

  const mouse = screenToWorld(offsetX, offsetY);

  AppState.viewport.scale = newScale;

  AppState.viewport.offsetX =
    offsetX - mouse.x * newScale;

  AppState.viewport.offsetY =
    offsetY - mouse.y * newScale;

  renderReferenceWithOverlay();
}

/* ================= PAN ================= */

function startPan(e) {
  if (e.button !== 1 && e.button !== 0) return;

  AppState.viewport.isDragging = true;
  AppState.viewport.lastX = e.clientX;
  AppState.viewport.lastY = e.clientY;
}

function handlePan(e) {
  if (!AppState.viewport.isDragging) return;

  const dx = e.clientX - AppState.viewport.lastX;
  const dy = e.clientY - AppState.viewport.lastY;

  AppState.viewport.offsetX += dx;
  AppState.viewport.offsetY += dy;

  AppState.viewport.lastX = e.clientX;
  AppState.viewport.lastY = e.clientY;

  renderReferenceWithOverlay();
}

function endPan() {
  AppState.viewport.isDragging = false;
}

/* ================= TRANSFORM ================= */

function applyTransform(ctx) {
  const v = AppState.viewport;

  ctx.setTransform(
    v.scale,
    0,
    0,
    v.scale,
    v.offsetX,
    v.offsetY
  );
}

/* ================= SCREEN <-> WORLD ================= */

function screenToWorld(x, y) {
  const v = AppState.viewport;

  return {
    x: (x - v.offsetX) / v.scale,
    y: (y - v.offsetY) / v.scale
  };
}

/* ================= PATCH RENDER ================= */

/* GANTI renderReferenceWithOverlay dengan ini */

function renderReferenceWithOverlay(mousePos = null) {
  const ctx = AppState.referenceContext;
  const canvas = AppState.referenceCanvas;
  const img = AppState.referenceImage;

  if (!img) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  applyTransform(ctx);

  ctx.drawImage(img, 0, 0);

  // polygons
  Object.keys(AppState.categories).forEach(cat => {
    const color = getCategoryColor(cat);

    AppState.categories[cat].polygons.forEach(poly => {
      drawPolygon(ctx, poly, color);
    });
  });

  // drawing
  if (AppState.currentPolygon.length > 0) {
    const color = getCategoryColor(AppState.activeCategory);

    drawPolygon(ctx, AppState.currentPolygon, color, true);

    if (mousePos) {
      const last = AppState.currentPolygon.at(-1);

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}

/* ================= PATCH MOUSE ================= */

function getMousePos(e) {
  const rect = AppState.referenceCanvas.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  return screenToWorld(x, y);
}
/* ================= FEATURE EXTRACTION ================= */

function extractPolygonFeatures(imageData, polygon) {
  const pixels = getPixelsInsidePolygon(imageData, polygon);

  if (pixels.length === 0) return null;

  let r = 0, g = 0, b = 0;

  pixels.forEach(p => {
    r += p.r;
    g += p.g;
    b += p.b;
  });

  const mean = {
    r: r / pixels.length,
    g: g / pixels.length,
    b: b / pixels.length
  };

  const area = pixels.length;

  const perimeter = estimatePerimeter(polygon);

  const circularity =
    (4 * Math.PI * area) / (perimeter * perimeter || 1);

  return {
    mean,
    area,
    circularity
  };
}

/* ================= PIXEL EXTRACTION ================= */

function getPixelsInsidePolygon(imageData, polygon) {
  const { width, data } = imageData;

  const pixels = [];

  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      if (pointInPolygon(x, y, polygon)) {
        const i = (y * width + x) * 4;

        pixels.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2]
        });
      }
    }
  }

  return pixels;
}

/* ================= POINT IN POLYGON ================= */

function pointInPolygon(x, y, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/* ================= PERIMETER ================= */

function estimatePerimeter(polygon) {
  let p = 0;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];

    const dx = a.x - b.x;
    const dy = a.y - b.y;

    p += Math.sqrt(dx * dx + dy * dy);
  }

  return p;
}

/* ================= BUILD REFERENCE ================= */

function buildReferenceFeatures() {
  const img = AppState.referenceImage;
  const ctx = AppState.referenceContext;

  const imageData = ctx.getImageData(
    0,
    0,
    img.width,
    img.height
  );

  const reference = {};

  Object.keys(AppState.categories).forEach(cat => {
    reference[cat] = AppState.categories[cat].polygons.map(poly =>
      extractPolygonFeatures(imageData, poly)
    ).filter(Boolean);
  });

  return reference;
}

/* ================= SIMILARITY ================= */

function computeSimilarity(a, b) {
  if (!a || !b) return 0;

  const colorDiff =
    Math.abs(a.mean.r - b.mean.r) +
    Math.abs(a.mean.g - b.mean.g) +
    Math.abs(a.mean.b - b.mean.b);

  const areaDiff = Math.abs(a.area - b.area) / (a.area + 1);

  const circDiff = Math.abs(a.circularity - b.circularity);

  const score =
    100 -
    (colorDiff * 0.3 +
      areaDiff * 50 +
      circDiff * 50);

  return Math.max(0, score);
}
/* ================= RUN DETECTION ================= */

document.getElementById('runRecognitionBtn')
  .addEventListener('click', runDetection);

function runDetection() {
  if (!AppState.referenceImage) {
    updateStatus('No Reference Image');
    return;
  }

  if (AppState.batchImages.length === 0) {
    updateStatus('No Target Images');
    return;
  }

  const reference = buildReferenceFeatures();

  const results = [];

  AppState.batchImages.forEach((img, index) => {
    const detections = detectInImage(img, reference);

    results.push({
      imageIndex: index,
      detections
    });
  });

  AppState.detectionResults = results;

  renderDetectionResults();
  updateStatus('Detection Complete');
}

/* ================= DETECT SINGLE IMAGE ================= */

function detectInImage(image, reference) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = image.width;
  canvas.height = image.height;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const detections = [];

  const step = 20; // scanning resolution
  const size = 40; // window size

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {

      const poly = [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size }
      ];

      const feature = extractPolygonFeatures(imageData, poly);

      if (!feature) continue;

      let bestCategory = null;
      let bestScore = 0;

      Object.keys(reference).forEach(cat => {
        reference[cat].forEach(ref => {
          const score = computeSimilarity(feature, ref);

          if (score > bestScore) {
            bestScore = score;
            bestCategory = cat;
          }
        });
      });

      if (bestScore > 60) {
        detections.push({
          x,
          y,
          size,
          category: bestCategory,
          score: bestScore,
          area: feature.area,
          circularity: feature.circularity
        });
      }
    }
  }

  return mergeDetections(detections);
}

/* ================= MERGE OVERLAP ================= */

function mergeDetections(detections) {
  const result = [];

  detections.forEach(det => {
    const overlap = result.find(r =>
      Math.abs(r.x - det.x) < det.size &&
      Math.abs(r.y - det.y) < det.size &&
      r.category === det.category
    );

    if (!overlap) {
      result.push(det);
    } else {
      if (det.score > overlap.score) {
        Object.assign(overlap, det);
      }
    }
  });

  return result;
}
/* ================= RENDER RESULT ================= */

function renderDetectionResults() {
  if (!AppState.detectionResults || AppState.detectionResults.length === 0) return;

 renderCurrentDetection();
return;
  const image = AppState.batchImages[current.imageIndex];
  const detections = current.detections;

  const canvas = AppState.resultCanvas;
  const ctx = AppState.resultContext;

  canvas.width = image.width;
  canvas.height = image.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  detections.forEach((det, index) => {
    drawDetection(ctx, det, index + 1);
  });
}

/* ================= DRAW DETECTION ================= */

function drawDetection(ctx, det, index) {
  const color = getCategoryColor(det.category);

  // BOX
  ctx.beginPath();
  ctx.rect(det.x, det.y, det.size, det.size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // NUMBER
  ctx.fillStyle = color;
  ctx.font = 'bold 14px Inter';
  ctx.fillText(index, det.x + 4, det.y + 16);

  // LABEL
  const name = AppState.categories[det.category].name;

  const text = `${name} (${det.score.toFixed(1)}%)`;

  ctx.fillStyle = color;
  ctx.font = '12px Inter';
  ctx.fillText(text, det.x, det.y - 6);

  // EXTRA INFO
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Inter';

  ctx.fillText(
    `A:${Math.round(det.area)} C:${det.circularity.toFixed(2)}`,
    det.x,
    det.y + det.size + 12
  );
}
/* ================= NAVIGATION ================= */

function initializeNavigation() {
  const toolbarTitle = document.getElementById('currentImageName');

  // tombol keyboard
  document.addEventListener('keydown', e => {
    if (!AppState.detectionResults) return;

    if (e.key === 'ArrowRight') {
      nextImage();
    }

    if (e.key === 'ArrowLeft') {
      prevImage();
    }
  });

  // update awal
  updateImageTitle();
}

/* ================= NEXT ================= */

function nextImage() {
  if (!AppState.detectionResults) return;

  if (AppState.currentImageIndex < AppState.batchImages.length - 1) {
    AppState.currentImageIndex++;
  }

  renderCurrentDetection();
}

/* ================= PREV ================= */

function prevImage() {
  if (!AppState.detectionResults) return;

  if (AppState.currentImageIndex > 0) {
    AppState.currentImageIndex--;
  }

  renderCurrentDetection();
}

/* ================= RENDER CURRENT ================= */

function renderCurrentDetection() {
  const index = AppState.currentImageIndex;

  const result = AppState.detectionResults[index];
  const image = AppState.batchImages[index];

  const canvas = AppState.resultCanvas;
  const ctx = AppState.resultContext;

  canvas.width = image.width;
  canvas.height = image.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  result.detections.forEach((det, i) => {
    drawDetection(ctx, det, i + 1);
  });

  updateImageTitle();
  renderResultsTable();
}

/* ================= TITLE ================= */

function updateImageTitle() {
  const el = document.getElementById('currentImageName');

  if (!AppState.batchImages.length) {
    el.textContent = 'No Image';
    return;
  }

  el.textContent =
    `Image ${AppState.currentImageIndex + 1} / ${AppState.batchImages.length}`;
}
/* ================= TABLE ================= */

function renderResultsTable() {
  const tbody = document.getElementById('resultsTableBody');

  const result = AppState.detectionResults[AppState.currentImageIndex];

  if (!result || result.detections.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No detection</td></tr>`;
    return;
  }

  tbody.innerHTML = '';

  result.detections.forEach((det, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${AppState.categories[det.category].name}</td>
      <td>${det.score.toFixed(1)}%</td>
      <td>${Math.round(det.area)}</td>
      <td>${det.circularity.toFixed(2)}</td>
    `;

    row.addEventListener('click', () => {
      highlightDetection(index);
    });

    tbody.appendChild(row);
  });
}

/* ================= HIGHLIGHT ================= */

AppState.highlightedIndex = null;

function highlightDetection(index) {
  AppState.highlightedIndex = index;
  renderCurrentDetection();
}

/* ================= PATCH DRAW ================= */

function drawDetection(ctx, det, index) {
  const color = getCategoryColor(det.category);

  const isActive = AppState.highlightedIndex === (index - 1);

  ctx.beginPath();
  ctx.rect(det.x, det.y, det.size, det.size);
  ctx.strokeStyle = color;
  ctx.lineWidth = isActive ? 4 : 2;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 14px Inter';
  ctx.fillText(index, det.x + 4, det.y + 16);

  const name = AppState.categories[det.category].name;

  ctx.fillStyle = color;
  ctx.font = '12px Inter';
  ctx.fillText(`${name} (${det.score.toFixed(1)}%)`, det.x, det.y - 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Inter';
  ctx.fillText(
    `A:${Math.round(det.area)} C:${det.circularity.toFixed(2)}`,
    det.x,
    det.y + det.size + 12
  );
}
