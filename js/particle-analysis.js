// ==============================
// PARTICLE ANALYSIS MAIN SCRIPT
// Aqua Insight Version 0.1
// ==============================

let uploadedImage = null;
let uploadedImageName = '';
let currentAnalysisMode = 'single';

const originalCanvas =
  document.getElementById('originalCanvas');

const channelCanvas =
  document.getElementById('channelCanvas');

const thresholdCanvas =
  document.getElementById('thresholdCanvas');

const overlayCanvas =
  document.getElementById('overlayCanvas');

const originalCtx =
  originalCanvas?.getContext('2d');

const channelCtx =
  channelCanvas?.getContext('2d');

const thresholdCtx =
  thresholdCanvas?.getContext('2d');

const overlayCtx =
  overlayCanvas?.getContext('2d');

document.addEventListener('DOMContentLoaded', () => {
  initializeUpload();
  initializeModeButtons();
  initializeSettingsPersistence();
  initializeRunAnalysisButton();
  initializeThresholdModeVisibility();
});

// ==============================
// IMAGE UPLOAD
// ==============================

function initializeUpload() {
  const uploadButton =
    document.getElementById('uploadButton');

  const imageUpload =
    document.getElementById('imageUpload');

  const uploadArea =
    document.getElementById('uploadArea');

  if (!uploadButton || !imageUpload || !uploadArea) {
    return;
  }

  uploadButton.addEventListener('click', () => {
    imageUpload.click();
  });

  imageUpload.addEventListener('change', event => {
    const files = Array.from(event.target.files);

    if (!files.length) return;

    if (currentAnalysisMode === 'batch') {
      handleBatchFiles(files);
      return;
    }

    handleImageFile(files[0]);
  });

  uploadArea.addEventListener('dragover', event => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', event => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = Array.from(event.dataTransfer.files);

    if (!files.length) return;

    if (currentAnalysisMode === 'batch') {
      handleBatchFiles(files);
      return;
    }

    handleImageFile(files[0]);
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file.');
    return;
  }

  uploadedImageName = file.name;

  const reader = new FileReader();

  reader.onload = event => {
    const image = new Image();

    image.onload = () => {
      uploadedImage = image;

      renderOriginalImage(image);
      resetPreviewCanvases();
      updateImageUploadStatus(file.name);
      resetResultsTable();
      clearOverlaySvg();
    };

    image.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

// ==============================
// RENDER IMAGE
// ==============================

function renderOriginalImage(image) {
  if (!originalCanvas || !originalCtx) return;

  originalCanvas.width = image.width;
  originalCanvas.height = image.height;

  originalCtx.clearRect(
    0,
    0,
    image.width,
    image.height
  );

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
    if (!canvas || !uploadedImage) return;

    const ctx = canvas.getContext('2d');

    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  });
}

// ==============================
// MODE BUTTONS
// ==============================

function initializeModeButtons() {
  const modeButtons =
    document.querySelectorAll('.sidebar-button');

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modeButtons.forEach(btn => {
        btn.classList.remove('active');
      });

      button.classList.add('active');

      currentAnalysisMode =
        button.dataset.mode || 'single';

      const imageUpload =
        document.getElementById('imageUpload');

      if (imageUpload) {
        imageUpload.multiple =
          currentAnalysisMode === 'batch';
      }

      resetResultsTable();
      clearOverlaySvg();
    });
  });
}
// ==============================
// SETTINGS
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
    'excludeEdgeParticles'
  ];

  settingIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    const savedValue = getSetting(id);

    if (
      savedValue !== undefined &&
      savedValue !== null
    ) {
      if (element.type === 'checkbox') {
        element.checked = savedValue;
      } else {
        element.value = savedValue;
      }
    }

    element.addEventListener('change', () => {
      const value =
        element.type === 'checkbox'
          ? element.checked
          : element.value;

      saveSetting(id, value);

      updateSummaryLabels();
      toggleManualThresholdVisibility();
    });
  });

  updateSummaryLabels();
  toggleManualThresholdVisibility();
}

function initializeThresholdModeVisibility() {
  const thresholdMode =
    document.getElementById('thresholdMode');

  if (!thresholdMode) return;

  thresholdMode.addEventListener('change', () => {
    toggleManualThresholdVisibility();
  });

  toggleManualThresholdVisibility();
}

