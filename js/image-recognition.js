/* ===== GLOBAL STATE ===== */
const AppState = {
  referenceImage: null,
  targetImage: null,
  batchImages: [],
  currentBatchIndex: 0,

  categories: [],
  activeCategoryId: null,

  results: [],
  threshold: 70
};

/* ===== INIT ===== */
function init() {
  bindUI();
}

/* ===== UI BINDING ===== */
function bindUI() {
  const refBtn = document.getElementById('uploadReferenceBtn');
  const refInput = document.getElementById('referenceInput');

  const targetBtn = document.getElementById('uploadTargetBtn');
  const targetInput = document.getElementById('targetInput');

  const threshold = document.getElementById('thresholdSlider');

  if (refBtn && refInput) {
    refBtn.addEventListener('click', () => refInput.click());

    refInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      loadImage(file, (img) => {
        AppState.referenceImage = img;
        renderReference();
      });
    });
  }

  if (targetBtn && targetInput) {
    targetBtn.addEventListener('click', () => targetInput.click());

    targetInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      AppState.batchImages = [];
      AppState.currentBatchIndex = 0;

      let loaded = 0;

      files.forEach(file => {
        loadImage(file, (img) => {
          AppState.batchImages.push(img);
          loaded++;

          if (loaded === files.length) {
            AppState.targetImage = AppState.batchImages[0];
            renderTarget();
          }
        });
      });
    });
  }

  if (threshold) {
    threshold.addEventListener('input', (e) => {
      AppState.threshold = Number(e.target.value) || 0;
    });
  }
}

/* ===== IMAGE LOADER ===== */
function loadImage(file, callback) {
  if (!file || !callback) return;

  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    URL.revokeObjectURL(url);
    callback(img);
  };

  img.onerror = () => {
    console.error('Failed to load image');
  };

  img.src = url;
}

/* ===== RENDER ===== */
function renderReference() {
  const canvas = document.getElementById('referenceCanvas');
  if (!canvas || !AppState.referenceImage) return;

  const ctx = canvas.getContext('2d');

  canvas.width = AppState.referenceImage.width;
  canvas.height = AppState.referenceImage.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(AppState.referenceImage, 0, 0);
}

function renderTarget() {
  const canvas = document.getElementById('targetCanvas');
  if (!canvas || !AppState.targetImage) return;

  const ctx = canvas.getContext('2d');

  canvas.width = AppState.targetImage.width;
  canvas.height = AppState.targetImage.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(AppState.targetImage, 0, 0);
}

/* ===== START ===== */
document.addEventListener('DOMContentLoaded', init);

/* ===== POLYGON STATE ===== */
let drawingPolygon = [];
let isDrawing = false;

/* ===== CATEGORY SYSTEM ===== */
function createCategory(name = 'Category') {
  if (AppState.categories.length >= 3) {
    alert('Max 3 categories');
    return;
  }

  const category = {
    id: generateId(),
    name: name,
    color: randomColor(),
    polygons: []
  };

  AppState.categories.push(category);
  AppState.activeCategoryId = category.id;

  renderCategories();
}

/* ===== CATEGORY UI ===== */
function renderCategories() {
  const container = document.getElementById('categoryList');
  if (!container) return;

  container.innerHTML = '';

  AppState.categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-item';
    div.style.borderLeft = `4px solid ${cat.color}`;

    div.textContent = cat.name;

    div.onclick = () => {
      AppState.activeCategoryId = cat.id;
    };

    container.appendChild(div);
  });
}

/* ===== BIND CATEGORY BUTTON ===== */
(function bindCategoryButton(){
  const btn = document.getElementById('addCategoryBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    createCategory(`Category ${AppState.categories.length + 1}`);
  });
})();

