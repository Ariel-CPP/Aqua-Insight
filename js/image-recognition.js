/* =========================
   APP STATE (CLEAN RESET)
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
  threshold: 60
};

/* =========================
   CANVAS CONTEXT
========================= */
const refCanvas = document.getElementById('referenceCanvas');
const tgtCanvas = document.getElementById('targetCanvas');
const resCanvas = document.getElementById('resultCanvas');

const refCtx = refCanvas.getContext('2d');
const tgtCtx = tgtCanvas.getContext('2d');
const resCtx = resCanvas.getContext('2d');

/* =========================
   GEOMETRY UTIL
========================= */

/* point inside polygon (ray casting) */
function pointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      ((yi > point.y) !== (yj > point.y)) &&
      (point.x <
        (xj - xi) * (point.y - yi) / (yj - yi + 0.00001) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/* bounding box polygon */
function getPolygonBounds(poly) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  poly.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/* =========================
   FEATURE EXTRACTION (SHAPE-AWARE)
========================= */
function extractPolygonFeature(ctx, polygon) {

  const bounds = getPolygonBounds(polygon);

  const imageData = ctx.getImageData(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height
  );

  const data = imageData.data;

  let r = 0, g = 0, b = 0;
  let count = 0;

  for (let y = 0; y < bounds.height; y += 2) {
    for (let x = 0; x < bounds.width; x += 2) {

      const globalX = bounds.x + x;
      const globalY = bounds.y + y;

      if (!pointInPolygon({ x: globalX, y: globalY }, polygon)) continue;

      const idx = (y * bounds.width + x) * 4;

      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];

      count++;
    }
  }

  if (count === 0) return null;

  return {
    r: r / count,
    g: g / count,
    b: b / count,
    area: count
  };
}

/* =========================
   SHAPE DESCRIPTOR
========================= */
function calculateShapeDescriptor(polygon) {

  const bounds = getPolygonBounds(polygon);

  const area = polygon.length;

  const perimeter = polygon.reduce((acc, p, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return acc + Math.hypot(next.x - p.x, next.y - p.y);
  }, 0);

  const circularity =
    (4 * Math.PI * area) / (perimeter * perimeter + 0.0001);

  return {
    area,
    perimeter,
    circularity,
    aspectRatio: bounds.width / (bounds.height + 0.0001)
  };
}

/* =========================
   BUILD REFERENCE LIBRARY
========================= */
function buildReferenceLibrary() {

  const library = [];

  AppState.categories.forEach(cat => {

    cat.polygons.forEach(poly => {

      const feature = extractPolygonFeature(refCtx, poly);
      const shape = calculateShapeDescriptor(poly);

      if (!feature) return;

      library.push({
        category: cat.name,
        color: cat.color,
        feature,
        shape,
        polygon: poly
      });

    });

  });

  return library;
}

/* =========================
   COLOR DISTANCE
========================= */
function colorDistance(a, b) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2
  );
}

/* =========================
   SHAPE SIMILARITY
========================= */
function shapeSimilarity(a, b) {
  const d1 = Math.abs(a.circularity - b.circularity);
  const d2 = Math.abs(a.aspectRatio - b.aspectRatio);

  return 100 - (d1 * 50 + d2 * 50);
}

/* =========================
   COMBINED SCORE
========================= */
function computeSimilarity(target, reference) {

  const colorScore = 100 - colorDistance(target.feature, reference.feature);
  const shapeScore = shapeSimilarity(target.shape, reference.shape);

  return (colorScore * 0.6) + (shapeScore * 0.4);
}

/* =========================
   DETECTION CONFIG
========================= */
const DetectionConfig = {
  step: 12,                 // jarak scan
  scales: [0.8, 1, 1.2],    // ukuran objek bisa beda
  maxResults: 400
};

