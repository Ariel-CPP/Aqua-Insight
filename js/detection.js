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

  const grayscale = extractChannelData(
    imageData,
    settings.channelMode
  );

  let thresholdValue = 128;

  switch (settings.thresholdMode) {
    case 'mean':
      thresholdValue =
        calculateMeanThreshold(grayscale);
      break;

    case 'triangle':
      thresholdValue =
        calculateTriangleThreshold(grayscale);
      break;

    case 'minerror':
      thresholdValue =
        calculateMinimumErrorThreshold(grayscale);
      break;

    case 'manual':
      thresholdValue =
        Number(settings.manualThresholdValue || 128);
      break;

    case 'otsu':
    default:
      thresholdValue =
        calculateOtsuThreshold(grayscale);
      break;
  }

  let binaryMask = applyThreshold(
    grayscale,
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

  const particles = connectedComponentLabeling(
    binaryMask,
    width,
    height
  );

  return {
    grayscale,
    binaryMask,
    thresholdValue,
    particles
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

  const channel =
    new Uint8ClampedArray(data.length / 4);

  for (
    let i = 0, j = 0;
    i < data.length;
    i += 4, j++
  ) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    switch (channelMode) {
      case 'red':
        channel[j] = r;
        break;

      case 'green':
        channel[j] = g;
        break;

      case 'blue':
        channel[j] = b;
        break;

      case 'grayscale':
      default:
        channel[j] = Math.round(
          (r * 0.299) +
          (g * 0.587) +
          (b * 0.114)
        );
        break;
    }
  }

  return channel;
}

// ==============================
// THRESHOLD METHODS
// ==============================

function calculateOtsuThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  grayscale.forEach(value => {
    histogram[value]++;
  });

  const total = grayscale.length;

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

    if (weightBackground === 0) continue;

    const weightForeground =
      total - weightBackground;

    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];

    const meanBackground =
      sumBackground / weightBackground;

    const meanForeground =
      (sum - sumBackground) / weightForeground;

    const variance =
      weightBackground *
      weightForeground *
      Math.pow(
        meanBackground - meanForeground,
        2
      );

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function calculateMeanThreshold(grayscale) {
  const total = grayscale.reduce(
    (sum, value) => sum + value,
    0
  );

  return Math.round(total / grayscale.length);
}

function calculateTriangleThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  grayscale.forEach(value => {
    histogram[value]++;
  });

  let peakIndex = 0;

  for (let i = 1; i < histogram.length; i++) {
    if (histogram[i] > histogram[peakIndex]) {
      peakIndex = i;
    }
  }

  let left = 0;
  let right = 255;

  while (left < 255 && histogram[left] === 0) {
    left++;
  }

  while (right > 0 && histogram[right] === 0) {
    right--;
  }

  let maxDistance = -1;
  let threshold = peakIndex;

  for (let i = left; i <= right; i++) {
    const distance = Math.abs(
      ((right - left) * (peakIndex - i)) -
      ((peakIndex - left) * (right - i))
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

  let bestThreshold = 128;
  let smallestError = Infinity;

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

    const error = Math.abs(
      foregroundMean - backgroundMean
    );

    if (error < smallestError) {
      smallestError = error;
      bestThreshold = threshold;
    }
  }

  return bestThreshold;
}

// ==============================
// THRESHOLD APPLICATION
// ==============================

function applyThreshold(
  grayscale,
  width,
  height,
  thresholdValue,
  invertThreshold,
  backgroundPixel
) {
  const binaryMask =
    new Uint8Array(width * height);

  for (let i = 0; i < grayscale.length; i++) {
    const value = grayscale[i];

    let isForeground = invertThreshold
      ? value < thresholdValue
      : value >= thresholdValue;

    if (
      backgroundPixel !== null &&
      backgroundPixel !== undefined
    ) {
      const difference = Math.abs(
        value - backgroundPixel
      );

      if (difference < 10) {
        isForeground = false;
      }
    }

    binaryMask[i] = isForeground ? 1 : 0;
  }

  return binaryMask;
}

// ==============================
// MORPHOLOGICAL FILTER
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