/* ===== CANVAS DRAW ===== */
(function bindPolygonDrawing(){
  const canvas = document.getElementById('referenceCanvas');
  if (!canvas) return;

  canvas.addEventListener('click', (e) => {
    if (!AppState.referenceImage) return;
    if (!AppState.activeCategoryId) return;

    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    drawingPolygon.push({ x, y });
    isDrawing = true;

    renderReference();
  });

  canvas.addEventListener('dblclick', () => {
    if (drawingPolygon.length < 3) {
      alert('Polygon needs at least 3 points');
      return;
    }

    const category = AppState.categories.find(
      c => c.id === AppState.activeCategoryId
    );

    if (!category) return;

    category.polygons.push([...drawingPolygon]);

    drawingPolygon = [];
    isDrawing = false;

    renderReference();
  });
})();

/* ===== DRAW POLYGONS ===== */
function drawPolygons(ctx) {
  AppState.categories.forEach(cat => {
    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 2;

    cat.polygons.forEach(poly => {
      ctx.beginPath();

      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });

      ctx.closePath();
      ctx.stroke();
    });
  });

  /* drawing current polygon */
  if (drawingPolygon.length > 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();

    drawingPolygon.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });

    ctx.stroke();
  }
}

/* ===== EXTEND RENDER REFERENCE ===== */
const _renderReference = renderReference;

renderReference = function () {
  _renderReference();

  const canvas = document.getElementById('referenceCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  drawPolygons(ctx);
};

/* ===== UTIL ===== */
function generateId() {
  return 'id-' + Math.random().toString(36).slice(2, 9);
}

function randomColor() {
  return `hsl(${Math.random() * 360}, 70%, 60%)`;
}

/* ===== VIEWPORT STATE ===== */
const Viewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  lastX: 0,
  lastY: 0,
  mouseX: 0,
  mouseY: 0
};

/* ===== APPLY TRANSFORM ===== */
function applyTransform(ctx) {
  ctx.setTransform(
    Viewport.scale,
    0,
    0,
    Viewport.scale,
    Viewport.offsetX,
    Viewport.offsetY
  );
}

/* ===== RESET TRANSFORM ===== */
function resetTransform(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ===== EXTEND RENDER TARGET ===== */
const _renderTarget = renderTarget;

renderTarget = function () {
  const canvas = document.getElementById('targetCanvas');
  if (!canvas || !AppState.targetImage) return;

  const ctx = canvas.getContext('2d');

  canvas.width = AppState.targetImage.width;
  canvas.height = AppState.targetImage.height;

  resetTransform(ctx);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  applyTransform(ctx);
  ctx.drawImage(AppState.targetImage, 0, 0);

  drawCrosshair(canvas);
};

/* ===== EXTEND RENDER REFERENCE ===== */
const __renderReference = renderReference;

renderReference = function () {
  const canvas = document.getElementById('referenceCanvas');
  if (!canvas || !AppState.referenceImage) return;

  const ctx = canvas.getContext('2d');

  canvas.width = AppState.referenceImage.width;
  canvas.height = AppState.referenceImage.height;

  resetTransform(ctx);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  applyTransform(ctx);
  ctx.drawImage(AppState.referenceImage, 0, 0);

  drawPolygons(ctx);
  drawCrosshair(canvas);
};

/* ===== CROSSHAIR ===== */
function drawCrosshair(canvas) {
  const ctx = canvas.getContext('2d');

  resetTransform(ctx);

  ctx.strokeStyle = 'rgba(73,214,255,0.4)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(Viewport.mouseX, 0);
  ctx.lineTo(Viewport.mouseX, canvas.height);

  ctx.moveTo(0, Viewport.mouseY);
  ctx.lineTo(canvas.width, Viewport.mouseY);
  ctx.stroke();
}

/* ===== BIND INTERACTION ===== */
(function bindViewport(){
  const canvases = [
    document.getElementById('referenceCanvas'),
    document.getElementById('targetCanvas'),
    document.getElementById('resultCanvas')
  ].filter(Boolean);

  if (canvases.length === 0) return;

  canvases.forEach(canvas => {

    /* ZOOM */
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const scaleAmount = e.deltaY > 0 ? 0.9 : 1.1;

      Viewport.scale *= scaleAmount;

      if (Viewport.scale < 0.2) Viewport.scale = 0.2;
      if (Viewport.scale > 5) Viewport.scale = 5;

      rerenderAll();
    });

    /* PAN START */
    canvas.addEventListener('mousedown', (e) => {
      Viewport.isDragging = true;
      Viewport.lastX = e.clientX;
      Viewport.lastY = e.clientY;
    });

    /* PAN MOVE */
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();

      Viewport.mouseX = e.clientX - rect.left;
      Viewport.mouseY = e.clientY - rect.top;

      if (Viewport.isDragging) {
        const dx = e.clientX - Viewport.lastX;
        const dy = e.clientY - Viewport.lastY;

        Viewport.offsetX += dx;
        Viewport.offsetY += dy;

        Viewport.lastX = e.clientX;
        Viewport.lastY = e.clientY;

        rerenderAll();
      } else {
        drawCrosshair(canvas);
      }
    });

    /* PAN END */
    window.addEventListener('mouseup', () => {
      Viewport.isDragging = false;
    });

  });
})();

