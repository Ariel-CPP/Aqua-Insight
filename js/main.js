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

let isUploadingFiles = false;

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
  originalCanvas = document.getElementById('originalCanvas');
  channelCanvas = document.getElementById('channelCanvas');
  thresholdCanvas = document.getElementById('thresholdCanvas');
  overlayCanvas = document.getElementById('overlayCanvas');

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

function initializeDropdowns() {
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector('.dropdown-button');

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
  const dropdowns = document.querySelectorAll('.dropdown');

  dropdowns.forEach(dropdown => {
    dropdown.classList.remove('dropdown-open');
  });
}

function initializeActiveLinks() {
  const currentPath = window.location.pathname.split('/').pop();

  const navLinks = document.querySelectorAll('.nav-link');
  const dropdownLinks = document.querySelectorAll('.dropdown-menu a');

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

    if (href && href === currentPath) {
      link.classList.add('active-dropdown-link');
    }
  });
}

// ==============================
// THRESHOLD DESCRIPTION
// ==============================

function initializeThresholdDescriptions() {
  const thresholdMode = document.getElementById('thresholdMode');
  const thresholdDescription = document.getElementById('thresholdDescription');

  if (!thresholdMode || !thresholdDescription) {
    return;
  }

  const descriptions = {
    otsu: 'Automatically separates foreground and background by maximizing variance between intensity classes.',
    mean: 'Uses the average image intensity as the threshold value.',
    triangle: 'Uses the triangle method and is suitable for asymmetric histograms.',
    minerror: 'Uses minimum error thresholding to find the best separation between foreground and background.',
    manual: 'Uses the threshold value entered manually by the user.'
  };

  function updateThresholdDescription() {
    const mode = thresholdMode.value;

    thresholdDescription.textContent =
      descriptions[mode] || 'Select a threshold method.';
  }

  thresholdMode.addEventListener('change', updateThresholdDescription);

  updateThresholdDescription();
}

// ==============================
// IMAGE UPLOAD
// ==============================

function initializeImageUpload() {
  const uploadButton = document.getElementById('uploadButton');
  const imageUpload = document.getElementById('imageUpload');
  const uploadArea = document.getElementById('uploadArea');

  if (!imageUpload) {
    console.error('imageUpload input not found');
    return;
  }

  if (uploadButton) {
    uploadButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      if (isUploadingFiles) {
        return;
      }

      isUploadingFiles = true;
      imageUpload.click();

      setTimeout(() => {
        isUploadingFiles = false;
      }, 300);
    });
  }

  imageUpload.addEventListener('change', event => {
    const files = Array.from(event.target.files || []).filter(file => {
      return file.type.startsWith('image/');
    });

    if (!files.length) {
      imageUpload.value = '';
      return;
    }

    loadUploadedImages(files);
    imageUpload.value = '';
  });

  if (uploadArea) {
    uploadArea.addEventListener('dragenter', event => {
      event.preventDefault();
      event.stopPropagation();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragover', event => {
      event.preventDefault();
      event.stopPropagation();
      uploadArea.classList.add('dragover');
    });
        uploadArea.addEventListener('dragleave', event => {
      event.preventDefault();
      event.stopPropagation();

      if (
        event.target === uploadArea ||
        !uploadArea.contains(event.relatedTarget)
      ) {
        uploadArea.classList.remove('dragover');
      }
    });

    uploadArea.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();

      uploadArea.classList.remove('dragover');

      const files = Array.from(
        event.dataTransfer.files || []
      ).filter(file => {
        return file.type.startsWith('image/');
      });

      if (!files.length) {
        alert('Please drop valid image files only.');
        return;
      }

      loadUploadedImages(files);
    });
  }
}

