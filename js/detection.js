// ==============================
// DETECTION ENGINE
// Aqua Insight Version 0.1
// ==============================

function runDetectionPipeline(sourceCanvas, settings) {
  const ctx = sourceCanvas.getContext('2d');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const grayscale = extractChannelData(imageData, settings.channelMode);

  let thresholdValue = 128;

  switch (settings.thresholdMode) {
    case 'mean':
      thresholdValue = calculateMeanThreshold(grayscale);
      break;

    case 'triangle':
      thresholdValue = calculateTriangleThreshold(grayscale);
      break;

    case 'minerror':
      thresholdValue = calculateMinimumErrorThreshold(grayscale);
      break;

    case 'manual':
      thresholdValue = settings.manualThresholdValue;
      break;

    case 'otsu':
    default:
      thresholdValue = calculateOtsuThreshold(grayscale);
      break;
  }

  let binaryMask = applyThreshold(
    grayscale,
    width,
    height,
    thresholdValue,
    settings.invertThreshold
  );

  binaryMask = morphologicalOpening(binaryMask, width, height);

  const particles = connectedComponentLabeling(binaryMask, width, height);

  return {
    binaryMask,
    thresholdValue,
    particles
  };
}

// ==============================
// CHANNEL EXTRACTION
// ==============================

function extractChannelData(imageData, channelMode) {
  const data = imageData.data;
  const grayscale = new Uint8ClampedArray(data.length / 4);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    switch (channelMode) {
      case 'red':
        grayscale[j] = red;
        break;

      case 'green':
        grayscale[j] = green;
        break;

      case 'blue':
        grayscale[j] = blue;
        break;

      case 'grayscale':
      default:
        grayscale[j] = Math.round((red + green + blue) / 3);
        break;
    }
  }

  return grayscale;
}

// ==============================
// OTSU THRESHOLD
// ==============================

function calculateMeanThreshold(grayscale) {
  const total = grayscale.reduce((sum, value) => sum + value, 0);
  return Math.round(total / grayscale.length);
}

function calculateTriangleThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  grayscale.forEach(value => {
    histogram[value]++;
  });

  let left = 0;
  let right = 255;
  let peak = 0;

  for (let i = 0; i < 256; i++) {
    if (histogram[i] > histogram[peak]) {
      peak = i;
    }

    if (histogram[i] > 0 && left === 0) {
      left = i;
    }

    if (histogram[i] > 0) {
      right = i;
    }
  }

  let maxDistance = -1;
  let threshold = peak;

  for (let i = left; i <= right; i++) {
    const distance = Math.abs(
      ((right - left) * (peak - i)) -
      ((peak - left) * (right - i))
    );

    if (distance > maxDistance) {
      maxDistance = distance;
      threshold = i;
    }
  }

  return threshold;
}

function calculateMinimumErrorThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  grayscale.forEach(value => {
    histogram[value]++;
  });

  let total = grayscale.length;
  let bestThreshold = 128;
  let minimumError = Infinity;

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

    if (backgroundCount === 0 || foregroundCount === 0) continue;

    const backgroundMean = backgroundSum / backgroundCount;
    const foregroundMean = foregroundSum / foregroundCount;

    const error = Math.abs(backgroundMean - foregroundMean);

    if (error < minimumError) {
      minimumError = error;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
}

// ==============================
// THRESHOLD APPLICATION
// ==============================

function applyThreshold(grayscale, width, height, thresholdValue, invert) {
  const binaryMask = new Uint8Array(width * height);

  for (let i = 0; i < grayscale.length; i++) {
    const isForeground = invert
      ? grayscale[i] < thresholdValue
      : grayscale[i] >= thresholdValue;

    binaryMask[i] = isForeground ? 1 : 0;
  }

  return binaryMask;
}

// ==============================
// MORPHOLOGICAL OPENING
// Opening = Erosion + Dilation
// ==============================

function morphologicalOpening(binaryMask, width, height) {
  const eroded = erosion(binaryMask, width, height);
  const dilated = dilation(eroded, width, height);

  return dilated;
}

function erosion(binaryMask, width, height) {
  const output = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keepPixel = 1;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index = (y + ky) * width + (x + kx);

          if (binaryMask[index] === 0) {
            keepPixel = 0;
          }
        }
      }

      output[y * width + x] = keepPixel;
    }
  }

  return output;
}