/* ===== RERENDER ALL ===== */
function rerenderAll() {
  renderReference();
  renderTarget();
}

/* ===== DETECTION ENTRY ===== */
(function bindDetection(){
  const btn = document.getElementById('runDetectionBtn');
  if (!btn) return;

  btn.addEventListener('click', runDetection);
})();

function runDetection() {
  if (!AppState.referenceImage) {
    alert('Reference image required');
    return;
  }

  if (!AppState.targetImage) {
    alert('Target image required');
    return;
  }

  if (AppState.categories.length === 0) {
    alert('No categories defined');
    return;
  }

  AppState.results = [];

  const targetCanvas = document.createElement('canvas');
  const ctx = targetCanvas.getContext('2d');

  /* ===== DOWNSCALE FOR PERFORMANCE ===== */
  const scale = 0.5;
  targetCanvas.width = AppState.targetImage.width * scale;
  targetCanvas.height = AppState.targetImage.height * scale;

  ctx.drawImage(
    AppState.targetImage,
    0,
    0,
    targetCanvas.width,
    targetCanvas.height
  );

  const imgData = ctx.getImageData(
    0,
    0,
    targetCanvas.width,
    targetCanvas.height
  );

  const step = 16; /* sliding window */
  const size = 32;

  for (let y = 0; y < targetCanvas.height - size; y += step) {
    for (let x = 0; x < targetCanvas.width - size; x += step) {

      const feature = extractFeature(imgData, x, y, size);

      const match = matchFeature(feature);

      if (!match) continue;

      if (match.confidence < AppState.threshold / 100) continue;

      AppState.results.push({
        id: generateId(),
        x: x / scale,
        y: y / scale,
        width: size / scale,
        height: size / scale,
        category: match.category,
        confidence: match.confidence,
        feature: feature,
        refPoly: match.refPoly,
        scale: 1
      });
    }
  }

  renderResultOverlay();
  renderResultTable();
}

/* ===== FEATURE EXTRACTION ===== */
function extractFeature(imgData, startX, startY, size) {
  const data = imgData.data;
  const width = imgData.width;

  let r = 0, g = 0, b = 0;
  let count = 0;

  let variance = 0;
  let edge = 0;

  const step = 2; /* sampling */

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {

      const px = startX + x;
      const py = startY + y;

      const i = (py * width + px) * 4;

      const cr = data[i];
      const cg = data[i + 1];
      const cb = data[i + 2];

      r += cr;
      g += cg;
      b += cb;
      count++;

      /* simple edge (difference) */
      const next = i + 4;
      if (data[next]) {
        edge += Math.abs(cr - data[next]);
      }
    }
  }

  r /= count;
  g /= count;
  b /= count;

  /* variance */
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const px = startX + x;
      const py = startY + y;
      const i = (py * width + px) * 4;

      variance += Math.pow(data[i] - r, 2);
    }
  }

  variance /= count;

  return {
    r,
    g,
    b,
    texture: variance,
    edge
  };
}

