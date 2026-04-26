/* =========================
   APP STATE
========================= */
const AppState = {
  referenceImage: null,
  targetImage: null,

  batchImages: [],
  currentBatchIndex: 0,

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
   CANVAS
========================= */
const refCanvas = document.getElementById('referenceCanvas');
const tgtCanvas = document.getElementById('targetCanvas');
const resCanvas = document.getElementById('resultCanvas');

const refCtx = refCanvas.getContext('2d');
const tgtCtx = tgtCanvas.getContext('2d');
const resCtx = resCanvas.getContext('2d');

/* =========================
   INPUT ELEMENT
========================= */
const refInput = document.getElementById('referenceInput');
const tgtInput = document.getElementById('targetInput');

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
});

/* =========================
   EVENT BINDING
========================= */
function bindEvents() {

  // reference upload
  refInput.onchange = (e) => {
    loadImage(e.files ? e : e.target.files, 'reference');
  };

  // target upload (batch aware)
  tgtInput.onchange = (e) => {
    const files = e.target.files;

    if (files.length > 1) {
      handleBatchUpload(files);
    } else {
      loadImage(files, 'target');
    }
  };
}

/* =========================
   LOAD IMAGE
========================= */
function loadImage(files, type) {

  const file = files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Only image files allowed');
    return;
  }

  const img = new Image();
  const reader = new FileReader();

  reader.onload = e => img.src = e.target.result;

  img.onload = () => {

    if (type === 'reference') {
      AppState.referenceImage = img;
      drawImage(img, refCanvas, refCtx);
    }

    if (type === 'target') {
      AppState.targetImage = img;
      drawImage(img, tgtCanvas, tgtCtx);
    }
  };

  reader.readAsDataURL(file);
}

/* =========================
   DRAW IMAGE
========================= */
function drawImage(img, canvas, ctx) {

  const max = 700;

  let w = img.width;
  let h = img.height;

  const scale = Math.min(max / w, max / h, 1);

  w *= scale;
  h *= scale;

  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
}

