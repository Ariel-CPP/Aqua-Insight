const AppState = {
  images: [],
  currentImageIndex: -1,
  currentResults: [],
  highlightedParticleId: null
};

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  initializeCanvasInteractions();
});

function initializeApp() {
  bindUploadEvents();
  bindNavigationEvents();
  bindThresholdEvents();
  bindActionEvents();
  bindResultTableEvents();
  initializeCanvasInteractions();

  UI.resetAllUi();
}

function bindUploadEvents() {
  const uploadInput = document.getElementById('imageUploadInput');
  const uploadButton = document.getElementById('uploadButton');
  const dropzone = document.getElementById('uploadDropzone');

  uploadButton.addEventListener('click', () => {
    uploadInput.click();
  });

  uploadInput.addEventListener('change', async event => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    await loadImages(files);
  });

  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');

    const files = Array.from(event.dataTransfer.files || []);

    if (!files.length) return;

    await loadImages(files);
  });
}

async function loadImages(files) {
  UI.showLoading('Loading images...');

  try {
    for (const file of files) {
      const image = await Utils.loadImageFromFile(file);

      AppState.images.push({
        id: Utils.generateId('image'),
        file,
        image,
        name: file.name,
        backgroundPoints: [],
        backgroundRange: null,
        analysis: null
      });
    }

    if (AppState.currentImageIndex === -1 && AppState.images.length > 0) {
      AppState.currentImageIndex = 0;
    }

    updateCurrentImageView();

    UI.showNotification(
      'success',
      'Images Loaded',
      `${files.length} image(s) loaded successfully.`
    );
  } catch (error) {
    console.error(error);

    UI.showNotification(
      'error',
      'Upload Failed',
      'Failed to load one or more images.'
    );
  } finally {
    UI.hideLoading();
  }
}

function updateCurrentImageView() {
  const currentImage = getCurrentImage();

  if (!currentImage) {
    return;
  }

  UI.updateImageCounter(
    AppState.currentImageIndex,
    AppState.images.length
  );

  UI.updateCurrentImageName(currentImage.name);

  renderOriginalImage(currentImage.image);

  if (!currentImage.backgroundRange) {
    UI.openBackgroundModal();
    renderBackgroundSelectionCanvas(currentImage.image);
  }
const statusChip = document.getElementById('analysisStatusChip');

if (statusChip) {
  statusChip.textContent = 'Background Required';
}
  if (currentImage.analysis) {
    restoreAnalysisResult(currentImage.analysis);
  } else {
    UI.resetSummary();
    UI.resetClassificationSummary();
    UI.resetResultTable();
  }
}

function getCurrentImage() {
  return AppState.images[AppState.currentImageIndex] || null;
}
function bindNavigationEvents() {
  const previousButton = document.getElementById('previousImageButton');
  const nextButton = document.getElementById('nextImageButton');

  previousButton.addEventListener('click', () => {
    if (AppState.currentImageIndex <= 0) {
      return;
    }

    AppState.currentImageIndex--;
    updateCurrentImageView();
  });

  nextButton.addEventListener('click', () => {
    if (AppState.currentImageIndex >= AppState.images.length - 1) {
      return;
    }

    AppState.currentImageIndex++;
    updateCurrentImageView();
  });
}

function bindThresholdEvents() {
  const thresholdMethod = document.getElementById('thresholdMethod');

  thresholdMethod.addEventListener('change', event => {
    UI.updateThresholdDescription(event.target.value);
  });
}

