```javascript
// ==============================
// AQUA INSIGHT MAIN SCRIPT
// Version 0.1
// ==============================

let uploadedImages = [];
let currentImageIndex = 0;
let allAnalysisResults = [];

let selectedBackgroundPixel = null;
let selectedBackgroundPosition = null;

let originalCanvas = null;
let originalCtx = null;

let channelCanvas = null;
let channelCtx = null;

let thresholdCanvas = null;
let thresholdCtx = null;

let overlayCanvas = null;
let overlayCtx = null;

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeCanvasReferences();
  initializeNavigation();
  initializeDropdowns();
  initializeActiveLinks();
  initializeThresholdDescriptions();
  initializeImageUpload();
  initializeImageNavigation();
  initializeAnalysisControls();
  initializeBackgroundPicker();
  initializeSettingsPersistence();
});

// ==============================
// CANVAS REFERENCES
// ==============================

function initializeCanvasReferences() {
  originalCanvas = document.getElementById(
    'originalCanvas'
  );

  channelCanvas = document.getElementById(
    'channelCanvas'
  );

  thresholdCanvas = document.getElementById(
    'thresholdCanvas'
  );

  overlayCanvas = document.getElementById(
    'overlayCanvas'
  );

  if (originalCanvas) {
    originalCtx = originalCanvas.getContext('2d');
  }

  if (channelCanvas) {
    channelCtx = channelCanvas.getContext('2d');
  }

  if (thresholdCanvas) {
    thresholdCtx = thresholdCanvas.getContext('2d');
  }

  if (overlayCanvas) {
    overlayCtx = overlayCanvas.getContext('2d');
  }
}

// ==============================
// NAVIGATION
// ==============================

function initializeNavigation() {
  const navLinks = document.querySelectorAll(
    '.nav-link'
  );

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(item => {
        item.classList.remove('active');
      });

      link.classList.add('active');
    });
  });
}

function initializeDropdowns() {
  const dropdowns = document.querySelectorAll(
    '.dropdown'
  );

  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector(
      '.dropdown-button'
    );

    if (!button) {
      return;
    }

    button.addEventListener('click', event => {
      event.stopPropagation();

      closeAllDropdowns();

      dropdown.classList.toggle('dropdown-open');
    });
  });

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });
}

function closeAllDropdowns() {
  const dropdowns = document.querySelectorAll(
    '.dropdown'
  );

  dropdowns.forEach(dropdown => {
    dropdown.classList.remove('dropdown-open');
  });
}

function initializeActiveLinks() {
  const currentPath =
    window.location.pathname.split('/').pop();

  const navLinks = document.querySelectorAll(
    '.nav-link'
  );

  const dropdownLinks = document.querySelectorAll(
    '.dropdown-menu a'
  );

  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (
      href &&
      (
        href === currentPath ||
        (
          currentPath === '' &&
          href.includes('index.html')
        )
      )
    ) {
      link.classList.add('active');
    }
  });

  dropdownLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (
      href &&
      href === currentPath
    ) {
      link.classList.add('active-dropdown-link');
    }
  });
}

// ==============================
// THRESHOLD DESCRIPTION
// ==============================

function initializeThresholdDescriptions() {
  const thresholdMode = document.getElementById(
    'thresholdMode'
  );

  const thresholdDescription = document.getElementById(
    'thresholdDescription'
  );

  if (!thresholdMode || !thresholdDescription) {
    return;
  }

  const descriptions = {
    otsu:
      'Automatically separates foreground and background by maximizing variance between intensity classes.',

    mean:
      'Uses the average image intensity as the threshold value.',

    triangle:
      'Uses the triangle method and is suitable for asymmetric histograms.',

    minerror:
      'Uses minimum error thresholding to find the best separation between foreground and background.',

    manual:
      'Uses the threshold value entered manually by the user.'
  };

  function updateThresholdDescription() {
    const mode = thresholdMode.value;

    thresholdDescription.textContent =
      descriptions[mode] ||
      'Select a threshold method.';
  }

  thresholdMode.addEventListener(
    'change',
    updateThresholdDescription
  );

  updateThresholdDescription();
}
```