/* =========================
   RUN DETECTION
========================= */
function runDetection() {

  if (!AppState.targetImage) return;

  AppState.results = [];

  const library = buildReferenceLibrary();

  if (library.length === 0) {
    alert('No reference polygons');
    return;
  }

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imageData = tgtCtx.getImageData(0, 0, w, h);

  let id = 1;

  for (let ref of library) {

    for (let scale of DetectionConfig.scales) {

      const templateBounds = getPolygonBounds(ref.polygon);

      const boxW = templateBounds.width * scale;
      const boxH = templateBounds.height * scale;

      for (let y = 0; y < h - boxH; y += DetectionConfig.step) {
        for (let x = 0; x < w - boxW; x += DetectionConfig.step) {

          if (AppState.results.length > DetectionConfig.maxResults) break;

          const candidate = extractCandidateFeature(
            imageData,
            ref,
            x,
            y,
            scale
          );

          if (!candidate) continue;

          const score = computeSimilarity(candidate, ref);

          if (score > AppState.threshold) {

            AppState.results.push({
              id: id++,
              x,
              y,
              width: boxW,
              height: boxH,
              category: ref.category,
              confidence: score,
              shape: candidate.shape
            });

          }

        }
      }

    }
  }

  renderResults();
  renderTable(AppState.results);
}

/* =========================
   EXTRACT CANDIDATE (MASK BASED)
========================= */
function extractCandidateFeature(imageData, ref, offsetX, offsetY, scale) {

  const bounds = getPolygonBounds(ref.polygon);

  let r = 0, g = 0, b = 0;
  let count = 0;

  const width = imageData.width;
  const data = imageData.data;

  for (let py = 0; py < bounds.height; py += 2) {
    for (let px = 0; px < bounds.width; px += 2) {

      const originalX = bounds.x + px;
      const originalY = bounds.y + py;

      // cek apakah titik ini masuk polygon
      if (!pointInPolygon({ x: originalX, y: originalY }, ref.polygon)) continue;

      // scaling + offset
      const tx = Math.floor(offsetX + px * scale);
      const ty = Math.floor(offsetY + py * scale);

      if (tx < 0 || ty < 0 || tx >= width) continue;

      const idx = (ty * width + tx) * 4;

      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];

      count++;
    }
  }

  if (count < 10) return null;

  return {
    feature: {
      r: r / count,
      g: g / count,
      b: b / count
    },
    shape: {
      circularity: ref.shape.circularity,
      aspectRatio: ref.shape.aspectRatio
    }
  };
}

/* =========================
   IOU (Intersection Over Union)
========================= */
function computeIOU(a, b) {

  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  const union = areaA + areaB - interArea;

  return union === 0 ? 0 : interArea / union;
}

/* =========================
   NON MAX SUPPRESSION
========================= */
function applyNMS(results) {

  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

  const finalResults = [];

  const IOU_THRESHOLD = 0.4;

  while (sorted.length > 0) {

    const best = sorted.shift();
    finalResults.push(best);

    for (let i = sorted.length - 1; i >= 0; i--) {

      const overlap = computeIOU(best, sorted[i]);

      if (overlap > IOU_THRESHOLD) {
        sorted.splice(i, 1);
      }

    }
  }

  return finalResults;
}

/* =========================
   GROUPING (OPTIONAL IMPROVEMENT)
========================= */
function groupNearby(results) {

  const grouped = [];

  const DIST_THRESHOLD = 20;

  results.forEach(r => {

    let merged = false;

    for (let g of grouped) {

      const dx = r.x - g.x;
      const dy = r.y - g.y;

      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DIST_THRESHOLD && r.category === g.category) {

        // merge position (average)
        g.x = (g.x + r.x) / 2;
        g.y = (g.y + r.y) / 2;

        // keep highest confidence
        if (r.confidence > g.confidence) {
          g.confidence = r.confidence;
        }

        merged = true;
        break;
      }
    }

    if (!merged) {
      grouped.push({ ...r });
    }

  });

  return grouped;
}

/* =========================
   UPDATE DETECTION PIPELINE
========================= */
function runDetection() {

  if (!AppState.targetImage) return;

  AppState.results = [];

  const library = buildReferenceLibrary();

  if (library.length === 0) {
    alert('No reference polygons');
    return;
  }

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imageData = tgtCtx.getImageData(0, 0, w, h);

  let id = 1;

  for (let ref of library) {

    for (let scale of DetectionConfig.scales) {

      const bounds = getPolygonBounds(ref.polygon);

      const boxW = bounds.width * scale;
      const boxH = bounds.height * scale;

      for (let y = 0; y < h - boxH; y += DetectionConfig.step) {
        for (let x = 0; x < w - boxW; x += DetectionConfig.step) {

          if (AppState.results.length > DetectionConfig.maxResults) break;

          const candidate = extractCandidateFeature(
            imageData,
            ref,
            x,
            y,
            scale
          );

          if (!candidate) continue;

          const score = computeSimilarity(candidate, ref);

          if (score > AppState.threshold) {

            AppState.results.push({
              id: id++,
              x,
              y,
              width: boxW,
              height: boxH,
              category: ref.category,
              confidence: score
            });

          }

        }
      }

    }
  }

  // 🔥 APPLY CLEANING
  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  renderResults();
  renderTable(clean);
}