function bindActionEvents() {
  const runAnalysisButton = document.getElementById('runAnalysisButton');
  const resetBackgroundButton = document.getElementById('resetBackgroundButton');
  const downloadOverlayButton = document.getElementById('downloadOverlayButton');
  const exportXlsxButton = document.getElementById('exportXlsxButton');

  const confirmBackgroundButton = document.getElementById('confirmBackgroundButton');
  const clearBackgroundPointsButton = document.getElementById('clearBackgroundPointsButton');

  runAnalysisButton.addEventListener('click', async () => {
    await runParticleAnalysis();
  });
const statusChip = document.getElementById('analysisStatusChip');

if (statusChip) {
  statusChip.textContent = 'Analysis Complete';
}
  
  resetBackgroundButton.addEventListener('click', () => {
    const currentImage = getCurrentImage();

    if (!currentImage) return;

    currentImage.backgroundPoints = [];
    currentImage.backgroundRange = null;

    UI.openBackgroundModal();
    renderBackgroundSelectionCanvas(currentImage.image);
  });

  downloadOverlayButton.addEventListener('click', () => {
    const canvas = document.getElementById('overlayCanvas');
    const currentImage = getCurrentImage();

    if (!currentImage) return;

    ExportManager.exportOverlayPng(canvas, currentImage.name);
  });

  exportXlsxButton.addEventListener('click', () => {
    const exportResults = AppState.images
      .filter(image => image.analysis)
      .map(image => image.analysis.exportData);

    ExportManager.exportResultsToXlsx(exportResults);
  });

  confirmBackgroundButton.addEventListener('click', () => {
    const currentImage = getCurrentImage();

    if (!currentImage) return;

    if (currentImage.backgroundPoints.length === 0) {
      UI.showNotification(
        'warning',
        'No Background Selected',
        'Please select at least one background point.'
      );
      return;
    }

    currentImage.backgroundRange = Utils.getMinMaxRgbRange(
      currentImage.backgroundPoints
    );

    const applyToAll = document.getElementById('applyBackgroundToAllImages').checked;

    if (applyToAll) {
      AppState.images.forEach(image => {
        image.backgroundPoints = [...currentImage.backgroundPoints];
        image.backgroundRange = { ...currentImage.backgroundRange };
      });
    }

    UI.closeBackgroundModal();
const statusChip = document.getElementById('analysisStatusChip');

if (statusChip) {
  statusChip.textContent = 'Ready for Analysis';
}
    UI.showNotification(
      'success',
      'Background Saved',
      'Background range has been saved successfully.'
    );
  });

  clearBackgroundPointsButton.addEventListener('click', () => {
    const currentImage = getCurrentImage();

    if (!currentImage) return;

    currentImage.backgroundPoints = [];

    UI.updateBackgroundPointCount(0);
    UI.renderBackgroundColorPreview([]);
    renderBackgroundSelectionCanvas(currentImage.image);
  });
}
function bindResultTableEvents() {
  UI.bindResultTableRowClick(particleId => {
    AppState.highlightedParticleId = particleId;

    const currentImage = getCurrentImage();

    if (!currentImage || !currentImage.analysis) {
      return;
    }

    ParticleAnalysis.renderParticleOverlay(
      document.getElementById('overlayCanvas'),
      currentImage.image,
      currentImage.analysis.particles,
      particleId
    );
  });

  const searchInput = document.getElementById('resultSearchInput');
  const sortSelect = document.getElementById('resultSortSelect');

  searchInput.addEventListener('input', () => {
    applyTableFilterAndSort();
  });

  sortSelect.addEventListener('change', () => {
    applyTableFilterAndSort();
  });
}

function applyTableFilterAndSort() {
  const currentImage = getCurrentImage();

  if (!currentImage || !currentImage.analysis) {
    return;
  }

  const keyword = UI.getResultSearchKeyword();
  const sortValue = UI.getResultSortValue();

  let filteredParticles = Utils.filterParticles(
    currentImage.analysis.particles,
    keyword
  );

  switch (sortValue) {
    case 'id-desc':
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'id', 'desc');
      break;

    case 'area-desc':
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'area', 'desc');
      break;

    case 'area-asc':
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'area', 'asc');
      break;

    case 'coverage-desc':
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'coverageArea', 'desc');
      break;

    case 'coverage-asc':
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'coverageArea', 'asc');
      break;

    case 'id-asc':
    default:
      filteredParticles = Utils.sortArrayByKey(filteredParticles, 'id', 'asc');
      break;
  }

  UI.populateResultTable(filteredParticles);
}

