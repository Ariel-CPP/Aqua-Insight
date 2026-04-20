// ==============================
// ZOOM AND PAN MODULE
// Aqua Insight Version 0.1
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeZoomControls();
  initializePreviewPan();
});

let currentZoom = 1;
const zoomStep = 0.1;
const minZoom = 0.5;
const maxZoom = 5;

let isDragging = false;
let startX = 0;
let startY = 0;
let currentTranslateX = 0;
let currentTranslateY = 0;

// ==============================
// INITIALIZE ZOOM CONTROLS
// ==============================

function initializeZoomControls() {
  const zoomInButton = document.getElementById('zoomInButton');
  const zoomOutButton = document.getElementById('zoomOutButton');
  const resetZoomButton = document.getElementById('resetZoomButton');

  if (zoomInButton) {
    zoomInButton.addEventListener('click', () => {
      currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
      applyZoomPan();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      currentZoom = Math.max(currentZoom - zoomStep, minZoom);
      applyZoomPan();
    });
  }

  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', () => {
      resetZoomPan();
    });
  }
}

// ==============================
// INITIALIZE PAN
// ==============================

function initializePreviewPan() {
  const previewContainers = document.querySelectorAll('.preview-canvas-container');

  previewContainers.forEach(container => {
    container.addEventListener('mousedown', (event) => {
      isDragging = true;
      startX = event.clientX - currentTranslateX;
      startY = event.clientY - currentTranslateY;

      container.classList.add('dragging');
    });

    container.addEventListener('mousemove', (event) => {
      if (!isDragging) return;

      currentTranslateX = event.clientX - startX;
      currentTranslateY = event.clientY - startY;

      applyZoomPan();
    });

    container.addEventListener('mouseup', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('mouseleave', () => {
      isDragging = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('wheel', (event) => {
      event.preventDefault();

      if (event.deltaY < 0) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
      } else {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
      }

      applyZoomPan();
    });
  });
}

// ==============================
// APPLY ZOOM AND PAN
// ==============================

function applyZoomPan() {
  const previewElements = document.querySelectorAll(
    '.preview-canvas-container canvas, .preview-canvas-container svg'
  );

  previewElements.forEach(element => {
    element.style.transform = `
      translate(${currentTranslateX}px, ${currentTranslateY}px)
      scale(${currentZoom})
    `;

    element.style.transformOrigin = 'center center';
    element.style.transition = isDragging ? 'none' : 'transform 0.15s ease';
  });
}

// ==============================
// RESET
// ==============================

function resetZoomPan() {
  currentZoom = 1;
  currentTranslateX = 0;
  currentTranslateY = 0;

  applyZoomPan();
}
