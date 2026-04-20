// ==============================
// PARTICLE ANALYSIS MAIN SCRIPT
// Aqua Insight Version 0.1
// ==============================

let uploadedImage = null;
let uploadedImageName = '';
let currentAnalysisMode = 'single';

// Canvas references
const originalCanvas = document.getElementById('originalCanvas');
const channelCanvas = document.getElementById('channelCanvas');
const thresholdCanvas = document.getElementById('thresholdCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');

const originalCtx = originalCanvas?.getContext('2d');
const channelCtx = channelCanvas?.getContext('2d');
const thresholdCtx = thresholdCanvas?.getContext('2d');
const overlayCtx = overlayCanvas?.getContext('2d');

// DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeUpload();
  initializeModeButtons();
  initializeSettingsPersistence();
  initializeRunAnalysisButton();
});

// ==============================
// IMAGE UPLOAD
// ==============================

function initializeUpload() {
  const uploadButton = document.getElementById('uploadButton');
  const imageUpload = document.getElementById('imageUpload');
  const uploadArea = document.getElementById('uploadArea');

  if (!uploadButton || !imageUpload || !uploadArea) return;

  uploadButton.addEventListener('click', () => {
    imageUpload.click();
  });

  imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];

    if (!file) return;

    handleImageFile(file);
  });

  uploadArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    const file = event.dataTransfer.files[0];

    if (!file) return;

    handleImageFile(file);
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file.');
    return;
  }

  uploadedImageName = file.name;

  const reader = new FileReader();

  reader.onload = (event) => {
    const img = new Image();

    img.onload = () => {
      uploadedImage = img;

      renderOriginalImage(img);
      resetPreviewCanvases();
      updateImageUploadStatus(file.name);
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

// ==============================
// ORIGINAL IMAGE RENDERING
// ==============================

function renderOriginalImage(image) {
  if (!originalCanvas || !originalCtx) return;

  originalCanvas.width = image.width;
  originalCanvas.height = image.height;

  originalCtx.clearRect(0, 0, image.width, image.height);
  originalCtx.drawImage(image, 0, 0);

  fitCanvasToContainer(originalCanvas);
}

function resetPreviewCanvases() {
  const canvases = [
    channelCanvas,
    thresholdCanvas,
    overlayCanvas
  ];

  canvases.forEach(canvas => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  clearOverlaySvg();
}

// ==============================
// MODE BUTTONS
// ==============================

function initializeModeButtons() {
  const modeButtons = document.querySelectorAll('.sidebar-button');

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      currentAnalysisMode = button.dataset.mode || 'single';

      saveSetting('lastFeatureMode', currentAnalysisMode);
    });
  });
}

// ==============================
// SETTINGS PERSISTENCE
// ==============================

function initializeSettingsPersistence() {
  const settingIds = [
  'channelMode',
  'thresholdMode',
  'manualThresholdValue',
  'minParticleSize',
  'maxParticleSize',
  'circularityMin',
  'circularityMax',
  'invertThreshold',
  'excludeEdgeParticles',
  'ignoreBackgroundParticles'
];

  settingIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    const savedValue = getSetting(id);

    if (savedValue !== undefined && savedValue !== null) {
      if (element.type === 'checkbox') {
        element.checked = savedValue;
      } else {
        element.value = savedValue;
      }
    }

    element.addEventListener('change', () => {
      const value = element.type === 'checkbox'
        ? element.checked
        : element.value;

      saveSetting(id, value);
      updateSummaryLabels();
    });
  });

  updateSummaryLabels();

  const thresholdModeSelect = document.getElementById('thresholdMode');
const manualThresholdGroup = document.getElementById('manualThresholdGroup');
const thresholdTooltip = document.getElementById('thresholdTooltip');

if (thresholdModeSelect) {
  const updateThresholdUI = () => {
    const selectedOption = thresholdModeSelect.options[thresholdModeSelect.selectedIndex];
    const thresholdMode = thresholdModeSelect.value;

    if (thresholdTooltip) {
      thresholdTooltip.textContent =
        selectedOption.dataset.description || '';
    }

    if (manualThresholdGroup) {
      manualThresholdGroup.style.display =
        thresholdMode === 'manual' ? 'flex' : 'none';
    }
  };

   thresholdModeSelect.addEventListener('change', updateThresholdUI);
  thresholdModeSelect.addEventListener('mouseover', updateThresholdUI);

  updateThresholdUI();
  }
}

// ==============================
// RUN ANALYSIS BUTTON
// ==============================

function initializeRunAnalysisButton() {
  const runAnalysisButton = document.getElementById('runAnalysisButton');

  if (!runAnalysisButton) return;

  runAnalysisButton.addEventListener('click', () => {
    if (!uploadedImage) {
      alert('Please upload an image before running analysis.');
      return;
    }

    runParticleAnalysis();
  });
}