function dilation(binaryMask, width, height) {
  const output = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let fillPixel = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index = (y + ky) * width + (x + kx);

          if (binaryMask[index] === 1) {
            fillPixel = 1;
          }
        }
      }

      output[y * width + x] = fillPixel;
    }
  }

  return output;
}

// ==============================
// CONNECTED COMPONENT LABELING
// 8-CONNECTIVITY
// ==============================

function connectedComponentLabeling(binaryMask, width, height) {
  const visited = new Uint8Array(width * height);
  const particles = [];

  let particleId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (binaryMask[index] === 1 && visited[index] === 0) {
        const particle = floodFillParticle(
          binaryMask,
          visited,
          width,
          height,
          x,
          y,
          particleId
        );

        particles.push(particle);
        particleId++;
      }
    }
  }

  return particles;
}

function floodFillParticle(binaryMask, visited, width, height, startX, startY, particleId) {
  const stack = [[startX, startY]];
  const pixels = [];

  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack.pop();

    pixels.push({ x, y });

    for (let ny = y - 1; ny <= y + 1; ny++) {
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height
        ) {
          const neighborIndex = ny * width + nx;

          if (
            binaryMask[neighborIndex] === 1 &&
            visited[neighborIndex] === 0
          ) {
            visited[neighborIndex] = 1;
            stack.push([nx, ny]);
          }
        }
      }
    }
  }

  return {
    id: particleId,
    pixels
  };
}

// ==============================
// BINARY MASK RENDER
// ==============================

function renderBinaryMaskToCanvas(binaryMask, width, height, canvas) {
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < binaryMask.length; i++) {
    const value = binaryMask[i] === 1 ? 255 : 0;

    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
function drawParticleOverlay(particles) {
  const overlaySvg = document.getElementById('overlaySvg');

  if (!overlaySvg || !uploadedImage) return;

  overlaySvg.innerHTML = '';

  overlaySvg.setAttribute('width', uploadedImage.width);
  overlaySvg.setAttribute('height', uploadedImage.height);
  overlaySvg.setAttribute('viewBox', `0 0 ${uploadedImage.width} ${uploadedImage.height}`);

  particles.forEach(particle => {
    if (!particle.pixels.length) return;

    const centroid = calculateParticleCentroid(particle.pixels);

    const bounds = calculateParticleBounds(particle.pixels);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', bounds.minX);
    rect.setAttribute('y', bounds.minY);
    rect.setAttribute('width', bounds.maxX - bounds.minX);
    rect.setAttribute('height', bounds.maxY - bounds.minY);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#38bdf8');
    rect.setAttribute('stroke-width', '1');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', centroid.x);
    text.setAttribute('y', centroid.y);
    text.setAttribute('fill', '#38bdf8');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = particle.id;

    overlaySvg.appendChild(rect);
    overlaySvg.appendChild(text);
  });
}

function populateResultsTable(particles) {
  const resultsTableBody = document.getElementById('resultsTableBody');

  if (!resultsTableBody) return;

  if (!particles.length) {
    resetResultsTable();
    return;
  }

  resultsTableBody.innerHTML = '';

  particles.forEach(particle => {
    const area = particle.pixels.length;
    const centroid = calculateParticleCentroid(particle.pixels);
    const bounds = calculateParticleBounds(particle.pixels);

    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    const aspectRatio = height === 0 ? 0 : (width / height).toFixed(2);

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${particle.id}</td>
      <td>${area}</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>${aspectRatio}</td>
      <td>-</td>
      <td>${centroid.x.toFixed(1)}</td>
      <td>${centroid.y.toFixed(1)}</td>
      <td>${isParticleTouchingEdge(bounds) ? 'Yes' : 'No'}</td>
    `;

    resultsTableBody.appendChild(row);
  });
}

function calculateParticleCentroid(pixels) {
  let sumX = 0;
  let sumY = 0;

  pixels.forEach(pixel => {
    sumX += pixel.x;
    sumY += pixel.y;
  });

  return {
    x: sumX / pixels.length,
    y: sumY / pixels.length
  };
}

function calculateParticleBounds(pixels) {
  const xValues = pixels.map(pixel => pixel.x);
  const yValues = pixels.map(pixel => pixel.y);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues)
  };
}

function isParticleTouchingEdge(bounds) {
  if (!uploadedImage) return false;

  return (
    bounds.minX <= 0 ||
    bounds.minY <= 0 ||
    bounds.maxX >= uploadedImage.width - 1 ||
    bounds.maxY >= uploadedImage.height - 1
  );
}