function loadUploadedImages(files) {
  uploadedImages = [];
  currentImageIndex = 0;
  allAnalysisResults = [];

  if (typeof resetResultsTable === 'function') {
    resetResultsTable();
  }

  if (typeof resetSummaryDisplay === 'function') {
    resetSummaryDisplay();
  }

  if (typeof clearOverlaySvg === 'function') {
    clearOverlaySvg();
  }

  let loadedCount = 0;

  const loadingLabel = document.getElementById(
    'activeImageLabel'
  );

  if (loadingLabel) {
    loadingLabel.textContent = 'Loading images...';
  }

  files.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = event => {
      const image = new Image();

      image.onload = () => {
        uploadedImages.push({
          id: index + 1,
          name: file.name,
          file,
          image
        });

        loadedCount++;

        if (loadingLabel) {
          loadingLabel.textContent =
            `Loading ${loadedCount} / ${files.length}...`;
        }

        if (loadedCount === files.length) {
          uploadedImages.sort((a, b) => a.id - b.id);

          renderCurrentImage();
          updateActiveImageLabel();

          if (
            typeof resetViewForNewImage === 'function'
          ) {
            resetViewForNewImage();
          }
        }
      };

      image.onerror = () => {
        console.error('Failed to load image:', file.name);
      };

      image.src = event.target.result;
    };

    reader.onerror = () => {
      console.error('Failed to read file:', file.name);
    };

    reader.readAsDataURL(file);
  });
}

// ==============================
// IMAGE NAVIGATION
// ==============================

function initializeImageNavigation() {
  const previousButton = document.getElementById(
    'previousImageButton'
  );

  const nextButton = document.getElementById(
    'nextImageButton'
  );

  if (previousButton) {
    previousButton.addEventListener('click', () => {
      if (!uploadedImages.length) {
        return;
      }

      currentImageIndex--;

      if (currentImageIndex < 0) {
        currentImageIndex = uploadedImages.length - 1;
      }

      renderImageByIndex();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      if (!uploadedImages.length) {
        return;
      }

      currentImageIndex++;

      if (currentImageIndex >= uploadedImages.length) {
        currentImageIndex = 0;
      }

      renderImageByIndex();
    });
  }
}

function renderImageByIndex() {
  if (!uploadedImages.length) {
    return;
  }

  renderCurrentImage();
  updateActiveImageLabel();

  if (allAnalysisResults[currentImageIndex]) {
    renderStoredAnalysisForCurrentImage();
  } else {
    resetResultsTable();
    resetSummaryDisplay();
    clearOverlaySvg();
    renderSelectedChannelPreview();
    renderBinaryPreview();
  }

  if (
    typeof resetViewForNewImage === 'function'
  ) {
    resetViewForNewImage();
  }
}
function updateActiveImageLabel() {
  const label = document.getElementById(
    'activeImageLabel'
  );

  if (!label) {
    return;
  }

  if (!uploadedImages.length) {
    label.textContent = 'No image loaded';
    return;
  }

  const current = uploadedImages[currentImageIndex];

  label.textContent =
    `${currentImageIndex + 1} / ${uploadedImages.length} — ${current.name}`;
}

// ==============================
// CURRENT IMAGE RENDER
// ==============================

function renderCurrentImage() {
  if (!uploadedImages.length) {
    return;
  }

  const currentImage =
    uploadedImages[currentImageIndex].image;

  const canvases = [
    originalCanvas,
    channelCanvas,
    thresholdCanvas,
    overlayCanvas
  ];

  canvases.forEach(canvas => {
    if (!canvas) {
      return;
    }

    canvas.width = currentImage.width;
    canvas.height = currentImage.height;
  });

  if (originalCtx) {
    originalCtx.clearRect(
      0,
      0,
      originalCanvas.width,
      originalCanvas.height
    );

    originalCtx.drawImage(
      currentImage,
      0,
      0
    );
  }

  renderSelectedChannelPreview();
  renderBinaryPreview();
}

function renderSelectedChannelPreview() {
  if (
    !uploadedImages.length ||
    !originalCanvas ||
    !channelCanvas
  ) {
    return;
  }

  const settings = getCurrentSettings();

  renderChannelPreview(
    originalCanvas,
    channelCanvas,
    settings.channelMode
  );
}

