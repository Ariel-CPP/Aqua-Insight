// Microbiology Colony Counter - Image Processing for TCBS / TSA

let canvas, ctx;
let originalImage = null;
let cameraStream = null;

let customTargetHSV = { h: 0, s: 0, v: 0, r: 255, g: 255, b: 255 };
let isColonyEyedropperActive = false;

// TFJS variables
let tfModel = null;
let isPredicting = false;

// Circular ROI state (Petri dish boundary)
let ccRoiRadius = 90; // percentage of max possible radius
let ccRoiX = 0; // pixel offset X
let ccRoiY = 0; // pixel offset Y

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('colony-canvas');
  ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#555';
  ctx.font = '14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('Menunggu gambar cawan petri...', canvas.width/2, canvas.height/2);
  
  canvas.addEventListener("click", handleCanvasClick);
  
  // Initialize AI Model
  initTFModel();
});

async function initTFModel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillText("Memuat Model YOLOv8...", canvas.width/2, canvas.height/2);
  
  if (!window.CVEngine || !window.CVEngine.YoloV8Engine) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText("CVEngine tidak ditemukan", canvas.width/2, canvas.height/2);
    return;
  }
  
  try {
    tfModel = new window.CVEngine.YoloV8Engine('../assets/models/yolo/colony/model.json');
    const success = await tfModel.loadModel();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(success) {
      ctx.fillText("YOLOv8 Colony Model Siap", canvas.width/2, canvas.height/2);
    } else {
      ctx.fillText("Model tidak ditemukan, Fallback Mode Aktif", canvas.width/2, canvas.height/2);
    }
  } catch(e) {
    console.error("Gagal memuat YOLOv8", e);
    ctx.fillText("Gagal memuat AI", canvas.width/2, canvas.height/2);
  }
}

function updateMediaMode() {
  const mediaType = document.getElementById('media-type').value;
  const eyedropperBtn = document.getElementById('btn-colony-eyedropper');
  const customGroup = document.getElementById('custom-color-group');
  
  if (mediaType === 'custom') {
    eyedropperBtn.style.display = 'inline-block';
    customGroup.style.display = 'block';
  } else {
    eyedropperBtn.style.display = 'none';
    customGroup.style.display = 'none';
    isColonyEyedropperActive = false;
    canvas.style.cursor = "default";
    eyedropperBtn.classList.remove("active");
  }
  analyzeColonies();
}

function toggleColonyEyedropper() {
  const btn = document.getElementById("btn-colony-eyedropper");
  isColonyEyedropperActive = !isColonyEyedropperActive;
  
  if (isColonyEyedropperActive) {
    btn.classList.add("active");
    btn.style.color = "#00f2fe";
    canvas.style.cursor = "crosshair";
  } else {
    btn.classList.remove("active");
    btn.style.color = "";
    canvas.style.cursor = "default";
  }
}

function handleCanvasClick(e) {
  if (!isColonyEyedropperActive || !originalImage) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  
  const px = ctx.getImageData(x, y, 1, 1).data;
  const r = px[0], g = px[1], b = px[2];
  
  // Calculate HSV
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if(delta > 0) {
    if(max === r)      h = 60 * (((g - b) / delta) % 6);
    else if(max === g) h = 60 * (((b - r) / delta) + 2);
    else               h = 60 * (((r - g) / delta) + 4);
    if(h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  
  customTargetHSV = { h, s, v, r, g, b };
  
  document.getElementById("target-color-preview").style.backgroundColor = `rgb(${r},${g},${b})`;
  document.getElementById("target-color-text").textContent = `HSV(${Math.round(h)}, ${(s*100).toFixed(0)}%, ${(v/2.55).toFixed(0)}%) / RGB(${r},${g},${b})`;
  
  toggleColonyEyedropper();
  analyzeColonies(); // Trigger re-analysis immediately on color pick
}

// UI Sliders Input Handlers
window.updateCcSensitivity = function(val) {
  document.getElementById('cc-sensitivity-val').textContent = val;
  analyzeColonies();
};

window.updateCcRoiRadius = function(val) {
  document.getElementById('cc-roi-radius-val').textContent = val + '%';
  ccRoiRadius = parseFloat(val);
  analyzeColonies();
};

window.updateCcRoiX = function(val) {
  ccRoiX = parseFloat(val);
  analyzeColonies();
};

window.updateCcRoiY = function(val) {
  ccRoiY = parseFloat(val);
  analyzeColonies();
};

// --- Media & Camera Handlers ---

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
    canvas.parentElement.style.display = "none";
    
    if (tfModel) {
      isPredicting = true;
      video.addEventListener('loadeddata', () => {
        predictColonyWebcam(video);
      });
    }
  } catch (err) {
    alert("Tidak dapat mengakses kamera: " + err.message);
  }
}

