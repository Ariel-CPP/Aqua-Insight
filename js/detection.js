// ==============================
// DETECTION ENGINE
// Aqua Insight Version 0.1
// ==============================

function runDetectionPipeline(sourceCanvas, settings) {
  const ctx = sourceCanvas.getContext('2d');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const imageData = ctx.getImageData(
    0,
    0,
    width,
    height
  );

  const channelData = extractChannelData(
    imageData,
    settings.channelMode
  );

  const thresholdValue = calculateThresholdValue(
    channelData,
    settings
  );

  let binaryMask = applyThreshold(
    channelData,
    width,
    height,
    thresholdValue,
    settings.invertThreshold,
    settings.backgroundPixel
  );

  binaryMask = morphologicalOpening(
    binaryMask,
    width,
    height
  );

  const labeledParticles = connectedComponentLabeling(
    binaryMask,
    width,
    height
  );

  return {
    channelData,
    binaryMask,
    thresholdValue,
    particles: labeledParticles
  };
}

// ==============================
// CHANNEL EXTRACTION
// ==============================

function extractChannelData(
  imageData,
  channelMode
) {
  const data = imageData.data;

  const output = new Uint8ClampedArray(
    data.length / 4
  );

  for (
    let pixelIndex = 0, channelIndex = 0;
    pixelIndex < data.length;
    pixelIndex += 4, channelIndex++
  ) {
    const red = data[pixelIndex];
    const green = data[pixelIndex + 1];
    const blue = data[pixelIndex + 2];

    switch (channelMode) {
      case 'red':
        output[channelIndex] = red;
        break;

      case 'green':
        output[channelIndex] = green;
        break;

      case 'blue':
        output[channelIndex] = blue;
        break;

      case 'grayscale':
      default:
        output[channelIndex] = Math.round(
          red * 0.299 +
          green * 0.587 +
          blue * 0.114
        );
        break;
    }
  }

  return output;
}

// ==============================
// THRESHOLD CONTROLLER
// ==============================

function calculateThresholdValue(
  grayscale,
  settings
) {
  switch (settings.thresholdMode) {
    case 'mean':
      return calculateMeanThreshold(grayscale);

    case 'triangle':
      return calculateTriangleThreshold(grayscale);

    case 'minerror':
      return calculateMinimumErrorThreshold(grayscale);

    case 'manual':
      return Number(
        settings.manualThresholdValue || 128
      );

    case 'otsu':
    default:
      return calculateOtsuThreshold(grayscale);
  }
}

// ==============================
// HISTOGRAM UTILITY
// ==============================

function buildHistogram(grayscale) {
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < grayscale.length; i++) {
    histogram[grayscale[i]]++;
  }

  return histogram;
}

// ==============================
// OTSU THRESHOLD
// ==============================