function initializeCanvasInteractions() {
  const canvasList = [
    document.getElementById('originalCanvas'),
    document.getElementById('channelCanvas'),
    document.getElementById('binaryCanvas'),
    document.getElementById('overlayCanvas')
  ];

  canvasList.forEach(canvas => {
    ZoomPan.bindCanvasInteractions(canvas, canvasList);

    ZoomPan.bindCrosshairSync(canvas, [
      'originalCanvasWrapper',
      'channelCanvasWrapper',
      'binaryCanvasWrapper',
      'overlayCanvasWrapper'
    ]);
  });
}

function renderOriginalImage(image) {
  const canvas = document.getElementById('originalCanvas');
  const context = canvas.getContext('2d');

  canvas.width = image.width;
  canvas.height = image.height;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  ZoomPan.applyViewportTransform(context);

  context.drawImage(image, 0, 0);

  ZoomPan.registerRedrawHandler(canvas, () => {
    renderOriginalImage(image);
  });

  UI.updateCanvasStatus(
    'originalCanvasWrapper',
    'Original image loaded',
    `${image.width} × ${image.height}`
  );
}

function renderBackgroundSelectionCanvas(image) {
  const canvas = document.getElementById('backgroundSelectionCanvas');
  const context = canvas.getContext('2d');

  const resized = Utils.resizeImageToMaxSide(image, 800);

  canvas.width = resized.width;
  canvas.height = resized.height;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, resized.width, resized.height);

  const currentImage = getCurrentImage();

  if (!currentImage) return;

  currentImage.backgroundPoints.forEach((point, index) => {
    context.beginPath();
    context.arc(point.displayX, point.displayY, 6, 0, Math.PI * 2);
    context.fillStyle = '#49d6ff';
    context.fill();

    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = '#ffffff';
    context.font = 'bold 12px Inter';
    context.fillText(index + 1, point.displayX + 10, point.displayY - 10);
  });

  canvas.onclick = event => {
    if (currentImage.backgroundPoints.length >= 5) {
      UI.showNotification(
        'warning',
        'Maximum Reached',
        'You can only select up to 5 background points.'
      );
      return;
    }

    const rect = canvas.getBoundingClientRect();

    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;

    const scaleX = image.width / canvas.width;
    const scaleY = image.height / canvas.height;

    const actualX = Math.floor(displayX * scaleX);
    const actualY = Math.floor(displayY * scaleY);

    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');

    tempCanvas.width = image.width;
    tempCanvas.height = image.height;

    tempContext.drawImage(image, 0, 0);

    const imageData = tempContext.getImageData(
      actualX,
      actualY,
      1,
      1
    );

    const pixel = {
      x: actualX,
      y: actualY,
      displayX,
      displayY,
      r: imageData.data[0],
      g: imageData.data[1],
      b: imageData.data[2]
    };

    currentImage.backgroundPoints.push(pixel);

    UI.updateBackgroundPointCount(
      currentImage.backgroundPoints.length
    );

    UI.renderBackgroundColorPreview(
      currentImage.backgroundPoints
    );

    renderBackgroundSelectionCanvas(image);
  };
}