/* ===== MATCH FEATURE ===== */
function matchFeature(feature) {
  let best = null;
  let bestScore = 0;

  AppState.categories.forEach(cat => {
    cat.polygons.forEach(poly => {

      const refFeature = computePolygonFeature(poly);

      if (!refFeature) return;

      const score = similarity(feature, refFeature);

      if (score > bestScore) {
        bestScore = score;
        best = {
          category: cat.name,
          confidence: score,
          refPoly: poly
        };
      }
    });
  });

  return best;
}

/* ===== SIMILARITY ===== */
function similarity(a, b) {
  const color =
    1 - (
      Math.abs(a.r - b.r) +
      Math.abs(a.g - b.g) +
      Math.abs(a.b - b.b)
    ) / 765;

  const texture =
    1 - Math.abs(a.texture - b.texture) / (b.texture + 1);

  const edge =
    1 - Math.abs(a.edge - b.edge) / (b.edge + 1);

  return (color * 0.5 + texture * 0.3 + edge * 0.2);
}

/* ===== REFERENCE FEATURE ===== */
function computePolygonFeature(poly) {
  if (!AppState.referenceImage) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = AppState.referenceImage.width;
  canvas.height = AppState.referenceImage.height;

  ctx.drawImage(AppState.referenceImage, 0, 0);

  const imgData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  /* simple bounding box */
  let minX = Infinity, minY = Infinity;
  let maxX = 0, maxY = 0;

  poly.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const size = Math.max(maxX - minX, maxY - minY);

  return extractFeature(imgData, minX, minY, size);
}

/* ===== APPLY NMS AFTER DETECTION ===== */
const _runDetection = runDetection;

runDetection = function () {
  _runDetection();

  AppState.results = applyNMS(AppState.results);
};

/* ===== NMS ===== */
function applyNMS(boxes) {
  if (!boxes || boxes.length === 0) return [];

  /* sort by confidence */
  boxes.sort((a, b) => b.confidence - a.confidence);

  const result = [];
  const used = new Set();

  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;

    const a = boxes[i];
    result.push(a);

    for (let j = i + 1; j < boxes.length; j++) {
      if (used.has(j)) continue;

      const b = boxes[j];

      if (a.category !== b.category) continue;

      const iou = computeIoU(a, b);

      if (iou > 0.4) {
        used.add(j);
      }
    }
  }

  return result;
}

/* ===== IOU ===== */
function computeIoU(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  const union = areaA + areaB - interArea;

  if (union === 0) return 0;

  return interArea / union;
}

/* ===== OPTIONAL GROUPING (LIGHT CLUSTER) ===== */
function groupResults(results) {
  if (!results || results.length === 0) return [];

  const grouped = [];

  results.forEach(r => {
    let found = false;

    grouped.forEach(g => {
      const dist = Math.hypot(r.x - g.x, r.y - g.y);

      if (dist < 20 && r.category === g.category) {
        g.x = (g.x + r.x) / 2;
        g.y = (g.y + r.y) / 2;
        g.confidence = Math.max(g.confidence, r.confidence);
        found = true;
      }
    });

    if (!found) {
      grouped.push({ ...r });
    }
  });

  return grouped;
}

/* ===== RENDER RESULT OVERLAY ===== */
function renderResultOverlay() {
  const canvas = document.getElementById('resultCanvas');
  if (!canvas || !AppState.targetImage) return;

  const ctx = canvas.getContext('2d');

  canvas.width = AppState.targetImage.width;
  canvas.height = AppState.targetImage.height;

  /* draw image */
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(AppState.targetImage, 0, 0);

  /* draw results */
  AppState.results.forEach((res, index) => {
    const color = getCategoryColor(res.category);

    /* ===== TRANSFORM POLYGON ===== */
    const poly = transformPolygon(
      res.refPoly,
      res.x,
      res.y,
      res.width,
      res.height
    );

    /* ===== DRAW POLYGON ===== */
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    /* ===== LABEL ===== */
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    ctx.fillText(
      `${index + 1} (${(res.confidence * 100).toFixed(0)}%)`,
      res.x,
      res.y - 4
    );
  });
}