function runParticleAnalysis() {
  const settings = getCurrentSettings();

  if (!uploadedImage) {
    alert('Please upload an image before running analysis.');
    return;
  }

  // Prepare overlay canvas
  overlayCanvas.width = uploadedImage.width;
  overlayCanvas.height = uploadedImage.height;

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.drawImage(uploadedImage, 0, 0);

  // Render selected channel preview
  renderSelectedChannelPreview(settings.channelMode);
  fitCanvasToContainer(thresholdCanvas);
  
  // Run detection pipeline
  const detectionResult = runDetectionPipeline(channelCanvas, settings);

  if (!detectionResult) {
    console.error('Detection pipeline failed.');
    return;
  }

  // Render binary threshold preview
  renderThresholdPreview(
    detectionResult.binaryMask,
    channelCanvas.width,
    channelCanvas.height
  );
  
fitCanvasToContainer(thresholdCanvas);
fitCanvasToContainer(originalCanvas);
fitCanvasToContainer(overlayCanvas);

// Extract particle properties first
const extractedParticles = detectionResult.particles.map(particle => {
  const centroid = calculateParticleCentroid(particle.pixels);
  const bounds = calculateParticleBounds(particle.pixels);
  const perimeter = calculateParticlePerimeterSimple(particle.pixels);
  const meanRGB = calculateParticleMeanRGB(particle.pixels);

  return {
    ...particle,
    area: particle.pixels.length,
    centroidX: centroid.x,
    centroidY: centroid.y,
    bounds,
    perimeter,
    meanRGB
  };
});

// Filter particles
const filteredParticles = extractedParticles.filter(particle => {
  return (
    particle.area >= settings.minParticleSize &&
    particle.area <= settings.maxParticleSize
  );
});

  // Summary values
  const totalArea = filteredParticles.reduce((sum, particle) => {
    return sum + particle.pixels.length;
  }, 0);

  const imageArea = uploadedImage.width * uploadedImage.height;

  const coveragePercentage = imageArea === 0
    ? 0
    : ((totalArea / imageArea) * 100).toFixed(2);

  // Safe summary update
  const particleCountElement = document.getElementById('particleCount');
  const totalParticleAreaElement = document.getElementById('totalParticleArea');
  const coverageAreaElement = document.getElementById('coverageArea');
  const thresholdMethodLabelElement = document.getElementById('thresholdMethodLabel');

  if (particleCountElement) {
    particleCountElement.textContent = filteredParticles.length;
  }

  if (totalParticleAreaElement) {
    totalParticleAreaElement.textContent = `${totalArea} px²`;
  }

  if (coverageAreaElement) {
    coverageAreaElement.textContent = `${coveragePercentage}%`;
  }

  if (thresholdMethodLabelElement) {
    thresholdMethodLabelElement.textContent =
      `${settings.thresholdMode} (${detectionResult.thresholdValue})`;
  }

  // Draw overlay
  drawParticleOverlay(filteredParticles);

  // Populate table
  populateResultsTable(filteredParticles);

  // Save export data
  storeAnalysisResults(filteredParticles, {
    filename: uploadedImageName,
    analysisMode: currentAnalysisMode,
    thresholdMode: settings.thresholdMode,
    thresholdValue: detectionResult.thresholdValue,
    channelMode: settings.channelMode,
    invertThreshold: settings.invertThreshold,
    excludeEdgeParticles: settings.excludeEdgeParticles,
    minParticleSize: settings.minParticleSize,
    maxParticleSize: settings.maxParticleSize,
    circularityMin: settings.circularityMin,
    circularityMax: settings.circularityMax,
    detectedParticleCount: filteredParticles.length,
    totalParticleArea: totalArea
  });

  console.log('Analysis completed successfully.');
}

// ==============================
// CHANNEL PREVIEW
// ==============================

function renderSelectedChannelPreview(channelMode) {
  if (!uploadedImage || !channelCanvas || !channelCtx) return;

  channelCanvas.width = uploadedImage.width;
  channelCanvas.height = uploadedImage.height;

  channelCtx.drawImage(uploadedImage, 0, 0);

  const imageData = channelCtx.getImageData(
    0,
    0,
    channelCanvas.width,
    channelCanvas.height
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    let value = 0;

    switch (channelMode) {
      case 'red':
        value = red;
        data[i] = value;
        data[i + 1] = 0;
        data[i + 2] = 0;
        break;

      case 'green':
        value = green;
        data[i] = 0;
        data[i + 1] = value;
        data[i + 2] = 0;
        break;

      case 'blue':
        value = blue;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = value;
        break;

      case 'grayscale':
      default:
        value = Math.round((red + green + blue) / 3);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        break;
    }
  }

  channelCtx.putImageData(imageData, 0, 0);
}

