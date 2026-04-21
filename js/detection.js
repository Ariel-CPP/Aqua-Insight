// ==============================
// DETECTION MODULE
// Aqua Insight Version 0.1
// ==============================

function runDetectionPipeline(
  sourceCanvas,
  settings
) {
  const ctx = sourceCanvas.getContext('2d');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const imageData = ctx.getImageData(
    0,
    0,
    width,
    height
  );

  const grayscalePixels = extractChannelPixels(
    imageData.data,
    settings.channelMode
  );

  let thresholdValue = calculateThresholdValue(
    grayscalePixels,
    settings
  );

  let binaryMask = applyThreshold(
    grayscalePixels,
    thresholdValue,
    settings.invertThreshold
  );

  if (
    settings.useBackgroundPicker &&
    settings.backgroundPixel !== null
  ) {
    binaryMask = removeBackgroundPixels(
      grayscalePixels,
      binaryMask,
      settings.backgroundPixel
    );
  }

  binaryMask = morphologicalOpening(
    binaryMask,
    width,
    height
  );

  const particles = connectedComponentLabeling(
    binaryMask,
    width,
    height
  );

  return {
    thresholdValue,
    binaryMask,
    particles
  };
}

// ==============================
// CHANNEL EXTRACTION
// ==============================

function extractChannelPixels(
  pixelData,
  channelMode
) {
  const result = new Uint8Array(
    pixelData.length / 4
  );

  for (
    let i = 0, pixelIndex = 0;
    i < pixelData.length;
    i += 4, pixelIndex++
  ) {
    const red = pixelData[i];
    const green = pixelData[i + 1];
    const blue = pixelData[i + 2];

    let value = 0;

    switch (channelMode) {
      case 'red':
        value = red;
        break;

      case 'green':
        value = green;
        break;

      case 'blue':
        value = blue;
        break;

      case 'grayscale':
      default:
        value = Math.round(
          red * 0.299 +
          green * 0.587 +
          blue * 0.114
        );
        break;
    }

    result[pixelIndex] = value;
  }

  return result;
}

// ==============================
// THRESHOLD SELECTION
// ==============================

function calculateThresholdValue(
  grayscalePixels,
  settings
) {
  switch (settings.thresholdMode) {
    case 'mean':
      return calculateMeanThreshold(
        grayscalePixels
      );

    case 'triangle':
      return calculateTriangleThreshold(
        grayscalePixels
      );

    case 'minerror':
      return calculateMinimumErrorThreshold(
        grayscalePixels
      );

    case 'manual':
      return Number(
        settings.manualThresholdValue || 128
      );

    case 'otsu':
    default:
      return calculateOtsuThreshold(
        grayscalePixels
      );
  }
}

// ==============================
// HISTOGRAM
// ==============================

function buildHistogram(grayscalePixels) {
  const histogram = new Array(256).fill(0);

  grayscalePixels.forEach(value => {
    histogram[value]++;
  });

  return histogram;
}

// ==============================
// OTSU THRESHOLD
// ==============================

function calculateOtsuThreshold(
  grayscalePixels
) {
  const histogram = buildHistogram(
    grayscalePixels
  );

  const total = grayscalePixels.length;

  let sum = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];

    if (weightBackground === 0) {
      continue;
    }

    const weightForeground =
      total - weightBackground;

    if (weightForeground === 0) {
      break;
    }

    sumBackground += i * histogram[i];

    const meanBackground =
      sumBackground / weightBackground;

    const meanForeground =
      (sum - sumBackground) /
      weightForeground;

    const betweenVariance =
      weightBackground *
      weightForeground *
      Math.pow(
        meanBackground - meanForeground,
        2
      );

    if (betweenVariance > maxVariance) {
      maxVariance = betweenVariance;
      threshold = i;
    }
  }
// ==============================
// MEAN THRESHOLD
// ==============================

function calculateMeanThreshold(
  grayscalePixels
) {
  let total = 0;

  grayscalePixels.forEach(value => {
    total += value;
  });

  return Math.round(
    total / grayscalePixels.length
  );
}

// ==============================
// TRIANGLE THRESHOLD
// ==============================

