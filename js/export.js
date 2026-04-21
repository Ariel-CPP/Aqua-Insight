// ==============================
// EXPORT MODULE
// Aqua Insight Version 0.1
// ==============================

let latestParticleResults = [];
let latestAnalysisMetadata = {};

// ==============================
// INITIALIZATION
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  initializeExportButton();
});

function initializeExportButton() {
  const exportButton = document.getElementById('exportResultsButton');

  if (!exportButton) return;

  exportButton.addEventListener('click', () => {
    if (currentAnalysisMode === 'batch') {
      exportBatchResultsToXLS();
      return;
    }

    if (!latestParticleResults.length) {
      alert('No analysis results available for export.');
      return;
    }

    exportParticleResultsToXLS();
  });
}

// ==============================
// STORE RESULTS
// ==============================

function storeAnalysisResults(particles, metadata) {
  latestParticleResults = particles;
  latestAnalysisMetadata = metadata;
}

// ==============================
// SINGLE ANALYSIS EXPORT
// ==============================

function exportParticleResultsToXLS() {
  const workbook = XLSX.utils.book_new();

  const metadataRows = [
    ['Aqua Insight Version', '0.1'],
    ['Filename', latestAnalysisMetadata.filename || '-'],
    ['Analysis Mode', latestAnalysisMetadata.analysisMode || '-'],
    ['Threshold Mode', latestAnalysisMetadata.thresholdMode || '-'],
    ['Threshold Value', latestAnalysisMetadata.thresholdValue || '-'],
    ['Channel Mode', latestAnalysisMetadata.channelMode || '-'],
    ['Invert Threshold', latestAnalysisMetadata.invertThreshold ? 'Yes' : 'No'],
    ['Exclude Edge Particles', latestAnalysisMetadata.excludeEdgeParticles ? 'Yes' : 'No'],
    ['Minimum Particle Size', latestAnalysisMetadata.minParticleSize || 0],
    ['Maximum Particle Size', latestAnalysisMetadata.maxParticleSize || 0],
    ['Circularity Minimum', latestAnalysisMetadata.circularityMin || 0],
    ['Circularity Maximum', latestAnalysisMetadata.circularityMax || 1],
    ['Detected Particle Count', latestAnalysisMetadata.detectedParticleCount || 0],
    ['Total Particle Area', latestAnalysisMetadata.totalParticleArea || 0],
    ['Coverage Percentage', latestAnalysisMetadata.coveragePercentage || 0]
  ];

  const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);

  metadataSheet['!cols'] = [
    { wch: 30 },
    { wch: 30 }
  ];

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

  latestParticleResults.forEach(particle => {
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

  const particleSheet = XLSX.utils.aoa_to_sheet(particleRows);

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
    metadataSheet,
    'Metadata'
  );

  XLSX.utils.book_append_sheet(
    workbook,
    particleSheet,
    'Particle Results'
  );

  XLSX.writeFile(
    workbook,
    generateSingleExportFileName()
  );
}

// ==============================
// FILE NAME GENERATION
// ==============================

function generateSingleExportFileName() {
  const baseName = uploadedImageName
    ? uploadedImageName.replace(/\.[^/.]+$/, '')
    : 'particle-analysis';

  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');

  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('-');

  return `${baseName}_particle_analysis_${datePart}_${timePart}.xlsx`;
}