function renderThresholdPreview(binaryMask, width, height) {
  if (!thresholdCanvas || !thresholdCtx) return;

  thresholdCanvas.width = width;
  thresholdCanvas.height = height;

  const imageData = thresholdCtx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < binaryMask.length; i++) {
    const value = binaryMask[i] === 1 ? 255 : 0;
    const pixelIndex = i * 4;

    data[pixelIndex] = value;
    data[pixelIndex + 1] = value;
    data[pixelIndex + 2] = value;
    data[pixelIndex + 3] = 255;
  }

  thresholdCtx.putImageData(imageData, 0, 0);

  thresholdCanvas.style.display = 'block';
  thresholdCanvas.style.width = '100%';
  thresholdCanvas.style.height = '100%';

  fitCanvasToContainer(thresholdCanvas);
}

// ==============================
// SUMMARY
// ==============================

function updateSummaryLabels() {
  const channelMode = document.getElementById('channelMode')?.value || 'grayscale';
  const thresholdMode = document.getElementById('thresholdMode')?.value || 'otsu';

  const formattedChannel =
    channelMode.charAt(0).toUpperCase() + channelMode.slice(1);

  const formattedThreshold =
    thresholdMode.charAt(0).toUpperCase() + thresholdMode.slice(1);

  document.getElementById('channelModeLabel').textContent = formattedChannel;
  document.getElementById('thresholdMethodLabel').textContent = formattedThreshold;
}

// ==============================
// RESULTS TABLE
// ==============================