function renderBinaryPreview() {
  if (!uploadedImages.length) {
    return;
  }

  const settings = getCurrentSettings();

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const currentImage =
    uploadedImages[currentImageIndex].image;

  const maxPreviewSize = 1000;

  let previewWidth = currentImage.width;
  let previewHeight = currentImage.height;

  if (
    previewWidth > maxPreviewSize ||
    previewHeight > maxPreviewSize
  ) {
    const scale = Math.min(
      maxPreviewSize / previewWidth,
      maxPreviewSize / previewHeight
    );

    previewWidth = Math.round(previewWidth * scale);
    previewHeight = Math.round(previewHeight * scale);
  }

  tempCanvas.width = previewWidth;
  tempCanvas.height = previewHeight;

  tempCtx.drawImage(
    currentImage,
    0,
    0,
    previewWidth,
    previewHeight
  );

  const result = runDetectionPipeline(
    tempCanvas,
    {
      ...settings,
      backgroundPixel: selectedBackgroundPixel
    }
  );

  renderBinaryMaskToCanvas(
    result.binaryMask,
    tempCanvas.width,
    tempCanvas.height,
    thresholdCanvas
  );
}

// ==============================
// ANALYSIS CONTROL
// ==============================

function initializeAnalysisControls() {
  const runButton = document.getElementById(
    'runAnalysisButton'
  );

  if (!runButton) {
    return;
  }

  runButton.addEventListener('click', () => {
    if (!uploadedImages.length) {
      alert('Please upload at least one image first.');
      return;
    }

    runFullAnalysis();
  });
}
async function runFullAnalysis() {
  const settings = getCurrentSettings();

  allAnalysisResults = [];

  const runButton = document.getElementById(
    'runAnalysisButton'
  );

  const activeImageLabel = document.getElementById(
    'activeImageLabel'
  );

  if (runButton) {
    runButton.disabled = true;
    runButton.textContent = 'Analyzing...';
  }

  for (
    let index = 0;
    index < uploadedImages.length;
    index++
  ) {
    const imageItem = uploadedImages[index];

    if (activeImageLabel) {
      activeImageLabel.textContent =
        `Analyzing ${index + 1} / ${uploadedImages.length} — ${imageItem.name}`;
    }

    await new Promise(resolve => {
      setTimeout(resolve, 10);
    });

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const maxAnalysisSize = 1200;

    let targetWidth = imageItem.image.width;
    let targetHeight = imageItem.image.height;

    if (
      targetWidth > maxAnalysisSize ||
      targetHeight > maxAnalysisSize
    ) {
      const scale = Math.min(
        maxAnalysisSize / targetWidth,
        maxAnalysisSize / targetHeight
      );

      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    tempCtx.drawImage(
      imageItem.image,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const detectionResult = runDetectionPipeline(
      tempCanvas,
      {
        ...settings,
        backgroundPixel: selectedBackgroundPixel
      }
    );

    let extractedParticles = extractParticlesWithFeatures(
      detectionResult.particles,
      tempCanvas
    );

    extractedParticles = extractedParticles.filter(
      particle => particle.area >= 3
    );

    extractedParticles = extractedParticles.map(
      particle => {
        return {
          ...particle,
          pixels: undefined
        };
      }
    );

    const filteredParticles = filterParticles(
      extractedParticles,
      settings
    );

    const totalParticleArea = filteredParticles.reduce(
      (sum, particle) => {
        return sum + particle.area;
      },
      0
    );

    const totalImagePixels =
      tempCanvas.width * tempCanvas.height;

    const coveragePercent =
      totalImagePixels > 0
        ? Number(
            (
              (totalParticleArea / totalImagePixels) *
              100
            ).toFixed(2)
          )
        : 0;

    allAnalysisResults.push({
      imageIndex: index,
      filename: imageItem.name,
      image: imageItem.image,
      width: tempCanvas.width,
      height: tempCanvas.height,
      thresholdMode: settings.thresholdMode,
      thresholdValue: detectionResult.thresholdValue,
      channelMode: settings.channelMode,
      binaryMask: detectionResult.binaryMask,
      particles: filteredParticles,
      coveragePixels: totalParticleArea,
      coveragePercent
    });
  }

  storeMultiAnalysisResults(
    allAnalysisResults,
    buildExportMetadata({
      ...settings,
      thresholdValue:
        allAnalysisResults[0]?.thresholdValue || '-'
    })
  );

  renderStoredAnalysisForCurrentImage();

  if (runButton) {
    runButton.disabled = false;
    runButton.textContent = 'Run Analysis';
  }

  updateActiveImageLabel();
}
// ==============================
// STORED RESULT RENDER
// ==============================

function renderStoredAnalysisForCurrentImage() {
  if (!allAnalysisResults.length) {
    return;
  }

  const result =
    allAnalysisResults[currentImageIndex];

  if (!result) {
    return;
  }

  renderCurrentImage();

  renderBinaryMaskToCanvas(
    result.binaryMask,
    result.width,
    result.height,
    thresholdCanvas
  );

  drawParticleOverlay(
    result.particles,
    result.width,
    result.height
  );

  populateResultsTable(result.particles);
  updateSummaryDisplay(result);
}

// ==============================
// PARTICLE FILTERING
// ==============================

function filterParticles(
  particles,
  settings
) {
  return particles.filter(particle => {
    const validArea =
      particle.area >= settings.minParticleSize &&
      particle.area <= settings.maxParticleSize;

    const validCircularity =
      particle.circularity >=
        settings.circularityMin &&
      particle.circularity <=
        settings.circularityMax;

    const validEdge =
      settings.excludeEdgeParticles
        ? !particle.touchesEdge
        : true;

    return (
      validArea &&
      validCircularity &&
      validEdge
    );
  });
}

// ==============================
// BACKGROUND PICKER
// ==============================

function initializeBackgroundPicker() {
  const container = document.getElementById(
    'originalCanvasContainer'
  );

  const indicator = document.getElementById(
    'backgroundColorIndicator'
  );

  const label = document.getElementById(
    'backgroundPixelValue'
  );

  const marker = document.getElementById(
    'backgroundSelectionMarker'
  );

  const resetButton = document.getElementById(
    'resetBackgroundButton'
  );

  if (!container || !originalCanvas) {
    return;
  }

  container.addEventListener('click', event => {
    const useBackgroundPicker = document.getElementById(
      'useBackgroundPicker'
    )?.checked;

    if (!useBackgroundPicker) {
      return;
    }

    const rect =
      originalCanvas.getBoundingClientRect();

    const scaleX =
      originalCanvas.width / rect.width;

    const scaleY =
      originalCanvas.height / rect.height;

    const x = Math.floor(
      (event.clientX - rect.left) * scaleX
    );

    const y = Math.floor(
      (event.clientY - rect.top) * scaleY
    );

    const pixel = originalCtx.getImageData(
      x,
      y,
      1,
      1
    ).data;

    const grayscale = Math.round(
      pixel[0] * 0.299 +
      pixel[1] * 0.587 +
      pixel[2] * 0.114
    );

    selectedBackgroundPixel = grayscale;

    selectedBackgroundPosition = {
      x,
      y,
      red: pixel[0],
      green: pixel[1],
      blue: pixel[2]
    };
        if (indicator) {
      indicator.style.backgroundColor =
        `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    }

    if (label) {
      label.textContent =
        `RGB(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    }

    if (marker) {
      marker.style.display = 'block';
      marker.style.left =
        `${event.clientX - rect.left}px`;
      marker.style.top =
        `${event.clientY - rect.top}px`;
    }

    renderBinaryPreview();
  });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      selectedBackgroundPixel = null;
      selectedBackgroundPosition = null;

      if (indicator) {
        indicator.style.backgroundColor =
          'transparent';
      }

      if (label) {
        label.textContent =
          'No pixel selected';
      }

      if (marker) {
        marker.style.display = 'none';
      }

      renderBinaryPreview();
    });
  }
}