async function runParticleAnalysis() {
  const currentImage = getCurrentImage();

  if (!currentImage) {
    return;
  }

  if (!currentImage.backgroundRange) {
    UI.openBackgroundModal();
    renderBackgroundSelectionCanvas(currentImage.image);

    UI.showNotification(
      'warning',
      'Background Required',
      'Please select background before running analysis.'
    );

    return;
  }

  UI.showLoading('Running particle analysis...');

  try {
    const image = currentImage.image;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    tempCtx.drawImage(image, 0, 0);

    const originalImageData = tempCtx.getImageData(
      0,
      0,
      image.width,
      image.height
    );

    const channelMode = document.getElementById('channelMode').value;
    const thresholdMethod = document.getElementById('thresholdMethod').value;
    const thresholdMin = Number(document.getElementById('thresholdMin').value);
    const thresholdMax = Number(document.getElementById('thresholdMax').value);
    const invert = document.getElementById('invertThreshold').checked;
    const minSize = Number(document.getElementById('minimumParticleSize').value);
    const morphologyStrength = Number(document.getElementById('morphologyStrength').value);
    const classificationMode = document.getElementById('classificationMode').value;

    const channel = Detection.extractChannel(originalImageData, channelMode);
    const channelImage = Detection.createChannelImageData(channel);

    const binary = Detection.createBinaryMask(
      channel,
      thresholdMethod,
      thresholdMin,
      thresholdMax,
      invert
    );

    let processedMask = Detection.removeBackgroundFromMask(
      binary,
      originalImageData,
      currentImage.backgroundRange
    );

    processedMask = Detection.applyMorphologicalOpening(
      processedMask,
      morphologyStrength
    );

    const labeled = Detection.connectedComponentLabeling(
      processedMask,
      minSize
    );

    const nonBackgroundMask = Detection.createNonBackgroundMask(
      originalImageData,
      currentImage.backgroundRange
    );

    const totalNonBackgroundArea = nonBackgroundMask.data.reduce(
      (sum, val) => sum + val,
      0
    );

    const analyzed = ParticleAnalysis.analyzeParticles(
      labeled,
      originalImageData,
      totalNonBackgroundArea,
      classificationMode
    );

    const classificationSummary =
      ParticleAnalysis.generateClassificationSummary(analyzed.particles);

    const totalCoverage =
      ParticleAnalysis.calculateTotalCoverage(analyzed.particles);

    currentImage.analysis = {
      particles: analyzed.particles,
      classificationSummary,
      exportData: {
        imageName: currentImage.name,
        particleCount: analyzed.particles.length,
        coverageArea: totalCoverage,
        thresholdMethod,
        thresholdValue:
          typeof binary.thresholdValue === 'object'
            ? `${thresholdMin}-${thresholdMax}`
            : binary.thresholdValue,
        thresholdMin,
        thresholdMax,
        channelMode,
        classificationMode: analyzed.classificationMode,
        imageSize: `${image.width}x${image.height}`,
        minimumParticleSize: minSize,
        morphologyStrength,
        invertThreshold: invert,
        backgroundRange: currentImage.backgroundRange,
        particles: analyzed.particles
      }
    };

    renderAnalysisResult(currentImage);

    UI.showNotification(
      'success',
      'Analysis Complete',
      `${analyzed.particles.length} particles detected.`
    );
  } catch (error) {
    console.error(error);

    UI.showNotification(
      'error',
      'Analysis Failed',
      'An error occurred during processing.'
    );
  } finally {
    UI.hideLoading();
  }
}

function renderAnalysisResult(currentImage) {
  const image = currentImage.image;
  const analysis = currentImage.analysis;

  if (!analysis) {
    return;
  }

  renderChannelPreview(image);
  renderBinaryPreview(image, currentImage);
  renderOverlayPreview(image, analysis.particles);

  UI.updateSummary({
    imageName: currentImage.name,
    particleCount: analysis.particles.length,
    coverageArea: analysis.exportData.coverageArea,
    thresholdMethod: analysis.exportData.thresholdMethod,
    thresholdValue: analysis.exportData.thresholdValue,
    channelMode: analysis.exportData.channelMode,
    classificationMode: analysis.exportData.classificationMode,
    imageSize: analysis.exportData.imageSize
  });

  UI.renderClassificationSummary(
    analysis.classificationSummary
  );

  UI.populateResultTable(
    analysis.particles
  );
}

function restoreAnalysisResult(analysis) {
  const currentImage = getCurrentImage();

  if (!currentImage || !analysis) {
    return;
  }

  renderAnalysisResult(currentImage);
}