/* =========================
   BATCH UPLOAD
========================= */
function handleBatchUpload(files) {

  AppState.batchImages = [];
  AppState.currentBatchIndex = 0;

  const valid = Array.from(files).filter(f =>
    f.type.startsWith('image/')
  );

  if (valid.length === 0) {
    alert('No valid images');
    return;
  }

  let loaded = 0;

  valid.forEach(file => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => img.src = e.target.result;

    img.onload = () => {
      AppState.batchImages.push(img);
      loaded++;

      if (loaded === valid.length) {
        runBatch();
      }
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
   RUN BATCH
========================= */
function runBatch() {
  if (AppState.batchImages.length === 0) return;
  processNextImage();
}

function processNextImage() {

  if (AppState.currentBatchIndex >= AppState.batchImages.length) {
    alert('Batch finished');
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

/* =========================
   EXPORT CSV
========================= */
function exportResultsCSV() {

  if (!AppState.results.length) {
    alert('No results');
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
  a.download = 'results.csv';
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================
   PLACEHOLDER (NEXT STEP)
========================= */
function runDetection() {
  console.log('Detection not implemented yet');
}

/* =========================
   VIEW (ZOOM & PAN BASE)
========================= */
const View = {
  scale: 1,
  offsetX: 0,
  offsetY: 0
};

/* =========================
   POLYGON STATE
========================= */
let currentPolygon = [];

/* =========================
   GET MOUSE (ZOOM SAFE)
========================= */
function getMousePos(canvas, e) {

  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  return {
    x: (x - View.offsetX) / View.scale,
    y: (y - View.offsetY) / View.scale
  };
}

/* =========================
   ADD POINT
========================= */
refCanvas.addEventListener('click', (e) => {

  if (!AppState.referenceImage) return;

  const pos = getMousePos(refCanvas, e);

  currentPolygon.push(pos);

  redrawReferenceCanvas();
});

/* =========================
   FINISH POLYGON
========================= */
refCanvas.addEventListener('dblclick', () => {

  if (currentPolygon.length < 3) return;

  const cat = AppState.categories.find(
    c => c.id === AppState.activeCategoryId
  );

  cat.polygons.push([...currentPolygon]);

  currentPolygon = [];

  redrawReferenceCanvas();
});

/* =========================
   REDRAW CANVAS
========================= */
function redrawReferenceCanvas() {

  if (!AppState.referenceImage) return;

  const ctx = refCtx;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,refCanvas.width,refCanvas.height);

  ctx.setTransform(
    View.scale,
    0,
    0,
    View.scale,
    View.offsetX,
    View.offsetY
  );

  ctx.drawImage(
    AppState.referenceImage,
    0,
    0,
    refCanvas.width,
    refCanvas.height
  );

  drawSavedPolygons();
  drawCurrentPolygon();
}

/* =========================
   DRAW SAVED POLYGONS
========================= */
function drawSavedPolygons() {

  AppState.categories.forEach(cat => {

    refCtx.strokeStyle = cat.color;
    refCtx.lineWidth = 2;

    cat.polygons.forEach(poly => drawPolygon(poly));
  });
}

/* =========================
   DRAW CURRENT
========================= */
function drawCurrentPolygon() {

  if (currentPolygon.length === 0) return;

  refCtx.strokeStyle = '#ffffff';
  refCtx.lineWidth = 1.5;

  drawPolygon(currentPolygon, true);

  currentPolygon.forEach(p => {
    refCtx.beginPath();
    refCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    refCtx.fillStyle = '#ffffff';
    refCtx.fill();
  });
}

/* =========================
   DRAW POLYGON
========================= */
function drawPolygon(poly, open=false) {

  if (poly.length === 0) return;

  refCtx.beginPath();

  poly.forEach((p,i)=>{
    if(i===0) refCtx.moveTo(p.x,p.y);
    else refCtx.lineTo(p.x,p.y);
  });

  if (!open) refCtx.closePath();

  refCtx.stroke();
}

/* =========================
   CATEGORY SELECT (UI)
========================= */
function selectCategory(id) {
  AppState.activeCategoryId = id;
}

/* =========================
   CLEAR CURRENT POLYGON
========================= */
function clearCurrentPolygon() {
  currentPolygon = [];
  redrawReferenceCanvas();
}

/* =========================
   VIEW STATE EXTENDED
========================= */
View.dragging = false;
View.lastX = 0;
View.lastY = 0;

/* =========================
   ZOOM (WHEEL)
========================= */
refCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

  const rect = refCanvas.getBoundingClientRect();

  const mx = (e.clientX - rect.left) * (refCanvas.width / rect.width);
  const my = (e.clientY - rect.top) * (refCanvas.height / rect.height);

  // zoom ke arah cursor
  View.offsetX = mx - (mx - View.offsetX) * zoomFactor;
  View.offsetY = my - (my - View.offsetY) * zoomFactor;

  View.scale *= zoomFactor;

  redrawReferenceCanvas();

}, { passive: false });

/* =========================
   PAN (MOUSE)
========================= */
refCanvas.addEventListener('mousedown', (e) => {
  View.dragging = true;
  View.lastX = e.clientX;
  View.lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
  View.dragging = false;
});

window.addEventListener('mousemove', (e) => {

  if (!View.dragging) return;

  const dx = e.clientX - View.lastX;
  const dy = e.clientY - View.lastY;

  View.offsetX += dx;
  View.offsetY += dy;

  View.lastX = e.clientX;
  View.lastY = e.clientY;

  redrawReferenceCanvas();
});

/* =========================
   PAN (TOUCH)
========================= */
refCanvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  View.dragging = true;
  View.lastX = t.clientX;
  View.lastY = t.clientY;
});

refCanvas.addEventListener('touchmove', (e) => {

  if (!View.dragging) return;

  const t = e.touches[0];

  const dx = t.clientX - View.lastX;
  const dy = t.clientY - View.lastY;

  View.offsetX += dx;
  View.offsetY += dy;

  View.lastX = t.clientX;
  View.lastY = t.clientY;

  redrawReferenceCanvas();
});

refCanvas.addEventListener('touchend', () => {
  View.dragging = false;
});

/* =========================
   RESET VIEW (RIGHT CLICK)
========================= */
refCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  View.scale = 1;
  View.offsetX = 0;
  View.offsetY = 0;

  redrawReferenceCanvas();
});

