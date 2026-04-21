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
  initializeBatchNavigationButtons();
});

// ==============================
// NAVIGATION
// ==============================

function initializeNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

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
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector('.dropdown-button');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (!button || !menu) return;

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
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    dropdown.classList.remove('dropdown-open');
  });
}

// ==============================
// ACTIVE LINK DETECTION
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
        (currentPath === '' && href.includes('index.html'))
      )
    ) {
      link.classList.add('active');
    }
  });

  dropdownLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (
      href &&
      (
        href === currentPath ||
        (currentPath === '' && href.includes('index.html'))
      )
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
    theme: 'dark',
    lastFeature: 'particle-counter',
    lastFeatureMode: 'single',
    channelMode: 'grayscale',
    thresholdMode: 'otsu',
    manualThresholdValue: 128,
    invertThreshold: false,
    excludeEdgeParticles: false,
    ignoreBackgroundParticles: true,
    minParticleSize: 0,
    maxParticleSize: 999999,
    circularityMin: 0,
    circularityMax: 1
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
      const targetId = link.getAttribute('href');

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

  if (!thresholdMode || !thresholdDescription) return;

  const descriptions = {
    otsu: 'Automatically separates foreground and background based on maximum between-class variance.',
    mean: 'Uses the average grayscale intensity of the image as the threshold value.',
    triangle: 'Applies the triangle algorithm for images with asymmetric histograms.',
    minerror: 'Uses minimum error thresholding based on separation between foreground and background.',
    manual: 'Allows manual threshold value adjustment using the threshold input field.'
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
// BATCH NAVIGATION BUTTONS
// ==============================

function initializeBatchNavigationButtons() {
  const previousButton =
    document.getElementById('previousBatchImageButton');

  const nextButton =
    document.getElementById('nextBatchImageButton');

  if (previousButton) {
    previousButton.addEventListener('click', () => {
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
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
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
    });
  }
}

// ==============================
// GLOBAL STORAGE HELPERS
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

console.log('Aqua Insight initialized successfully.');