/* =========================
   ROTATION CONFIG
========================= */
const RotationConfig = {
  angles: [-20, -10, 0, 10, 20] // derajat
};

/* =========================
   ROTATE POINT
========================= */
function rotatePoint(p, center, angleDeg) {
  const angle = angleDeg * Math.PI / 180;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dx = p.x - center.x;
  const dy = p.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

/* =========================
   ROTATE POLYGON
========================= */
function rotatePolygon(poly, angle) {

  const bounds = getPolygonBounds(poly);

  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };

  return poly.map(p => rotatePoint(p, center, angle));
}

/* =========================
   EXTENDED REFERENCE LIBRARY (WITH ROTATION)
========================= */
function buildReferenceLibrary() {

  const library = [];

  AppState.categories.forEach(cat => {

    cat.polygons.forEach(poly => {

      RotationConfig.angles.forEach(angle => {

        const rotated = rotatePolygon(poly, angle);

        const feature = extractPolygonFeature(refCtx, rotated);
        const shape = calculateShapeDescriptor(rotated);

        if (!feature) return;

        library.push({
          category: cat.name,
          color: cat.color,
          feature,
          shape,
          polygon: rotated,
          angle
        });

      });

    });

  });

  return library;
}

/* =========================
   RESULT CANVAS
========================= */
function renderResults() {

  if (!AppState.targetImage) return;

  resCanvas.width = tgtCanvas.width;
  resCanvas.height = tgtCanvas.height;

  // draw base image
  resCtx.clearRect(0, 0, resCanvas.width, resCanvas.height);
  resCtx.drawImage(tgtCanvas, 0, 0);

  drawPolygonOverlay(AppState.results);
}

/* =========================
   DRAW POLYGON OVERLAY
========================= */
function drawPolygonOverlay(results) {

  results.forEach(obj => {

    const color = getCategoryColor(obj.category);

    // generate polygon dari template (scaled)
    const poly = transformPolygonToTarget(obj);

    // DRAW POLYGON
    resCtx.beginPath();

    poly.forEach((p, i) => {
      if (i === 0) resCtx.moveTo(p.x, p.y);
      else resCtx.lineTo(p.x, p.y);
    });

    resCtx.closePath();

    resCtx.strokeStyle = color;
    resCtx.lineWidth = 2;
    resCtx.stroke();

    // fill transparent
    resCtx.fillStyle = color + '22';
    resCtx.fill();

    // LABEL
    drawLabel(obj, poly[0], color);
  });
}

/* =========================
   TRANSFORM POLYGON (KEY)
========================= */
function transformPolygonToTarget(obj) {

  const ref = findReferenceByCategory(obj.category);

  if (!ref) return [];

  const basePoly = ref.polygon;

  const bounds = getPolygonBounds(basePoly);

  const scaleX = obj.width / bounds.width;
  const scaleY = obj.height / bounds.height;

  return basePoly.map(p => ({
    x: obj.x + (p.x - bounds.x) * scaleX,
    y: obj.y + (p.y - bounds.y) * scaleY
  }));
}

/* =========================
   FIND REFERENCE
========================= */
function findReferenceByCategory(category) {

  for (let cat of AppState.categories) {
    if (cat.name === category && cat.polygons.length > 0) {
      return {
        polygon: cat.polygons[0] // ambil template pertama
      };
    }
  }

  return null;
}

/* =========================
   LABEL DRAWING
========================= */
function drawLabel(obj, pos, color) {

  const text = `${obj.id} (${Math.round(obj.confidence)}%)`;

  resCtx.font = '11px Inter';
  resCtx.fillStyle = color;

  const width = resCtx.measureText(text).width;

  resCtx.fillRect(pos.x, pos.y - 16, width + 6, 14);

  resCtx.fillStyle = '#000';
  resCtx.fillText(text, pos.x + 3, pos.y - 4);
}

/* =========================
   CATEGORY COLOR (SAFE)
========================= */
function getCategoryColor(name) {
  const cat = AppState.categories.find(c => c.name === name);
  return cat ? cat.color : '#ffffff';
}

