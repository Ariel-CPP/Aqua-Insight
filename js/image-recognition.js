/* =========================
   APP STATE
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
   ELEMENTS
========================= */
const refInput = document.getElementById('referenceInput');
const tgtInput = document.getElementById('targetInput');

const refBtn = document.getElementById('uploadReferenceBtn');
const tgtBtn = document.getElementById('uploadTargetBtn');
const addCatBtn = document.getElementById('addCategoryBtn');

const refCanvas = document.getElementById('referenceCanvas');
const tgtCanvas = document.getElementById('targetCanvas');
const resCanvas = document.getElementById('resultCanvas');

const refCtx = refCanvas.getContext('2d');
const tgtCtx = tgtCanvas.getContext('2d');
const resCtx = resCanvas.getContext('2d');

const tableBody = document.getElementById('resultTableBody');
const thresholdSlider = document.getElementById('thresholdSlider');
const runBtn = document.getElementById('runDetectionBtn');

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  renderCategoryList();
});

/* =========================
   EVENTS
========================= */
function bindEvents() {
  refBtn.onclick = () => refInput.click();
  tgtBtn.onclick = () => tgtInput.click();

  refInput.onchange = e => loadImage(e, 'reference');
  tgtInput.onchange = e => loadImage(e, 'target');

  addCatBtn.onclick = addCategory;

  thresholdSlider.oninput = () => {
    AppState.threshold = Number(thresholdSlider.value);
    renderFiltered();
  };

  runBtn.onclick = runDetection;
}

/* =========================
   IMAGE UPLOAD (FIX)
========================= */
function loadImage(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Only image allowed');
    return;
  }

  const img = new Image();
  const reader = new FileReader();

  reader.onload = ev => img.src = ev.target.result;

  img.onload = () => {
    if (type === 'reference') {
      AppState.referenceImage = img;
      drawImage(img, refCanvas, refCtx);
    } else {
      AppState.targetImage = img;
      drawImage(img, tgtCanvas, tgtCtx);
    }
  };

  reader.readAsDataURL(file);
}

/* =========================
   DRAW IMAGE (OPTIMIZED)
========================= */
function drawImage(img, canvas, ctx) {
  const max = 600;

  let w = img.width;
  let h = img.height;

  const scale = Math.min(max / w, max / h, 1);

  w *= scale;
  h *= scale;

  canvas.width = w;
  canvas.height = h;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(img, 0, 0, w, h);
}

/* =========================
   CATEGORY (FIX)
========================= */
function addCategory() {
  const name = prompt('Category name');
  if (!name) return;

  const id = 'C' + Date.now();

  AppState.categories.push({
    id,
    name,
    color: randomColor(),
    polygons: []
  });

  renderCategoryList();
}

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
      renderCategoryList();
    };

    if (cat.id === AppState.activeCategoryId) {
      div.style.background = 'rgba(73,214,255,0.1)';
    }

    container.appendChild(div);
  });
}

/* =========================
   POLYGON
========================= */
let poly = [];

refCanvas.addEventListener('click', e => {
  if (!AppState.referenceImage) return;

  const pos = getMouse(refCanvas, e);
  poly.push(pos);
  redrawRef();
});

refCanvas.addEventListener('dblclick', () => {
  if (poly.length < 3) return;

  const cat = AppState.categories.find(c => c.id === AppState.activeCategoryId);
  cat.polygons.push([...poly]);

  poly = [];
  redrawRef();
});

function redrawRef() {
  drawImage(AppState.referenceImage, refCanvas, refCtx);

  AppState.categories.forEach(cat => {
    refCtx.strokeStyle = cat.color;

    cat.polygons.forEach(p => drawPoly(p, refCtx));
  });

  drawPoly(poly, refCtx, true);
}

function drawPoly(p, ctx, open=false) {
  if (p.length === 0) return;

  ctx.beginPath();
  p.forEach((pt,i)=>{
    if(i===0) ctx.moveTo(pt.x,pt.y);
    else ctx.lineTo(pt.x,pt.y);
  });
  if(!open) ctx.closePath();
  ctx.stroke();
}

/* =========================
   DETECTION (FIX)
========================= */
function runDetection() {
  if (!AppState.targetImage) return;

  AppState.results = [];

  const w = tgtCanvas.width;
  const h = tgtCanvas.height;

  const imgData = tgtCtx.getImageData(0,0,w,h).data;

  let id=1;

  for(let y=0;y<h;y+=12){
    for(let x=0;x<w;x+=12){

      const f = getFeature(imgData,w,x,y);

      const match = classify(f);

      if(match.conf > AppState.threshold){
        AppState.results.push({
          id:id++,
          x,y,width:20,height:20,
          category:match.cat,
          confidence:match.conf,
          area:400,
          circularity:0.8
        });
      }
    }
  }

  renderFiltered();
}