// ==============================
// SETTINGS PERSISTENCE
// ==============================

function initializeSettingsPersistence() {
  const settingIds = [
    'channelMode',
    'thresholdMode',
    'manualThresholdValue',
    'minimumOverlayArea',
    'minParticleSize',
    'maxParticleSize',
    'circularityMin',
    'circularityMax',
    'invertThreshold',
    'excludeEdgeParticles',
    'useBackgroundPicker'
  ];

  loadSavedSettings();

  settingIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const eventType =
      element.type === 'checkbox'
        ? 'change'
        : 'input';

    element.addEventListener(eventType, () => {
      saveCurrentSettings();
    });
  });
}

function saveCurrentSettings() {
  const settings = {
    channelMode:
      document.getElementById('channelMode')?.value ||
      'grayscale',

    thresholdMode:
      document.getElementById('thresholdMode')?.value ||
      'otsu',

    manualThresholdValue:
      document.getElementById('manualThresholdValue')?.value ||
      128,

    minimumOverlayArea:
      document.getElementById('minimumOverlayArea')?.value ||
      50,

    minParticleSize:
      document.getElementById('minParticleSize')?.value ||
      0,

    maxParticleSize:
      document.getElementById('maxParticleSize')?.value ||
      999999,

    circularityMin:
      document.getElementById('circularityMin')?.value ||
      0,

    circularityMax:
      document.getElementById('circularityMax')?.value ||
      1,

    invertThreshold:
      document.getElementById('invertThreshold')?.checked ||
      false,

    excludeEdgeParticles:
      document.getElementById('excludeEdgeParticles')?.checked ||
      false,

    useBackgroundPicker:
      document.getElementById('useBackgroundPicker')?.checked ||
      false
  };
    localStorage.setItem(
    'aquaInsightParticleCounterSettings',
    JSON.stringify(settings)
  );
}

