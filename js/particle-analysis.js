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
      const value = element.type === 'checkbox'
        ? element.checked
        : element.value;

      saveSetting(id, value);
      updateSummaryLabels();
    });
  });

  updateSummaryLabels();
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

  console.log('Running particle analysis with settings:', settings);

  // Draw original image into overlay canvas
  overlayCanvas.width = uploadedImage.width;
  overlayCanvas.height = uploadedImage.height;

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.drawImage(uploadedImage, 0, 0);

  // Process selected channel preview
  renderSelectedChannelPreview(settings.channelMode);

  // Placeholder threshold preview
  renderThresholdPreview(settings.channelMode);

  // Placeholder summary update
  document.getElementById('particleCount').textContent = '0';
  document.getElementById('totalParticleArea').textContent = '0 px²';

  // Placeholder table reset
  resetResultsTable();

  // Future integration
  // detection.js will later handle:
  // - Otsu threshold
  // - Morphological opening
  // - Connected components
  // - Contour extraction
  // - Feature extraction
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

function renderThresholdPreview(channelMode) {
  if (!uploadedImage || !thresholdCanvas || !thresholdCtx) return;

  thresholdCanvas.width = uploadedImage.width;
  thresholdCanvas.height = uploadedImage.height;

  thresholdCtx.drawImage(channelCanvas, 0, 0);
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
      <td colspan="10" class="empty-table-message">
        No particles detected.
      </td>
    </tr>
  `;
}

// ==============================
// HELPERS
// ==============================

function getCurrentSettings() {
  return {
    channelMode: document.getElementById('channelMode')?.value || 'grayscale',
    thresholdMode: document.getElementById('thresholdMode')?.value || 'otsu',
    minParticleSize: Number(document.getElementById('minParticleSize')?.value || 0),
    maxParticleSize: Number(document.getElementById('maxParticleSize')?.value || 999999),
    circularityMin: Number(document.getElementById('circularityMin')?.value || 0),
    circularityMax: Number(document.getElementById('circularityMax')?.value || 1),
    invertThreshold: document.getElementById('invertThreshold')?.checked || false,
    excludeEdgeParticles: document.getElementById('excludeEdgeParticles')?.checked || false
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

  canvas.style.width = '100%';
  canvas.style.height = 'auto';
}