async function predictColonyWebcam(video) {
  if(!isPredicting) return;
  
  let predictions = [];
  if (tfModel && tfModel.isLoaded) {
    await tfModel.predict(video);
  }
  
  video.style.display = "none";
  canvas.parentElement.style.display = "flex";
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  predictions.forEach(pred => {
    ctx.beginPath();
    ctx.rect(pred.bbox[0], pred.bbox[1], pred.bbox[2], pred.bbox[3]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FBBF24'; 
    ctx.stroke();
    
    ctx.fillStyle = '#FBBF24';
    ctx.fillText(`Colony (${Math.round(pred.score * 100)}%)`, pred.bbox[0] + 5, pred.bbox[1] + 15);
  });
  
  window.requestAnimationFrame(() => predictColonyWebcam(video));
}

function stopCamera() {
  if(cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  isPredicting = false;
  document.getElementById("camera-stream").style.display = "none";
  document.getElementById("snap-btn").style.display = "none";
  canvas.parentElement.style.display = "flex";
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
  const ratio = canvas.width / img.width;
  const targetHeight = img.height * ratio;
  canvas.height = targetHeight;
  
  ctx.drawImage(img, 0, 0, canvas.width, targetHeight);
}

// --- Analysis Pipeline with Adaptive Color and circular ROI ---

// Separable Box Blur for fast local background estimation
function boxBlur(src, w, h, radius) {
  const dest = new Float32Array(w * h);
  
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    let sum = 0;
    
    // Initialize window
    for (let x = -radius; x <= radius; x++) {
      const clampedX = Math.min(w - 1, Math.max(0, x));
      sum += src[rowOffset + clampedX];
    }
    
    for (let x = 0; x < w; x++) {
      dest[rowOffset + x] = sum / (2 * radius + 1);
      
      // Update window
      const oldX = Math.min(w - 1, Math.max(0, x - radius));
      const newX = Math.min(w - 1, Math.max(0, x + radius + 1));
      sum += src[rowOffset + newX] - src[rowOffset + oldX];
    }
  }
  
  const dest2 = new Float32Array(w * h);
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    
    // Initialize window
    for (let y = -radius; y <= radius; y++) {
      const clampedY = Math.min(h - 1, Math.max(0, y));
      sum += dest[clampedY * w + x];
    }
    
    for (let y = 0; y < h; y++) {
      dest2[y * w + x] = sum / (2 * radius + 1);
      
      // Update window
      const oldY = Math.min(h - 1, Math.max(0, y - radius));
      const newY = Math.min(h - 1, Math.max(0, y + radius + 1));
      sum += dest[newY * w + x] - dest[oldY * w + x];
    }
  }
  
  return dest2;
}