/* =========================
   CROSSHAIR (DYNAMIC)
========================= */
refCanvas.addEventListener('mousemove', (e) => {

  const wrapper = refCanvas.parentElement;
  const rect = wrapper.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  wrapper.style.setProperty('--cross-x', `${x}px`);
  wrapper.style.setProperty('--cross-y', `${y}px`);
});

/* =========================
   CROSSHAIR STYLE (AUTO INJECT)
========================= */
(function injectCrosshairStyle(){

  const style = document.createElement('style');

  style.innerHTML = `
    .canvas-wrapper::before,
    .canvas-wrapper::after {
      content: '';
      position: absolute;
      pointer-events: none;
      z-index: 10;
    }

    .canvas-wrapper::before {
      left: var(--cross-x);
      top: 0;
      bottom: 0;
      width: 1px;
      background: rgba(73,214,255,0.4);
    }

    .canvas-wrapper::after {
      top: var(--cross-y);
      left: 0;
      right: 0;
      height: 1px;
      background: rgba(73,214,255,0.4);
    }
  `;

  document.head.appendChild(style);

})();

/* =========================
   DETECTION CONFIG
========================= */
const DetectCfg = {
  scales: [0.8, 1, 1.2],
  step: 14,
  sampleStep: 3,
  maxCandidates: 3000
};

