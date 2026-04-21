// ==============================
// AQUA INSIGHT MAIN SCRIPT
// Version 0.1
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeNavigation();
  initializeDropdowns();
  initializeActiveLinks();
  initializeLocalStorage();
  initializeSmoothScroll();
  initializeThresholdDescriptions();
});

// ==============================
// NAVIGATION
// ==============================

function initializeNavigation() {
  const navLinks =
    document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(item => {
        item.classList.remove('active');
      });

      link.classList.add('active');
    });
  });
}

// ==============================
// DROPDOWN MENU
// ==============================

function initializeDropdowns() {
  const dropdowns =
    document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const button =
      dropdown.querySelector('.dropdown-button');

    if (!button) return;

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
  const dropdowns =
    document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    dropdown.classList.remove('dropdown-open');
  });
}

// ==============================
// ACTIVE LINKS
// ==============================

function initializeActiveLinks() {
  const currentPath =
    window.location.pathname.split('/').pop();

  const navLinks =
    document.querySelectorAll('.nav-link');

  const dropdownLinks =
    document.querySelectorAll('.dropdown-menu a');

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
// LOCAL STORAGE
// ==============================

function initializeLocalStorage() {
  const defaultSettings = {
    channelMode: 'grayscale',
    thresholdMode: 'otsu',
    manualThresholdValue: 128,
    minimumOverlayArea: 50,
    minParticleSize: 0,
    maxParticleSize: 999999,
    circularityMin: 0,
    circularityMax: 1,
    invertThreshold: false,
    excludeEdgeParticles: false,
    useBackgroundPicker: false
  };

  const existingSettings =
    localStorage.getItem('aquaInsightSettings');

  if (!existingSettings) {
    localStorage.setItem(
      'aquaInsightSettings',
      JSON.stringify(defaultSettings)
    );
  }
}

// ==============================
// SMOOTH SCROLL
// ==============================

function initializeSmoothScroll() {
  const internalLinks =
    document.querySelectorAll('a[href^="#"]');

  internalLinks.forEach(link => {
    link.addEventListener('click', event => {
      const targetId =
        link.getAttribute('href');

      if (!targetId || targetId === '#') return;

      const targetElement =
        document.querySelector(targetId);

      if (!targetElement) return;

      event.preventDefault();

      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });
}

// ==============================
// THRESHOLD DESCRIPTION
// ==============================

function initializeThresholdDescriptions() {
  const thresholdMode =
    document.getElementById('thresholdMode');

  const thresholdDescription =
    document.getElementById('thresholdDescription');

  if (!thresholdMode || !thresholdDescription) {
    return;
  }

  const descriptions = {
    otsu:
      'Automatically separates foreground and background by maximizing the variance between pixel intensity classes.',

    mean:
      'Uses the average grayscale intensity of the image as the threshold value.',

    triangle:
      'Uses the triangle method, suitable for skewed histograms and images with a strong background peak.',

    minerror:
      'Uses minimum error thresholding to find the best separation between foreground and background distributions.',

    manual:
      'Uses the exact threshold value entered manually in the threshold input field.'
  };

  function updateThresholdDescription() {
    const selectedMode = thresholdMode.value;

    thresholdDescription.textContent =
      descriptions[selectedMode] ||
      'Select a threshold mode to view its description.';
  }

  thresholdMode.addEventListener(
    'change',
    updateThresholdDescription
  );

  updateThresholdDescription();
}

// ==============================
// SETTINGS HELPERS
// ==============================

function saveSetting(key, value) {
  const settings = JSON.parse(
    localStorage.getItem('aquaInsightSettings')
  ) || {};

  settings[key] = value;

  localStorage.setItem(
    'aquaInsightSettings',
    JSON.stringify(settings)
  );
}

function getSetting(key) {
  const settings = JSON.parse(
    localStorage.getItem('aquaInsightSettings')
  ) || {};

  return settings[key];
}

function getAllSettings() {
  return JSON.parse(
    localStorage.getItem('aquaInsightSettings')
  ) || {};
}

// ==============================
// SUMMARY HELPERS
// ==============================

function updateSummaryValue(elementId, value) {
  const element =
    document.getElementById(elementId);

  if (!element) return;

  element.textContent = value;
}

function clearSummaryDisplay() {
  updateSummaryValue(
    'activeImageSummary',
    '-'
  );

  updateSummaryValue(
    'particleCount',
    '0'
  );

  updateSummaryValue(
    'coverageArea',
    '0%'
  );

  updateSummaryValue(
    'coveragePixelArea',
    '0 px'
  );

  updateSummaryValue(
    'thresholdMethodLabel',
    '-'
  );

  updateSummaryValue(
    'channelModeLabel',
    '-'
  );

  updateSummaryValue(
    'thresholdValueLabel',
    '-'
  );

  updateSummaryValue(
    'imageSizeLabel',
    '-'
  );
}

console.log(
  'Aqua Insight initialized successfully.'
);

