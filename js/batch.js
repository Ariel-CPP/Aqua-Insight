// ==============================
// BATCH ANALYSIS MODULE
// Aqua Insight Version 0.1
// ==============================

let batchFiles = [];
let batchResults = [];

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeBatchMode();
});

function initializeBatchMode() {
  const imageUpload = document.getElementById('imageUpload');

  if (!imageUpload) return;

  imageUpload.setAttribute('multiple', true);
}

// ==============================
// HANDLE BATCH FILES
// ==============================

function handleBatchFiles(files) {
  const validFiles = files.filter(file =>
    file.type.startsWith('image/')
  );

  if (!validFiles.length) {
    alert('Please upload valid image files.');
    return;
  }

  batchFiles = validFiles;
  batchResults = [];
  currentBatchPreviewIndex = 0;

  const uploadDescription =
    document.querySelector('.upload-description');

  if (uploadDescription) {
    uploadDescription.textContent =
      `${batchFiles.length} image(s) loaded for batch analysis`;
  }

  resetResultsTable();
  clearOverlaySvg();
}

async function runBatchAnalysis() {
  if (!batchFiles.length) {
    alert('Please upload images before running batch analysis.');
    return;
  }

  const settings = getCurrentSettings();

  batchResults = [];

  let totalParticles = 0;
  let totalArea = 0;

  for (const file of batchFiles) {
    const image = await loadBatchImage(file);

    const result = analyzeBatchImage(
      image,
      file.name,
      settings
    );

    batchResults.push(result);

    totalParticles += result.detectedParticleCount;
    totalArea += result.totalParticleArea;
  }

  updateBatchSummary(totalParticles, totalArea);
  populateBatchResultsTable(batchResults);

  if (batchResults.length > 0) {
    currentBatchPreviewIndex = 0;
    renderBatchPreviewImage();
    highlightActiveBatchRow();
  }

  alert(
    `Batch analysis completed for ${batchResults.length} image(s).`
  );
}

function loadBatchImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = error => reject(error);

      image.src = event.target.result;
    };

    reader.onerror = error => reject(error);

    reader.readAsDataURL(file);
  });
}

function analyzeBatchImage(
  image,
  filename,
  settings
) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = image.width;
  tempCanvas.height = image.height;

  tempCtx.drawImage(image, 0, 0);

  const detectionResult = runDetectionPipeline(
    tempCanvas,
    settings
  );

  const imageData = tempCtx.getImageData(
    0,
    0,
    image.width,
    image.height
  );

  const extractedParticles =
    detectionResult.particles.map(particle => {
      return extractParticleFeatures(
        particle,
        imageData,
        image.width,
        image.height
      );
    });

  const filteredParticles = extractedParticles.filter(particle => {
    const validArea =
      particle.area >= settings.minParticleSize &&
      particle.area <= settings.maxParticleSize;

    const validCircularity =
      particle.circularity >= settings.circularityMin &&
      particle.circularity <= settings.circularityMax;

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

  const totalParticleArea = filteredParticles.reduce(
    (sum, particle) => sum + particle.area,
    0
  );

  return {
    filename,
    imageObject: image,
    binaryMask: detectionResult.binaryMask,
    thresholdMode: settings.thresholdMode,
    thresholdValue: detectionResult.thresholdValue,
    channelMode: settings.channelMode,
    imageWidth: image.width,
    imageHeight: image.height,
    particles: filteredParticles,
    detectedParticleCount: filteredParticles.length,
    totalParticleArea
  };
}

function updateBatchSummary(totalParticles, totalArea) {
  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  const thresholdMethodLabel =
    document.getElementById('thresholdMethodLabel');

  const channelModeLabel =
    document.getElementById('channelModeLabel');

  if (particleCountElement) {
    particleCountElement.textContent = totalParticles;
  }

  if (coverageAreaElement) {
    coverageAreaElement.textContent = totalArea.toLocaleString();
  }

  if (thresholdMethodLabel && batchResults.length > 0) {
    thresholdMethodLabel.textContent =
      `${batchResults[0].thresholdMode} (${batchResults[0].thresholdValue})`;
  }

  if (channelModeLabel && batchResults.length > 0) {
    channelModeLabel.textContent =
      batchResults[0].channelMode;
  }
}
function populateBatchResultsTable(results) {
  const resultsTableBody =
    document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  resultsTableBody.innerHTML = '';

  if (!results.length) {
    resultsTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-table-message">
          No batch analysis results available.
        </td>
      </tr>
    `;
    return;
  }

  results.forEach((result, index) => {
    const row = document.createElement('tr');

    row.classList.add('batch-result-row');

    if (index === currentBatchPreviewIndex) {
      row.classList.add('active-batch-row');
    }

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${result.detectedParticleCount}</td>
      <td>${result.totalParticleArea}</td>
      <td>${result.thresholdValue}</td>
      <td>${result.imageWidth}</td>
      <td>${result.imageHeight}</td>
      <td colspan="4">${result.filename}</td>
    `;

    row.addEventListener('click', () => {
      currentBatchPreviewIndex = index;
      renderBatchPreviewImage();
      highlightActiveBatchRow();
    });

    resultsTableBody.appendChild(row);
  });
}

