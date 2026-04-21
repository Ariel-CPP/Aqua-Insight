// ==============================
// PARTICLE ANALYSIS MAIN SCRIPT
// Aqua Insight Version 0.1
// ==============================

let uploadedImage = null;
let uploadedImageName = '';
let currentAnalysisMode = 'single';

let originalCanvas = null;
let channelCanvas = null;
let thresholdCanvas = null;
let overlayCanvas = null;

let originalCtx = null;
let channelCtx = null;
let thresholdCtx = null;
let overlayCtx = null;

document.addEventListener('DOMContentLoaded', () => {
  originalCanvas = document.getElementById('originalCanvas');
  channelCanvas = document.getElementById('channelCanvas');
  thresholdCanvas = document.getElementById('thresholdCanvas');
  overlayCanvas = document.getElementById('overlayCanvas');

  originalCtx = originalCanvas?.getContext('2d');
  channelCtx = channelCanvas?.getContext('2d');
  thresholdCtx = thresholdCanvas?.getContext('2d');
  overlayCtx = overlayCanvas?.getContext('2d');

  initializeUpload();
  initializeModeButtons();
  initializeSettingsPersistence();
  initializeRunAnalysisButton();
  initializeThresholdModeVisibility();
  initializeThresholdDescription();
  resetResultsTable();
});

function initializeThresholdDescription() {
  const thresholdMode = document.getElementById('thresholdMode');
  const thresholdTooltip = document.getElementById('thresholdTooltip');

  if (!thresholdMode || !thresholdTooltip) return;

  function updateThresholdDescription() {
    const selectedOption =
      thresholdMode.options[thresholdMode.selectedIndex];

    const description =
      selectedOption.getAttribute('data-description');

    thresholdTooltip.textContent =
      description || 'No description available.';
  }

  thresholdMode.addEventListener('change', updateThresholdDescription);

  updateThresholdDescription();
}

function initializeUpload() {
  const uploadButton = document.getElementById('uploadButton');
  const imageUpload = document.getElementById('imageUpload');
  const uploadArea = document.getElementById('uploadArea');

  if (!uploadButton || !imageUpload || !uploadArea) return;

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
    const img = new Image();

    img.onload = () => {
      uploadedImage = img;

      renderOriginalImage(img);
      resetPreviewCanvases();
      updateImageUploadStatus(file.name);
      resetResultsTable();
      updateSummary(0, 0);
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

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
    if (!canvas || !uploadedImage) return;

    const ctx = canvas.getContext('2d');

    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  clearOverlaySvg();
}
function initializeModeButtons() {
  const modeButtons = document.querySelectorAll('.sidebar-button');

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
      updateSummary(0, 0);

      const uploadDescription =
        document.querySelector('.upload-description');

      if (uploadDescription) {
        uploadDescription.textContent =
          currentAnalysisMode === 'batch'
            ? 'Upload multiple images for batch analysis'
            : 'Supported image formats: JPG, PNG, BMP, TIFF';
      }
    });
  });
}

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

    if (savedValue !== undefined && savedValue !== null) {
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

      if (id === 'thresholdMode') {
        initializeThresholdDescription();
      }
    });
  });

  updateSummaryLabels();
  toggleManualThresholdVisibility();
}

function initializeThresholdModeVisibility() {
  const thresholdModeElement =
    document.getElementById('thresholdMode');

  if (!thresholdModeElement) return;

  thresholdModeElement.addEventListener('change', () => {
    toggleManualThresholdVisibility();
  });

  toggleManualThresholdVisibility();
}

function toggleManualThresholdVisibility() {
  const thresholdMode =
    document.getElementById('thresholdMode')?.value;

  const manualThresholdGroup =
    document.getElementById('manualThresholdGroup');

  if (!manualThresholdGroup) return;

  manualThresholdGroup.style.display =
    thresholdMode === 'manual'
      ? 'block'
      : 'none';
}

