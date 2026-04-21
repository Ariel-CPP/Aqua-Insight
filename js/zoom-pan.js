// ==============================
// ZOOM AND PAN MODULE
// Aqua Insight Version 0.1
// ==============================

let zoomScale = 1;
let panOffsetX = 0;
let panOffsetY = 0;

let isDraggingCanvas = false;
let dragStartX = 0;
let dragStartY = 0;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.15;

document.addEventListener('DOMContentLoaded', () => {
  initializeZoomButtons();
  initializeCanvasPanZoom();
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
      zoomScale += ZOOM_STEP;

      if (zoomScale > MAX_ZOOM) {
        zoomScale = MAX_ZOOM;
      }

      applyCanvasTransform();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      zoomScale -= ZOOM_STEP;

      if (zoomScale < MIN_ZOOM) {
        zoomScale = MIN_ZOOM;
      }

      applyCanvasTransform();
    });
  }

  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', () => {
      resetCanvasTransform();
    });
  }
}

// ==============================
// PAN + MOUSE WHEEL ZOOM
// ==============================

function initializeCanvasPanZoom() {
  const containers =
    document.querySelectorAll(
      '.preview-canvas-container'
    );

  containers.forEach(container => {
    container.addEventListener('mousedown', event => {
      isDraggingCanvas = true;

      dragStartX =
        event.clientX - panOffsetX;

      dragStartY =
        event.clientY - panOffsetY;

      container.classList.add('dragging');
    });

    container.addEventListener('mousemove', event => {
      if (!isDraggingCanvas) return;

      panOffsetX =
        event.clientX - dragStartX;

      panOffsetY =
        event.clientY - dragStartY;

      applyCanvasTransform();
    });

    container.addEventListener('mouseup', () => {
      isDraggingCanvas = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('mouseleave', () => {
      isDraggingCanvas = false;
      container.classList.remove('dragging');
    });

    container.addEventListener('wheel', event => {
      event.preventDefault();

      const delta =
        event.deltaY < 0
          ? ZOOM_STEP
          : -ZOOM_STEP;

      zoomScale += delta;

      if (zoomScale < MIN_ZOOM) {
        zoomScale = MIN_ZOOM;
      }

      if (zoomScale > MAX_ZOOM) {
        zoomScale = MAX_ZOOM;
      }

      applyCanvasTransform();
    });
  });
}

// ==============================
// APPLY TRANSFORM
// ==============================

function applyCanvasTransform() {
  const targets =
    document.querySelectorAll(
      '.preview-canvas-container canvas, .preview-canvas-container svg, .background-selection-marker'
    );

  targets.forEach(target => {
    target.style.transform =
      `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoomScale})`;

    target.style.transformOrigin =
      'center center';

    if (!isDraggingCanvas) {
      target.style.transition =
        'transform 0.12s ease';
    } else {
      target.style.transition = 'none';
    }
  });
}

// ==============================
// RESET VIEW
// ==============================

function resetCanvasTransform() {
  zoomScale = 1;
  panOffsetX = 0;
  panOffsetY = 0;

  applyCanvasTransform();
}

// ==============================
// FIT IMAGE TO VIEW
// ==============================

function fitImageToView() {
  zoomScale = 1;
  panOffsetX = 0;
  panOffsetY = 0;

  applyCanvasTransform();
}

// ==============================
// AUTO RESET ON IMAGE CHANGE
// ==============================

function resetViewForNewImage() {
  resetCanvasTransform();

  const containers =
    document.querySelectorAll(
      '.preview-canvas-container'
    );

  containers.forEach(container => {
    container.scrollLeft = 0;
    container.scrollTop = 0;
  });
}

// ==============================
// OPTIONAL CENTERING
// ==============================

function centerCurrentView() {
  const containers =
    document.querySelectorAll(
      '.preview-canvas-container'
    );

  containers.forEach(container => {
    const rect =
      container.getBoundingClientRect();

    panOffsetX = rect.width * 0.02;
    panOffsetY = rect.height * 0.02;
  });

  applyCanvasTransform();
}

// ==============================
// HELPERS FOR IMAGE CHANGE
// ==============================

function refreshViewAfterNavigation() {
  resetViewForNewImage();

  if (typeof displayCurrentAnalysis === 'function') {
    displayCurrentAnalysis();
  }
}