/* =========================
   TEXTURE FEATURE (VARIANCE)
========================= */
function computeVariance(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return variance;
}

/* =========================
   EDGE DETECTION (LIGHT)
========================= */
function computeEdgeDensity(grayValues) {
  let edges = 0;

  for (let i = 1; i < grayValues.length; i++) {
    if (Math.abs(grayValues[i] - grayValues[i - 1]) > 20) {
      edges++;
    }
  }

  return edges / grayValues.length;
}

/* =========================
   EXTRACT ADVANCED FEATURE
========================= */
function extractAdvancedFeature(ctx, polygon) {

  const bounds = getPolygonBounds(polygon);

  const imageData = ctx.getImageData(
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height
  );

  const data = imageData.data;

  let rArr = [], gArr = [], bArr = [];
  let grayArr = [];

  for (let y = 0; y < bounds.height; y += 2) {
    for (let x = 0; x < bounds.width; x += 2) {

      const gx = bounds.x + x;
      const gy = bounds.y + y;

      if (!pointInPolygon({ x: gx, y: gy }, polygon)) continue;

      const idx = (y * bounds.width + x) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      rArr.push(r);
      gArr.push(g);
      bArr.push(b);

      const gray = 0.299*r + 0.587*g + 0.114*b;
      grayArr.push(gray);
    }
  }

  if (rArr.length < 10) return null;

  return {
    r: rArr.reduce((a,b)=>a+b)/rArr.length,
    g: gArr.reduce((a,b)=>a+b)/gArr.length,
    b: bArr.reduce((a,b)=>a+b)/bArr.length,

    texture: computeVariance(grayArr),
    edge: computeEdgeDensity(grayArr)
  };
}

/* =========================
   UPGRADE REFERENCE FEATURE
========================= */
function buildReferenceLibrary() {

  const library = [];

  AppState.categories.forEach(cat => {

    cat.polygons.forEach(poly => {

      RotationConfig.angles.forEach(angle => {

        const rotated = rotatePolygon(poly, angle);

        const feature = extractAdvancedFeature(refCtx, rotated);
        const shape = calculateShapeDescriptor(rotated);

        if (!feature) return;

        library.push({
          category: cat.name,
          color: cat.color,
          feature,
          shape,
          polygon: rotated
        });

      });

    });

  });

  return library;
}

/* =========================
   CANDIDATE FEATURE UPGRADE
========================= */
function extractCandidateFeature(imageData, ref, offsetX, offsetY, scale) {

  const bounds = getPolygonBounds(ref.polygon);

  let rArr=[], gArr=[], bArr=[], grayArr=[];

  const data = imageData.data;
  const width = imageData.width;

  for (let py = 0; py < bounds.height; py += 2) {
    for (let px = 0; px < bounds.width; px += 2) {

      const ox = bounds.x + px;
      const oy = bounds.y + py;

      if (!pointInPolygon({ x: ox, y: oy }, ref.polygon)) continue;

      const tx = Math.floor(offsetX + px * scale);
      const ty = Math.floor(offsetY + py * scale);

      if (tx < 0 || ty < 0 || tx >= width) continue;

      const idx = (ty * width + tx) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      rArr.push(r);
      gArr.push(g);
      bArr.push(b);

      const gray = 0.299*r + 0.587*g + 0.114*b;
      grayArr.push(gray);
    }
  }

  if (rArr.length < 10) return null;

  return {
    feature: {
      r: rArr.reduce((a,b)=>a+b)/rArr.length,
      g: gArr.reduce((a,b)=>a+b)/gArr.length,
      b: bArr.reduce((a,b)=>a+b)/bArr.length,
      texture: computeVariance(grayArr),
      edge: computeEdgeDensity(grayArr)
    },
    shape: {
      circularity: ref.shape.circularity,
      aspectRatio: ref.shape.aspectRatio
    }
  };
}

/* =========================
   SIMILARITY (UPGRADED)
========================= */
function computeSimilarity(target, reference) {

  const colorDist = Math.sqrt(
    (target.feature.r - reference.feature.r)**2 +
    (target.feature.g - reference.feature.g)**2 +
    (target.feature.b - reference.feature.b)**2
  );

  const colorScore = 100 - colorDist;

  const textureDiff = Math.abs(
    target.feature.texture - reference.feature.texture
  );

  const edgeDiff = Math.abs(
    target.feature.edge - reference.feature.edge
  );

  const textureScore = 100 - textureDiff * 0.5;
  const edgeScore = 100 - edgeDiff * 100;

  const shapeScore = shapeSimilarity(target.shape, reference.shape);

  return (
    colorScore * 0.4 +
    textureScore * 0.2 +
    edgeScore * 0.2 +
    shapeScore * 0.2
  );
}

