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

  const uploadDescription =
    document.querySelector('.upload-description');

  if (uploadDescription) {
    uploadDescription.textContent =
      `${batchFiles.length} image(s) loaded for batch analysis`;
  }

  currentBatchPreviewIndex = 0;
}

// ==============================
// RUN BATCH ANALYSIS
// ==============================

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

    const analysisResult = analyzeBatchImage(
      image,
      file.name,
      settings
    );

    batchResults.push(analysisResult);

    totalParticles += analysisResult.detectedParticleCount;
    totalArea += analysisResult.totalParticleArea;
  }

  updateBatchSummary(totalParticles, totalArea);
  populateBatchResultsTable(batchResults);

  currentBatchPreviewIndex = 0;
  renderBatchPreviewImage();

  alert(
    `Batch analysis completed for ${batchFiles.length} image(s).`
  );
}

// ==============================
// LOAD IMAGE
// ==============================

function loadBatchImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==============================
// ANALYZE SINGLE IMAGE IN BATCH
// ==============================

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

  const imageData = tempCtx.getImageData(
    0,
    0,
    tempCanvas.width,
    tempCanvas.height
  );

  const detectionResult = runDetectionPipeline(
    tempCanvas,
    settings
  );

  const extractedParticles =
    detectionResult.particles.map(particle => {
      return extractParticleFeatures(
        particle,
        imageData,
        tempCanvas.width,
        tempCanvas.height
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
    thresholdMode: settings.thresholdMode,
    thresholdValue: detectionResult.thresholdValue,
    detectedParticleCount: filteredParticles.length,
    totalParticleArea,
    imageWidth: image.width,
    imageHeight: image.height,
    imageObject: image,
    binaryMask: detectionResult.binaryMask,
    particles: filteredParticles
  };
}

// ==============================
// SUMMARY UPDATE
// ==============================

function updateBatchSummary(totalParticles, totalArea) {
  const particleCountElement =
    document.getElementById('particleCount');

  const coverageAreaElement =
    document.getElementById('coverageArea');

  const thresholdMethodLabelElement =
    document.getElementById('thresholdMethodLabel');

  if (particleCountElement) {
    particleCountElement.textContent = totalParticles;
  }

  if (coverageAreaElement) {
    coverageAreaElement.textContent = '-';
  }

  if (
    thresholdMethodLabelElement &&
    batchResults.length > 0
  ) {
    thresholdMethodLabelElement.textContent =
      `${batchResults[0].thresholdMode}`;
  }
}
// ==============================
// TABLE DISPLAY
// ==============================

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
      <td>${result.filename}</td>
      <td>${result.detectedParticleCount}</td>
      <td>${result.totalParticleArea}</td>
      <td>${result.thresholdValue}</td>
      <td colspan="6">
        ${result.imageWidth} × ${result.imageHeight}px
      </td>
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

// ==============================
// EXPORT BATCH RESULTS
// ==============================

function exportBatchResultsToXLS() {
  if (!batchResults.length) {
    alert('No batch results available.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    [
      'Filename',
      'Threshold Mode',
      'Threshold Value',
      'Detected Particles',
      'Total Particle Area',
      'Image Width',
      'Image Height'
    ]
  ];

  batchResults.forEach(result => {
    summaryRows.push([
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

  batchResults.forEach(result => {
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

    let sheetName = result.filename
      .replace(/\.[^/.]+$/, '')
      .substring(0, 28);

    if (!sheetName.trim()) {
      sheetName =
        `Image_${Math.random().toString(36).substring(2, 8)}`;
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
  
