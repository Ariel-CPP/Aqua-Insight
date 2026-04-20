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
});

// ==============================
// NAVIGATION
// ==============================

function initializeNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(item => item.classList.remove('active'));
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

    button.addEventListener('click', (event) => {
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
  const currentPath = window.location.pathname.split('/').pop();

  const navLinks = document.querySelectorAll('.nav-link');
  const dropdownLinks = document.querySelectorAll('.dropdown-menu a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (href && href.includes(currentPath)) {
      link.classList.add('active');
    }
  });

  dropdownLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (href && href.includes(currentPath)) {
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
  channelMode: 'grayscale',
  thresholdMode: 'otsu',
  manualThresholdValue: 128,
  invertThreshold: false,
  excludeEdgeParticles: false,
  ignoreBackgroundParticles: true,
  minParticleSize: 0,
  maxParticleSize: 999999,
  circularityMin: 0.00,
  circularityMax: 1.00
};

  const existingSettings = localStorage.getItem('aquaInsightSettings');

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
  const internalLinks = document.querySelectorAll('a[href^="#"]');

  internalLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');

      if (!targetId || targetId === '#') return;

      const targetElement = document.querySelector(targetId);

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
// GLOBAL HELPER FUNCTIONS
// ==============================

function saveSetting(key, value) {
  const settings = JSON.parse(localStorage.getItem('aquaInsightSettings')) || {};

  settings[key] = value;

  localStorage.setItem(
    'aquaInsightSettings',
    JSON.stringify(settings)
  );
}

function getSetting(key) {
  const settings = JSON.parse(localStorage.getItem('aquaInsightSettings')) || {};

  return settings[key];
}

// ==============================
// DEBUG INFO
// ==============================

console.log('Aqua Insight initialized successfully.');
