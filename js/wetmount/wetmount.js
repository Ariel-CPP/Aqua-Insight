/**
 * AQUA INSIGHT - WET MOUNT HP PATHOLOGY ANALYZER CONTROLLER
 * Features: Auto-seeding IndexedDB for shrimp hepatopancreas, interactive contours annotation,
 * canvas click-to-select, and lumen nutrient coverage diagnostic calculations.
 */

(function() {
  let canvas, ctx;
  let originalImage = null;
  let cameraStream = null;
  let db;

  let wmSettings = {
    autoThreshold: true,
    thresholdVal: 128,
    channel: 'gray',
    erosionIterations: 0,
    useColorRegion: false,
    colorRegionTolerance: 20,
    minSize: 8,
    maxSize: 80000,
    lumenAreaPercent: 45 // manual baseline lumen calibration percentage
  };

  let particlesList = [];      // Global storage of detected particles
  let activeDbProfiles = [];   // Global reference to active DB profiles
  let selectedParticleIndex = null; // Currently highlighted particle index

  const DB_NAME = "AHL_WetMount_Database";
  const STORE_NAME = "wetmount_objects";

  // Palette for unknown/generic particles
  const PALETTE = [
    '#00F2FE','#4FACFE','#F7971E','#FFD200','#43E97B','#F093FB',
    '#FA709A','#30CFD0','#A18CD1','#FBC2EB'
  ];

  document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("microscope-canvas");
    ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#555";
    ctx.font = "14px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Menunggu sampel gambar...", canvas.width / 2, canvas.height / 2);

    // Bind interactive click listener on the microscope canvas
    canvas.addEventListener("click", handleCanvasClick);

    initIndexedDB();
  });

  // ─── Image Upload & Camera Operations ────────────────────────────────────────

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = function() {
        originalImage = img;
        selectedParticleIndex = null;
        particlesList = [];
        hideSelectedParticleDetails();
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
    } catch (err) {
      alert("Tidak dapat mengakses kamera: " + err.message);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    const video = document.getElementById("camera-stream");
    if (video) video.style.display = "none";
    const snapBtn = document.getElementById("snap-btn");
    if (snapBtn) snapBtn.style.display = "none";
    canvas.style.display = "block";
  }

  function captureSnapshot() {
    const video = document.getElementById("camera-stream");
    if (!cameraStream) return;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = video.videoWidth;
    offCanvas.height = video.videoHeight;
    offCanvas.getContext("2d").drawImage(video, 0, 0);
    const img = new Image();
    img.onload = function() {
      originalImage = img;
      selectedParticleIndex = null;
      particlesList = [];
      hideSelectedParticleDetails();
      stopCamera();
      drawToCanvas(img);
    };
    img.src = offCanvas.toDataURL("image/png");
  }

  function drawToCanvas(img) {
    const ratio = canvas.width / img.width;
    const targetHeight = img.height * ratio;
    canvas.height = targetHeight;
    ctx.filter = "none";
    ctx.drawImage(img, 0, 0, canvas.width, targetHeight);
  }

  // ─── Control Listeners ───────────────────────────────────────────────────────

  function updateDetectionMethod(val) {
    wmSettings.useColorRegion = (val === 'color_region');
    document.getElementById('binary-settings-group').style.display = wmSettings.useColorRegion ? 'none' : 'block';
    document.getElementById('color-settings-group').style.display = wmSettings.useColorRegion ? 'block' : 'none';
  }

  function setChannel(ch, btn) {
    wmSettings.channel = ch;
    document.querySelectorAll('.channel-btn').forEach(b => {
      b.style.background = 'none';
      b.style.fontWeight = 'normal';
    });
    btn.style.background = 'var(--bg-hover)';
    btn.style.fontWeight = '700';
  }

  function toggleAutoThreshold() {
    wmSettings.autoThreshold = !wmSettings.autoThreshold;
    const btn = document.getElementById('toggle-auto-threshold');
    btn.classList.toggle('active', wmSettings.autoThreshold);
    document.getElementById('manual-thresh-group').style.display = wmSettings.autoThreshold ? 'none' : 'flex';
  }

  function updateManualThreshold(v) {
    wmSettings.thresholdVal = parseInt(v);
  }

  function updateErosion(v) {
    wmSettings.erosionIterations = parseInt(v);
  }

  function updateColorRegionTolerance(v) {
    wmSettings.colorRegionTolerance = parseInt(v);
  }

  function updateLumenAreaSlider(val) {
    const display = document.getElementById('lumen-area-val');
    if (display) display.textContent = `${val}%`;
    wmSettings.lumenAreaPercent = parseInt(val);
    
    // Recalculate metrics on the fly if analysis has already run
    if (originalImage && particlesList.length > 0) {
      matchAndDisplay(particlesList, activeDbProfiles);
    }
  }

  // ─── Image Processing & Classification ───────────────────────────────────────

  function analyzeHepatopancreas() {
    if (!originalImage) {
      alert("Silakan unggah gambar terlebih dahulu.");
      return;
    }
    selectedParticleIndex = null;
    hideSelectedParticleDetails();
    loadAndRunAnalysis();
  }

  function loadAndRunAnalysis() {
    if (!db) {
      runDetection([]);
      return;
    }
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = function() {
      runDetection(req.result || []);
    };
    req.onerror = function() {
      runDetection([]);
    };
  }

  function runDetection(dbProfiles) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = originalImage.width;
    offCanvas.height = originalImage.height;
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(originalImage, 0, 0);

    const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
    const W = offCanvas.width;
    const H = offCanvas.height;

    let particles = [];

    if (typeof window.AquaDetection === "undefined") {
      console.error("AquaDetection not loaded.");
      alert("Mesin Computer Vision tidak terdeteksi.");
      return;
    }

    if (wmSettings.useColorRegion) {
      // Color Region Growing mode
      particles = window.AquaDetection.analyzeByColor(
        imageData, W, H,
        1, 'px',
        wmSettings.colorRegionTolerance,
        wmSettings.minSize,
        wmSettings.maxSize
      ) || [];
    } else {
      // Binary Threshold mode
      const grayData = window.AquaDetection.toGrayscale(imageData, wmSettings.channel);
      let threshold = wmSettings.thresholdVal;
      if (wmSettings.autoThreshold) {
        threshold = window.AquaDetection.computeOtsuThreshold(grayData);
      }
      let binary = window.AquaDetection.threshold(grayData, W, H, threshold, true);
      if (wmSettings.erosionIterations > 0) {
        binary = window.AquaDetection.erode(binary, W, H, wmSettings.erosionIterations);
      }
      const raw = window.AquaDetection.analyze(binary, W, H, 1, 'px', imageData, false) || [];
      particles = raw.filter(p => p.areaPx >= wmSettings.minSize && p.areaPx <= wmSettings.maxSize);
    }

    matchAndDisplay(particles, dbProfiles);
  }

  // Maps segments to pathology categories, computes lumen nutrition ratios
  function matchAndDisplay(particles, dbProfiles) {
    activeDbProfiles = dbProfiles;
    const scaleFactor = canvas.width / originalImage.width;
    const W = originalImage.width;
    const H = originalImage.height;

    particles.forEach((p, idx) => {
      p.index = idx + 1; // 1-indexed

      let closestDist = Infinity;
      let closestLabel = null;
      let closestColor = '#888';

      // Access average RGB from CV Engine output
      const r = p.rgb ? p.rgb.r : 128;
      const g = p.rgb ? p.rgb.g : 128;
      const b = p.rgb ? p.rgb.b : 128;

      dbProfiles.forEach(prof => {
        if (p.areaPx < prof.minSize) return;

        const rDiff = r - prof.r;
        const gDiff = g - prof.g;
        const bDiff = b - prof.b;
        const dist = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

        if (dist < 90 && dist < closestDist) {
          closestDist = dist;
          closestLabel = prof.name;
          closestColor = `rgb(${prof.r},${prof.g},${prof.b})`;
        }
      });

      // Fallbacks if no profile matches
      if (!closestLabel) {
        // Lipid droplets are highly circular, small-to-medium refractive spheres
        if (p.circularity > 0.75 && p.areaPx >= 8 && p.areaPx <= 1200) {
          closestLabel = "Tetes Lipid (Nutrisi)";
          closestColor = '#10B981'; // Emerald Green
        } else {
          closestLabel = "Tidak Dikenali / Serpihan";
          closestColor = '#888888'; // Grey
        }
      }

      p.label = closestLabel;
      p.color = closestColor;
    });

    particlesList = particles;

    // Calculate Lumen Coverage
    let totalLumenArea = particles.filter(p => p.label === "Lumen Tubulus (Normal)").reduce((sum, p) => sum + p.areaPx, 0);
    const totalLipidArea = particles.filter(p => p.label === "Tetes Lipid (Nutrisi)").reduce((sum, p) => sum + p.areaPx, 0);

    let usedBaseline = false;
    if (totalLumenArea < 1000) {
      const factor = wmSettings.lumenAreaPercent / 100;
      totalLumenArea = W * H * factor;
      usedBaseline = true;
    }

    const coveragePercent = Math.min((totalLipidArea / totalLumenArea) * 100, 100);

    // Redraw and render results
    redrawCanvasWithAnnotations();

    const grouped = {};
    particles.forEach(p => {
      if (!grouped[p.label]) grouped[p.label] = { count: 0, color: p.color };
      grouped[p.label].count++;
    });

    renderResultsTable(grouped, particles.length);
    renderLumenCoverageCard(coveragePercent, usedBaseline, grouped);
  }

  // Renders the color-coded composition results
  function renderResultsTable(grouped, total) {
    document.getElementById("empty-state-result").style.display = "none";
    document.getElementById("result-stats").style.display = "block";

    const tbody = document.getElementById("objects-table-body");
    let html = '';
    const keys = Object.keys(grouped);

    keys.forEach((label) => {
      const g = grouped[label];
      const colorDot = `<div style="width:12px;height:12px;border-radius:50%;background:${g.color};display:inline-block;border:1px solid rgba(255,255,255,0.3);vertical-align:middle;margin-right:6px;"></div>`;
      html += `
        <tr>
          <td><strong>${label}</strong></td>
          <td>${colorDot}</td>
          <td style="font-family:var(--font-heading);font-weight:700;color:var(--text-accent);">${g.count}</td>
        </tr>
      `;
    });

    if (keys.length > 1) {
      html += `
        <tr style="border-top: 2px solid var(--border-color);">
          <td colspan="2" style="color:var(--text-secondary);">Total Objek</td>
          <td style="font-family:var(--font-heading);font-weight:700;">${total}</td>
        </tr>
      `;
    }

    if (html === '') {
      html = `<tr><td colspan="3" style="text-align:center;color:var(--text-secondary);padding:1rem;">Tidak ada partikel terdeteksi. Coba sesuaikan parameter segmentasi.</td></tr>`;
    }

    tbody.innerHTML = html;
  }

  // Renders the percentage coverage and diagnostic advice
  function renderLumenCoverageCard(coveragePercent, usedBaseline, grouped) {
    const card = document.getElementById('lumen-coverage-card');
    if (!card) return;
    card.style.display = 'block';

    const pctText = document.getElementById('coverage-percentage');
    pctText.textContent = `${coveragePercent.toFixed(1)}%`;

    const pBar = document.getElementById('coverage-bar');
    pBar.style.width = `${coveragePercent}%`;

    const statusBadge = document.getElementById('coverage-status');
    const recommendationText = document.getElementById('coverage-recommendation');

    let statusText = '';
    let statusColor = '';
    let recs = '';

    if (coveragePercent >= 50) {
      statusText = 'Kondisi Nutrisi: Normal / Optimal';
      statusColor = '#10B981'; // Green
      pBar.style.backgroundColor = '#10B981';
      pctText.style.color = '#10B981';
      recs = 'Ketersediaan tetes lipid dalam lumen tubulus melimpah. Mengindikasikan penyerapan nutrisi pakan berjalan sangat optimal.';
    } else if (coveragePercent >= 20) {
      statusText = 'Kondisi Nutrisi: Defisiensi Ringan (Waspada)';
      statusColor = '#F59E0B'; // Amber
      pBar.style.backgroundColor = '#F59E0B';
      pctText.style.color = '#F59E0B';
      recs = 'Tingkat vakuolisasi lipid sedang menurun. Disarankan untuk memantau pakan secara intensif dan menyesuaikan rasio pemberian.';
    } else {
      statusText = 'Kondisi Nutrisi: Malnutrisi / Atropi Tubulus (Bahaya)';
      statusColor = '#EF4444'; // Red
      pBar.style.backgroundColor = '#EF4444';
      pctText.style.color = '#EF4444';
      recs = 'Vakuolisasi lipid sangat rendah (kritis). Mengindikasikan stres pakan berat, kelaparan, atau gejala patogenik tubulus.';
    }

    // Append alert warnings if pathogenic elements are present
    let alerts = [];
    if (grouped['ATM (Aggregated Transformed Microvilli)'] && grouped['ATM (Aggregated Transformed Microvilli)'].count > 0) {
      alerts.push(`⚠️ [ALERT] Terdeteksi ${grouped['ATM (Aggregated Transformed Microvilli)'].count} partikel ATM (Aggregated Transformed Microvilli) di lumen. Indikasi serangan bakteri Vibrio sp.`);
    }
    if (grouped['Melanosis / Nekrosis HP'] && grouped['Melanosis / Nekrosis HP'].count > 0) {
      alerts.push(`⚠️ [ALERT] Terdeteksi ${grouped['Melanosis / Nekrosis HP'].count} daerah Melanosis/Nekrosis. Jaringan tubulus HP mengalami degenerasi seluler.`);
    }

    if (alerts.length > 0) {
      recs += '\n\n' + alerts.join('\n');
      statusText = 'Kondisi Kritis: Terdeteksi Infeksi Patogen';
      statusColor = '#EF4444';
      pctText.style.color = '#EF4444';
      pBar.style.backgroundColor = '#EF4444';
    }

    statusBadge.textContent = statusText;
    statusBadge.style.backgroundColor = statusColor;
    recommendationText.textContent = recs;
  }

  // ─── Canvas Interaction & Rendering ─────────────────────────────────────────

  function handleCanvasClick(e) {
    if (!originalImage || particlesList.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const scaleFactor = canvas.width / originalImage.width;

    let closestDist = Infinity;
    let closestParticle = null;

    particlesList.forEach(p => {
      const cx = p.centroid.x * scaleFactor;
      const cy = p.centroid.y * scaleFactor;
      const dist = Math.sqrt((clickX - cx)**2 + (clickY - cy)**2);
      if (dist < closestDist) {
        closestDist = dist;
        closestParticle = p;
      }
    });

    // Accept selection if within 35 pixels from centroid
    if (closestParticle && closestDist < 35) {
      selectedParticleIndex = closestParticle.index;
      showSelectedParticleDetails(closestParticle);
    } else {
      selectedParticleIndex = null;
      hideSelectedParticleDetails();
    }

    redrawCanvasWithAnnotations();
  }

  function redrawCanvasWithAnnotations() {
    if (!originalImage) return;

    // Clear and redraw image
    drawToCanvas(originalImage);

    const scaleFactor = canvas.width / originalImage.width;
    ctx.lineWidth = 2;

    particlesList.forEach(p => {
      const cx = p.centroid.x * scaleFactor;
      const cy = p.centroid.y * scaleFactor;
      const r = Math.sqrt(p.areaPx / Math.PI) * scaleFactor;

      // Draw boundary contour if available, otherwise fallback to bounding circle
      ctx.beginPath();
      if (p.contour && p.contour.length > 0) {
        ctx.moveTo(p.contour[0].x * scaleFactor, p.contour[0].y * scaleFactor);
        for (let i = 1; i < p.contour.length; i++) {
          ctx.lineTo(p.contour[i].x * scaleFactor, p.contour[i].y * scaleFactor);
        }
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, Math.max(r, 4), 0, 2 * Math.PI);
      }
      ctx.strokeStyle = p.color || '#888';
      ctx.stroke();

      // Draw Index Number overlay
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.shadowBlur = 3;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.index, cx, cy);
      ctx.shadowBlur = 0; // reset

      // Highlight selected particle
      if (selectedParticleIndex === p.index) {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(r, 4) + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#00F2FE";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
        ctx.lineWidth = 2; // restore
      }
    });
  }

  function showSelectedParticleDetails(p) {
    const card = document.getElementById('selected-object-card');
    if (!card) return;
    card.style.display = 'block';

    document.getElementById('sel-obj-index').textContent = p.index;
    document.getElementById('sel-obj-class').textContent = p.label;
    
    const classSpan = document.getElementById('sel-obj-class');
    classSpan.style.color = p.color;

    document.getElementById('sel-obj-size').textContent = `${p.areaPx} px`;
    document.getElementById('sel-obj-circ').textContent = p.circularity.toFixed(3);

    const r = p.rgb ? p.rgb.r : 128;
    const g = p.rgb ? p.rgb.g : 128;
    const b = p.rgb ? p.rgb.b : 128;
    document.getElementById('sel-obj-color').textContent = `RGB(${r}, ${g}, ${b})`;
  }

  function hideSelectedParticleDetails() {
    const card = document.getElementById('selected-object-card');
    if (card) card.style.display = 'none';
  }

  // ─── IndexedDB Storage & Auto-seeding ────────────────────────────────────────

  function initIndexedDB() {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = function(e) {
      const dbObj = e.target.result;
      if (dbObj.objectStoreNames.contains('pathology_models')) {
        dbObj.deleteObjectStore('pathology_models');
      }
      if (!dbObj.objectStoreNames.contains(STORE_NAME)) {
        dbObj.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = function(e) {
      db = e.target.result;
      seedDatabaseIfEmpty();
    };

    request.onerror = function(e) {
      console.error("IndexedDB Error: ", e);
    };
  }

  // Auto-seeds default HP pathology and nutrient profiles
  function seedDatabaseIfEmpty() {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = function() {
      if (req.result.length === 0) {
        const defaultProfiles = [
          {
            name: "Tetes Lipid (Nutrisi)",
            minSize: 8,
            r: 210,
            g: 205,
            b: 170,
            image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><circle cx='16' cy='16' r='10' fill='%2310B981' opacity='0.75'/></svg>",
            timestamp: Date.now()
          },
          {
            name: "ATM (Aggregated Transformed Microvilli)",
            minSize: 25,
            r: 140,
            g: 100,
            b: 60,
            image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><circle cx='16' cy='16' r='10' fill='%23F59E0B' opacity='0.75'/></svg>",
            timestamp: Date.now()
          },
          {
            name: "Melanosis / Nekrosis HP",
            minSize: 35,
            r: 65,
            g: 50,
            b: 40,
            image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><circle cx='16' cy='16' r='10' fill='%23EF4444' opacity='0.75'/></svg>",
            timestamp: Date.now()
          },
          {
            name: "Lumen Tubulus (Normal)",
            minSize: 50,
            r: 185,
            g: 175,
            b: 150,
            image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><circle cx='16' cy='16' r='10' fill='%2306B6D4' opacity='0.75'/></svg>",
            timestamp: Date.now()
          }
        ];

        const writeTx = db.transaction([STORE_NAME], "readwrite");
        const writeStore = writeTx.objectStore(STORE_NAME);
        defaultProfiles.forEach(prof => writeStore.add(prof));
        writeTx.oncomplete = function() {
          console.log("IndexedDB Wet Mount: HP pathology profiles seeded.");
          loadSpeciesDB();
        };
      } else {
        loadSpeciesDB();
      }
    };
  }

  function openTrainModal() {
    document.getElementById("train-modal").style.display = "flex";
    loadSpeciesDB();
  }

  function saveToIndexedDB() {
    const nameInput = document.getElementById("train-obj-name");
    const minsizeInput = document.getElementById("train-obj-minsize");
    const fileInput = document.getElementById("train-img-input");

    if (!nameInput || !nameInput.value.trim()) {
      alert("Silakan masukkan Nama Objek.");
      return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("Silakan unggah gambar referensi.");
      return;
    }

    const name = nameInput.value.trim();
    const minSize = parseInt(minsizeInput.value) || 10;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const base64Img = evt.target.result;
      const img = new Image();
      img.onload = function() {
        // Extract average color, ignoring transparent/white pixels
        const oc = document.createElement("canvas");
        oc.width = img.width;
        oc.height = img.height;
        const octx = oc.getContext("2d");
        octx.drawImage(img, 0, 0);
        const imgData = octx.getImageData(0, 0, oc.width, oc.height).data;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          if (imgData[i + 3] < 10) continue;
          if (imgData[i] > 240 && imgData[i + 1] > 240 && imgData[i + 2] > 240) continue;
          rSum += imgData[i];
          gSum += imgData[i + 1];
          bSum += imgData[i + 2];
          count++;
        }
        if (count === 0) count = 1;

        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add({
          name: name,
          minSize: minSize,
          r: avgR,
          g: avgG,
          b: avgB,
          image: base64Img,
          timestamp: Date.now()
        });
        tx.oncomplete = function() {
          alert(`Objek "${name}" berhasil ditambahkan ke database!`);
          nameInput.value = "";
          fileInput.value = "";
          loadSpeciesDB();
        };
      };
      img.src = base64Img;
    };
    reader.readAsDataURL(fileInput.files[0]);
  }

  function loadSpeciesDB() {
    if (!db) return;
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = function() {
      const list = req.result || [];
      const ul = document.getElementById("species-list-ui");
      if (!ul) return;

      if (list.length === 0) {
        ul.innerHTML = `<li style="color:var(--text-secondary);font-size:0.8rem;padding:0.5rem 0;">Belum ada objek referensi.</li>`;
        return;
      }

      ul.innerHTML = list.map(item => `
        <li style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);border-radius:8px;padding:0.6rem 0.8rem;display:flex;align-items:center;gap:0.6rem;">
          <img src="${item.image}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);">RGB(${item.r},${item.g},${item.b}) · min ${item.minSize}px</div>
          </div>
          <div style="width:12px;height:12px;border-radius:50%;background:rgb(${item.r},${item.g},${item.b});flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></div>
          <button onclick="deleteSpeciesDB(${item.id})" style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0.2rem;"><i class="fa-solid fa-trash"></i></button>
        </li>
      `).join('');
    };
  }

  function deleteSpeciesDB(id) {
    const tx = db.transaction([STORE_NAME], "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => loadSpeciesDB();
  }

  function clearSpeciesDB() {
    if (!confirm("Yakin ingin menghapus semua data referensi objek?")) return;
    const tx = db.transaction([STORE_NAME], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => loadSpeciesDB();
  }

  // ─── Attach to window explicitly for inline HTML event handlers ─────────────

  window.handleImageUpload = handleImageUpload;
  window.startCamera = startCamera;
  window.captureSnapshot = captureSnapshot;
  window.updateDetectionMethod = updateDetectionMethod;
  window.setChannel = setChannel;
  window.toggleAutoThreshold = toggleAutoThreshold;
  window.updateManualThreshold = updateManualThreshold;
  window.updateErosion = updateErosion;
  window.updateColorRegionTolerance = updateColorRegionTolerance;
  window.updateLumenAreaSlider = updateLumenAreaSlider;
  window.analyzeHepatopancreas = analyzeHepatopancreas;
  window.openTrainModal = openTrainModal;
  window.saveToIndexedDB = saveToIndexedDB;
  window.deleteSpeciesDB = deleteSpeciesDB;
  window.clearSpeciesDB = clearSpeciesDB;

})();