function initializeRunAnalysisButton() {
  const runAnalysisButton =
    document.getElementById('runAnalysisButton');

  if (!runAnalysisButton) return;

  runAnalysisButton.addEventListener('click', () => {
    if (currentAnalysisMode === 'batch') {
      runBatchAnalysis();
      return;
    }

    if (!uploadedImage) {
      alert('Please upload an image before analysis.');
      return;
    }

    runParticleAnalysis();
  });
}

function runParticleAnalysis() {
  const settings = getCurrentSettings();

  renderSelectedChannelPreview(settings.channelMode);

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

  updateThresholdLabel(detectionResult.thresholdValue);

  const sourceImageData = originalCtx.getImageData(
    0,
    0,
    originalCanvas.width,
    originalCanvas.height
  );

  let extractedParticles = detectionResult.particles.map(
    particle => extractParticleFeatures(
      particle,
      sourceImageData,
      originalCanvas.width,
      originalCanvas.height
    )
  );

  extractedParticles = extractedParticles.filter(particle => {
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

    return validArea && validCircularity && validEdge;
  });

  extractedParticles.forEach((particle, index) => {
    particle.id = index + 1;
  });

  const totalArea = extractedParticles.reduce(
    (sum, particle) => sum + particle.area,
    0
  );

  updateSummary(extractedParticles.length, totalArea);
  populateResultsTable(extractedParticles);
  drawParticleOverlay(extractedParticles);
    storeAnalysisResults(extractedParticles, {
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
    detectedParticleCount: extractedParticles.length,
    totalParticleArea: totalArea,
    coveragePercentage: calculateCoverage(totalArea)
  });
}

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
        const gray = Math.round((r + g + b) / 3);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        break;
    }
  }

  channelCtx.putImageData(imageData, 0, 0);
}

function updateSummaryLabels() {
  const channelMode =
    document.getElementById('channelMode')?.value || 'grayscale';

  const thresholdMode =
    document.getElementById('thresholdMode')?.value || 'otsu';

  const channelModeLabel =
    document.getElementById('channelModeLabel');

  const thresholdMethodLabel =
    document.getElementById('thresholdMethodLabel');

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
    `${thresholdMode.toUpperCase()} (${thresholdValue})`;
}

function updateSummary(particleCount, totalArea) {
  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  if (particleCountElement) {
    particleCountElement.textContent = particleCount;
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

  return ((totalArea / totalPixels) * 100).toFixed(2);
}

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

  if (!particles.length) {
    resetResultsTable();
    return;
  }

  resultsTableBody.innerHTML = '';
    particles.forEach(particle => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${particle.id}</td>
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

  particles.forEach(particle => {
    if (!particle.pixels || !particle.pixels.length) return;

    const polygon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polygon'
    );

    const pointString = particle.pixels
      .map(pixel => `${pixel.x},${pixel.y}`)
      .join(' ');

    polygon.setAttribute('points', pointString);
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#22d3ee');
    polygon.setAttribute('stroke-width', '1');

    const text = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text'
    );

    text.setAttribute('x', particle.centroidX);
    text.setAttribute('y', particle.centroidY);
    text.setAttribute('fill', '#22d3ee');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', '600');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = particle.id;

    overlaySvg.appendChild(polygon);
    overlaySvg.appendChild(text);
  });
}

function getCurrentSettings() {
  return {
    channelMode:
      document.getElementById('channelMode')?.value || 'grayscale',

    thresholdMode:
      document.getElementById('thresholdMode')?.value || 'otsu',

    manualThresholdValue: Number(
      document.getElementById('manualThresholdValue')?.value || 128
    ),

    minParticleSize: Number(
      document.getElementById('minParticleSize')?.value || 0
    ),

    maxParticleSize: Number(
      document.getElementById('maxParticleSize')?.value || 999999
    ),

    circularityMin: Number(
      document.getElementById('circularityMin')?.value || 0
    ),

    circularityMax: Number(
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