function calculateTriangleThreshold(
  grayscalePixels
) {
  const histogram = buildHistogram(
    grayscalePixels
  );

  let left = 0;
  let right = 255;
  let peak = 0;
  let peakValue = 0;

  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      left = i;
      break;
    }
  }

  for (let i = 255; i >= 0; i--) {
    if (histogram[i] > 0) {
      right = i;
      break;
    }
  }

  for (let i = 0; i < 256; i++) {
    if (histogram[i] > peakValue) {
      peakValue = histogram[i];
      peak = i;
    }
  }

  let maxDistance = -1;
  let threshold = peak;

  const inverted = peak - left < right - peak;

  if (inverted) {
    for (let i = peak; i <= right; i++) {
      const distance = Math.abs(
        (right - peak) *
        (peakValue - histogram[i]) -
        (peakValue - 0) * (i - peak)
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        threshold = i;
      }
    }
  } else {
    for (let i = left; i <= peak; i++) {
      const distance = Math.abs(
        (peak - left) *
        (peakValue - histogram[i]) -
        (peakValue - 0) * (i - left)
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        threshold = i;
      }
    }
  }

  return threshold;
}

// ==============================
// MINIMUM ERROR THRESHOLD
// Simplified iterative threshold
// ==============================

function calculateMinimumErrorThreshold(
  grayscalePixels
) {
  let threshold = calculateMeanThreshold(
    grayscalePixels
  );

  let previousThreshold = 0;

  while (
    Math.abs(threshold - previousThreshold) > 1
  ) {
    previousThreshold = threshold;

    let backgroundSum = 0;
    let backgroundCount = 0;
    let foregroundSum = 0;
    let foregroundCount = 0;

    grayscalePixels.forEach(value => {
      if (value <= threshold) {
        backgroundSum += value;
        backgroundCount++;
      } else {
        foregroundSum += value;
        foregroundCount++;
      }
    });

    const backgroundMean =
      backgroundCount > 0
        ? backgroundSum / backgroundCount
        : 0;

    const foregroundMean =
      foregroundCount > 0
        ? foregroundSum / foregroundCount
        : 0;

    threshold = Math.round(
      (backgroundMean + foregroundMean) / 2
    );
  }

  return threshold;
}

// ==============================
// APPLY THRESHOLD
// ==============================

function applyThreshold(
  grayscalePixels,
  thresholdValue,
  invertThreshold = false
) {
  const binaryMask = new Uint8Array(
    grayscalePixels.length
  );

  for (let i = 0; i < grayscalePixels.length; i++) {
    const foreground = invertThreshold
      ? grayscalePixels[i] < thresholdValue
      : grayscalePixels[i] > thresholdValue;

    binaryMask[i] = foreground ? 1 : 0;
  }

  return binaryMask;
}
  // ==============================
// BACKGROUND REMOVAL
// ==============================

function removeBackgroundPixels(
  grayscalePixels,
  binaryMask,
  backgroundPixel
) {
  const tolerance = 20;

  const filteredMask = new Uint8Array(
    binaryMask.length
  );

  for (let i = 0; i < binaryMask.length; i++) {
    const difference = Math.abs(
      grayscalePixels[i] - backgroundPixel
    );

    filteredMask[i] =
      difference <= tolerance
        ? 0
        : binaryMask[i];
  }

  return filteredMask;
}

// ==============================
// MORPHOLOGICAL OPENING
// Erosion + Dilation
// ==============================

function morphologicalOpening(
  binaryMask,
  width,
  height
) {
  const eroded = erodeBinaryMask(
    binaryMask,
    width,
    height
  );

  return dilateBinaryMask(
    eroded,
    width,
    height
  );
}

function erodeBinaryMask(
  binaryMask,
  width,
  height
) {
  const output = new Uint8Array(
    binaryMask.length
  );

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keepPixel = 1;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index =
            (y + ky) * width + (x + kx);

          if (binaryMask[index] === 0) {
            keepPixel = 0;
            break;
          }
        }

        if (!keepPixel) {
          break;
        }
      }

      output[y * width + x] = keepPixel;
    }
  }

  return output;
}

function dilateBinaryMask(
  binaryMask,
  width,
  height
) {
  const output = new Uint8Array(
    binaryMask.length
  );

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let fillPixel = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index =
            (y + ky) * width + (x + kx);

          if (binaryMask[index] === 1) {
            fillPixel = 1;
            break;
          }
        }

        if (fillPixel) {
          break;
        }
      }

      output[y * width + x] = fillPixel;
    }
  }

  return output;
}

// ==============================
// CONNECTED COMPONENT LABELING
// ==============================