/* =========================
   GEOMETRY
========================= */
function pointInPolygon(p, poly){
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi=poly[i].x, yi=poly[i].y;
    const xj=poly[j].x, yj=poly[j].y;

    const intersect =
      ((yi>p.y)!==(yj>p.y)) &&
      (p.x < (xj-xi)*(p.y-yi)/(yj-yi+1e-6)+xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

function getPolygonBounds(poly){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  poly.forEach(p=>{
    if(p.x<minX)minX=p.x;
    if(p.y<minY)minY=p.y;
    if(p.x>maxX)maxX=p.x;
    if(p.y>maxY)maxY=p.y;
  });
  return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

/* =========================
   FEATURE (COLOR + TEXTURE + EDGE)
========================= */
function variance(arr){
  const m = arr.reduce((a,b)=>a+b,0)/arr.length;
  return arr.reduce((s,v)=>s+(v-m)*(v-m),0)/arr.length;
}

function edgeDensity(gray){
  let e=0;
  for(let i=1;i<gray.length;i++){
    if(Math.abs(gray[i]-gray[i-1])>20) e++;
  }
  return e/(gray.length||1);
}

/* reference feature (from refCanvas) */
function extractRefFeature(poly){
  const b = getPolygonBounds(poly);
  const img = refCtx.getImageData(b.x, b.y, b.width, b.height).data;

  let rA=[],gA=[],bA=[],gGray=[];

  for(let y=0;y<b.height;y+=DetectCfg.sampleStep){
    for(let x=0;x<b.width;x+=DetectCfg.sampleStep){

      const gx=b.x+x, gy=b.y+y;
      if(!pointInPolygon({x:gx,y:gy}, poly)) continue;

      const idx=(y*b.width+x)*4;

      const r=img[idx], g=img[idx+1], bC=img[idx+2];
      rA.push(r); gA.push(g); bA.push(bC);

      gGray.push(0.299*r+0.587*g+0.114*bC);
    }
  }

  if(rA.length<10) return null;

  return {
    r: rA.reduce((a,b)=>a+b)/rA.length,
    g: gA.reduce((a,b)=>a+b)/gA.length,
    b: bA.reduce((a,b)=>a+b)/bA.length,
    texture: variance(gGray),
    edge: edgeDensity(gGray)
  };
}

/* candidate feature (from target imageData) */
function extractCandidateFeature(imageData, refPoly, offX, offY, scale){
  const b = getPolygonBounds(refPoly);

  const data = imageData.data;
  const W = imageData.width, H = imageData.height;

  let rA=[],gA=[],bA=[],gGray=[];

  for(let py=0;py<b.height;py+=DetectCfg.sampleStep){
    for(let px=0;px<b.width;px+=DetectCfg.sampleStep){

      const ox=b.x+px, oy=b.y+py;
      if(!pointInPolygon({x:ox,y:oy}, refPoly)) continue;

      const tx = Math.floor(offX + px*scale);
      const ty = Math.floor(offY + py*scale);

      if(tx<0||ty<0||tx>=W||ty>=H) continue;

      const idx=(ty*W+tx)*4;

      const r=data[idx], g=data[idx+1], bC=data[idx+2];
      rA.push(r); gA.push(g); bA.push(bC);

      gGray.push(0.299*r+0.587*g+0.114*bC);
    }
  }

  if(rA.length<10) return null;

  return {
    r: rA.reduce((a,b)=>a+b)/rA.length,
    g: gA.reduce((a,b)=>a+b)/gA.length,
    b: bA.reduce((a,b)=>a+b)/bA.length,
    texture: variance(gGray),
    edge: edgeDensity(gGray)
  };
}

/* =========================
   SIMILARITY
========================= */
function similarity(a, b){
  const colorDist = Math.sqrt(
    (a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2
  );
  const colorScore = 100 - colorDist;

  const texScore = 100 - Math.abs(a.texture-b.texture)*0.5;
  const edgeScore = 100 - Math.abs(a.edge-b.edge)*100;

  return colorScore*0.5 + texScore*0.25 + edgeScore*0.25;
}

/* =========================
   BUILD LIBRARY
========================= */
function buildLibrary(){
  const lib = [];
  AppState.categories.forEach(cat=>{
    cat.polygons.forEach(poly=>{
      const feat = extractRefFeature(poly);
      if(!feat) return;
      lib.push({
        category: cat.name,
        color: cat.color,
        polygon: poly,
        feature: feat
      });
    });
  });
  return lib;
}

/* =========================
   MAIN DETECTION
========================= */
function runDetection(){

  if(!AppState.targetImage) return;

  const lib = buildLibrary();
  if(lib.length===0){
    alert('No reference polygons');
    return;
  }

  AppState.results = [];

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imageData = tgtCtx.getImageData(0,0,w,h);

  let id=1, count=0;

  lib.forEach(ref=>{

    const b = getPolygonBounds(ref.polygon);

    DetectCfg.scales.forEach(scale=>{

      const boxW = b.width*scale;
      const boxH = b.height*scale;

      for(let y=0; y<h-boxH; y+=DetectCfg.step){
        for(let x=0; x<w-boxW; x+=DetectCfg.step){

          if(count++ > DetectCfg.maxCandidates) break;

          const feat = extractCandidateFeature(
            imageData,
            ref.polygon,
            x,y,scale
          );

          if(!feat) continue;

          const score = similarity(feat, ref.feature);

          if(score >= AppState.threshold){
            AppState.results.push({
              id: id++,
              x,y,
              width: boxW,
              height: boxH,
              category: ref.category,
              confidence: score,
              refPoly: ref.polygon,
              scale
            });
          }
        }
      }

    });

  });

  // (NMS + grouping akan di step berikutnya)
  renderResults();
  renderTable(AppState.results);
}

/* =========================
   IOU (Intersection over Union)
========================= */
function computeIOU(a, b){

  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);

  const interArea = interW * interH;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  const union = areaA + areaB - interArea;

  return union === 0 ? 0 : interArea / union;
}

/* =========================
   NON-MAX SUPPRESSION
========================= */
function applyNMS(results){

  const sorted = [...results].sort((a,b)=>b.confidence - a.confidence);
  const finalResults = [];

  const IOU_THRESHOLD = 0.45;

  while(sorted.length){

    const best = sorted.shift();
    finalResults.push(best);

    for(let i=sorted.length-1;i>=0;i--){
      const iou = computeIOU(best, sorted[i]);
      if(iou > IOU_THRESHOLD){
        sorted.splice(i,1);
      }
    }
  }

  return finalResults;
}

/* =========================
   GROUP NEARBY (REFINEMENT)
========================= */
function groupNearby(results){

  const grouped = [];
  const DIST = 20;

  results.forEach(r=>{

    let merged = false;

    for(let g of grouped){

      const dx = r.x - g.x;
      const dy = r.y - g.y;

      const dist = Math.sqrt(dx*dx + dy*dy);

      if(dist < DIST && r.category === g.category){

        // merge position (average)
        g.x = (g.x + r.x) / 2;
        g.y = (g.y + r.y) / 2;

        // keep best confidence
        if(r.confidence > g.confidence){
          g.confidence = r.confidence;
          g.width = r.width;
          g.height = r.height;
          g.refPoly = r.refPoly;
          g.scale = r.scale;
        }

        merged = true;
        break;
      }
    }

    if(!merged){
      grouped.push({...r});
    }

  });

  return grouped;
}

/* =========================
   UPDATE PIPELINE
========================= */
function runDetection(){

  if(!AppState.targetImage) return;

  const lib = buildLibrary();

  if(lib.length === 0){
    alert('No reference polygons');
    return;
  }

  AppState.results = [];

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imageData = tgtCtx.getImageData(0,0,w,h);

  let id = 1, count = 0;

  lib.forEach(ref=>{

    const b = getPolygonBounds(ref.polygon);

    DetectCfg.scales.forEach(scale=>{

      const boxW = b.width * scale;
      const boxH = b.height * scale;

      for(let y=0; y<h-boxH; y+=DetectCfg.step){
        for(let x=0; x<w-boxW; x+=DetectCfg.step){

          if(count++ > DetectCfg.maxCandidates) break;

          const feat = extractCandidateFeature(
            imageData,
            ref.polygon,
            x,y,scale
          );

          if(!feat) continue;

          const score = similarity(feat, ref.feature);

          if(score >= AppState.threshold){

            AppState.results.push({
              id: id++,
              x,y,
              width: boxW,
              height: boxH,
              category: ref.category,
              confidence: score,
              refPoly: ref.polygon,
              scale
            });

          }
        }
      }

    });

  });

  /* 🔥 CLEAN RESULT */
  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  renderResults();
  renderTable(clean);
}

/* =========================
   RENDER RESULT
========================= */
function renderResults(){

  if(!AppState.targetImage) return;

  resCanvas.width = tgtCanvas.width;
  resCanvas.height = tgtCanvas.height;

  resCtx.clearRect(0,0,resCanvas.width,resCanvas.height);
  resCtx.drawImage(tgtCanvas,0,0);

  drawPolygonOverlay(AppState.results);
}

/* =========================
   DRAW POLYGON OVERLAY
========================= */
function drawPolygonOverlay(results){

  results.forEach(obj=>{

    const color = getCategoryColor(obj.category);

    const poly = transformPolygon(obj);

    if(poly.length === 0) return;

    // DRAW SHAPE
    resCtx.beginPath();

    poly.forEach((p,i)=>{
      if(i===0) resCtx.moveTo(p.x,p.y);
      else resCtx.lineTo(p.x,p.y);
    });

    resCtx.closePath();

    resCtx.strokeStyle = color;
    resCtx.lineWidth = 2;
    resCtx.stroke();

    resCtx.fillStyle = color + '22';
    resCtx.fill();

    drawLabel(obj, poly[0], color);
  });
}

/* =========================
   TRANSFORM POLYGON
========================= */
function transformPolygon(obj){

  const basePoly = obj.refPoly;
  if(!basePoly) return [];

  const bounds = getPolygonBounds(basePoly);

  const scaleX = obj.width / bounds.width;
  const scaleY = obj.height / bounds.height;

  return basePoly.map(p=>({
    x: obj.x + (p.x - bounds.x) * scaleX,
    y: obj.y + (p.y - bounds.y) * scaleY
  }));
}

/* =========================
   LABEL
========================= */
function drawLabel(obj, pos, color){

  const text = `${obj.id} (${Math.round(obj.confidence)}%)`;

  resCtx.font = '11px Arial';

  const width = resCtx.measureText(text).width;

  resCtx.fillStyle = color;
  resCtx.fillRect(pos.x, pos.y - 16, width + 6, 14);

  resCtx.fillStyle = '#000';
  resCtx.fillText(text, pos.x + 3, pos.y - 4);
}

/* =========================
   CATEGORY COLOR
========================= */
function getCategoryColor(name){
  const cat = AppState.categories.find(c=>c.name===name);
  return cat ? cat.color : '#ffffff';
}

/* =========================
   RENDER RESULT
========================= */
function renderResults(){

  if(!AppState.targetImage) return;

  resCanvas.width = tgtCanvas.width;
  resCanvas.height = tgtCanvas.height;

  resCtx.clearRect(0,0,resCanvas.width,resCanvas.height);
  resCtx.drawImage(tgtCanvas,0,0);

  drawPolygonOverlay(AppState.results);
}

/* =========================
   DRAW POLYGON OVERLAY
========================= */
function drawPolygonOverlay(results){

  results.forEach(obj=>{

    const color = getCategoryColor(obj.category);

    const poly = transformPolygon(obj);

    if(poly.length === 0) return;

    // DRAW SHAPE
    resCtx.beginPath();

    poly.forEach((p,i)=>{
      if(i===0) resCtx.moveTo(p.x,p.y);
      else resCtx.lineTo(p.x,p.y);
    });

    resCtx.closePath();

    resCtx.strokeStyle = color;
    resCtx.lineWidth = 2;
    resCtx.stroke();

    resCtx.fillStyle = color + '22';
    resCtx.fill();

    drawLabel(obj, poly[0], color);
  });
}

/* =========================
   TRANSFORM POLYGON
========================= */
function transformPolygon(obj){

  const basePoly = obj.refPoly;
  if(!basePoly) return [];

  const bounds = getPolygonBounds(basePoly);

  const scaleX = obj.width / bounds.width;
  const scaleY = obj.height / bounds.height;

  return basePoly.map(p=>({
    x: obj.x + (p.x - bounds.x) * scaleX,
    y: obj.y + (p.y - bounds.y) * scaleY
  }));
}

/* =========================
   LABEL
========================= */
function drawLabel(obj, pos, color){

  const text = `${obj.id} (${Math.round(obj.confidence)}%)`;

  resCtx.font = '11px Arial';

  const width = resCtx.measureText(text).width;

  resCtx.fillStyle = color;
  resCtx.fillRect(pos.x, pos.y - 16, width + 6, 14);

  resCtx.fillStyle = '#000';
  resCtx.fillText(text, pos.x + 3, pos.y - 4);
}

/* =========================
   CATEGORY COLOR
========================= */
function getCategoryColor(name){
  const cat = AppState.categories.find(c=>c.name===name);
  return cat ? cat.color : '#ffffff';
}

/* =========================
   PERFORMANCE CONFIG
========================= */
const Perf = {
  downscale: 0.5,     // resize target image
  step: 18,           // langkah scanning (lebih besar = lebih cepat)
  sampleStep: 4,      // sampling pixel
  maxScan: 150000     // limit loop
};

/* =========================
   DOWNSCALED IMAGE
========================= */
function getDownscaledImage(){

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
   FAST FEATURE
========================= */
function fastFeature(data, width, height, x, y, size){

  let r=0,g=0,b=0,count=0;

  for(let j=0;j<size;j+=Perf.sampleStep){
    for(let i=0;i<size;i+=Perf.sampleStep){

      const px = x+i;
      const py = y+j;

      if(px>=width || py>=height) continue;

      const idx = (py*width + px)*4;

      r += data[idx];
      g += data[idx+1];
      b += data[idx+2];

      count++;
    }
  }

  if(count===0) return null;

  return {
    r: r/count,
    g: g/count,
    b: b/count,
    texture: 0,
    edge: 0
  };
}

/* =========================
   FAST DETECTION PIPELINE
========================= */
function runDetection(){

  if(!AppState.targetImage) return;

  initAdaptive();

  const lib = buildLibrary();
  if(lib.length===0){
    alert('No reference polygons');
    return;
  }

  AppState.results = [];

  const imageData = getDownscaledImage();

  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  let id=1, scan=0;

  lib.forEach(ref=>{

    const bounds = getPolygonBounds(ref.polygon);
    const baseSize = Math.max(bounds.width, bounds.height);

    const size = baseSize * Perf.downscale;

    for(let y=0; y<h-size; y+=Perf.step){
      for(let x=0; x<w-size; x+=Perf.step){

        if(scan++ > Perf.maxScan) break;

        const feat = fastFeature(data, w, h, x, y, size);
        if(!feat) continue;

        const score = similarity(
          feat,
          ref.feature,
          ref.category
        );

        if(score >= AppState.threshold){

          AppState.results.push({
            id: id++,
            x: x / Perf.downscale,
            y: y / Perf.downscale,
            width: size / Perf.downscale,
            height: size / Perf.downscale,
            category: ref.category,
            confidence: score,
            refPoly: ref.polygon,
            scale: 1,
            feature: feat
          });

        }

      }
    }

  });

  /* CLEAN */
  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  updateAdaptive(clean);

  renderResults();
  renderTable(clean);
}

/* =========================
   STORAGE KEY
========================= */
const STORAGE_KEY = 'aqua_insight_adaptive_v1';

/* =========================
   SAVE TO LOCAL STORAGE
========================= */
function saveAdaptive(){

  const payload = {
    samples: Adaptive.samples
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch(e){
    console.warn('Save failed', e);
  }
}

/* =========================
   LOAD FROM LOCAL STORAGE
========================= */
function loadAdaptive(){

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;

    const data = JSON.parse(raw);

    if(data && data.samples){
      Adaptive.samples = data.samples;
    }
  } catch(e){
    console.warn('Load failed', e);
  }
}

/* =========================
   CLEAR STORAGE
========================= */
function clearAdaptive(){

  localStorage.removeItem(STORAGE_KEY);

  Adaptive.samples = {};

  initAdaptive();

  alert('Adaptive memory cleared');
}

/* =========================
   EXPORT JSON
========================= */
function exportAdaptiveJSON(){

  const payload = {
    samples: Adaptive.samples,
    categories: AppState.categories.map(c=>c.name)
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'adaptive-memory.json';
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================
   IMPORT JSON
========================= */
function importAdaptiveJSON(file){

  const reader = new FileReader();

  reader.onload = e => {

    try {
      const data = JSON.parse(e.target.result);

      if(data.samples){
        Adaptive.samples = data.samples;
        alert('Adaptive memory loaded');
      }
    } catch(err){
      alert('Invalid JSON file');
    }

  };

  reader.readAsText(file);
}

/* =========================
   AUTO SAVE AFTER DETECTION
========================= */
function runDetection(){

  if(!AppState.targetImage) return;

  initAdaptive();

  const lib = buildLibrary();
  if(lib.length===0){
    alert('No reference polygons');
    return;
  }

  AppState.results = [];

  const imageData = getDownscaledImage();

  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  let id=1, scan=0;

  lib.forEach(ref=>{

    const bounds = getPolygonBounds(ref.polygon);
    const size = Math.max(bounds.width, bounds.height) * Perf.downscale;

    for(let y=0; y<h-size; y+=Perf.step){
      for(let x=0; x<w-size; x+=Perf.step){

        if(scan++ > Perf.maxScan) break;

        const feat = fastFeature(data, w, h, x, y, size);
        if(!feat) continue;

        const score = similarity(
          feat,
          ref.feature,
          ref.category
        );

        if(score >= AppState.threshold){

          AppState.results.push({
            id: id++,
            x: x / Perf.downscale,
            y: y / Perf.downscale,
            width: size / Perf.downscale,
            height: size / Perf.downscale,
            category: ref.category,
            confidence: score,
            refPoly: ref.polygon,
            scale: 1,
            feature: feat
          });

        }

      }
    }

  });

  let clean = applyNMS(AppState.results);
  clean = groupNearby(clean);

  AppState.results = clean;

  updateAdaptive(clean);

  /* 🔥 AUTO SAVE */
  saveAdaptive();

  renderResults();
  renderTable(clean);
}

/* =========================
   AUTO LOAD ON START
========================= */
document.addEventListener('DOMContentLoaded', () => {
  loadAdaptive();
});

function exportResultsXLSX(){

  if(!AppState.results.length){
    alert('No data');
    return;
  }

  const data = AppState.results.map(r => ({
    ID: r.id,
    Category: r.category,
    X: Math.round(r.x),
    Y: Math.round(r.y),
    Width: Math.round(r.width),
    Height: Math.round(r.height),
    Confidence: Math.round(r.confidence)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

  XLSX.writeFile(workbook, "results.xlsx");
}

   document.getElementById('importModel').onchange = (e)=>{
  importAdaptiveJSON(e.target.files[0]);
};