/* =========================
   FEATURE
========================= */
function getFeature(data,w,x,y){
  let r=0,g=0,b=0,c=0;

  for(let i=0;i<20;i+=4){
    const idx=((y+i)*w+(x+i))*4;
    r+=data[idx];
    g+=data[idx+1];
    b+=data[idx+2];
    c++;
  }

  return {r:r/c,g:g/c,b:b/c};
}

/* =========================
   CLASSIFY
========================= */
function classify(f){
  let best={cat:null,conf:0};

  AppState.categories.forEach(cat=>{
    cat.polygons.forEach(p=>{
      const ref={r:p.length*10,g:p.length*5,b:100};
      const conf=100-Math.abs(f.r-ref.r);

      if(conf>best.conf){
        best={cat:cat.name,conf};
      }
    });
  });

  return best;
}

/* =========================
   RENDER
========================= */
function renderFiltered(){
  resCanvas.width=tgtCanvas.width;
  resCanvas.height=tgtCanvas.height;

  resCtx.drawImage(tgtCanvas,0,0);

  const filtered=AppState.results.filter(r=>r.confidence>=AppState.threshold);

  filtered.forEach(o=>{
    const col=getColor(o.category);

    resCtx.strokeStyle=col;
    resCtx.strokeRect(o.x,o.y,o.width,o.height);

    resCtx.fillStyle=col;
    resCtx.fillRect(o.x,o.y-12,60,12);

    resCtx.fillStyle='#000';
    resCtx.fillText(o.id,o.x+2,o.y-2);
  });

  renderTable(filtered);
}

/* =========================
   TABLE
========================= */
function renderTable(data){
  tableBody.innerHTML='';

  data.forEach(o=>{
    const tr=document.createElement('tr');

    tr.innerHTML=`
      <td>${o.id}</td>
      <td>${o.category}</td>
      <td>${o.area}</td>
      <td>${o.circularity}</td>
      <td>${Math.round(o.confidence)}%</td>
    `;

    tableBody.appendChild(tr);
  });
}

/* =========================
   HELPERS
========================= */
function getMouse(canvas,e){
  const r=canvas.getBoundingClientRect();
  return {
    x:(e.clientX-r.left)*(canvas.width/r.width),
    y:(e.clientY-r.top)*(canvas.height/r.height)
  };
}

function randomColor(){
  return `hsl(${Math.random()*360},70%,60%)`;
}

function getColor(name){
  const c=AppState.categories.find(x=>x.name===name);
  return c?c.color:'#fff';
}

/* =========================
   VIEW STATE (NEW SYSTEM)
========================= */
const View = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0
};

/* =========================
   APPLY TRANSFORM
========================= */
function applyView(ctx) {
  ctx.setTransform(
    View.scale,
    0,
    0,
    View.scale,
    View.offsetX,
    View.offsetY
  );
}

/* =========================
   RESET TRANSFORM
========================= */
function resetView(ctx, canvas) {
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

/* =========================
   REDRAW (WITH VIEW)
========================= */
function redrawRef() {
  if (!AppState.referenceImage) return;

  resetView(refCtx, refCanvas);
  applyView(refCtx);

  refCtx.drawImage(
    AppState.referenceImage,
    0,
    0,
    refCanvas.width,
    refCanvas.height
  );

  // draw polygons AFTER transform
  AppState.categories.forEach(cat => {
    refCtx.strokeStyle = cat.color;
    cat.polygons.forEach(p => drawPoly(p, refCtx));
  });

  drawPoly(poly, refCtx, true);
}

/* =========================
   ZOOM (FIX)
========================= */
refCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const zoom = e.deltaY < 0 ? 1.1 : 0.9;

  // zoom toward mouse
  const rect = refCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  View.offsetX = mx - (mx - View.offsetX) * zoom;
  View.offsetY = my - (my - View.offsetY) * zoom;

  View.scale *= zoom;

  redrawRef();
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

  redrawRef();
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

  redrawRef();
});

refCanvas.addEventListener('touchend', () => {
  View.dragging = false;
});

/* =========================
   RESET VIEW (DOUBLE CLICK ALT)
========================= */
refCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  View.scale = 1;
  View.offsetX = 0;
  View.offsetY = 0;

  redrawRef();
});