/* ===== TRANSFORM POLYGON ===== */
function transformPolygon(refPoly, x, y, w, h) {
  if (!refPoly || refPoly.length === 0) return [];

  /* get ref bounds */
  let minX = Infinity, minY = Infinity;
  let maxX = 0, maxY = 0;

  refPoly.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const refW = maxX - minX;
  const refH = maxY - minY;

  if (refW === 0 || refH === 0) return [];

  /* scale + translate */
  return refPoly.map(p => ({
    x: x + ((p.x - minX) / refW) * w,
    y: y + ((p.y - minY) / refH) * h
  }));
}

/* ===== CATEGORY COLOR ===== */
function getCategoryColor(name) {
  const cat = AppState.categories.find(c => c.name === name);
  return cat ? cat.color : '#ffffff';
}

/* ===== RENDER RESULT TABLE ===== */
function renderResultTable() {
  const tbody = document.getElementById('resultTableBody');
  if (!tbody) return;

  if (!AppState.results || AppState.results.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No data</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  AppState.results.forEach((res, index) => {

    const area = computeArea(res);
    const circularity = computeCircularity(res);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${res.category}</td>
      <td>${(res.confidence * 100).toFixed(1)}%</td>
      <td>${area.toFixed(0)}</td>
      <td>${circularity.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ===== AREA ===== */
function computeArea(res) {
  if (!res) return 0;
  return res.width * res.height;
}

/* ===== CIRCULARITY ===== */
function computeCircularity(res) {
  if (!res) return 0;

  const area = res.width * res.height;
  const perimeter = 2 * (res.width + res.height);

  if (perimeter === 0) return 0;

  return (4 * Math.PI * area) / (perimeter * perimeter);
}

/* ===== EXTEND DETECTION FLOW ===== */
const __runDetection = runDetection;

runDetection = function () {
  __runDetection();

  /* UI SYNC */
  renderResultTable();
};

/* ===== MEMORY CONFIG ===== */
const LearningConfig = {
  maxSamplesPerCategory: 20,
  minConfidence: 0.8
};

/* ===== CATEGORY MEMORY INIT ===== */
function initCategoryMemory(category) {
  if (!category) return;

  if (!category.memory) {
    category.memory = [];
  }
}

/* ===== STORE HIGH CONFIDENCE RESULT ===== */
function updateLearningMemory() {
  if (!AppState.results || AppState.results.length === 0) return;

  AppState.results.forEach(res => {
    if (res.confidence < LearningConfig.minConfidence) return;

    const category = AppState.categories.find(
      c => c.name === res.category
    );

    if (!category) return;

    initCategoryMemory(category);

    category.memory.push(res.feature);

    /* limit memory */
    if (category.memory.length > LearningConfig.maxSamplesPerCategory) {
      category.memory.shift();
    }
  });
}

/* ===== COMPUTE AVERAGE FEATURE ===== */
function getAdaptiveFeature(category, baseFeature) {
  if (!category || !category.memory || category.memory.length === 0) {
    return baseFeature;
  }

  let r = 0, g = 0, b = 0, t = 0, e = 0;

  category.memory.forEach(f => {
    r += f.r;
    g += f.g;
    b += f.b;
    t += f.texture;
    e += f.edge;
  });

  const n = category.memory.length;

  return {
    r: (baseFeature.r + r / n) / 2,
    g: (baseFeature.g + g / n) / 2,
    b: (baseFeature.b + b / n) / 2,
    texture: (baseFeature.texture + t / n) / 2,
    edge: (baseFeature.edge + e / n) / 2
  };
}

/* ===== EXTEND MATCH FEATURE ===== */
const _matchFeature = matchFeature;

matchFeature = function (feature) {
  let best = null;
  let bestScore = 0;

  AppState.categories.forEach(cat => {
    cat.polygons.forEach(poly => {

      let refFeature = computePolygonFeature(poly);
      if (!refFeature) return;

      /* APPLY ADAPTIVE LEARNING */
      refFeature = getAdaptiveFeature(cat, refFeature);

      const score = similarity(feature, refFeature);

      if (score > bestScore) {
        bestScore = score;
        best = {
          category: cat.name,
          confidence: score,
          refPoly: poly
        };
      }
    });
  });

  return best;
};

/* ===== EXTEND DETECTION FLOW ===== */
const ___runDetection = runDetection;

runDetection = function () {
  ___runDetection();

  updateLearningMemory();
};

/* ===== PERFORMANCE CONFIG ===== */
const PerformanceConfig = {
  maxWindows: 2000,
  samplingStep: 2,
  windowStep: 16,
  downscale: 0.5
};

/* ===== SAFE LOOP WRAPPER ===== */
function shouldStopLoop(counter) {
  return counter > PerformanceConfig.maxWindows;
}

/* ===== EXTEND DETECTION (SAFE VERSION) ===== */
const ____runDetection = runDetection;

runDetection = function () {
  if (!AppState.targetImage) return;

  AppState.results = [];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const scale = PerformanceConfig.downscale;

  canvas.width = AppState.targetImage.width * scale;
  canvas.height = AppState.targetImage.height * scale;

  ctx.drawImage(AppState.targetImage, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const step = PerformanceConfig.windowStep;
  const size = 32;

  let counter = 0;

  for (let y = 0; y < canvas.height - size; y += step) {
    for (let x = 0; x < canvas.width - size; x += step) {

      counter++;
      if (shouldStopLoop(counter)) break;

      const feature = extractFeatureFast(imgData, x, y, size);

      const match = matchFeature(feature);

      if (!match) continue;
      if (match.confidence < AppState.threshold / 100) continue;

      AppState.results.push({
        id: generateId(),
        x: x / scale,
        y: y / scale,
        width: size / scale,
        height: size / scale,
        category: match.category,
        confidence: match.confidence,
        feature: feature,
        refPoly: match.refPoly,
        scale: 1
      });
    }
  }

  /* APPLY NMS */
  AppState.results = applyNMS(AppState.results);

  renderResultOverlay();
  renderResultTable();
  updateLearningMemory();
};

/* ===== FAST FEATURE EXTRACTION ===== */
function extractFeatureFast(imgData, startX, startY, size) {
  const data = imgData.data;
  const width = imgData.width;

  let r = 0, g = 0, b = 0;
  let count = 0;
  let variance = 0;
  let edge = 0;

  const step = PerformanceConfig.samplingStep;

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {

      const px = startX + x;
      const py = startY + y;

      const i = (py * width + px) * 4;

      const cr = data[i];
      const cg = data[i + 1];
      const cb = data[i + 2];

      r += cr;
      g += cg;
      b += cb;
      count++;

      const next = i + 4;
      if (data[next]) {
        edge += Math.abs(cr - data[next]);
      }
    }
  }

  r /= count;
  g /= count;
  b /= count;

  /* FAST variance (reduced) */
  for (let y = 0; y < size; y += step * 2) {
    for (let x = 0; x < size; x += step * 2) {
      const px = startX + x;
      const py = startY + y;
      const i = (py * width + px) * 4;

      variance += Math.pow(data[i] - r, 2);
    }
  }

  variance /= count;

  return {
    r,
    g,
    b,
    texture: variance,
    edge
  };
}

/* ===== EXPORT BUTTON BIND ===== */
(function bindExport(){
  const btn = document.getElementById('exportRecognitionButton');
  if (!btn) return;

  btn.addEventListener('click', () => {
    exportCSV();
  });
})();

/* ===== EXPORT CSV ===== */
function exportCSV() {
  if (!AppState.results || AppState.results.length === 0) {
    alert('No data to export');
    return;
  }

  let csv = 'ID,Category,Confidence,Area,Circularity\n';

  AppState.results.forEach((r, i) => {
    const area = computeArea(r);
    const circ = computeCircularity(r);

    csv += `${i + 1},${r.category},${(r.confidence*100).toFixed(2)},${area},${circ.toFixed(3)}\n`;
  });

  downloadFile(csv, 'results.csv', 'text/csv');
}

/* ===== EXPORT JSON MODEL ===== */
function exportModel() {
  const model = {
    categories: AppState.categories.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      polygons: c.polygons,
      memory: c.memory || []
    }))
  };

  const json = JSON.stringify(model);
  downloadFile(json, 'model.json', 'application/json');
}

/* ===== IMPORT MODEL ===== */
function importModel(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data.categories) {
      alert('Invalid model');
      return;
    }

    AppState.categories = data.categories;
    renderCategories();

  } catch (e) {
    console.error(e);
    alert('Failed to load model');
  }
}

