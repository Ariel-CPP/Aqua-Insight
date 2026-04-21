// ==============================
// ZOOM AND PAN MODULE
// Aqua Insight Version 0.1
// ==============================

let currentZoom = 1;
let currentTranslateX = 0;
let currentTranslateY = 0;

const zoomStep = 0.1;
const minZoom = 0.5;
const maxZoom = 5;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Batch preview navigation
let currentBatchPreviewIndex = 0;

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeZoomControls();
  initializePanControls();
  initializeBatchPreviewNavigation();
});

// ==============================
// ZOOM CONTROLS
// ==============================

function initializeZoomControls() {
  const zoomInButton =
    document.getElementById('zoomInButton');

  const zoomOutButton =
    document.getElementById('zoomOutButton');

  const resetZoomButton =
    document.getElementById('resetZoomButton');

  if (zoomInButton) {
    zoomInButton.addEventListener('click', () => {
      currentZoom = Math.min(
        currentZoom + zoomStep,
        maxZoom
      );

      applyZoomAndPan();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      currentZoom = Math.max(
        currentZoom - zoomStep,
        minZoom
      );

      applyZoomAndPan();
    });
  }

  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', () => {
      resetZoomAndPan();
    });
  }
}

// ==============================
// PAN CONTROLS
// ==============================

function initializePanControls() {
  const previewContainers = document.querySelectorAll(
    '.preview-canvas-container'
  );

  previewContainers.forEach(container => {
    container.addEventListener('mousedown', event => {
      isDragging = true;

      dragStartX = event.clientX - currentTranslateX;
      dragStartY = event.clientY - currentTranslateY;

      container.classList.add('dragging');
    });

    container.addEventListener('mousemove', event => {
      if (!isDragging) return;

      currentTranslateX =
        event.clientX - dragStartX;

      currentTranslateY =
        event.clientY - dragStartY;

      applyZoomAndPan();
    });

    container.addEventListener('mouseup', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('mouseleave', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('wheel', event => {
      event.preventDefault();

      if (event.deltaY < 0) {
        currentZoom = Math.min(
          currentZoom + zoomStep,
          maxZoom
        );
      } else {
        currentZoom = Math.max(
          currentZoom - zoomStep,
          minZoom
        );
      }

      applyZoomAndPan();
    });
  });
}

// ==============================
// APPLY TRANSFORM
// ==============================

function applyZoomAndPan() {
  const previewElements = document.querySelectorAll(
    '.preview-canvas-container canvas, .preview-canvas-container svg'
  );

  previewElements.forEach(element => {
    element.style.transform = `
      translate(${currentTranslateX}px, ${currentTranslateY}px)
      scale(${currentZoom})
    `;

    element.style.transformOrigin = 'center center';
    element.style.transition = isDragging
      ? 'none'
      : 'transform 0.15s ease';
  });
}

// ==============================
// RESET
// ==============================

function resetZoomAndPan() {
  currentZoom = 1;
  currentTranslateX = 0;
  currentTranslateY = 0;

  applyZoomAndPan();
}

// ==============================
// BATCH PREVIEW NAVIGATION
// ==============================

function initializeBatchPreviewNavigation() {
  createBatchNavigationButtons();
}

function createBatchNavigationButtons() {
  const previewCard = document.querySelector(
    '.preview-controls'
  );

  if (!previewCard) return;

  const previousButton = document.createElement('button');
  previousButton.id = 'previousBatchImageButton';
  previousButton.className = 'preview-control-button';
  previousButton.textContent = 'Previous';

  const nextButton = document.createElement('button');
  nextButton.id = 'nextBatchImageButton';
  nextButton.className = 'preview-control-button';
  nextButton.textContent = 'Next';

  previousButton.addEventListener('click', () => {
    showPreviousBatchImage();
  });

  nextButton.addEventListener('click', () => {
    showNextBatchImage();
  });

  previewCard.appendChild(previousButton);
  previewCard.appendChild(nextButton);
}

// ==============================
// BATCH IMAGE DISPLAY
// ==============================

function showPreviousBatchImage() {
  if (!batchResults.length) return;

  currentBatchPreviewIndex--;

  if (currentBatchPreviewIndex < 0) {
    currentBatchPreviewIndex = batchResults.length - 1;
  }

  renderBatchPreviewImage();
}

function showNextBatchImage() {
  if (!batchResults.length) return;

  currentBatchPreviewIndex++;

  if (currentBatchPreviewIndex >= batchResults.length) {
    currentBatchPreviewIndex = 0;
  }

  renderBatchPreviewImage();
}
function renderBatchPreviewImage() {
  if (!batchResults.length) return;

  const result = batchResults[currentBatchPreviewIndex];

  if (!result || !result.imageObject) return;

  const image = result.imageObject;

  // Original
  originalCanvas.width = image.width;
  originalCanvas.height = image.height;
  originalCtx.clearRect(0, 0, image.width, image.height);
  originalCtx.drawImage(image, 0, 0);

  // Channel Preview
  uploadedImage = image;
  uploadedImageName = result.filename;

  renderSelectedChannelPreview(
    document.getElementById('channelMode')?.value || 'grayscale'
  );

  // Threshold Preview
  thresholdCanvas.width = image.width;
  thresholdCanvas.height = image.height;

  renderBinaryMaskToCanvas(
    result.binaryMask,
    image.width,
    image.height,
    thresholdCanvas
  );

  // Overlay Preview
  overlayCanvas.width = image.width;
  overlayCanvas.height = image.height;

  overlayCtx.clearRect(
    0,
    0,
    overlayCanvas.width,
    overlayCanvas.height
  );

  overlayCtx.drawImage(image, 0, 0);

  drawParticleOverlay(result.particles);

  // Summary
  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  const thresholdMethodLabel =
    document.getElementById('thresholdMethodLabel');

  if (particleCountElement) {
    particleCountElement.textContent =
      result.detectedParticleCount;
  }

  if (coverageAreaElement) {
    const totalPixels =
      result.imageWidth * result.imageHeight;

    const coverage =
      totalPixels > 0
        ? (
            (result.totalParticleArea / totalPixels) *
            100
          ).toFixed(2)
        : '0.00';

    coverageAreaElement.textContent = `${coverage}%`;
  }

  if (thresholdMethodLabel) {
    thresholdMethodLabel.textContent =
      `${result.thresholdMode} (${result.thresholdValue})`;
  }

  // Results table for selected image
  populateResultsTable(result.particles);

  // Upload label
  const uploadDescription =
    document.querySelector('.upload-description');

  if (uploadDescription) {
    uploadDescription.textContent =
      `Viewing batch image ${currentBatchPreviewIndex + 1} of ${batchResults.length}: ${result.filename}`;
  }

  resetZoomAndPan();
}