function connectedComponentLabeling(
  binaryMask,
  width,
  height
) {
  const visited = new Uint8Array(
    binaryMask.length
  );

  const particles = [];

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
        x,
        y,
        binaryMask,
        visited,
        width,
        height
      );

      if (particle.area > 0) {
        particles.push(particle);
      }
    }
  }

  return particles;
}
  
  return threshold;
}
// ==============================
// FLOOD FILL PARTICLE
// ==============================

function floodFillParticle(
  startX,
  startY,
  binaryMask,
  visited,
  width,
  height
) {
  const queue = [[startX, startY]];
  const pixels = [];

  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;

  let touchesEdge = false;

  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const [x, y] = queue.pop();

    pixels.push({ x, y });

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    if (
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1
    ) {
      touchesEdge = true;
    }

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
      [x - 1, y - 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x + 1, y + 1]
    ];

    neighbors.forEach(([nx, ny]) => {
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= width ||
        ny >= height
      ) {
        return;
      }

      const neighborIndex = ny * width + nx;

      if (
        binaryMask[neighborIndex] === 1 &&
        visited[neighborIndex] === 0
      ) {
        visited[neighborIndex] = 1;
        queue.push([nx, ny]);
      }
    });
  }

  return {
    pixels,
    area: pixels.length,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    touchesEdge
  };
}

// ==============================
// CHANNEL PREVIEW RENDER
// ==============================

function renderChannelPreview(
  sourceCanvas,
  targetCanvas,
  channelMode
) {
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');

  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;

  const imageData = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const outputData = targetCtx.createImageData(
    sourceCanvas.width,
    sourceCanvas.height
  );

  for (let i = 0; i < imageData.data.length; i += 4) {
    const red = imageData.data[i];
    const green = imageData.data[i + 1];
    const blue = imageData.data[i + 2];

    let value = 0;

    switch (channelMode) {
      case 'red':
        value = red;
        outputData.data[i] = red;
        outputData.data[i + 1] = 0;
        outputData.data[i + 2] = 0;
        break;

      case 'green':
        value = green;
        outputData.data[i] = 0;
        outputData.data[i + 1] = green;
        outputData.data[i + 2] = 0;
        break;

      case 'blue':
        value = blue;
        outputData.data[i] = 0;
        outputData.data[i + 1] = 0;
        outputData.data[i + 2] = blue;
        break;

      case 'grayscale':
      default:
        value = Math.round(
          red * 0.299 +
          green * 0.587 +
          blue * 0.114
        );

        outputData.data[i] = value;
        outputData.data[i + 1] = value;
        outputData.data[i + 2] = value;
        break;
    }

    outputData.data[i + 3] = 255;
  }

  targetCtx.putImageData(outputData, 0, 0);
}
// ==============================
// BINARY MASK RENDER
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

  const ctx = targetCanvas.getContext('2d');

  targetCanvas.width = width;
  targetCanvas.height = height;

  const imageData = ctx.createImageData(
    width,
    height
  );

  for (let i = 0; i < binaryMask.length; i++) {
    const value = binaryMask[i] === 1 ? 255 : 0;

    const pixelIndex = i * 4;

    imageData.data[pixelIndex] = value;
    imageData.data[pixelIndex + 1] = value;
    imageData.data[pixelIndex + 2] = value;
    imageData.data[pixelIndex + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

// ==============================
// OVERLAY DRAWING
// Fast rectangle-based overlay
// ==============================

function drawParticleOverlay(
  particles,
  width,
  height
) {
  const svg = document.getElementById('overlaySvg');

  if (!svg) {
    return;
  }

  clearOverlaySvg();

  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const settings = getCurrentSettings();

  particles.forEach((particle, index) => {
    const rect = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );

    rect.setAttribute('x', particle.minX);
    rect.setAttribute('y', particle.minY);
    rect.setAttribute('width', particle.width);
    rect.setAttribute('height', particle.height);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#00ffff');
    rect.setAttribute('stroke-width', '1');

    svg.appendChild(rect);

    if (
      particle.area >= settings.minimumOverlayArea
    ) {
      const text = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );

      text.setAttribute('x', particle.centroidX);
      text.setAttribute('y', particle.centroidY);
      text.setAttribute('fill', '#00ffff');
      text.setAttribute('font-size', '10');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');

      text.textContent =
        particle.id || index + 1;

      svg.appendChild(text);
    }
  });
}

// ==============================
// CLEAR OVERLAY SVG
// ==============================

function clearOverlaySvg() {
  const svg = document.getElementById('overlaySvg');

  if (!svg) {
    return;
  }

  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}