function resetResultsTable() {
  const resultsTableBody = document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  resultsTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-table-message">
        No particles detected.
      </td>
    </tr>
  `;
}
function drawParticleOverlay(particles) {
  const overlaySvg = document.getElementById('overlaySvg');

  if (!overlaySvg || !uploadedImage) return;

  overlaySvg.innerHTML = '';

  overlaySvg.setAttribute('width', uploadedImage.width);
  overlaySvg.setAttribute('height', uploadedImage.height);
  overlaySvg.setAttribute('viewBox', `0 0 ${uploadedImage.width} ${uploadedImage.height}`);

  particles.forEach(particle => {
    if (!particle.pixels.length) return;

    const contourPoints = extractBoundaryPoints(particle.pixels);

    if (!contourPoints.length) return;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

    polygon.setAttribute(
      'points',
      contourPoints.map(point => `${point.x},${point.y}`).join(' ')
    );

    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#38bdf8');
    polygon.setAttribute('stroke-width', '1');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', particle.centroidX);
    text.setAttribute('y', particle.centroidY);
    text.setAttribute('fill', '#38bdf8');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = particle.id;

    overlaySvg.appendChild(polygon);
    overlaySvg.appendChild(text);
  });
}

function extractBoundaryPoints(pixels) {
  const pixelSet = new Set(
    pixels.map(pixel => `${pixel.x},${pixel.y}`)
  );

  const boundary = [];

  pixels.forEach(pixel => {
    const neighbors = [
      [pixel.x - 1, pixel.y],
      [pixel.x + 1, pixel.y],
      [pixel.x, pixel.y - 1],
      [pixel.x, pixel.y + 1]
    ];

    const isBoundary = neighbors.some(([nx, ny]) => {
      return !pixelSet.has(`${nx},${ny}`);
    });

    if (isBoundary) {
      boundary.push({
        x: pixel.x,
        y: pixel.y
      });
    }
  });

  if (boundary.length < 3) {
    return boundary;
  }

  const centroid = calculateParticleCentroidFromBoundary(boundary);

  boundary.sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);

    return angleA - angleB;
  });

  return smoothBoundary(boundary, 2);
}

function calculateParticleCentroidFromBoundary(points) {
  let sumX = 0;
  let sumY = 0;

  points.forEach(point => {
    sumX += point.x;
    sumY += point.y;
  });

  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

function smoothBoundary(points, iterations = 1) {
  let smoothed = [...points];

  for (let iteration = 0; iteration < iterations; iteration++) {
    const newPoints = [];

    for (let i = 0; i < smoothed.length; i++) {
      const prev = smoothed[(i - 1 + smoothed.length) % smoothed.length];
      const current = smoothed[i];
      const next = smoothed[(i + 1) % smoothed.length];

      const smoothX = (prev.x + current.x + next.x) / 3;
      const smoothY = (prev.y + current.y + next.y) / 3;

      newPoints.push({
        x: Number(smoothX.toFixed(2)),
        y: Number(smoothY.toFixed(2))
      });
    }

    smoothed = newPoints;
  }

  return smoothed;
}

function populateResultsTable(particles) {
  const resultsTableBody = document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  if (!particles.length) {
    resultsTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-table-message">
          No particles detected.
        </td>
      </tr>
    `;
    return;
  }

  resultsTableBody.innerHTML = '';

  particles.forEach(particle => {
    const circularity = particle.perimeter === 0
      ? 0
      : ((4 * Math.PI * particle.area) / (particle.perimeter * particle.perimeter)).toFixed(3);

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${particle.id}</td>
      <td>${particle.area}</td>
      <td>${particle.perimeter}</td>
      <td>${circularity}</td>
      <td>-</td>
      <td>-</td>
      <td>${particle.meanRGB}</td>
      <td>${particle.centroidX.toFixed(1)}</td>
      <td>${particle.centroidY.toFixed(1)}</td>
      <td>${isParticleTouchingEdge(particle.bounds) ? 'Yes' : 'No'}</td>
    `;

    resultsTableBody.appendChild(row);
  });
}

function calculateParticleCentroid(pixels) {
  let sumX = 0;
  let sumY = 0;

  pixels.forEach(pixel => {
    sumX += pixel.x;
    sumY += pixel.y;
  });

  return {
    x: sumX / pixels.length,
    y: sumY / pixels.length
  };
}

function calculateParticleBounds(pixels) {
  const xValues = pixels.map(pixel => pixel.x);
  const yValues = pixels.map(pixel => pixel.y);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues)
  };
}
function calculateParticlePerimeterSimple(pixels) {
  const pixelSet = new Set(
    pixels.map(pixel => `${pixel.x},${pixel.y}`)
  );

  let perimeter = 0;

  pixels.forEach(pixel => {
    const neighbors = [
      [pixel.x - 1, pixel.y],
      [pixel.x + 1, pixel.y],
      [pixel.x, pixel.y - 1],
      [pixel.x, pixel.y + 1]
    ];

    neighbors.forEach(([nx, ny]) => {
      if (!pixelSet.has(`${nx},${ny}`)) {
        perimeter++;
      }
    });
  });

  return perimeter;
}

function calculateParticleMeanRGB(pixels) {
  if (!originalCtx) return '(0, 0, 0)';

  const imageData = originalCtx.getImageData(
    0,
    0,
    originalCanvas.width,
    originalCanvas.height
  );

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  pixels.forEach(pixel => {
    const index = (pixel.y * originalCanvas.width + pixel.x) * 4;

    totalR += imageData.data[index];
    totalG += imageData.data[index + 1];
    totalB += imageData.data[index + 2];
  });

  const count = pixels.length;

  const meanR = Math.round(totalR / count);
  const meanG = Math.round(totalG / count);
  const meanB = Math.round(totalB / count);

  return `(${meanR}, ${meanG}, ${meanB})`;
}

function calculateParticleMeanGrayscale(meanRGBString) {
  const values = meanRGBString
    .replace('(', '')
    .replace(')', '')
    .split(',')
    .map(value => Number(value.trim()));

  const [r, g, b] = values;

  return Math.round((r + g + b) / 3);
}
function isParticleTouchingEdge(bounds) {
  if (!uploadedImage) return false;

  return (
    bounds.minX <= 0 ||
    bounds.minY <= 0 ||
    bounds.maxX >= uploadedImage.width - 1 ||
    bounds.maxY >= uploadedImage.height - 1
  );
}
// ==============================
// HELPERS
// ==============================

function getCurrentSettings() {
  return {
    channelMode: document.getElementById('channelMode')?.value || 'grayscale',
    thresholdMode: document.getElementById('thresholdMode')?.value || 'otsu',
    manualThresholdValue: Number(document.getElementById('manualThresholdValue')?.value || 128),
    minParticleSize: Number(document.getElementById('minParticleSize')?.value || 0),
    maxParticleSize: Number(document.getElementById('maxParticleSize')?.value || 999999),
    circularityMin: Number(document.getElementById('circularityMin')?.value || 0),
    circularityMax: Number(document.getElementById('circularityMax')?.value || 1),
    invertThreshold: document.getElementById('invertThreshold')?.checked || false,
    excludeEdgeParticles: document.getElementById('excludeEdgeParticles')?.checked || false,
    ignoreBackgroundParticles: document.getElementById('ignoreBackgroundParticles')?.checked || false
  };
}

function updateImageUploadStatus(fileName) {
  const uploadDescription = document.querySelector('.upload-description');

  if (!uploadDescription) return;

  uploadDescription.textContent = `Loaded image: ${fileName}`;
}

function clearOverlaySvg() {
  const overlaySvg = document.getElementById('overlaySvg');

  if (!overlaySvg) return;

  overlaySvg.innerHTML = '';
}

function fitCanvasToContainer(canvas) {
  if (!canvas) return;

  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.maxWidth = '100%';
  canvas.style.maxHeight = '100%';
  canvas.style.objectFit = 'contain';
}