/* =========================
   ADAPTIVE MEMORY
========================= */
const AdaptiveMemory = {
  samples: {}, // per category
  maxSamples: 50
};

/* =========================
   INIT MEMORY
========================= */
function initAdaptiveMemory() {
  AppState.categories.forEach(cat => {
    if (!AdaptiveMemory.samples[cat.name]) {
      AdaptiveMemory.samples[cat.name] = [];
    }
  });
}

/* =========================
   STORE SAMPLE
========================= */
function storeSample(category, feature) {

  const arr = AdaptiveMemory.samples[category];
  if (!arr) return;

  arr.push(feature);

  // limit memory
  if (arr.length > AdaptiveMemory.maxSamples) {
    arr.shift();
  }
}

/* =========================
   UPDATE MEMORY FROM RESULTS
========================= */
function updateAdaptiveMemory(results) {

  results.forEach(obj => {

    if (obj.confidence < 80) return; // hanya yang high confidence

    const feature = obj.feature;

    if (!feature) return;

    storeSample(obj.category, feature);

  });
}

/* =========================
   COMPUTE ADAPTIVE FEATURE
========================= */
function getAdaptiveFeature(category) {

  const samples = AdaptiveMemory.samples[category];

  if (!samples || samples.length === 0) return null;

  let r=0,g=0,b=0,texture=0,edge=0;

  samples.forEach(s => {
    r += s.r;
    g += s.g;
    b += s.b;
    texture += s.texture;
    edge += s.edge;
  });

  const n = samples.length;

  return {
    r: r/n,
    g: g/n,
    b: b/n,
    texture: texture/n,
    edge: edge/n
  };
}

/* =========================
   HYBRID SIMILARITY
========================= */
function computeSimilarity(target, reference) {

  const adaptive = getAdaptiveFeature(reference.category);

  const baseFeature = reference.feature;

  const refFeature = adaptive || baseFeature;

  const colorDist = Math.sqrt(
    (target.feature.r - refFeature.r)**2 +
    (target.feature.g - refFeature.g)**2 +
    (target.feature.b - refFeature.b)**2
  );

  const colorScore = 100 - colorDist;

  const textureDiff = Math.abs(
    target.feature.texture - refFeature.texture
  );

  const edgeDiff = Math.abs(
    target.feature.edge - refFeature.edge
  );

  const textureScore = 100 - textureDiff * 0.5;
  const edgeScore = 100 - edgeDiff * 100;

  const shapeScore = shapeSimilarity(target.shape, reference.shape);

  return (
    colorScore * 0.35 +
    textureScore * 0.25 +
    edgeScore * 0.2 +
    shapeScore * 0.2
  );
}

/* =========================
   HOOK INTO DETECTION
========================= */
function runDetection() {

  if (!AppState.targetImage) return;

  initAdaptiveMemory();

  AppState.results = [];

  const library = buildReferenceLibrary();

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imageData = tgtCtx.getImageData(0, 0, w, h);

  let id = 1;

  for (let ref of library) {

    for (let scale of DetectionConfig.scales) {

      const bounds = getPolygonBounds(ref.polygon);

      const boxW = bounds.width * scale;
      const boxH = bounds.height * scale;

      for (let y = 0; y < h - boxH; y += DetectionConfig.step) {
        for (let x = 0; x < w - boxW; x += DetectionConfig.step) {

          const candidate = extractCandidateFeature(
            imageData,
            ref,
            x,
            y,
            scale
          );

          if (!candidate) continue;

          const score = computeSimilarity(candidate, ref);

          if (score > AppState.threshold) {

            AppState.results.push({
              id: id++,
              x,
              y,
              width: boxW,
              height: boxH,
              category: ref.category,
              confidence: score,
              feature: candidate.feature
            });

          }

        }
      }

    }
  }

  // CLEAN
  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  // 🔥 LEARNING STEP
  updateAdaptiveMemory(clean);

  renderResults();
  renderTable(clean);
}