function erosion(binaryMask, width, height) {
  const output =
    new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keep = 1;

          for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index =
            (y + ky) * width + (x + kx);

          if (binaryMask[index] === 0) {
            keep = 0;
            break;
          }
        }

        if (!keep) break;
      }

      output[y * width + x] = keep;
    }
  }

  return output;
}

function dilation(binaryMask, width, height) {
  const output =
    new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let fill = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index =
            (y + ky) * width + (x + kx);

          if (binaryMask[index] === 1) {
            fill = 1;
            break;
          }
        }

        if (fill) break;
      }

      output[y * width + x] = fill;
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
  const visited =
    new Uint8Array(width * height);

  const particles = [];

  let particleId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (
        binaryMask[index] === 1 &&
        visited[index] === 0
      ) {
        const pixels = [];
        const queue = [[x, y]];

        visited[index] = 1;

        while (queue.length > 0) {
          const [currentX, currentY] =
            queue.shift();

          pixels.push({
            x: currentX,
            y: currentY
          });

          for (
            let offsetY = -1;
            offsetY <= 1;
            offsetY++
          ) {
            for (
              let offsetX = -1;
              offsetX <= 1;
              offsetX++
            ) {
              if (
                offsetX === 0 &&
                offsetY === 0
              ) {
                continue;
              }

              const nextX =
                currentX + offsetX;

              const nextY =
                currentY + offsetY;

              if (
                nextX < 0 ||
                nextY < 0 ||
                nextX >= width ||
                nextY >= height
              ) {
                continue;
              }

              const nextIndex =
                nextY * width + nextX;

              if (
                binaryMask[nextIndex] === 1 &&
                visited[nextIndex] === 0
              ) {
                visited[nextIndex] = 1;

                queue.push([
                  nextX,
                  nextY
                ]);
              }
            }
          }
        }

        particles.push({
          id: particleId,
          pixels
        });

        particleId++;
      }
    }
  }

  return particles;
}

// ==============================
// BOUNDARY EXTRACTION
// ==============================

function extractBoundaryPoints(pixels) {
  const pixelSet = new Set(
    pixels.map(pixel => `${pixel.x},${pixel.y}`)
  );

  const boundary = [];

  pixels.forEach(pixel => {
    const neighbors = [
      [pixel.x - 1, pixel.y],
      [pixel.x + 1, pixel.y],
      [pixel.x, pixel.y - 1],
      [pixel.x, pixel.y + 1]
    ];

    const isBoundary = neighbors.some(([nx, ny]) => {
      return !pixelSet.has(`${nx},${ny}`);
    });

    if (isBoundary) {
      boundary.push({
        x: pixel.x,
        y: pixel.y
      });
    }
  });

  if (boundary.length < 3) {
    return boundary;
  }

  const centroid =
    calculateBoundaryCentroid(boundary);

  boundary.sort((a, b) => {
    const angleA = Math.atan2(
      a.y - centroid.y,
      a.x - centroid.x
    );

    const angleB = Math.atan2(
      b.y - centroid.y,
      b.x - centroid.x
    );

    return angleA - angleB;
  });

  return smoothBoundary(boundary);
}

function calculateBoundaryCentroid(points) {
  let sumX = 0;
  let sumY = 0;

  points.forEach(point => {
    sumX += point.x;
    sumY += point.y;
  });

  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

function smoothBoundary(boundary) {
  if (boundary.length < 5) {
    return boundary;
  }

  const smoothed = [];

  for (let i = 0; i < boundary.length; i++) {
    const previous =
      boundary[
        (i - 1 + boundary.length) %
        boundary.length
      ];

    const current = boundary[i];

    const next =
      boundary[
        (i + 1) % boundary.length
      ];

    smoothed.push({
      x:
        (previous.x + current.x + next.x) / 3,
      y:
        (previous.y + current.y + next.y) / 3
    });
  }

  return smoothed;
}

// ==============================
// BINARY PREVIEW RENDER
// ==============================

function renderBinaryMaskToCanvas(
  binaryMask,
  width,
  height,
  canvas
) {
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(
    width,
    height
  );

  for (let i = 0; i < binaryMask.length; i++) {
    const value =
      binaryMask[i] === 1 ? 255 : 0;

    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