function renderChannelPreview(image) {
  const canvas = document.getElementById('channelCanvas');
  const context = canvas.getContext('2d');

  const tempCanvas = document.createElement('canvas');
  const tempContext = tempCanvas.getContext('2d');

  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  tempContext.drawImage(image, 0, 0);

  const imageData = tempContext.getImageData(
    0,
    0,
    image.width,
    image.height
  );

  const channelMode = document.getElementById('channelMode').value;

  const channel = Detection.extractChannel(
    imageData,
    channelMode
  );

  const channelImage = Detection.createChannelImageData(channel);

  canvas.width = image.width;
  canvas.height = image.height;

  const renderCanvas = document.createElement('canvas');
  const renderContext = renderCanvas.getContext('2d');

  renderCanvas.width = image.width;
  renderCanvas.height = image.height;

  renderContext.putImageData(channelImage, 0, 0);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  ZoomPan.applyViewportTransform(context);

  context.drawImage(renderCanvas, 0, 0);

  ZoomPan.registerRedrawHandler(canvas, () => {
    renderChannelPreview(image);
  });

  UI.updateCanvasStatus(
    'channelCanvasWrapper',
    `Channel: ${channelMode}`,
    `${image.width} × ${image.height}`
  );
}

function renderBinaryPreview(image, currentImage) {
  const canvas = document.getElementById('binaryCanvas');
  const context = canvas.getContext('2d');

  const tempCanvas = document.createElement('canvas');
  const tempContext = tempCanvas.getContext('2d');

  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  tempContext.drawImage(image, 0, 0);

  const imageData = tempContext.getImageData(
    0,
    0,
    image.width,
    image.height
  );

  const channelMode = document.getElementById('channelMode').value;
  const thresholdMethod = document.getElementById('thresholdMethod').value;
  const thresholdMin = Number(document.getElementById('thresholdMin').value);
  const thresholdMax = Number(document.getElementById('thresholdMax').value);
  const invert = document.getElementById('invertThreshold').checked;

  const channel = Detection.extractChannel(imageData, channelMode);

  const binary = Detection.createBinaryMask(
    channel,
    thresholdMethod,
    thresholdMin,
    thresholdMax,
    invert
  );

  const processedMask = Detection.removeBackgroundFromMask(
    binary,
    imageData,
    currentImage.backgroundRange
  );

  const binaryImage = Detection.createBinaryImageData(processedMask);

  canvas.width = image.width;
  canvas.height = image.height;

  const renderCanvas = document.createElement('canvas');
  const renderContext = renderCanvas.getContext('2d');

  renderCanvas.width = image.width;
  renderCanvas.height = image.height;

  renderContext.putImageData(binaryImage, 0, 0);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  ZoomPan.applyViewportTransform(context);

  context.drawImage(renderCanvas, 0, 0);

  ZoomPan.registerRedrawHandler(canvas, () => {
    renderBinaryPreview(image, currentImage);
  });

  UI.updateCanvasStatus(
    'binaryCanvasWrapper',
    `Threshold: ${thresholdMethod}`,
    typeof binary.thresholdValue === 'object'
      ? `${thresholdMin}-${thresholdMax}`
      : String(binary.thresholdValue)
  );
}

function renderOverlayPreview(image, particles) {
  const canvas = document.getElementById('overlayCanvas');
  const context = canvas.getContext('2d');

  const overlayCanvas = document.createElement('canvas');

  ParticleAnalysis.renderParticleOverlay(
    overlayCanvas,
    image,
    particles,
    AppState.highlightedParticleId
  );

  canvas.width = overlayCanvas.width;
  canvas.height = overlayCanvas.height;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  ZoomPan.applyViewportTransform(context);

  context.drawImage(overlayCanvas, 0, 0);

  ZoomPan.registerRedrawHandler(canvas, () => {
    renderOverlayPreview(image, particles);
  });

  UI.updateCanvasStatus(
    'overlayCanvasWrapper',
    `${particles.length} particles`,
    AppState.highlightedParticleId
      ? `Selected: ${AppState.highlightedParticleId}`
      : '-'
  );
}

window.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') {
    const previousButton = document.getElementById('previousImageButton');
    previousButton.click();
  }

  if (event.key === 'ArrowRight') {
    const nextButton = document.getElementById('nextImageButton');
    nextButton.click();
  }

  if (event.key === 'Escape') {
    UI.closeBackgroundModal();
  }
});

UI.updateThresholdDescription(
  document.getElementById('thresholdMethod')?.value || 'otsu'
);
