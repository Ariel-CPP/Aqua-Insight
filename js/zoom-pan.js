// ==============================
// PARTICLE ZOOM PAN MODULE
// Aqua Insight Version 0.1
// ==============================

let currentZoom = 1;
let currentTranslateX = 0;
let currentTranslateY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const minZoom = 0.25;
const maxZoom = 8;
const zoomStep = 0.1;

let currentBatchPreviewIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  initializeZoomPan();
  initializeZoomButtons();
  initializeBatchNavigation();
});

// ==============================
// ZOOM BUTTONS
// ==============================

function initializeZoomButtons() {
  const zoomInButton =
    document.getElementById('zoomInButton');

  const zoomOutButton =
    document.getElementById('zoomOutButton');

  const resetZoomButton =
    document.getElementById('resetZoomButton');

  if (zoomInButton) {
    zoomInButton.addEventListener('click', () => {
      currentZoom += zoomStep;

      if (currentZoom > maxZoom) {
        currentZoom = maxZoom;
      }

      applyZoomPanTransform();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      currentZoom -= zoomStep;

      if (currentZoom < minZoom) {
        currentZoom = minZoom;
      }

      applyZoomPanTransform();
    });
  }

  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', () => {
      resetZoomAndPan();
    });
  }
}

// ==============================
// PAN AND SCROLL ZOOM
// ==============================

function initializeZoomPan() {
  const containers = document.querySelectorAll(
    '.preview-canvas-container'
  );

  containers.forEach(container => {
    container.addEventListener('mousedown', event => {
      isDragging = true;

      dragStartX =
        event.clientX - currentTranslateX;

      dragStartY =
        event.clientY - currentTranslateY;

      container.classList.add('dragging');
    });

    container.addEventListener('mousemove', event => {
      if (!isDragging) return;

      currentTranslateX =
        event.clientX - dragStartX;

      currentTranslateY =
        event.clientY - dragStartY;

      applyZoomPanTransform();
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
        currentZoom += zoomStep;
      } else {
        currentZoom -= zoomStep;
      }

      if (currentZoom < minZoom) {
        currentZoom = minZoom;
      }

      if (currentZoom > maxZoom) {
        currentZoom = maxZoom;
      }

      applyZoomPanTransform();
    });
  });
}

// ==============================
// APPLY TRANSFORM
// ==============================

function applyZoomPanTransform() {
  const targets = document.querySelectorAll(
    '.preview-canvas-container canvas, .preview-canvas-container svg'
  );

  targets.forEach(target => {
    target.style.transform =
      `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;

    target.style.transformOrigin = 'center center';

    if (!isDragging) {
      target.style.transition =
        'transform 0.15s ease';
    } else {
      target.style.transition = 'none';
    }
  });
}

function resetZoomAndPan() {
  currentZoom = 1;
  currentTranslateX = 0;
  currentTranslateY = 0;

  applyZoomPanTransform();
}
// ==============================
// BATCH NAVIGATION
// ==============================

function initializeBatchNavigation() {
  const previousButton =
    document.getElementById('previousBatchImageButton');

  const nextButton =
    document.getElementById('nextBatchImageButton');

  if (previousButton) {
    previousButton.addEventListener('click', () => {
      showPreviousBatchImage();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      showNextBatchImage();
    });
  }
}

function showPreviousBatchImage() {
  if (
    typeof batchResults === 'undefined' ||
    !batchResults.length
  ) {
    return;
  }

  currentBatchPreviewIndex--;

  if (currentBatchPreviewIndex < 0) {
    currentBatchPreviewIndex =
      batchResults.length - 1;
  }

  if (typeof renderBatchPreviewImage === 'function') {
    renderBatchPreviewImage();
  }

  if (typeof highlightActiveBatchRow === 'function') {
    highlightActiveBatchRow();
  }

  resetZoomAndPan();
}

function showNextBatchImage() {
  if (
    typeof batchResults === 'undefined' ||
    !batchResults.length
  ) {
    return;
  }

  currentBatchPreviewIndex++;

  if (currentBatchPreviewIndex >= batchResults.length) {
    currentBatchPreviewIndex = 0;
  }

  if (typeof renderBatchPreviewImage === 'function') {
    renderBatchPreviewImage();
  }

  if (typeof highlightActiveBatchRow === 'function') {
    highlightActiveBatchRow();
  }

  resetZoomAndPan();
}
