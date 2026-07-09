// Plankton Analyzer - Image Processing & IndexedDB Implementation

let canvas, ctx;
let originalImage = null;
let cameraStream = null;
let observations = [];
let db; // IndexedDB reference
let tfModel = null;
let isPredicting = false;

const DB_NAME = "AHL_Database";
const STORE_NAME = "plankton_models";

// 12 Default Species for Auto-seeding
const DEFAULT_SPECIES = [
  { species: "Chaetoceros", type: "Beneficial", minSize: 10, r: 160, g: 150, b: 60 },
  { species: "Skeletonema", type: "Beneficial", minSize: 12, r: 180, g: 140, b: 70 },
  { species: "Nannochloropsis", type: "Beneficial", minSize: 5, r: 100, g: 200, b: 80 },
  { species: "Spirulina", type: "Beneficial", minSize: 20, r: 20, g: 100, b: 50 },
  { species: "Tetraselmis", type: "Beneficial", minSize: 8, r: 40, g: 180, b: 90 },
  { species: "Dunaliella", type: "Beneficial", minSize: 7, r: 180, g: 120, b: 40 },
  { species: "Karenia", type: "HABs", minSize: 15, r: 190, g: 110, b: 60 },
  { species: "Alexandrium", type: "HABs", minSize: 20, r: 160, g: 50, b: 40 },
  { species: "Dinophysis", type: "HABs", minSize: 25, r: 210, g: 130, b: 50 },
  { species: "Pseudo-nitzschia", type: "HABs", minSize: 30, r: 140, g: 120, b: 90 },
  { species: "Gymnodinium", type: "HABs", minSize: 18, r: 170, g: 130, b: 70 },
  { species: "Microcystis", type: "HABs", minSize: 12, r: 30, g: 120, b: 100 }
];

document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("plankton-canvas");
  ctx = canvas.getContext("2d");
  
  // Set default manual date to today
  const manualDateInput = document.getElementById("manual-date");
  if (manualDateInput) {
    manualDateInput.value = new Date().toISOString().split('T')[0];
  }
  
  // Clear canvas
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#555";
  ctx.font = "14px Inter";
  ctx.textAlign = "center";
  ctx.fillText("Tidak ada citra dimuat", canvas.width/2, canvas.height/2);
  
  initIndexedDB();
  loadPondDatabase();
  
  // Initialize AI Model (Fallback Mode is active when file not found)
  initTFModel();
  
  // Listen for language changes to update localized dynamic content
  window.addEventListener('languageChanged', () => {
    loadPondDatabase();
    loadSpeciesDB();
  });
});

async function initTFModel() {
  if (!window.CVEngine || !window.CVEngine.YoloV8Engine) {
    console.log("CVEngine tidak ditemukan");
    return;
  }
  
  try {
    tfModel = new window.CVEngine.YoloV8Engine('../assets/models/yolo/plankton/model.json');
    await tfModel.loadModel();
  } catch(e) {
    console.error("Gagal memuat YOLOv8", e);
  }
}

// --- Image Upload & Camera ---

function handleImageUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      originalImage = img;
      stopCamera();
      drawToCanvas(img);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

async function startCamera() {
  const video = document.getElementById("camera-stream");
  const snapBtn = document.getElementById("snap-btn");
  
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = cameraStream;
    video.style.display = "block";
    snapBtn.style.display = "flex";
    canvas.style.display = "none";
    
    // Start Live Prediction if model loaded
    if (tfModel && tfModel.isLoaded) {
      isPredicting = true;
      video.addEventListener('loadeddata', () => {
        predictWebcam(video);
      });
    }
  } catch (err) {
    alert("Tidak dapat mengakses kamera: " + err.message);
  }
}

