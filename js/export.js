// ==============================
// EXPORT MODULE (MULTI-IMAGE)
// Aqua Insight Version 0.1
// ==============================

let analysisResults = []; // array per image
let analysisMetadata = {}; // global metadata

document.addEventListener('DOMContentLoaded', () => {
  initializeExportButton();
});

// ==============================
// INIT EXPORT BUTTON
// ==============================

function initializeExportButton() {
  const exportButton =
    document.getElementById('exportResultsButton');

  if (!exportButton) return;

  exportButton.addEventListener('click', () => {
    if (!analysisResults.length) {
      alert('No analysis results available.');
      return;
    }

    exportAllResultsToXLS();
  });
}

// ==============================
// STORE RESULTS (CALLED FROM ANALYSIS)
// ==============================

function storeMultiAnalysisResults(
  resultsArray,
  metadata
) {
  analysisResults = resultsArray;
  analysisMetadata = metadata;
}

// ==============================
// EXPORT MAIN FUNCTION
// ==============================

function exportAllResultsToXLS() {
  const workbook = XLSX.utils.book_new();

  // =========================
  // GLOBAL SUMMARY SHEET
  // =========================

  const summaryRows = [
    [
      'Image No',
      'Filename',
      'Particles',
      'Coverage (%)',
      'Coverage (px)',
      'Threshold Mode',
      'Threshold Value',
      'Channel Mode'
    ]
  ];

  analysisResults.forEach((result, index) => {
    summaryRows.push([
      index + 1,
      result.filename,
      result.particles.length,
      result.coveragePercent,
      result.coveragePixels,
      result.thresholdMode,
      result.thresholdValue,
      result.channelMode
    ]);
  });

  const summarySheet =
    XLSX.utils.aoa_to_sheet(summaryRows);

  summarySheet['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    'Summary'
  );

  // =========================
  // PER IMAGE SHEETS
  // =========================

  analysisResults.forEach((result, index) => {
    const rows = [
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

    result.particles.forEach((particle, i) => {
      rows.push([
        i + 1,
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

    const sheet =
      XLSX.utils.aoa_to_sheet(rows);

    sheet['!cols'] = [
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

    let sheetName =
      `${index + 1}_${result.filename}`
        .replace(/\.[^/.]+$/, '')
        .substring(0, 28);

    if (!sheetName.trim()) {
      sheetName = `Image_${index + 1}`;
    }

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sheetName
    );
  });

  XLSX.writeFile(
    workbook,
    generateExportFileName()
  );
}

// ==============================
// FILE NAME GENERATION
// ==============================

function generateExportFileName() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    now.getDate()
  ).padStart(2, '0');

  const hours = String(
    now.getHours()
  ).padStart(2, '0');

  const minutes = String(
    now.getMinutes()
  ).padStart(2, '0');

  const seconds = String(
    now.getSeconds()
  ).padStart(2, '0');

  return (
    `aqua_insight_particle_analysis_` +
    `${year}-${month}-${day}_` +
    `${hours}-${minutes}-${seconds}.xlsx`
  );
}

// ==============================
// CLEAR STORED EXPORT DATA
// ==============================

function resetStoredExportResults() {
  analysisResults = [];
  analysisMetadata = {};
}

// ==============================
// HELPER FOR SINGLE ACTIVE IMAGE
// ==============================

function getCurrentActiveExportResult() {
  if (
    typeof currentImageIndex === 'undefined' ||
    !analysisResults.length
  ) {
    return null;
  }

  return analysisResults[currentImageIndex] || null;
}
