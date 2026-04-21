// ==============================
// EXPORT MODULE
// Aqua Insight Version 0.1
// ==============================

let analysisResults = [];
let analysisMetadata = {};

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeExportButton();
});

function initializeExportButton() {
  const exportButton = document.getElementById(
    'exportResultsButton'
  );

  if (!exportButton) {
    return;
  }

  exportButton.addEventListener('click', () => {
    if (!analysisResults.length) {
      alert('No analysis results available.');
      return;
    }

    exportAllResultsToXLS();
  });
}

// ==============================
// STORE RESULTS
// ==============================

function storeMultiAnalysisResults(
  resultsArray,
  metadata = {}
) {
  analysisResults = resultsArray || [];

  analysisMetadata = {
    exportDate: new Date().toLocaleString(),
    ...metadata
  };
}

// ==============================
// EXPORT MAIN FUNCTION
// ==============================

function exportAllResultsToXLS() {
  const workbook = XLSX.utils.book_new();

  // =========================
  // METADATA SHEET
  // =========================

  const metadataRows = [
    ['Parameter', 'Value'],
    ['Export Date', analysisMetadata.exportDate || '-'],
    ['Channel Mode', analysisMetadata.channelMode || '-'],
    ['Threshold Mode', analysisMetadata.thresholdMode || '-'],
    ['Threshold Value', analysisMetadata.thresholdValue || '-'],
    ['Manual Threshold Value', analysisMetadata.manualThresholdValue || '-'],
    ['Minimum Overlay Area', analysisMetadata.minimumOverlayArea || '-'],
    ['Minimum Particle Size', analysisMetadata.minParticleSize || '-'],
    ['Maximum Particle Size', analysisMetadata.maxParticleSize || '-'],
    ['Circularity Minimum', analysisMetadata.circularityMin || '-'],
    ['Circularity Maximum', analysisMetadata.circularityMax || '-'],
    ['Invert Threshold', analysisMetadata.invertThreshold ? 'Yes' : 'No'],
    ['Exclude Edge Particles', analysisMetadata.excludeEdgeParticles ? 'Yes' : 'No'],
    ['Use Background Picker', analysisMetadata.useBackgroundPicker ? 'Yes' : 'No'],
    ['Background Pixel', analysisMetadata.backgroundPixel ?? '-']
  ];

  const metadataSheet = XLSX.utils.aoa_to_sheet(
    metadataRows
  );

  metadataSheet['!cols'] = [
    { wch: 32 },
    { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    metadataSheet,
    'Metadata'
  );

  // =========================
  // SUMMARY SHEET
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
      'Channel Mode',
      'Image Width',
      'Image Height'
    ]
  ];

  analysisResults.forEach((result, index) => {
    summaryRows.push([
      index + 1,
      result.filename || `Image_${index + 1}`,
      result.particles?.length || 0,
      result.coveragePercent || 0,
      result.coveragePixels || 0,
      result.thresholdMode || '-',
      result.thresholdValue || '-',
      result.channelMode || '-',
      result.width || '-',
      result.height || '-'
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(
    summaryRows
  );

  summarySheet['!cols'] = [
    { wch: 10 },
    { wch: 35 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    'Summary'
  );

  // =========================
  // PARTICLE DETAIL SHEETS
  // =========================

  analysisResults.forEach((result, index) => {
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

    if (result.particles && result.particles.length) {
      result.particles.forEach((particle, particleIndex) => {
        particleRows.push([
          particleIndex + 1,
          particle.area ?? '-',
          particle.perimeter ?? '-',
          particle.circularity ?? '-',
          particle.feretDiameter ?? '-',
          particle.aspectRatio ?? '-',
          particle.meanRGB ?? '-',
          particle.minRGB ?? '-',
          particle.maxRGB ?? '-',
          particle.centroidX ?? '-',
          particle.centroidY ?? '-',
          particle.touchesEdge ? 'Yes' : 'No'
        ]);
      });
    } else {
      particleRows.push([
        'No particles detected'
      ]);
    }

```javascript
    const particleSheet = XLSX.utils.aoa_to_sheet(
      particleRows
    );

    particleSheet['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
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

    let sheetName = (
      `${index + 1}_${result.filename || 'Image'}`
    )
      .replace(/\.[^/.]+$/, '')
      .replace(/[\\/*?:\[\]]/g, '')
      .substring(0, 31);

    if (!sheetName.trim()) {
      sheetName = `Image_${index + 1}`;
    }

    XLSX.utils.book_append_sheet(
      workbook,
      particleSheet,
      sheetName
    );
  });

  // =========================
  // FINAL EXPORT
  // =========================

  XLSX.writeFile(
    workbook,
    generateExportFileName()
  );
}

// ==============================
// FILE NAME GENERATOR
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

  return `AquaInsight_Export_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`;
}

// ==============================
// BUILD EXPORT METADATA
// ==============================

function buildExportMetadata(settings) {
  return {
    exportDate: new Date().toLocaleString(),
    channelMode: settings.channelMode,
    thresholdMode: settings.thresholdMode,
    thresholdValue: settings.thresholdValue,
    manualThresholdValue: settings.manualThresholdValue,
    minimumOverlayArea: settings.minimumOverlayArea,
    minParticleSize: settings.minParticleSize,
    maxParticleSize: settings.maxParticleSize,
    circularityMin: settings.circularityMin,
    circularityMax: settings.circularityMax,
    invertThreshold: settings.invertThreshold,
    excludeEdgeParticles: settings.excludeEdgeParticles,
    useBackgroundPicker: settings.useBackgroundPicker,
    backgroundPixel: settings.backgroundPixel
  };
}

// ==============================
// QUICK EXPORT PREVIEW OBJECT
// ==============================

function getExportPreviewData() {
  return {
    totalImages: analysisResults.length,
    totalParticles: analysisResults.reduce(
      (sum, result) => {
        return sum + (
          result.particles?.length || 0
        );
      },
      0
    ),
    metadata: analysisMetadata,
    results: analysisResults
  };
}

// ==============================
// EXPORT RESET
// ==============================

function resetStoredExportData() {
  analysisResults = [];
  analysisMetadata = {};
}