function loadSavedSettings() {
  const saved = localStorage.getItem(
    'aquaInsightParticleCounterSettings'
  );

  if (!saved) {
    return;
  }

  const settings = JSON.parse(saved);

  setInputValue('channelMode', settings.channelMode);
  setInputValue('thresholdMode', settings.thresholdMode);

  setInputValue(
    'manualThresholdValue',
    settings.manualThresholdValue
  );

  setInputValue(
    'minimumOverlayArea',
    settings.minimumOverlayArea
  );

  setInputValue(
    'minParticleSize',
    settings.minParticleSize
  );

  setInputValue(
    'maxParticleSize',
    settings.maxParticleSize
  );

  setInputValue(
    'circularityMin',
    settings.circularityMin
  );

  setInputValue(
    'circularityMax',
    settings.circularityMax
  );

  setCheckboxValue(
    'invertThreshold',
    settings.invertThreshold
  );

  setCheckboxValue(
    'excludeEdgeParticles',
    settings.excludeEdgeParticles
  );

  setCheckboxValue(
    'useBackgroundPicker',
    settings.useBackgroundPicker
  );
}

function setInputValue(id, value) {
  const element = document.getElementById(id);

  if (!element || value === undefined) {
    return;
  }

  element.value = value;
}

function setCheckboxValue(id, value) {
  const element = document.getElementById(id);

  if (!element || value === undefined) {
    return;
  }

  element.checked = Boolean(value);
}

// ==============================
// KEYBOARD SHORTCUTS
// ==============================

document.addEventListener('keydown', event => {
  if (!uploadedImages.length) {
    return;
  }

  if (
    event.target.tagName === 'INPUT' ||
    event.target.tagName === 'TEXTAREA' ||
    event.target.tagName === 'SELECT'
  ) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();

    currentImageIndex--;

    if (currentImageIndex < 0) {
      currentImageIndex = uploadedImages.length - 1;
    }

    renderImageByIndex();
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();

    currentImageIndex++;

    if (currentImageIndex >= uploadedImages.length) {
      currentImageIndex = 0;
    }

    renderImageByIndex();
  }

  if (
    event.key.toLowerCase() === 'r' &&
    typeof runFullAnalysis === 'function'
  ) {
    event.preventDefault();
    runFullAnalysis();
  }
});

// ==============================
// GLOBAL ERROR HANDLER
// ==============================

window.addEventListener('error', event => {
  console.error('Global error:', event.error);
});