function calculateOtsuThreshold(grayscale) {
  const histogram = buildHistogram(grayscale);

  const totalPixels = grayscale.length;

  let totalIntensity = 0;

  for (let i = 0; i < 256; i++) {
    totalIntensity += i * histogram[i];
  }

  let backgroundWeight = 0;
  let foregroundWeight = 0;

  let backgroundIntensity = 0;

  let bestVariance = -1;
  let bestThreshold = 128;

  for (let threshold = 0; threshold < 256; threshold++) {
    backgroundWeight += histogram[threshold];

    if (backgroundWeight === 0) {
      continue;
    }

    foregroundWeight =
      totalPixels - backgroundWeight;

    if (foregroundWeight === 0) {
      break;
    }

    backgroundIntensity +=
      threshold * histogram[threshold];

    const backgroundMean =
      backgroundIntensity / backgroundWeight;

    const foregroundMean =
      (totalIntensity - backgroundIntensity) /
      foregroundWeight;

    const betweenClassVariance =
      backgroundWeight *
      foregroundWeight *
      Math.pow(
        backgroundMean - foregroundMean,
        2
      );

    if (betweenClassVariance > bestVariance) {
      bestVariance = betweenClassVariance;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
}

// ==============================
// MEAN THRESHOLD
// ==============================

function calculateMeanThreshold(grayscale) {
  let sum = 0;

  for (let i = 0; i < grayscale.length; i++) {
    sum += grayscale[i];
  }

  return Math.round(sum / grayscale.length);
}

// ==============================
// TRIANGLE THRESHOLD
// ==============================

function calculateTriangleThreshold(grayscale) {
  const histogram = buildHistogram(grayscale);

  let peakIndex = 0;

  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > histogram[peakIndex]) {
      peakIndex = i;
    }
  }

```javascript
  let leftBoundary = 0;
  let rightBoundary = 255;

  while (
    leftBoundary < 255 &&
    histogram[leftBoundary] === 0
  ) {
    leftBoundary++;
  }

  while (
    rightBoundary > 0 &&
    histogram[rightBoundary] === 0
  ) {
    rightBoundary--;
  }

  let maxDistance = -1;
  let bestThreshold = peakIndex;

  for (
    let intensity = leftBoundary;
    intensity <= rightBoundary;
    intensity++
  ) {
    const distance = Math.abs(
      (
        (rightBoundary - leftBoundary) *
        (peakIndex - intensity)
      ) -
      (
        (peakIndex - leftBoundary) *
        (rightBoundary - intensity)
      )
    );

    if (distance > maxDistance) {
      maxDistance = distance;
      bestThreshold = intensity;
    }
  }

  return bestThreshold;
}

// ==============================
// MINIMUM ERROR THRESHOLD
// ==============================

function calculateMinimumErrorThreshold(grayscale) {
  const histogram = buildHistogram(grayscale);

  let bestThreshold = 128;
  let minimumDifference = Infinity;

  for (let threshold = 1; threshold < 255; threshold++) {
    let backgroundCount = 0;
    let foregroundCount = 0;

    let backgroundSum = 0;
    let foregroundSum = 0;

    for (let i = 0; i <= threshold; i++) {
      backgroundCount += histogram[i];
      backgroundSum += histogram[i] * i;
    }

    for (let i = threshold + 1; i < 256; i++) {
      foregroundCount += histogram[i];
      foregroundSum += histogram[i] * i;
    }

    if (
      backgroundCount === 0 ||
      foregroundCount === 0
    ) {
      continue;
    }

    const backgroundMean =
      backgroundSum / backgroundCount;

    const foregroundMean =
      foregroundSum / foregroundCount;

    const meanDifference = Math.abs(
      foregroundMean - backgroundMean
    );

    if (meanDifference < minimumDifference) {
      minimumDifference = meanDifference;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
}

// ==============================
// APPLY THRESHOLD
// ==============================

function applyThreshold(
  grayscale,
  width,
  height,
  thresholdValue,
  invertThreshold,
  backgroundPixel
) {
  const binaryMask = new Uint8Array(
    width * height
  );

  for (let i = 0; i < grayscale.length; i++) {
    const pixelValue = grayscale[i];

    let isForeground = invertThreshold
      ? pixelValue < thresholdValue
      : pixelValue >= thresholdValue;

    if (
      backgroundPixel !== null &&
      backgroundPixel !== undefined
    ) {
      const difference = Math.abs(
        pixelValue - backgroundPixel
      );

      if (difference <= 10) {
        isForeground = false;
      }
    }

    binaryMask[i] = isForeground ? 1 : 0;
  }

  return binaryMask;
}

// ==============================
// MORPHOLOGICAL OPENING
// ==============================

function morphologicalOpening(
  binaryMask,
  width,
  height
) {
  const eroded = erosion(
    binaryMask,
    width,
    height
  );

  const dilated = dilation(
    eroded,
    width,
    height
  );

  return dilated;
}

// ==============================
// EROSION
// ==============================

function erosion(
  binaryMask,
  width,
  height
) {
  const output = new Uint8Array(
    width * height
  );

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keepPixel = true;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const neighborIndex =
            (y + ky) * width + (x + kx);

          if (binaryMask[neighborIndex] === 0) {
            keepPixel = false;
            break;
          }
        }

        if (!keepPixel) {
          break;
        }
      }

      output[y * width + x] = keepPixel ? 1 : 0;
    }
  }

  return output;
}

// ==============================
// DILATION
// ==============================

function dilation(
  binaryMask,
  width,
  height
) {
  const output = new Uint8Array(
    width * height
  );

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let fillPixel = false;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const neighborIndex =
            (y + ky) * width + (x + kx);

          if (binaryMask[neighborIndex] === 1) {
            fillPixel = true;
            break;
          }
        }

        if (fillPixel) {
          break;
        }
      }

      output[y * width + x] = fillPixel ? 1 : 0;
    }
  }

  return output;
}

```javascript
// ==============================
// CONNECTED COMPONENT LABELING
// ==============================

function connectedComponentLabeling(
  binaryMask,
  width,
  height
) {
  const visited = new Uint8Array(
    width * height
  );

  const particles = [];

  let particleId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (
        binaryMask[index] === 0 ||
        visited[index] === 1
      ) {
        continue;
      }

      const particle = floodFillParticle(
        binaryMask,
        visited,
        width,
        height,
        x,
        y,
        particleId
      );

      if (particle.pixels.length > 0) {
        particles.push(particle);
        particleId++;
      }
    }
  }

  return particles;
}

