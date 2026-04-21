// ==============================
// ZOOM AND PAN MODULE
// Aqua Insight Version 0.1
// ==============================

let currentZoom = 1;
let minZoom = 0.2;
let maxZoom = 10;

let panOffsetX = 0;
let panOffsetY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const previewContainerIds = [
  'originalCanvasContainer',
  'channelCanvas',
  'thresholdCanvas',
  'overlayCanvas'
];

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeZoomControls();
  initializePanControls();
  initializeWheelZoom();
});

// ==============================
// ZOOM BUTTONS
// ==============================

function initializeZoomControls() {
  const zoomInButton = document.getElementById(
    'zoomInButton'
  );

  const zoomOutButton = document.getElementById(
    'zoomOutButton'
  );

  const resetZoomButton = document.getElementById(
    'resetZoomButton'
  );

  if (zoomInButton) {
    zoomInButton.addEventListener('click', () => {
      setZoomLevel(currentZoom * 1.2);
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      setZoomLevel(currentZoom / 1.2);
    });
  }

  if (resetZoomButton) {
    resetZoomButton.addEventListener('click', () => {
      resetViewForNewImage();
    });
  }
}

// ==============================
// ZOOM SETTER
// ==============================

function setZoomLevel(newZoom) {
  currentZoom = Math.min(
    maxZoom,
    Math.max(minZoom, newZoom)
  );

  applyTransformToAllPreviewPanels();
}

// ==============================
// PAN CONTROL
// ==============================

function initializePanControls() {
  previewContainerIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.addEventListener('mousedown', event => {
      isDragging = true;

      dragStartX = event.clientX - panOffsetX;
      dragStartY = event.clientY - panOffsetY;

      element.classList.add('dragging');
    });

    element.addEventListener('mousemove', event => {
      if (!isDragging) {
        return;
      }

      panOffsetX = event.clientX - dragStartX;
      panOffsetY = event.clientY - dragStartY;

      applyTransformToAllPreviewPanels();
    });

    element.addEventListener('mouseup', () => {
      isDragging = false;
      element.classList.remove('dragging');
    });

    element.addEventListener('mouseleave', () => {
      isDragging = false;
      element.classList.remove('dragging');
    });
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;

    previewContainerIds.forEach(id => {
      const element = document.getElementById(id);

      if (element) {
        element.classList.remove('dragging');
      }
    });
  });
}

// ==============================
// MOUSE WHEEL ZOOM
// ==============================

function initializeWheelZoom() {
  previewContainerIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.addEventListener('wheel', event => {
      event.preventDefault();

      const zoomFactor = event.deltaY < 0
        ? 1.1
        : 0.9;

      setZoomLevel(currentZoom * zoomFactor);
    });
  });
}

// ==============================
// APPLY TRANSFORM
// ==============================

function applyTransformToAllPreviewPanels() {
  const transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentZoom})`;

  const targetElements = [
    document.getElementById('originalCanvas'),
    document.getElementById('channelCanvas'),
    document.getElementById('thresholdCanvas'),
    document.getElementById('overlayCanvas'),
    document.getElementById('overlaySvg')
  ];

  targetElements.forEach(element => {
    if (!element) {
      return;
    }

    element.style.transform = transform;
    element.style.transformOrigin = 'center center';
    element.style.cursor = isDragging
      ? 'grabbing'
      : 'grab';
  });
}

// ==============================
// RESET VIEW
// ==============================

function resetViewForNewImage() {
  currentZoom = 1;
  panOffsetX = 0;
  panOffsetY = 0;

  applyTransformToAllPreviewPanels();
}