async function predictWebcam(video) {
  if(!isPredicting) return;
  
  let predictions = [];
  
  if (tfModel && tfModel.isLoaded) {
    await tfModel.predict(video);
  }
  
  video.style.display = "none";
  canvas.style.display = "block";
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Draw bounding boxes fallback
  predictions.forEach(pred => {
    ctx.beginPath();
    ctx.rect(pred.bbox[0], pred.bbox[1], pred.bbox[2], pred.bbox[3]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10B981';
    ctx.fillStyle = '#10B981';
    ctx.stroke();
    ctx.fillText(`${pred.class} (${Math.round(pred.score * 100)}%)`, pred.bbox[0], pred.bbox[1] > 10 ? pred.bbox[1] - 5 : 10);
  });
  
  // Loop
  window.requestAnimationFrame(() => predictWebcam(video));
}

function stopCamera() {
  if(cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  isPredicting = false;
  document.getElementById("camera-stream").style.display = "none";
  document.getElementById("snap-btn").style.display = "none";
  canvas.style.display = "block";
}

function captureSnapshot() {
  const video = document.getElementById("camera-stream");
  if(!cameraStream) return;
  
  const offCanvas = document.createElement("canvas");
  offCanvas.width = video.videoWidth;
  offCanvas.height = video.videoHeight;
  offCanvas.getContext("2d").drawImage(video, 0, 0);
  
  const img = new Image();
  img.onload = function() {
    originalImage = img;
    stopCamera();
    drawToCanvas(img);
  };
  img.src = offCanvas.toDataURL("image/png");
}

function drawToCanvas(img) {
  // Scale to fit canvas width while maintaining aspect ratio
  const ratio = canvas.width / img.width;
  const targetHeight = img.height * ratio;
  
  canvas.height = targetHeight;
  ctx.drawImage(img, 0, 0, canvas.width, targetHeight);
}

// --- Image Processing & Plankton Density Calculations ---

// Helper for density calculation: (N * D * 10^4) / (n * V)
function calculateDensityVal(N, D, n, V) {
  if (n <= 0 || V <= 0) return 0;
  return Math.round((N * D * 10000) / (n * V));
}

function addManualObservation() {
  const speciesSelect = document.getElementById("manual-species");
  const cellInput = document.getElementById("manual-cells");
  const dateInput = document.getElementById("manual-date");
  
  const D = parseFloat(document.getElementById("dilution-factor").value) || 1;
  const V = parseFloat(document.getElementById("sample-volume").value) || 1;
  const n = parseFloat(document.getElementById("squares-counted").value) || 5;
  
  if (!speciesSelect || !speciesSelect.value) {
    alert("Database spesies kosong atau tidak ada spesies yang dipilih.");
    return;
  }
  
  const N = parseInt(cellInput.value) || 0;
  if (N <= 0) {
    alert("Jumlah sel (N) harus lebih besar dari 0.");
    return;
  }
  
  const speciesName = speciesSelect.value;
  const dateStr = dateInput.value || new Date().toISOString().split('T')[0];
  
  // Find species details
  const profile = (window.userDbProfiles || []).find(p => p.species === speciesName) || { type: "Unknown" };
  const density = calculateDensityVal(N, D, n, V);
  
  // Check if species already exists in current session observations
  const existingIndex = observations.findIndex(o => o.genus === speciesName);
  if (existingIndex >= 0) {
    observations[existingIndex].count += N;
    // Recalculate density for accumulated counts
    observations[existingIndex].density = calculateDensityVal(observations[existingIndex].count, D, n, V);
  } else {
    observations.push({
      id: Date.now() + Math.random(),
      genus: speciesName,
      count: N,
      density: density,
      type: profile.type,
      date: dateStr
    });
  }
  
  updateDensityTable();
  calculateDiversity();
  
  // Update chart if Tab 2 is active or we want to draw it
  renderChart();
  
  // Reset cell count input
  cellInput.value = "25";
}

function analyzePlanktonImage() {
  if(!originalImage) {
    alert("Silakan unggah gambar atau ambil foto terlebih dahulu.");
    return;
  }
  
  // Prepare offscreen canvas to process the image data
  const offCanvas = document.createElement('canvas');
  offCanvas.width = canvas.width;
  offCanvas.height = canvas.height;
  const oCtx = offCanvas.getContext('2d');
  oCtx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  
  const imgData = oCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const W = canvas.width;
  const H = canvas.height;
  
  // Convert to grayscale and calculate median brightness
  let brightness = new Float32Array(W * H);
  let allBright = [];
  for(let i=0; i < W*H; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
    const br = 0.299*r + 0.587*g + 0.114*b;
    brightness[i] = br;
    allBright.push(br);
  }
  allBright.sort((a,b) => a-b);
  const medianBr = allBright[Math.floor(allBright.length * 0.5)];
  
  // Binary threshold (assuming dark objects on bright background or vice versa)
  const isBrightBg = medianBr > 128;
  let mask = new Uint8Array(W * H);
  const thresholdOffset = 30; // empirical
  for(let i=0; i < W*H; i++) {
    if (isBrightBg) {
      if (brightness[i] < medianBr - thresholdOffset) mask[i] = 1;
    } else {
      if (brightness[i] > medianBr + thresholdOffset) mask[i] = 1;
    }
  }
  
  // BFS Blob detection
  const visited = new Uint8Array(W * H);
  const blobs = [];
  
  for(let y=0; y<H; y++) {
    for(let x=0; x<W; x++) {
      const idx = y * W + x;
      if(mask[idx] && !visited[idx]) {
        let queue = [idx];
        visited[idx] = 1;
        let qi = 0;
        let blobPixels = [];
        let rSum = 0, gSum = 0, bSum = 0;
        
        while(qi < queue.length) {
          let curr = queue[qi++];
          blobPixels.push(curr);
          rSum += data[curr*4];
          gSum += data[curr*4+1];
          bSum += data[curr*4+2];
          
          let cx = curr % W;
          let cy = Math.floor(curr / W);
          
          [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => {
            let nx = cx + dx;
            let ny = cy + dy;
            if(nx >=0 && nx < W && ny >= 0 && ny < H) {
              let ni = ny * W + nx;
              if(mask[ni] && !visited[ni]) {
                visited[ni] = 1;
                queue.push(ni);
              }
            }
          });
        }
        
        if (blobPixels.length > 5 && blobPixels.length < (W*H)*0.2) {
          let cx = blobPixels.reduce((s, p) => s + (p % W), 0) / blobPixels.length;
          let cy = blobPixels.reduce((s, p) => s + Math.floor(p / W), 0) / blobPixels.length;
          blobs.push({
            pixels: blobPixels,
            area: blobPixels.length,
            r: Math.round(rSum / blobPixels.length),
            g: Math.round(gSum / blobPixels.length),
            b: Math.round(bSum / blobPixels.length),
            cx: cx,
            cy: cy
          });
        }
      }
    }
  }
  
  // Plankton Database Matching
  const dbProfiles = window.userDbProfiles || [];
  
  // Results grouped by Genus
  const resultsByGenus = {};
  
  // Redraw canvas with bounding circles
  drawToCanvas(originalImage);
  ctx.lineWidth = 2;
  
  blobs.forEach(blob => {
    // Distance calculation
    let closestDist = Infinity;
    let closestGenus = null;
    let closestType = "Unknown";
    
    if (dbProfiles.length > 0) {
      dbProfiles.forEach(prof => {
        // Skip if the blob is smaller than the minimum size required for this species
        if (blob.area < prof.minSize) return;
        
        let rDiff = blob.r - prof.r;
        let gDiff = blob.g - prof.g;
        let bDiff = blob.b - prof.b;
        let colorDist = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);
        
        // If color is close enough (e.g. dist < 80)
        if (colorDist < 80) {
          if (colorDist < closestDist) {
            closestDist = colorDist;
            closestGenus = prof.species;
            closestType = prof.type;
          }
        }
      });
    }
    
    // User requested: "jangan berikan identifikasi tanpa adanya data di database"
    if (!closestGenus) {
      closestGenus = `Spesies Tidak Dikenal`;
      closestType = "Unknown"; 
    }
    
    if(!resultsByGenus[closestGenus]) {
      resultsByGenus[closestGenus] = { count: 0, type: closestType, color: closestGenus === 'Spesies Tidak Dikenal' ? 'gray' : `rgb(${blob.r},${blob.g},${blob.b})` };
    }
    resultsByGenus[closestGenus].count++;
    
    // Draw on canvas
    ctx.beginPath();
    let r = Math.sqrt(blob.area / Math.PI);
    ctx.arc(blob.cx, blob.cy, r + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = resultsByGenus[closestGenus].color;
    ctx.stroke();
  });
  
  const dilution = parseFloat(document.getElementById('dilution-factor').value) || 1;
  const volume = parseFloat(document.getElementById('sample-volume').value) || 1;
  const squares = parseFloat(document.getElementById('squares-counted').value) || 5;
  
  let totalDetected = 0;
  
  Object.keys(resultsByGenus).forEach(genusKey => {
    let stat = resultsByGenus[genusKey];
    let density = calculateDensityVal(stat.count, dilution, squares, volume);
    totalDetected += stat.count;
    
    const obs = {
      id: Date.now() + Math.random(),
      genus: genusKey,
      count: stat.count,
      density: density,
      type: stat.type,
      date: new Date().toISOString().split('T')[0]
    };
    observations.push(obs);
  });
  
  updateDensityTable();
  calculateDiversity();
  renderChart();
  
  alert(`Deteksi Otomatis Selesai!\nDitemukan total ${totalDetected} sel dari ${Object.keys(resultsByGenus).length} spesies.`);
}

function isHarmful(genus) {
  const habs = ["Karenia", "Alexandrium", "Dinophysis", "Pseudo-nitzschia", "Gymnodinium", "Microcystis"];
  return habs.includes(genus);
}

// --- IndexedDB Management for Plankton Species Database ---

function initIndexedDB() {
  const request = indexedDB.open(DB_NAME, 1);
  
  request.onupgradeneeded = function(e) {
    db = e.target.result;
    if(!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    }
  };
  
  request.onsuccess = function(e) {
    db = e.target.result;
    // Check if store is empty, if yes, do seeding. Otherwise load DB.
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();
    
    countRequest.onsuccess = function() {
      if (countRequest.result === 0) {
        seedDefaultSpecies();
      } else {
        loadSpeciesDB();
      }
    };
  };
  
  request.onerror = function(e) {
    console.error("IndexedDB Error: ", e);
  };
}

// Draw dynamic plankton vectors as Base64 placeholders
function generatePlanktonImage(species, r, g, b) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  
  // Background
  ctx.fillStyle = "rgba(10, 10, 12, 0.95)";
  ctx.fillRect(0, 0, 100, 100);
  
  // Border
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, 92, 92);
  
  // Drawing setup
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
  ctx.lineWidth = 2.5;
  
  const cx = 50, cy = 50;
  
  if (species === "Chaetoceros") {
    // Oval with long spines
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 10, 0, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
    // Spines (setae)
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, 42); ctx.lineTo(15, 20);
    ctx.moveTo(65, 42); ctx.lineTo(85, 20);
    ctx.moveTo(35, 58); ctx.lineTo(15, 80);
    ctx.moveTo(65, 58); ctx.lineTo(85, 80);
    ctx.stroke();
  } else if (species === "Skeletonema") {
    // Cylinders linked in a chain
    ctx.beginPath();
    ctx.rect(35, 20, 30, 14);
    ctx.rect(35, 43, 30, 14);
    ctx.rect(35, 66, 30, 14);
    ctx.fill();
    ctx.stroke();
    // Connecting threads
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 34); ctx.lineTo(40, 43);
    ctx.moveTo(50, 34); ctx.lineTo(50, 43);
    ctx.moveTo(60, 34); ctx.lineTo(60, 43);
    ctx.moveTo(40, 57); ctx.lineTo(40, 66);
    ctx.moveTo(50, 57); ctx.lineTo(50, 66);
    ctx.moveTo(60, 57); ctx.lineTo(60, 66);
    ctx.stroke();
  } else if (species === "Nannochloropsis") {
    // Tiny green spherical cell
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (species === "Spirulina") {
    // Helical thread
    ctx.beginPath();
    ctx.lineWidth = 3;
    let first = true;
    for (let theta = 0; theta < 5 * Math.PI; theta += 0.1) {
      let x = cx + 16 * Math.sin(theta);
      let y = 18 + (theta / (5 * Math.PI)) * 64;
      if (first) { ctx.moveTo(x, y); first = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  } else if (species === "Tetraselmis") {
    // Heart/pear shaped green cell
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.bezierCurveTo(cx - 15, cy - 25, cx - 22, cy + 2, cx, cy + 18);
    ctx.bezierCurveTo(cx + 22, cy + 2, cx + 15, cy - 25, cx, cy - 18);
    ctx.fill();
    ctx.stroke();
    // Flagella
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.quadraticCurveTo(cx - 8, cy - 30, cx - 22, cy - 34);
    ctx.moveTo(cx, cy - 18);
    ctx.quadraticCurveTo(cx + 8, cy - 30, cx + 22, cy - 34);
    ctx.stroke();
  } else if (species === "Dunaliella") {
    // Oval cell
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 20, 0, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
    // Flagella
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.quadraticCurveTo(cx - 10, cy - 32, cx - 24, cy - 35);
    ctx.moveTo(cx, cy - 20);
    ctx.quadraticCurveTo(cx + 10, cy - 32, cx + 24, cy - 35);
    ctx.stroke();
  } else if (species === "Karenia") {
    // Bilobed dinoflagellate
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 16, Math.PI, 0);
    ctx.lineTo(cx + 16, cy + 10);
    ctx.arc(cx, cy + 10, 16, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (species === "Alexandrium") {
    // Spherical polygonal armored plates
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx - 16, cy - 8);
    ctx.lineTo(cx - 16, cy + 8);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx + 16, cy + 8);
    ctx.lineTo(cx + 16, cy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Plate sutures
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy + 18);
    ctx.stroke();
  } else if (species === "Dinophysis") {
    // Dynamic pocket shape with large collar
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy + 5, 16, 22, -0.15, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
    // Collar projection
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 15);
    ctx.quadraticCurveTo(cx - 4, cy - 28, cx + 12, cy - 20);
    ctx.stroke();
  } else if (species === "Pseudo-nitzschia") {
    // Extremely thin spindle shape (needle)
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.5, 36, Math.PI/4, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (species === "Gymnodinium") {
    // Rounded dinoflagellate with deep central girdle
    ctx.beginPath();
    ctx.arc(cx, cy - 5, 14, 0, Math.PI, true);
    ctx.arc(cx, cy + 8, 13, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (species === "Microcystis") {
    // Colony of multiple clustered cyanobacteria cells
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 10, 6, 0, 2*Math.PI);
    ctx.arc(cx + 10, cy - 12, 6, 0, 2*Math.PI);
    ctx.arc(cx - 8, cy + 10, 6, 0, 2*Math.PI);
    ctx.arc(cx + 12, cy + 8, 6, 0, 2*Math.PI);
    ctx.arc(cx + 2, cy - 2, 6, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  
  return canvas.toDataURL("image/png");
}

function seedDefaultSpecies() {
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  
  DEFAULT_SPECIES.forEach(sp => {
    const dataUrl = generatePlanktonImage(sp.species, sp.r, sp.g, sp.b);
    store.add({
      species: sp.species,
      type: sp.type,
      minSize: sp.minSize,
      r: sp.r,
      g: sp.g,
      b: sp.b,
      image: dataUrl,
      timestamp: Date.now()
    });
  });
  
  transaction.oncomplete = function() {
    console.log("Seeding default species database selesai!");
    loadSpeciesDB();
  };
}

function openTrainModal() {
  document.getElementById("train-modal").style.display = "flex";
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("train-section").style.display = "none";
  document.getElementById("admin-pwd").value = "";
}

function verifyAdmin() {
  const pwd = document.getElementById("admin-pwd").value;
  if(pwd === "AHL2026") {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("train-section").style.display = "block";
  } else {
    alert("Password salah! Akses ditolak.");
  }
}

function saveToIndexedDB() {
  const speciesInput = document.getElementById("train-species-name");
  const typeInput = document.getElementById("train-species-type");
  const minsizeInput = document.getElementById("train-species-minsize");
  const fileInput = document.getElementById("train-img-input");
  
  if(!speciesInput || !speciesInput.value.trim()) {
    alert("Silakan masukkan nama Genus / Spesies.");
    return;
  }
  
  if(!fileInput.files || fileInput.files.length === 0) {
    alert("Silakan unggah gambar referensi plankton.");
    return;
  }
  
  const species = speciesInput.value.trim();
  const type = typeInput.value;
  const minSize = parseInt(minsizeInput.value) || 10;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64Img = evt.target.result;
    
    // Draw to an offscreen canvas to calculate average color
    const img = new Image();
    img.onload = function() {
      const oc = document.createElement("canvas");
      oc.width = img.width;
      oc.height = img.height;
      const octx = oc.getContext("2d");
      octx.drawImage(img, 0, 0);
      
      const imgData = octx.getImageData(0, 0, oc.width, oc.height).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      // Calculate average color, ignoring near-white/transparent backgrounds if possible
      for(let i=0; i < imgData.length; i+=4) {
        if (imgData[i+3] < 10) continue;
        if (imgData[i] > 240 && imgData[i+1] > 240 && imgData[i+2] > 240) continue;
        
        rSum += imgData[i];
        gSum += imgData[i+1];
        bSum += imgData[i+2];
        count++;
      }
      
      if (count === 0) { count = 1; } // fallback
      
      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);
      
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      store.add({
        species: species,
        type: type,
        minSize: minSize,
        r: avgR,
        g: avgG,
        b: avgB,
        image: base64Img,
        timestamp: Date.now()
      });
      
      transaction.oncomplete = function() {
        alert(`Spesies ${species} berhasil ditambahkan ke Database Referensi!`);
        document.getElementById("train-species-name").value = "";
        document.getElementById("train-img-input").value = "";
        loadSpeciesDB();
      };
    };
    img.src = base64Img;
  };
  reader.readAsDataURL(fileInput.files[0]);
}

function loadSpeciesDB() {
  if(!db) return;
  const transaction = db.transaction([STORE_NAME], "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  
  request.onsuccess = function() {
    const speciesList = request.result;
    const tbody = document.getElementById("species-table-body");
    const emptyState = document.getElementById("species-empty-state");
    
    if(speciesList.length === 0) {
      tbody.innerHTML = "";
      emptyState.style.display = "flex";
      window.userDbProfiles = [];
      populateManualSpeciesDropdown();
      return;
    }
    
    emptyState.style.display = "none";
    let html = "";
    
    window.userDbProfiles = speciesList;
    populateManualSpeciesDropdown();
    
    speciesList.forEach(item => {
      let badgeClass = item.type === 'HABs' ? 'alert' : 'safe';
      html += `
        <tr>
          <td><img src="${item.image}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;"></td>
          <td><strong>${item.species}</strong></td>
          <td><span class="status-badge ${badgeClass}">${item.type}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 20px; height: 20px; border-radius: 50%; background-color: rgb(${item.r},${item.g},${item.b}); border: 1px solid #fff;"></div>
              <span>RGB(${item.r}, ${item.g}, ${item.b})</span>
            </div>
          </td>
          <td><button class="header-btn compact-btn" onclick="deleteSpeciesDB(${item.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  };
}

function populateManualSpeciesDropdown() {
  const select = document.getElementById("manual-species");
  if (!select) return;
  
  select.innerHTML = "";
  const profiles = window.userDbProfiles || [];
  
  if (profiles.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- Database Kosong --";
    select.appendChild(opt);
    return;
  }
  
  profiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.species;
    opt.textContent = `${p.species} (${p.type === 'HABs' ? 'HABs' : 'Beneficial'})`;
    select.appendChild(opt);
  });
}

function deleteSpeciesDB(id) {
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.delete(id);
  transaction.oncomplete = function() {
    loadSpeciesDB();
  };
}

function clearSpeciesDB() {
  if(!confirm("Yakin ingin menghapus seluruh data referensi spesies?")) return;
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  transaction.oncomplete = function() {
    loadSpeciesDB();
  };
}

// --- Results UI (Tables & Diversity) ---

function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");
  
  if(tabId === 'diversity-tab') {
    renderChart();
  } else if (tabId === 'species-db-tab') {
    loadSpeciesDB();
  }
}

function updateDensityTable() {
  const tbody = document.getElementById("density-table-body");
  const empty = document.getElementById("density-empty-state");
  
  if(observations.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  
  empty.style.display = "none";
  let html = "";
  
  observations.forEach(obs => {
    let badgeClass = obs.type === 'HABs' ? 'alert' : (obs.type === 'Unknown' ? 'neutral' : 'safe');
    let status = 'Aman';
    if (obs.type === 'HABs') {
      status = obs.density > 10000 ? 'Bahaya Kritis' : 'Waspada';
    } else if (obs.type === 'Unknown') {
      status = 'Tidak Diketahui';
    }
    
    html += `
      <tr>
        <td><strong>${obs.genus}</strong></td>
        <td>${obs.type === 'Unknown' ? '-' : obs.type}</td>
        <td style="font-family: var(--font-heading); color: var(--text-accent); font-weight: 700;">${obs.density.toLocaleString()}</td>
        <td><span class="status-badge ${badgeClass}">${status}</span></td>
        <td><button class="header-btn compact-btn" onclick="deleteObservation(${obs.id})"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

function deleteObservation(id) {
  observations = observations.filter(o => o.id !== id);
  updateDensityTable();
  calculateDiversity();
  renderChart();
}

// Ecological Indices (Shannon, Simpson, Evenness)
function calculateDiversity() {
  if(observations.length === 0) {
    document.getElementById("shannon-val").innerText = "0.00";
    document.getElementById("simpson-val").innerText = "0.00";
    document.getElementById("evenness-val").innerText = "0.00";
    document.getElementById("shannon-interp").innerText = "-";
    document.getElementById("evenness-interp").innerText = "-";
    return;
  }
  
  let totalDensity = observations.reduce((sum, obs) => sum + obs.density, 0);
  if (totalDensity <= 0) totalDensity = 1; // safety
  
  let shannonH = 0;
  let simpsonD = 0;
  let S = observations.length; // Species richness
  
  observations.forEach(obs => {
    let pi = obs.density / totalDensity;
    if(pi > 0) {
      shannonH -= (pi * Math.log(pi));
      simpsonD += (pi * pi);
    }
  });
  
  let evennessJ = S > 1 ? shannonH / Math.log(S) : 1;
  
  document.getElementById("shannon-val").innerText = shannonH.toFixed(3);
  document.getElementById("simpson-val").innerText = simpsonD.toFixed(3);
  document.getElementById("evenness-val").innerText = evennessJ.toFixed(3);
  
  // Interpretations
  document.getElementById("shannon-interp").innerText = shannonH > 2.0 ? "Keanekaragaman Tinggi (Ekosistem Stabil)" : (shannonH > 1.0 ? "Keanekaragaman Sedang" : "Keanekaragaman Rendah (Tercemar)");
  document.getElementById("evenness-interp").innerText = evennessJ > 0.6 ? "Spesies Merata" : "Terdapat Dominansi Spesies Tertentu";
}

let compChart = null;
function renderChart() {
  const ctx = document.getElementById('compositionChart');
  if(!ctx) return;
  
  if(compChart) {
    compChart.destroy();
  }
  
  if (observations.length === 0) {
    return;
  }
  
  const labels = observations.map(o => o.genus);
  const data = observations.map(o => o.density);
  const colors = observations.map(o => o.type === 'HABs' ? 'rgba(244, 63, 94, 0.7)' : (o.type === 'Unknown' ? 'rgba(156, 163, 175, 0.7)' : 'rgba(16, 185, 129, 0.7)'));
  
  compChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Kepadatan Sel (sel/mL)',
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.7', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// --- Pond Database Manager (LocalStorage Relational Database) ---

const POND_DB_KEY = "aqua_insight_plankton_history";

function saveCurrentSession() {
  const pondNameInput = document.getElementById("db-pond-name");
  const notesInput = document.getElementById("db-notes");
  
  if (observations.length === 0) {
    alert("Tidak ada data pengamatan aktif untuk disimpan. Silakan lakukan entri manual atau analisis otomatis.");
    return;
  }
  
  const pondName = pondNameInput.value.trim();
  if (!pondName) {
    alert("Silakan masukkan nama kolam terlebih dahulu.");
    return;
  }
  
  const notes = notesInput.value.trim() || "Tidak ada catatan";
  
  const session = {
    id: Date.now(),
    pondName: pondName,
    notes: notes,
    date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    totalDensity: observations.reduce((s, o) => s + o.density, 0),
    shannonH: parseFloat(document.getElementById("shannon-val").innerText) || 0,
    simpsonD: parseFloat(document.getElementById("simpson-val").innerText) || 0,
    evennessJ: parseFloat(document.getElementById("evenness-val").innerText) || 0,
    items: JSON.parse(JSON.stringify(observations))
  };
  
  let history = [];
  const saved = localStorage.getItem(POND_DB_KEY);
  if (saved) {
    try {
      history = JSON.parse(saved);
    } catch(e) {
      history = [];
    }
  }
  
  history.unshift(session); // Add to beginning
  localStorage.setItem(POND_DB_KEY, JSON.stringify(history));
  
  pondNameInput.value = "";
  notesInput.value = "";
  
  loadPondDatabase();
  alert(`Sesi kolam "${pondName}" berhasil disimpan ke database!`);
}

function loadPondDatabase() {
  const list = document.getElementById("database-list");
  if (!list) return;
  
  list.innerHTML = "";
  const saved = localStorage.getItem(POND_DB_KEY);
  let history = [];
  
  if (saved) {
    try {
      history = JSON.parse(saved);
    } catch(e) {
      history = [];
    }
  }
  
  const isEn = (typeof window.AQUA_GET_LANG === "function") && window.AQUA_GET_LANG() === "en";
  const tEmpty = isEn ? "No saved pond session history yet." : "Belum ada riwayat sesi kolam tersimpan.";
  const tSpecies = isEn ? "Species" : "Spesies";
  const tDensity = isEn ? "Density" : "Kepadatan";
  const tLoad = isEn ? "Load" : "Muat";
  const tDelete = isEn ? "Delete" : "Hapus";
  
  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <i class="fa-solid fa-folder-open"></i>
        <p data-i18n="pl_empty_history">${tEmpty}</p>
      </div>
    `;
    return;
  }
  
  history.forEach(session => {
    const li = document.createElement("li");
    li.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 0.8rem;";
    
    li.innerHTML = `
      <div class="db-info">
        <div class="db-date" style="font-weight: 700; color: var(--text-accent); font-size: 1rem;">${session.pondName}</div>
        <div class="db-meta" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
          <i class="fa-solid fa-calendar-day"></i> ${session.date} | <i class="fa-solid fa-tags"></i> ${session.items.length} ${tSpecies}
        </div>
        <div class="db-meta" style="font-size: 0.8rem; color: var(--text-primary); margin-top: 0.4rem; font-style: italic;">
          "${session.notes}"
        </div>
        <div style="display: flex; gap: 0.8rem; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
          <span>${tDensity}: <b>${session.totalDensity.toLocaleString()} sel/mL</b></span>
          <span>Shannon H': <b>${session.shannonH.toFixed(2)}</b></span>
        </div>
      </div>
      <div style="display: flex; gap: 0.4rem;">
        <button class="header-btn compact-btn" style="background: rgba(0, 242, 254, 0.1); color: var(--text-accent); border-color: rgba(0, 242, 254, 0.3);" onclick="loadPondSession(${session.id})">
          <i class="fa-solid fa-folder-open"></i> ${tLoad}
        </button>
        <button class="header-btn compact-btn" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deletePondSession(${session.id})">
          <i class="fa-solid fa-trash"></i> ${tDelete}
        </button>
      </div>
    `;
    list.appendChild(li);
  });
}

function loadPondSession(id) {
  const saved = localStorage.getItem(POND_DB_KEY);
  if (!saved) return;
  
  try {
    const history = JSON.parse(saved);
    const session = history.find(s => s.id === id);
    if (!session) return;
    
    if (confirm(`Muat sesi "${session.pondName}"? Ini akan menimpa data sesi aktif saat ini.`)) {
      observations = JSON.parse(JSON.stringify(session.items));
      updateDensityTable();
      calculateDiversity();
      renderChart();
      
      // Navigate to density tab
      const densityTabBtn = document.querySelector('[onclick*="density-tab"]');
      if (densityTabBtn) {
        switchTab('density-tab', densityTabBtn);
      }
      
      alert(`Sesi kolam "${session.pondName}" berhasil dimuat ke workspace!`);
    }
  } catch(e) {
    console.error("Gagal memuat sesi kolam", e);
  }
}

function deletePondSession(id) {
  const saved = localStorage.getItem(POND_DB_KEY);
  if (!saved) return;
  
  if (confirm("Apakah Anda yakin ingin menghapus sesi ini dari riwayat?")) {
    try {
      let history = JSON.parse(saved);
      history = history.filter(s => s.id !== id);
      localStorage.setItem(POND_DB_KEY, JSON.stringify(history));
      loadPondDatabase();
    } catch(e) {
      console.error(e);
    }
  }
}

function clearDatabase() {
  if(confirm("Yakin ingin menghapus seluruh riwayat pengamatan kolam di database?")) {
    localStorage.removeItem(POND_DB_KEY);
    loadPondDatabase();
  }
}

// --- Data Export Utilities (CSV & JSON) ---

function exportDatabaseJSON() {
  const saved = localStorage.getItem(POND_DB_KEY);
  if (!saved || JSON.parse(saved).length === 0) {
    alert("Database kosong, tidak ada data untuk diekspor.");
    return;
  }
  
  const blob = new Blob([saved], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plankton_pond_database_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportDatabaseCSV() {
  const saved = localStorage.getItem(POND_DB_KEY);
  if (!saved) {
    alert("Database kosong, tidak ada data untuk diekspor.");
    return;
  }
  
  let history = [];
  try {
    history = JSON.parse(saved);
  } catch(e) {
    alert("Gagal membaca database.");
    return;
  }
  
  if (history.length === 0) {
    alert("Database kosong, tidak ada data untuk diekspor.");
    return;
  }
  
  let csvContent = "Pond Name,Date Saved,Notes,Species,Count (N),Density (cells/mL),Type,Shannon H',Simpson D,Evenness J'\n";
  
  history.forEach(session => {
    session.items.forEach(item => {
      const row = [
        `"${session.pondName.replace(/"/g, '""')}"`,
        `"${session.date}"`,
        `"${session.notes.replace(/"/g, '""')}"`,
        `"${item.genus.replace(/"/g, '""')}"`,
        item.count,
        item.density,
        `"${item.type}"`,
        session.shannonH.toFixed(3),
        session.simpsonD.toFixed(3),
        session.evennessJ.toFixed(3)
      ].join(",");
      csvContent += row + "\n";
    });
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plankton_pond_database_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