/* =========================
   PERFORMANCE CONFIG
========================= */
const Perf = {
  downscale: 0.5,       // shrink image 50%
  step: 16,             // lebih besar = lebih cepat
  sampleStep: 4,        // sampling pixel
  maxScan: 200000       // limit loop
};

/* =========================
   CREATE DOWNSCALED IMAGE
========================= */
function getDownscaledImageData() {

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const temp = document.createElement('canvas');
  const ctx = temp.getContext('2d');

  temp.width = w * Perf.downscale;
  temp.height = h * Perf.downscale;

  ctx.drawImage(tgtCanvas, 0, 0, temp.width, temp.height);

  return ctx.getImageData(0, 0, temp.width, temp.height);
}

/* =========================
   FAST FEATURE EXTRACTION
========================= */
function fastFeature(data, width, x, y, size) {

  let r=0,g=0,b=0,count=0;

  for (let j=0; j<size; j+=Perf.sampleStep) {
    for (let i=0; i<size; i+=Perf.sampleStep) {

      const px = x+i;
      const py = y+j;

      if (px >= width) continue;

      const idx = (py * width + px) * 4;

      r += data[idx];
      g += data[idx+1];
      b += data[idx+2];

      count++;
    }
  }

  return {
    r: r/count,
    g: g/count,
    b: b/count,
    texture: 0,
    edge: 0
  };
}

/* =========================
   FAST DETECTION LOOP
========================= */
function runDetection() {

  if (!AppState.targetImage) return;

  initAdaptiveMemory();

  AppState.results = [];

  const library = buildReferenceLibrary();

  const imageData = getDownscaledImageData();

  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  let id = 1;
  let scanCount = 0;

  for (let ref of library) {

    const bounds = getPolygonBounds(ref.polygon);

    const size = Math.max(bounds.width, bounds.height) * Perf.downscale;

    for (let y = 0; y < h - size; y += Perf.step) {
      for (let x = 0; x < w - size; x += Perf.step) {

        scanCount++;
        if (scanCount > Perf.maxScan) break;

        const feature = fastFeature(data, w, x, y, size);

        const score = computeSimilarity(
          { feature, shape: ref.shape },
          ref
        );

        if (score > AppState.threshold) {

          // scale back ke original size
          AppState.results.push({
            id: id++,
            x: x / Perf.downscale,
            y: y / Perf.downscale,
            width: size / Perf.downscale,
            height: size / Perf.downscale,
            category: ref.category,
            confidence: score,
            feature
          });

        }

      }
    }

  }

  // CLEAN
  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  updateAdaptiveMemory(clean);

  renderResults();
  renderTable(clean);
}

/* =========================
   EXPORT RESULTS (CSV)
========================= */
function exportResultsCSV() {

  if (!AppState.results || AppState.results.length === 0) {
    alert('No results to export');
    return;
  }

  let csv = 'ID,Category,X,Y,Width,Height,Confidence\n';

  AppState.results.forEach(r => {
    csv += `${r.id},${r.category},${r.x},${r.y},${r.width},${r.height},${r.confidence}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'detection_results.csv';
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================
   BATCH STATE
========================= */
AppState.batchImages = [];
AppState.currentBatchIndex = 0;

/* =========================
   HANDLE BATCH UPLOAD
========================= */
function handleBatchUpload(files) {

  AppState.batchImages = [];
  AppState.currentBatchIndex = 0;

  const validFiles = Array.from(files).filter(f =>
    f.type.startsWith('image/')
  );

  if (validFiles.length === 0) {
    alert('No valid images');
    return;
  }

  let loaded = 0;

  validFiles.forEach(file => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => img.src = e.target.result;

    img.onload = () => {
      AppState.batchImages.push(img);
      loaded++;

      if (loaded === validFiles.length) {
        runBatchDetection();
      }
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
   RUN BATCH DETECTION
========================= */
function runBatchDetection() {

  if (AppState.batchImages.length === 0) return;

  processNextImage();
}

/* =========================
   PROCESS EACH IMAGE
========================= */
function processNextImage() {

  if (AppState.currentBatchIndex >= AppState.batchImages.length) {
    alert('Batch completed');
    return;
  }

  const img = AppState.batchImages[AppState.currentBatchIndex];

  drawImage(img, tgtCanvas, tgtCtx);

  AppState.targetImage = img;

  setTimeout(() => {
    runDetection();

    AppState.currentBatchIndex++;
    processNextImage();
  }, 50);
}