/* ===== XLSX EXPORT (OPTIONAL IF LIB EXIST) ===== */
function exportXLSX() {
  if (typeof XLSX === 'undefined') {
    alert('XLSX library not found');
    return;
  }

  const rows = AppState.results.map((r, i) => ({
    ID: i + 1,
    Category: r.category,
    Confidence: (r.confidence * 100).toFixed(2),
    Area: computeArea(r),
    Circularity: computeCircularity(r).toFixed(3)
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Results');

  XLSX.writeFile(wb, 'results.xlsx');
}

/* ===== DOWNLOAD UTILITY ===== */
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===== FIX 1: CLEAN CROSSHAIR ===== */
function drawCrosshair(canvas) {
  const ctx = canvas.getContext('2d');

  /* CLEAR LAYER */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  /* redraw base first */
  if (canvas.id === 'referenceCanvas') {
    _renderReference();
  } else if (canvas.id === 'targetCanvas') {
    _renderTarget();
  } else if (canvas.id === 'resultCanvas') {
    renderResultOverlay();
  }

  /* draw crosshair */
  ctx.strokeStyle = 'rgba(73,214,255,0.4)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(Viewport.mouseX, 0);
  ctx.lineTo(Viewport.mouseX, canvas.height);

  ctx.moveTo(0, Viewport.mouseY);
  ctx.lineTo(canvas.width, Viewport.mouseY);
  ctx.stroke();

  ctx.restore();
}

/* ===== FIX 2: LOADING SYSTEM ===== */
const Loading = {
  el: null
};

function initLoading() {
  const div = document.createElement('div');

  div.id = 'loadingOverlay';
  div.style.position = 'fixed';
  div.style.inset = '0';
  div.style.display = 'none';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.background = 'rgba(6,18,31,0.7)';
  div.style.zIndex = '9999';

  div.innerHTML = `
    <div style="text-align:center;">
      <div class="loader"></div>
      <p style="margin-top:10px;">Processing...</p>
    </div>
  `;

  document.body.appendChild(div);
  Loading.el = div;
}

function showLoading() {
  if (!Loading.el) return;
  Loading.el.style.display = 'flex';
}

function hideLoading() {
  if (!Loading.el) return;
  Loading.el.style.display = 'none';
}

/* ===== LOADER STYLE ===== */
(function addLoaderCSS(){
  const style = document.createElement('style');
  style.innerHTML = `
    .loader {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.1);
      border-top: 4px solid var(--accent-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
})();

/* ===== FIX 3: WRAP DETECTION WITH LOADING ===== */
const _____runDetection = runDetection;

runDetection = function () {
  showLoading();

  setTimeout(() => {
    _____runDetection();
    hideLoading();
  }, 50); /* allow UI render */
};

/* ===== FIX 4: FILE TYPE VALIDATION ===== */
function isImageFile(file) {
  return file && file.type.startsWith('image/');
}

/* EXTEND UPLOAD VALIDATION */
const _loadImage = loadImage;

loadImage = function (file, callback) {
  if (!isImageFile(file)) {
    alert('Only image files are allowed');
    return;
  }

  _loadImage(file, callback);
};

/* ===== INIT LOADING ===== */
const _init = init;

init = function () {
  _init();
  initLoading();
};

/* ===== WORKER DETECTION ENGINE ===== */

self.onmessage = function (e) {
  const { imageData, config, categories, threshold } = e.data;

  const results = [];

  const { width, height, data } = imageData;

  const step = config.windowStep;
  const size = 32;
  const sample = config.samplingStep;

  let counter = 0;

  for (let y = 0; y < height - size; y += step) {
    for (let x = 0; x < width - size; x += step) {

      counter++;
      if (counter > config.maxWindows) break;

      const feature = extractFeature(data, width, x, y, size, sample);

      const match = matchFeature(feature, categories);

      if (!match) continue;
      if (match.confidence < threshold) continue;

      results.push({
        x, y,
        width: size,
        height: size,
        category: match.category,
        confidence: match.confidence,
        feature,
        refPoly: match.refPoly
      });
    }
  }

  self.postMessage({ results });
};

/* ===== FEATURE ===== */
function extractFeature(data, width, startX, startY, size, step) {
  let r=0,g=0,b=0,count=0,variance=0,edge=0;

  for (let y=0;y<size;y+=step){
    for (let x=0;x<size;x+=step){

      const px = startX + x;
      const py = startY + y;

      const i = (py * width + px) * 4;

      const cr = data[i];
      const cg = data[i+1];
      const cb = data[i+2];

      r+=cr; g+=cg; b+=cb;
      count++;

      const next = i+4;
      if (data[next]) edge += Math.abs(cr - data[next]);
    }
  }

  r/=count; g/=count; b/=count;

  for (let y=0;y<size;y+=step*2){
    for (let x=0;x<size;x+=step*2){
      const i = ((startY+y)*width + (startX+x))*4;
      variance += Math.pow(data[i]-r,2);
    }
  }

  variance/=count;

  return { r,g,b, texture:variance, edge };
}

/* ===== MATCH ===== */
function matchFeature(feature, categories){
  let best=null, bestScore=0;

  categories.forEach(cat=>{
    (cat.polygons||[]).forEach(poly=>{

      const ref = cat.refFeature;
      if (!ref) return;

      const score = similarity(feature, ref);

      if (score > bestScore){
        bestScore = score;
        best = {
          category: cat.name,
          confidence: score,
          refPoly: poly
        };
      }
    });
  });

  return best;
}

/* ===== SIMILARITY ===== */
function similarity(a,b){
  const color = 1 - (
    Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b)
  ) / 765;

  const texture = 1 - Math.abs(a.texture-b.texture)/(b.texture+1);
  const edge = 1 - Math.abs(a.edge-b.edge)/(b.edge+1);

  return (color*0.5 + texture*0.3 + edge*0.2);
}

/* ===== INIT WORKER ===== */
let IRWorker = null;

function initWorker() {
  if (IRWorker) return;

  IRWorker = new Worker('../js/ir-worker.js');

  IRWorker.onmessage = function (e) {
    const { results } = e.data;

    /* scale back */
    AppState.results = results.map(r => ({
      id: generateId(),
      x: r.x / PerformanceConfig.downscale,
      y: r.y / PerformanceConfig.downscale,
      width: r.width / PerformanceConfig.downscale,
      height: r.height / PerformanceConfig.downscale,
      category: r.category,
      confidence: r.confidence,
      feature: r.feature,
      refPoly: r.refPoly,
      scale: 1
    }));

    AppState.results = applyNMS(AppState.results);

    renderResultOverlay();
    renderResultTable();
    updateLearningMemory();

    hideLoading();
  };
}

/* ===== PREPARE CATEGORY FEATURE ===== */
function prepareCategoryFeatures() {
  AppState.categories.forEach(cat => {
    if (!cat.polygons || cat.polygons.length === 0) return;

    const poly = cat.polygons[0];
    cat.refFeature = computePolygonFeature(poly);
  });
}

/* ===== EXTEND DETECTION ===== */
const ______runDetection = runDetection;

runDetection = function () {
  if (!AppState.targetImage) return;

  initWorker();
  showLoading();

  prepareCategoryFeatures();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const scale = PerformanceConfig.downscale;

  canvas.width = AppState.targetImage.width * scale;
  canvas.height = AppState.targetImage.height * scale;

  ctx.drawImage(AppState.targetImage, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  IRWorker.postMessage({
    imageData,
    config: PerformanceConfig,
    categories: AppState.categories,
    threshold: AppState.threshold / 100
  });
};