function analyzeColonies() {
  if(!originalImage) {
    alert('Silakan unggah gambar cawan petri terlebih dahulu.');
    return;
  }
  
  const mediaType = document.getElementById('media-type').value;
  const dilFactor = parseInt(document.getElementById('dilution-factor').value) || 1;
  const platVol = parseFloat(document.getElementById('plating-vol').value) || 0.1;
  const multiplier = dilFactor / platVol;
  
  const minSize = parseInt(document.getElementById('cc-min-size').value) || 20;
  const maxSize = parseInt(document.getElementById('cc-max-size').value) || 1000;
  
  // Redraw clean image first
  drawToCanvas(originalImage);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const W = canvas.width;
  const H = canvas.height;
  
  // Calculate Circular ROI (Petri dish boundary) parameters
  const centerX = W / 2 + ccRoiX;
  const centerY = H / 2 + ccRoiY;
  const radius = Math.min(W, H) * 0.5 * (ccRoiRadius / 100);
  
  // Grayscale representation for local thresholding
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  
  // Local background estimate using separable box blur
  const bgGray = boxBlur(gray, W, H, 20);
  
  // Compute median background brightness of the plate for Light/Dark classification
  const allBgVals = [];
  for (let i = 0; i < W * H; i++) {
    const pxX = i % W;
    const pxY = Math.floor(i / W);
    if ((pxX - centerX)**2 + (pxY - centerY)**2 <= radius**2) {
      allBgVals.push(bgGray[i]);
    }
  }
  allBgVals.sort((a, b) => a - b);
  const medBright = allBgVals.length > 0 ? allBgVals[Math.floor(allBgVals.length * 0.5)] : 128;
  
  // Adaptive local threshold calculation
  const sensitivity = parseInt(document.getElementById('cc-sensitivity').value) || 50;
  const relThresh = (100 - sensitivity) / 500; // range from 0.02 (S=90) to 0.18 (S=10)
  const absThresh = Math.max(3, 12 - sensitivity / 10); // range from 3 (S=90) to 11 (S=10)
  
  // Mask values: 0 = background, 1 = bright candidate, 2 = dark candidate
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const pxX = i % W;
    const pxY = Math.floor(i / W);
    
    // Enforce ROI boundary check
    if ((pxX - centerX)**2 + (pxY - centerY)**2 > radius**2) {
      mask[i] = 0;
      continue;
    }
    
    // Check if it's a bright candidate (e.g. yellow colonies)
    const diffBright = gray[i] - bgGray[i];
    if (diffBright > absThresh && (diffBright / (bgGray[i] + 10)) > relThresh) {
      mask[i] = 1;
      continue;
    }
    
    // Check if it's a dark candidate (e.g. green colonies)
    const diffDark = bgGray[i] - gray[i];
    if (diffDark > absThresh && (diffDark / (bgGray[i] + 10)) > relThresh) {
      mask[i] = 2;
      continue;
    }
    
    mask[i] = 0;
  }
  
  // Step 2: BFS Connected Components labeling (running separately for bright and dark candidates)
  const visited = new Uint8Array(W * H);
  const components = [];
  
  for(let y = 0; y < H; y++) {
    for(let x = 0; x < W; x++) {
      const idx = y * W + x;
      if(mask[idx] > 0 && !visited[idx]) {
        const colorType = mask[idx]; // 1 = bright, 2 = dark
        const pixels = [];
        const queue = [idx];
        visited[idx] = 1;
        let qi = 0;
        
        while(qi < queue.length) {
          const ci = queue[qi++];
          pixels.push(ci);
          const cx = ci % W, cy = Math.floor(ci / W);
          [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx, dy]) => {
            const nx = cx + dx, ny = cy + dy;
            if(nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const ni = ny * W + nx;
              // Only traverse if it has the EXACT same candidate type (bright vs dark)
              if(mask[ni] === colorType && !visited[ni]) {
                visited[ni] = 1;
                queue.push(ni);
              }
            }
          });
        }
        
        // Filter based on user-defined size parameters
        if(pixels.length >= minSize && pixels.length <= maxSize) {
          const compCx = pixels.reduce((s, p) => s + p % W, 0) / pixels.length;
          const compCy = pixels.reduce((s, p) => s + Math.floor(p / W), 0) / pixels.length;
          
          // Calculate average RGB of the component
          let sumR = 0, sumG = 0, sumB = 0;
          pixels.forEach(p => {
            sumR += data[p * 4];
            sumG += data[p * 4 + 1];
            sumB += data[p * 4 + 2];
          });
          const avgR = sumR / pixels.length;
          const avgG = sumG / pixels.length;
          const avgB = sumB / pixels.length;
          
          components.push({ pixels, cx: compCx, cy: compCy, colorType, avgR, avgG, avgB, area: pixels.length });
        }
      }
    }
  }
  
  // Step 3: Draw detection overlays on canvas and classify colors
  drawToCanvas(originalImage); // Redraw clean background
  ctx.lineWidth = 2;
  
  let numYellow = 0, numGreen = 0, numTotal = 0;
  
  components.forEach(comp => {
    // Convert average RGB to HSV
    const avgR = comp.avgR;
    const avgG = comp.avgG;
    const avgB = comp.avgB;
    
    const max = Math.max(avgR, avgG, avgB);
    const min = Math.min(avgR, avgG, avgB);
    const delta = max - min;
    let h = 0;
    if (delta > 0) {
      if (max === avgR)      h = 60 * (((avgG - avgB) / delta) % 6);
      else if (max === avgG) h = 60 * (((avgB - avgR) / delta) + 2);
      else                   h = 60 * (((avgR - avgG) / delta) + 4);
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    
    let finalColorType = 0; // 0 = excluded, 1 = yellow/light, 2 = green/dark, 4 = custom
    
    if (mediaType === 'tcbs') {
      if (comp.colorType === 1) {
        // Bright spots -> check if it matches yellow/orange Hue range [340, 360] or [0, 75]
        // Yellow colonies are highly saturated and red/green are high
        const isYellow = (h >= 340 || h <= 75) && (avgR > avgB * 1.1) && (avgG > avgB * 1.1);
        if (isYellow) {
          finalColorType = 1;
        }
      } else if (comp.colorType === 2) {
        // Dark spots -> check if it matches green Hue range [75, 180]
        // Green colonies are forest green (high green compared to red/blue)
        const isGreen = (h >= 75 && h <= 180) && (avgG > avgR * 0.9);
        if (isGreen) {
          finalColorType = 2;
        }
      }
    } else if (mediaType === 'custom') {
      let hDiff = Math.abs(h - customTargetHSV.h);
      if (hDiff > 180) hDiff = 360 - hDiff;
      const sDiff = Math.abs(s - customTargetHSV.s);
      
      const rDiff = Math.abs(avgR - customTargetHSV.r);
      const gDiff = Math.abs(avgG - customTargetHSV.g);
      const bDiff = Math.abs(avgB - customTargetHSV.b);
      const rgbDist = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);
      
      const maxRgbDist = 30 + (sensitivity / 90) * 80;
      const maxHDiff = 20 + (sensitivity / 90) * 40;
      
      if (hDiff <= maxHDiff && rgbDist <= maxRgbDist) {
        finalColorType = 4; // custom matched
      }
    } else {
      // TSA/NA: Classify directly as Light (bright mask) or Dark (dark mask)
      if (comp.colorType === 1) {
        finalColorType = 1; // Light
      } else {
        finalColorType = 2; // Dark
      }
    }
    
    // Draw and count
    if (finalColorType === 0) {
      return; // Skip if it doesn't match the specific class color criteria (filters out noise/reflections)
    }
    
    const r = Math.sqrt(comp.area / Math.PI);
    ctx.beginPath();
    ctx.arc(comp.cx, comp.cy, r + 2.5, 0, 2 * Math.PI);
    
    if (mediaType === 'tcbs') {
      if (finalColorType === 1) {
        ctx.strokeStyle = '#FBBF24'; // Yellow
        numYellow++;
      } else {
        ctx.strokeStyle = '#10B981'; // Green
        numGreen++;
      }
    } else if (mediaType === 'custom') {
      ctx.strokeStyle = `rgb(${customTargetHSV.r}, ${customTargetHSV.g}, ${customTargetHSV.b})`;
      ctx.lineWidth = 3;
    } else {
      // TSA/NA
      if (finalColorType === 1) {
        ctx.strokeStyle = '#FFFFFF'; // Light (white)
        numYellow++;
      } else {
        ctx.strokeStyle = '#9CA3AF'; // Dark (gray)
        numGreen++;
      }
    }
    ctx.stroke();
    numTotal++;
  });
  
  // Draw circular ROI dashed outline overlay on canvas
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash
  
  // Step 4: Update results UI
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';
  
  const isTcbs = mediaType === 'tcbs';
  const tcbsNote = document.getElementById('tcbs-note');
  const yellowCard = document.getElementById('card-yellow');
  const greenCard  = document.getElementById('card-green');
  
  if(tcbsNote) tcbsNote.style.display = isTcbs ? 'block' : 'none';
  
  if (yellowCard) {
    yellowCard.style.display = '';
    const header = yellowCard.querySelector('h4');
    if (header) {
      header.innerText = isTcbs ? window.AQUA_T('cc_yellow_col') : window.AQUA_T('cc_light_col');
    }
  }
  if (greenCard) {
    greenCard.style.display = '';
    const header = greenCard.querySelector('h4');
    if (header) {
      header.innerText = isTcbs ? window.AQUA_T('cc_green_col') : window.AQUA_T('cc_dark_col');
    }
  }
  
  if (mediaType === 'custom') {
    if (yellowCard) yellowCard.style.display = 'none';
    if (greenCard) greenCard.style.display = 'none';
  } else {
    document.getElementById('val-yellow').innerText  = numYellow;
    document.getElementById('cfu-yellow').innerText  = (numYellow * multiplier).toExponential(2) + ' CFU/mL';
    document.getElementById('val-green').innerText   = numGreen;
    document.getElementById('cfu-green').innerText   = (numGreen * multiplier).toExponential(2) + ' CFU/mL';
  }
  
  document.getElementById('val-total').innerText   = numTotal;
  document.getElementById('cfu-total').innerText   = (numTotal * multiplier).toExponential(2) + ' CFU/mL';
}