// ==============================
// FLOOD FILL PARTICLE EXTRACTION
// ==============================

function floodFillParticle(
  binaryMask,
  visited,
  width,
  height,
  startX,
  startY,
  particleId
) {
  const stack = [];

  stack.push({
    x: startX,
    y: startY
  });

  const pixels = [];

  let touchesEdge = false;

  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;

  while (stack.length > 0) {
    const current = stack.pop();

    const x = current.x;
    const y = current.y;

    if (
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= height
    ) {
      continue;
    }

    const index = y * width + x;

    if (
      visited[index] === 1 ||
      binaryMask[index] === 0
    ) {
      continue;
    }

    visited[index] = 1;

    pixels.push({ x, y });

    if (
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1
    ) {
      touchesEdge = true;
    }

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    // 8-connectivity neighbors
    stack.push({ x: x - 1, y: y - 1 });
    stack.push({ x: x, y: y - 1 });
    stack.push({ x: x + 1, y: y - 1 });
    stack.push({ x: x - 1, y: y });
    stack.push({ x: x + 1, y: y });
    stack.push({ x: x - 1, y: y + 1 });
    stack.push({ x: x, y: y + 1 });
    stack.push({ x: x + 1, y: y + 1 });
  }

  return {
    id: particleId,
    pixels,
    area: pixels.length,
    touchesEdge,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// ==============================
// BINARY MASK TO IMAGE DATA
// ==============================

function createBinaryImageData(
  binaryMask,
  width,
  height
) {
  const imageData = new ImageData(
    width,
    height
  );

  const data = imageData.data;

  for (let i = 0; i < binaryMask.length; i++) {
    const pixelValue = binaryMask[i] === 1
      ? 255
      : 0;

    const dataIndex = i * 4;

    data[dataIndex] = pixelValue;
    data[dataIndex + 1] = pixelValue;
    data[dataIndex + 2] = pixelValue;
    data[dataIndex + 3] = 255;
  }

  return imageData;
}

// ==============================
// BINARY MASK RENDERER
// ==============================

function renderBinaryMaskToCanvas(
  binaryMask,
  width,
  height,
  targetCanvas
) {
  if (!targetCanvas) {
    return;
  }

  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext('2d');

  const imageData = createBinaryImageData(
    binaryMask,
    width,
    height
  );

  ctx.putImageData(imageData, 0, 0);
}

// ==============================
// CHANNEL PREVIEW IMAGE DATA
// ==============================

function createChannelPreviewImageData(
  sourceImageData,
  channelMode
) {
  const previewImageData = new ImageData(
    sourceImageData.width,
    sourceImageData.height
  );

  const source = sourceImageData.data;
  const output = previewImageData.data;

  for (let i = 0; i < source.length; i += 4) {
    const red = source[i];
    const green = source[i + 1];
    const blue = source[i + 2];

```javascript
    switch (channelMode) {
      case 'red':
        output[i] = red;
        output[i + 1] = 0;
        output[i + 2] = 0;
        break;

      case 'green':
        output[i] = 0;
        output[i + 1] = green;
        output[i + 2] = 0;
        break;

      case 'blue':
        output[i] = 0;
        output[i + 1] = 0;
        output[i + 2] = blue;
        break;

      case 'grayscale':
      default:
        const gray = Math.round(
          red * 0.299 +
          green * 0.587 +
          blue * 0.114
        );

        output[i] = gray;
        output[i + 1] = gray;
        output[i + 2] = gray;
        break;
    }

    output[i + 3] = 255;
  }

  return previewImageData;
}

// ==============================
// CHANNEL PREVIEW RENDERER
// ==============================

function renderChannelPreview(
  sourceCanvas,
  targetCanvas,
  channelMode
) {
  if (!sourceCanvas || !targetCanvas) {
    return;
  }

  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;

  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');

  const sourceImageData = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const previewImageData =
    createChannelPreviewImageData(
      sourceImageData,
      channelMode
    );

  targetCtx.putImageData(
    previewImageData,
    0,
    0
  );
}

// ==============================
// OVERLAY SVG RESET
// ==============================

function clearOverlaySvg() {
  const svg = document.getElementById(
    'overlaySvg'
  );

  if (!svg) {
    return;
  }

  svg.innerHTML = '';
}

// ==============================
// OVERLAY DRAWER
// ==============================

function drawParticleOverlay(
  particles,
  width,
  height
) {
  const svg = document.getElementById(
    'overlaySvg'
  );

  if (!svg) {
    return;
  }

  clearOverlaySvg();

  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute(
    'viewBox',
    `0 0 ${width} ${height}`
  );

  const settings = getCurrentSettings();

  particles.forEach((particle, index) => {
    if (!particle.pixels || particle.pixels.length < 3) {
      return;
    }

    const boundaryPoints = extractBoundaryPoints(
      particle.pixels
    );

    if (!boundaryPoints.length) {
      return;
    }

    const smoothedPoints = smoothBoundaryPoints(
      boundaryPoints
    );

    const polygon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polygon'
    );

    polygon.setAttribute(
      'points',
      smoothedPoints
        .map(point => `${point.x},${point.y}`)
        .join(' ')
    );

    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#00ffff');
    polygon.setAttribute('stroke-width', '1');
    polygon.setAttribute('stroke-linejoin', 'round');
    polygon.setAttribute('stroke-linecap', 'round');

    svg.appendChild(polygon);

    if (
      particle.area >=
      settings.minimumOverlayArea
    ) {
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );

      text.setAttribute('x', particle.centroidX);
      text.setAttribute('y', particle.centroidY);
      text.setAttribute('fill', '#00ffff');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', '700');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');

      text.textContent = index + 1;

      svg.appendChild(text);
    }
  });
}

// ==============================
// BOUNDARY EXTRACTION
// ==============================

function extractBoundaryPoints(pixels) {
  const pointSet = new Set();

  pixels.forEach(pixel => {
    pointSet.add(`${pixel.x},${pixel.y}`);
  });

  const boundary = [];

  pixels.forEach(pixel => {
    const neighbors = [
      `${pixel.x - 1},${pixel.y}`,
      `${pixel.x + 1},${pixel.y}`,
      `${pixel.x},${pixel.y - 1}`,
      `${pixel.x},${pixel.y + 1}`
    ];

    const isBoundary = neighbors.some(neighbor => {
      return !pointSet.has(neighbor);
    });

    if (isBoundary) {
      boundary.push({
        x: pixel.x,
        y: pixel.y
      });
    }
  });

  return boundary;
}

```javascript
// ==============================
// BOUNDARY SMOOTHING
// ==============================

function smoothBoundaryPoints(
  boundaryPoints,
  smoothingFactor = 2
) {
  if (
    !boundaryPoints ||
    boundaryPoints.length < 5
  ) {
    return boundaryPoints;
  }

  const smoothed = [];

  for (let i = 0; i < boundaryPoints.length; i++) {
    let totalX = 0;
    let totalY = 0;
    let count = 0;

    for (
      let offset = -smoothingFactor;
      offset <= smoothingFactor;
      offset++
    ) {
      let neighborIndex = i + offset;

      if (neighborIndex < 0) {
        neighborIndex = 0;
      }

      if (neighborIndex >= boundaryPoints.length) {
        neighborIndex = boundaryPoints.length - 1;
      }

      totalX += boundaryPoints[neighborIndex].x;
      totalY += boundaryPoints[neighborIndex].y;
      count++;
    }

    smoothed.push({
      x: totalX / count,
      y: totalY / count
    });
  }

  return smoothed;
}

// ==============================
// CURRENT SETTINGS COLLECTOR
// ==============================

function getCurrentSettings() {
  return {
    channelMode:
      document.getElementById('channelMode')?.value ||
      'grayscale',

    thresholdMode:
      document.getElementById('thresholdMode')?.value ||
      'otsu',

    manualThresholdValue: Number(
      document.getElementById('manualThresholdValue')?.value ||
      128
    ),

    minimumOverlayArea: Number(
      document.getElementById('minimumOverlayArea')?.value ||
      50
    ),

    minParticleSize: Number(
      document.getElementById('minParticleSize')?.value ||
      0
    ),

    maxParticleSize: Number(
      document.getElementById('maxParticleSize')?.value ||
      999999
    ),

    circularityMin: Number(
      document.getElementById('circularityMin')?.value ||
      0
    ),

    circularityMax: Number(
      document.getElementById('circularityMax')?.value ||
      1
    ),

    invertThreshold:
      document.getElementById('invertThreshold')?.checked ||
      false,

    excludeEdgeParticles:
      document.getElementById('excludeEdgeParticles')?.checked ||
      false,

    useBackgroundPicker:
      document.getElementById('useBackgroundPicker')?.checked ||
      false,

    backgroundPixel:
      typeof selectedBackgroundPixel !== 'undefined'
        ? selectedBackgroundPixel
        : null
  };
}

// ==============================
// TABLE RESET
// ==============================

function resetResultsTable() {
  const tableBody = document.getElementById(
    'resultsTableBody'
  );

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="12" class="empty-table-message">
        No analysis results available
      </td>
    </tr>
  `;
}

// ==============================
// TABLE POPULATOR
// ==============================

function populateResultsTable(particles) {
  const tableBody = document.getElementById(
    'resultsTableBody'
  );

  if (!tableBody) {
    return;
  }

  if (!particles || particles.length === 0) {
    resetResultsTable();
    return;
  }

  tableBody.innerHTML = '';

  particles.forEach((particle, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${particle.area}</td>
      <td>${particle.perimeter.toFixed(2)}</td>
      <td>${particle.circularity.toFixed(3)}</td>
      <td>${particle.feretDiameter.toFixed(2)}</td>
      <td>${particle.aspectRatio.toFixed(2)}</td>
      <td>${particle.meanRGB}</td>
      <td>${particle.minRGB}</td>
      <td>${particle.maxRGB}</td>
      <td>${particle.centroidX.toFixed(2)}</td>
      <td>${particle.centroidY.toFixed(2)}</td>
      <td>${particle.touchesEdge ? 'Yes' : 'No'}</td>
    `;

    tableBody.appendChild(row);
  });
}

// ==============================
// SUMMARY UPDATE
// ==============================

function updateSummaryDisplay(result) {
  updateSummaryValue(
    'activeImageSummary',
    result.filename || '-'
  );

  updateSummaryValue(
    'particleCount',
    result.particles?.length || 0
  );

  updateSummaryValue(
    'coverageArea',
    `${result.coveragePercent || 0}%`
  );

  updateSummaryValue(
    'coveragePixelArea',
    `${result.coveragePixels || 0} px`
  );

```javascript
  updateSummaryValue(
    'thresholdMethodLabel',
    result.thresholdMode || '-'
  );

  updateSummaryValue(
    'thresholdValueLabel',
    result.thresholdValue || '-'
  );

  updateSummaryValue(
    'channelModeLabel',
    result.channelMode || '-'
  );

  updateSummaryValue(
    'imageSizeLabel',
    `${result.width || 0} × ${result.height || 0}`
  );
}

function updateSummaryValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value;
}

// ==============================
// SUMMARY RESET
// ==============================

function resetSummaryDisplay() {
  updateSummaryValue('activeImageSummary', '-');
  updateSummaryValue('particleCount', '0');
  updateSummaryValue('coverageArea', '0%');
  updateSummaryValue('coveragePixelArea', '0 px');
  updateSummaryValue('thresholdMethodLabel', '-');
  updateSummaryValue('thresholdValueLabel', '-');
  updateSummaryValue('channelModeLabel', '-');
  updateSummaryValue('imageSizeLabel', '-');
}

// ==============================
// OVERLAY RESET
// ==============================

function resetOverlayCanvas() {
  const overlayCanvas = document.getElementById(
    'overlayCanvas'
  );

  if (!overlayCanvas) {
    return;
  }

  const ctx = overlayCanvas.getContext('2d');

  ctx.clearRect(
    0,
    0,
    overlayCanvas.width,
    overlayCanvas.height
  );

  clearOverlaySvg();
}

// ==============================
// PREVIEW RESET
// ==============================

function resetPreviewCanvases() {
  const canvasIds = [
    'originalCanvas',
    'channelCanvas',
    'thresholdCanvas',
    'overlayCanvas'
  ];

  canvasIds.forEach(canvasId => {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  });

  clearOverlaySvg();
}

// ==============================
// FULL UI RESET
// ==============================

function resetAnalysisUI() {
  resetPreviewCanvases();
  resetOverlayCanvas();
  resetResultsTable();
  resetSummaryDisplay();
}

// ==============================
// MANUAL THRESHOLD VISIBILITY
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  const thresholdMode = document.getElementById(
    'thresholdMode'
  );

  const manualThresholdGroup = document.getElementById(
    'manualThresholdGroup'
  );

  if (!thresholdMode || !manualThresholdGroup) {
    return;
  }

  function updateManualThresholdVisibility() {
    if (thresholdMode.value === 'manual') {
      manualThresholdGroup.style.display = 'block';
    } else {
      manualThresholdGroup.style.display = 'none';
    }
  }

  thresholdMode.addEventListener(
    'change',
    updateManualThresholdVisibility
  );

  updateManualThresholdVisibility();
});

// ==============================
// THRESHOLD PREVIEW AUTO UPDATE
// ==============================

document.addEventListener('DOMContentLoaded', () => {
  const triggerIds = [
    'channelMode',
    'thresholdMode',
    'manualThresholdValue',
    'invertThreshold'
  ];

  triggerIds.forEach(id => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.addEventListener('change', () => {
      if (
        typeof renderBinaryPreview === 'function'
      ) {
        renderBinaryPreview();
      }

      if (
        typeof renderSelectedChannelPreview === 'function'
      ) {
        renderSelectedChannelPreview();
      }
    });
  });
});
