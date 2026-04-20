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

  imageUpload.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);

    if (currentAnalysisMode === 'batch') {
      handleBatchFiles(files);
    }
  });

  const runAnalysisButton = document.getElementById('runAnalysisButton');

  if (runAnalysisButton) {
    runAnalysisButton.addEventListener('click', () => {
      if (currentAnalysisMode === 'batch') {
        runBatchAnalysis();
      }
    });
  }
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

  const uploadDescription = document.querySelector('.upload-description');

  if (uploadDescription) {
    uploadDescription.textContent =
      `${batchFiles.length} image(s) loaded for batch analysis`;
  }
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

    const analysisResult = analyzeBatchImage(image, file.name, settings);

    batchResults.push(analysisResult);

    totalParticles += analysisResult.detectedParticleCount;
    totalArea += analysisResult.totalParticleArea;
  }

  document.getElementById('particleCount').textContent = totalParticles;
  document.getElementById('totalParticleArea').textContent = `${totalArea} px²`;

  populateBatchResultsTable(batchResults);

  alert(`Batch analysis completed for ${batchFiles.length} image(s).`);
}

// ==============================
// LOAD IMAGE
// ==============================

function loadBatchImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
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

function analyzeBatchImage(image, filename, settings) {
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

  const detectionResult = runDetectionPipeline(tempCanvas, settings);

  const extractedParticles = detectionResult.particles.map(particle => {
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

    return validArea && validCircularity && validEdge;
  });

  const totalParticleArea = filteredParticles.reduce((sum, particle) => {
    return sum + particle.area;
  }, 0);

  return {
    filename,
    thresholdValue: detectionResult.thresholdValue,
    detectedParticleCount: filteredParticles.length,
    totalParticleArea,
    particles: filteredParticles
  };
}

// ==============================
// TABLE DISPLAY
// ==============================

function populateBatchResultsTable(results) {
  const resultsTableBody = document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  resultsTableBody.innerHTML = '';

  results.forEach(result => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td colspan="2">${result.filename}</td>
      <td>${result.detectedParticleCount}</td>
      <td>${result.totalParticleArea}</td>
      <td>${result.thresholdValue}</td>
      <td colspan="5">Batch Summary</td>
    `;

    resultsTableBody.appendChild(row);
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
      'Detected Particles',
      'Total Particle Area',
      'Threshold Value'
    ]
  ];

  batchResults.forEach(result => {
    summaryRows.push([
      result.filename,
      result.detectedParticleCount,
      result.totalParticleArea,
      result.thresholdValue
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  summarySheet['!cols'] = [
    { wch: 40 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Batch Summary');

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
        Number(particle.centroidX.toFixed(2)),
        Number(particle.centroidY.toFixed(2)),
        particle.touchesEdge ? 'Yes' : 'No'
      ]);
    });

    const sheetName = result.filename.substring(0, 28);

    const particleSheet = XLSX.utils.aoa_to_sheet(particleRows);

    XLSX.utils.book_append_sheet(
      workbook,
      particleSheet,
      sheetName
    );
  });

  const now = new Date();
  const exportName = `batch_particle_analysis_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;

  XLSX.writeFile(workbook, exportName);
}