function toggleManualThresholdVisibility() {
  const thresholdMode =
    document.getElementById('thresholdMode');

  const manualThresholdGroup =
    document.getElementById('manualThresholdGroup');

  if (!thresholdMode || !manualThresholdGroup) {
    return;
  }

  manualThresholdGroup.style.display =
    thresholdMode.value === 'manual'
      ? 'block'
      : 'none';
}

// ==============================
// RUN ANALYSIS
// ==============================

function initializeRunAnalysisButton() {
  const runAnalysisButton =
    document.getElementById('runAnalysisButton');

  if (!runAnalysisButton) return;

  runAnalysisButton.addEventListener('click', () => {
    if (currentAnalysisMode === 'batch') {
      runBatchAnalysis();
      return;
    }

    runParticleAnalysis();
  });
}

function runParticleAnalysis() {
  if (!uploadedImage) {
    alert('Please upload an image before analysis.');
    return;
  }

  const settings = getCurrentSettings();

  renderSelectedChannelPreview(
    settings.channelMode
  );

  const detectionResult = runDetectionPipeline(
    originalCanvas,
    settings
  );

  renderBinaryMaskToCanvas(
    detectionResult.binaryMask,
    originalCanvas.width,
    originalCanvas.height,
    thresholdCanvas
  );

  const sourceImageData = originalCtx.getImageData(
    0,
    0,
    originalCanvas.width,
    originalCanvas.height
  );

  const extractedParticles =
    detectionResult.particles.map(particle => {
      return extractParticleFeatures(
        particle,
        sourceImageData,
        originalCanvas.width,
        originalCanvas.height
      );
    });

  const filteredParticles = extractedParticles.filter(particle => {
    const validArea =
      particle.area >= settings.minParticleSize &&
      particle.area <= settings.maxParticleSize;

    const validCircularity =
      particle.circularity >= settings.circularityMin &&
      particle.circularity <= settings.circularityMax;

    const validEdge =
      settings.excludeEdgeParticles
        ? !particle.touchesEdge
        : true;

    return (
      validArea &&
      validCircularity &&
      validEdge
    );
  });

  const totalArea = filteredParticles.reduce(
    (sum, particle) => sum + particle.area,
    0
  );

  drawParticleOverlay(filteredParticles);
  populateResultsTable(filteredParticles);
  updateSummary(
    filteredParticles.length,
    totalArea
  );
    updateThresholdLabel(
    detectionResult.thresholdValue
  );

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
    totalParticleArea: totalArea,
    coveragePercentage: calculateCoverage(totalArea)
  });
}

// ==============================
// CHANNEL PREVIEW
// ==============================

function renderSelectedChannelPreview(channelMode) {
  if (!uploadedImage) return;

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
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    switch (channelMode) {
      case 'red':
        data[i] = r;
        data[i + 1] = 0;
        data[i + 2] = 0;
        break;

      case 'green':
        data[i] = 0;
        data[i + 1] = g;
        data[i + 2] = 0;
        break;

      case 'blue':
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = b;
        break;

      case 'grayscale':
      default:
        const gray = Math.round(
          (r * 0.299) +
          (g * 0.587) +
          (b * 0.114)
        );

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        break;
    }
  }

  channelCtx.putImageData(imageData, 0, 0);
}

// ==============================
// SUMMARY
// ==============================

function updateSummaryLabels() {
  const channelModeLabel =
    document.getElementById('channelModeLabel');

  const thresholdMethodLabel =
    document.getElementById('thresholdMethodLabel');

  const channelMode =
    document.getElementById('channelMode')?.value || 'grayscale';

  const thresholdMode =
    document.getElementById('thresholdMode')?.value || 'otsu';

  if (channelModeLabel) {
    channelModeLabel.textContent = channelMode;
  }

  if (thresholdMethodLabel) {
    thresholdMethodLabel.textContent = thresholdMode;
  }
}

function updateThresholdLabel(thresholdValue) {
  const thresholdMethodLabel =
    document.getElementById('thresholdMethodLabel');

  const thresholdMode =
    document.getElementById('thresholdMode')?.value || 'otsu';

  if (!thresholdMethodLabel) return;

  thresholdMethodLabel.textContent =
    `${thresholdMode} (${thresholdValue})`;
}

function updateSummary(
  particleCount,
  totalArea
) {
  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  if (particleCountElement) {
    particleCountElement.textContent =
      particleCount;
  }

  if (coverageAreaElement) {
    coverageAreaElement.textContent =
      `${calculateCoverage(totalArea)}%`;
  }
}