function highlightActiveBatchRow() {
  const rows = document.querySelectorAll('.batch-result-row');

  rows.forEach((row, index) => {
    row.classList.remove('active-batch-row');

    if (index === currentBatchPreviewIndex) {
      row.classList.add('active-batch-row');
    }
  });
}

function renderBatchPreviewImage() {
  if (!batchResults.length) return;

  const result = batchResults[currentBatchPreviewIndex];

  if (!result || !result.imageObject) return;

  const image = result.imageObject;

  uploadedImage = image;
  uploadedImageName = result.filename;

  originalCanvas.width = image.width;
  originalCanvas.height = image.height;
  originalCtx.clearRect(0, 0, image.width, image.height);
  originalCtx.drawImage(image, 0, 0);

  renderSelectedChannelPreview(result.channelMode);

  renderBinaryMaskToCanvas(
    result.binaryMask,
    image.width,
    image.height,
    thresholdCanvas
  );

  overlayCanvas.width = image.width;
  overlayCanvas.height = image.height;

  overlayCtx.clearRect(
    0,
    0,
    overlayCanvas.width,
    overlayCanvas.height
  );

  overlayCtx.drawImage(image, 0, 0);

  clearOverlaySvg();
  drawParticleOverlay(result.particles);

  updateThresholdLabel(result.thresholdValue);

  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  if (particleCountElement) {
    particleCountElement.textContent =
      result.detectedParticleCount;
  }

  if (coverageAreaElement) {
    const totalPixels =
      result.imageWidth * result.imageHeight;

    const coverage =
      totalPixels > 0
        ? (
            (result.totalParticleArea / totalPixels) *
            100
          ).toFixed(2)
        : '0.00';

    coverageAreaElement.textContent = `${coverage}%`;
  }

  populateResultsTable(result.particles);

  const uploadDescription =
    document.querySelector('.upload-description');

  if (uploadDescription) {
    uploadDescription.textContent =
      `Viewing image ${currentBatchPreviewIndex + 1} of ${batchResults.length}: ${result.filename}`;
  }

  highlightActiveBatchRow();

  if (typeof resetZoomAndPan === 'function') {
    resetZoomAndPan();
  }
}
function exportBatchResultsToXLS() {
  if (!batchResults.length) {
    alert('No batch results available.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    [
      'Image No',
      'Filename',
      'Threshold Mode',
      'Threshold Value',
      'Detected Particles',
      'Total Particle Area',
      'Image Width',
      'Image Height'
    ]
  ];

  batchResults.forEach((result, index) => {
    summaryRows.push([
      index + 1,
      result.filename,
      result.thresholdMode,
      result.thresholdValue,
      result.detectedParticleCount,
      result.totalParticleArea,
      result.imageWidth,
      result.imageHeight
    ]);
  });

  const summarySheet =
    XLSX.utils.aoa_to_sheet(summaryRows);

  summarySheet['!cols'] = [
    { wch: 10 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    'Batch Summary'
  );

  batchResults.forEach((result, index) => {
    const particleRows = [
      [
        'Particle ID',
        'Area',
        'Perimeter',
        'Circularity',
        'Feret Diameter',
        'Aspect Ratio',
        'Mean RGB',
        'Min RGB',
        'Max RGB',
        'Centroid X',
        'Centroid Y',
        'Touches Edge'
      ]
    ];

    result.particles.forEach(particle => {
      particleRows.push([
        particle.id,
        particle.area,
        particle.perimeter,
        particle.circularity,
        particle.feretDiameter,
        particle.aspectRatio,
        particle.meanRGB,
        particle.minRGB,
        particle.maxRGB,
        Number(particle.centroidX.toFixed(2)),
        Number(particle.centroidY.toFixed(2)),
        particle.touchesEdge ? 'Yes' : 'No'
      ]);
    });

    let sheetName =
      `${index + 1}_${result.filename}`
        .replace(/\.[^/.]+$/, '')
        .substring(0, 28);

    if (!sheetName.trim()) {
      sheetName = `Image_${index + 1}`;
    }

    const particleSheet =
      XLSX.utils.aoa_to_sheet(particleRows);

    particleSheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 }
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      particleSheet,
      sheetName
    );
  });

  const now = new Date();

  const exportName =
    `batch_particle_analysis_${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')}_` +
    `${String(now.getHours()).padStart(2, '0')}-` +
    `${String(now.getMinutes()).padStart(2, '0')}.xlsx`;

  XLSX.writeFile(workbook, exportName);
}