function calculateCoverage(totalArea) {
  if (!uploadedImage) return '0.00';

  const totalPixels =
    uploadedImage.width * uploadedImage.height;

  return (
    (totalArea / totalPixels) * 100
  ).toFixed(2);
}
// ==============================
// RESULTS TABLE
// ==============================

function resetResultsTable() {
  const resultsTableBody =
    document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  resultsTableBody.innerHTML = `
    <tr>
      <td colspan="10" class="empty-table-message">
        No analysis results available.
      </td>
    </tr>
  `;
}

function populateResultsTable(particles) {
  const resultsTableBody =
    document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  resultsTableBody.innerHTML = '';

  if (!particles.length) {
    resetResultsTable();
    return;
  }

  particles.forEach((particle, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${particle.area}</td>
      <td>${particle.perimeter}</td>
      <td>${particle.circularity}</td>
      <td>${particle.feretDiameter}</td>
      <td>${particle.aspectRatio}</td>
      <td>${particle.meanRGB}</td>
      <td>${particle.centroidX.toFixed(1)}</td>
      <td>${particle.centroidY.toFixed(1)}</td>
      <td>${particle.touchesEdge ? 'Yes' : 'No'}</td>
    `;

    resultsTableBody.appendChild(row);
  });
}

// ==============================
// OVERLAY
// ==============================

function drawParticleOverlay(particles) {
  const overlaySvg =
    document.getElementById('overlaySvg');

  if (!overlaySvg || !uploadedImage) return;

  overlaySvg.innerHTML = '';

  overlaySvg.setAttribute(
    'width',
    uploadedImage.width
  );

  overlaySvg.setAttribute(
    'height',
    uploadedImage.height
  );

  overlaySvg.setAttribute(
    'viewBox',
    `0 0 ${uploadedImage.width} ${uploadedImage.height}`
  );

  particles.forEach((particle, index) => {
    if (!particle.pixels || !particle.pixels.length) {
      return;
    }

    const boundaryPoints =
      extractBoundaryPoints(particle.pixels);

    if (boundaryPoints.length < 3) {
      return;
    }

    const polygon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polygon'
    );

    polygon.setAttribute(
      'points',
      boundaryPoints
        .map(point => `${point.x},${point.y}`)
        .join(' ')
    );

    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#00ffff');
    polygon.setAttribute('stroke-width', '1');

    const label = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text'
    );

    label.setAttribute(
      'x',
      particle.centroidX
    );

    label.setAttribute(
      'y',
      particle.centroidY
    );

    label.setAttribute('fill', '#00ffff');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = index + 1;

    overlaySvg.appendChild(polygon);
    overlaySvg.appendChild(label);
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

  const centroid = calculateBoundaryCentroid(boundary);

  boundary.sort((a, b) => {
    const angleA = Math.atan2(
      a.y - centroid.y,
      a.x - centroid.x
    );

    const angleB = Math.atan2(
      b.y - centroid.y,
      b.x - centroid.x
    );

    return angleA - angleB;
  });

  return boundary;
}

function calculateBoundaryCentroid(points) {
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

// ==============================
// HELPERS
// ==============================

function getCurrentSettings() {
  return {
    channelMode:
      document.getElementById('channelMode')?.value || 'grayscale',

    thresholdMode:
      document.getElementById('thresholdMode')?.value || 'otsu',

    manualThresholdValue:
      Number(
        document.getElementById('manualThresholdValue')?.value || 128
      ),

    minParticleSize:
      Number(
        document.getElementById('minParticleSize')?.value || 0
      ),

    maxParticleSize:
      Number(
        document.getElementById('maxParticleSize')?.value || 999999
      ),

    circularityMin:
      Number(
        document.getElementById('circularityMin')?.value || 0
      ),

    circularityMax:
      Number(
        document.getElementById('circularityMax')?.value || 1
      ),

    invertThreshold:
      document.getElementById('invertThreshold')?.checked || false,

    excludeEdgeParticles:
      document.getElementById('excludeEdgeParticles')?.checked || false
  };
}

function updateImageUploadStatus(fileName) {
  const uploadDescription =
    document.querySelector('.upload-description');

  if (!uploadDescription) return;

  uploadDescription.textContent =
    `Loaded image: ${fileName}`;
}

function clearOverlaySvg() {
  const overlaySvg =
    document.getElementById('overlaySvg');

  if (!overlaySvg) return;

  overlaySvg.innerHTML = '';
}

function fitCanvasToContainer(canvas) {
  if (!canvas) return;

  canvas.style.width = '100%';
  canvas.style.height = 'auto';
}
