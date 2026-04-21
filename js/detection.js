// ==============================
// DETECTION ENGINE
// Aqua Insight Version 0.1
// ==============================

function runDetectionPipeline(sourceCanvas, settings) {
  const ctx = sourceCanvas.getContext('2d');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);

  const grayscale = extractChannelData(
    imageData,
    settings.channelMode
  );

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
      thresholdValue = Number(settings.manualThresholdValue || 128);
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
  const channel = new Uint8ClampedArray(data.length / 4);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
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

    const weightForeground = total - weightBackground;

    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];

    const meanBackground =
      sumBackground / weightBackground;

    const meanForeground =
      (sum - sumBackground) / weightForeground;

    const variance =
      weightBackground *
      weightForeground *
      Math.pow(meanBackground - meanForeground, 2);

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

  let peak = 0;

  for (let i = 1; i < 256; i++) {
    if (histogram[i] > histogram[peak]) {
      peak = i;
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

  let bestDistance = -1;
  let threshold = peak;
    for (let i = left; i <= right; i++) {
    const numerator = Math.abs(
      ((right - left) * (peak - i)) -
      ((peak - left) * (right - i))
    );

    if (numerator > bestDistance) {
      bestDistance = numerator;
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
  let smallestDifference = Infinity;

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

    if (backgroundCount === 0 || foregroundCount === 0) {
      continue;
    }

    const backgroundMean =
      backgroundSum / backgroundCount;

    const foregroundMean =
      foregroundSum / foregroundCount;

    const difference = Math.abs(
      foregroundMean - backgroundMean
    );

    if (difference < smallestDifference) {
      smallestDifference = difference;
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
  invertThreshold
) {
  const binaryMask = new Uint8Array(width * height);

  for (let i = 0; i < grayscale.length; i++) {
    const foreground = invertThreshold
      ? grayscale[i] < thresholdValue
      : grayscale[i] >= thresholdValue;

    binaryMask[i] = foreground ? 1 : 0;
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

  return dilation(
    eroded,
    width,
    height
  );
}

function erosion(binaryMask, width, height) {
  const output = new Uint8Array(width * height);

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
  const output = new Uint8Array(width * height);

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
  const visited = new Uint8Array(width * height);
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
          const [currentX, currentY] = queue.shift();

          pixels.push({
            x: currentX,
            y: currentY
          });

          for (let offsetY = -1; offsetY <= 1; offsetY++) {
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
              if (offsetX === 0 && offsetY === 0) {
                continue;
              }

              const nextX = currentX + offsetX;
              const nextY = currentY + offsetY;

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
// PARTICLE FEATURE EXTRACTION
// ==============================

function extractParticleFeatures(
  particle,
  imageData,
  imageWidth,
  imageHeight
) {
  const area = particle.pixels.length;

  const bounds = getParticleBounds(
    particle.pixels
  );

  const perimeter = calculateParticlePerimeter(
    particle.pixels,
    imageWidth,
    imageHeight
  );

  const circularity = perimeter > 0
    ? Number(
        (
          (4 * Math.PI * area) /
          (perimeter * perimeter)
        ).toFixed(4)
      )
    : 0;

  const feretDiameter = calculateFeretDiameter(bounds);

  const aspectRatio = calculateAspectRatio(bounds);

  const centroid = calculateParticleCentroid(
    particle.pixels
  );

  const rgbStats = calculateParticleRGB(
    particle.pixels,
    imageData,
    imageWidth
  );

  const touchesEdge =
    bounds.minX <= 0 ||
    bounds.minY <= 0 ||
    bounds.maxX >= imageWidth - 1 ||
    bounds.maxY >= imageHeight - 1;

  return {
    id: particle.id,
    pixels: particle.pixels,
    bounds,
    area,
    perimeter,
    circularity,
    feretDiameter,
    aspectRatio,
    centroidX: centroid.x,
    centroidY: centroid.y,
    meanRGB: rgbStats.mean,
    minRGB: rgbStats.min,
    maxRGB: rgbStats.max,
    touchesEdge
  };
}

function calculateParticlePerimeter(
  pixels,
  imageWidth,
  imageHeight
) {
  const pixelSet = new Set(
    pixels.map(pixel => `${pixel.x},${pixel.y}`)
  );

  let perimeter = 0;
    pixels.forEach(pixel => {
    const neighbors = [
      [pixel.x - 1, pixel.y],
      [pixel.x + 1, pixel.y],
      [pixel.x, pixel.y - 1],
      [pixel.x, pixel.y + 1]
    ];

    neighbors.forEach(([nx, ny]) => {
      const outside =
        nx < 0 ||
        ny < 0 ||
        nx >= imageWidth ||
        ny >= imageHeight;

      const missingNeighbor =
        !pixelSet.has(`${nx},${ny}`);

      if (outside || missingNeighbor) {
        perimeter++;
      }
    });
  });

  return perimeter;
}

function calculateFeretDiameter(bounds) {
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;

  return Number(
    Math.sqrt(
      (width * width) +
      (height * height)
    ).toFixed(2)
  );
}

function calculateAspectRatio(bounds) {
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;

  if (height === 0) return 0;

  return Number(
    (width / height).toFixed(2)
  );
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

function calculateParticleRGB(
  pixels,
  imageData,
  imageWidth
) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  let minR = 255;
  let minG = 255;
  let minB = 255;

  let maxR = 0;
  let maxG = 0;
  let maxB = 0;

  pixels.forEach(pixel => {
    const index =
      (pixel.y * imageWidth + pixel.x) * 4;

    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];

    totalR += r;
    totalG += g;
    totalB += b;

    minR = Math.min(minR, r);
    minG = Math.min(minG, g);
    minB = Math.min(minB, b);

    maxR = Math.max(maxR, r);
    maxG = Math.max(maxG, g);
    maxB = Math.max(maxB, b);
  });

  const count = pixels.length;

  return {
    mean: `(${Math.round(totalR / count)}, ${Math.round(totalG / count)}, ${Math.round(totalB / count)})`,
    min: `(${minR}, ${minG}, ${minB})`,
    max: `(${maxR}, ${maxG}, ${maxB})`
  };
}

function getParticleBounds(pixels) {
  const xValues = pixels.map(pixel => pixel.x);
  const yValues = pixels.map(pixel => pixel.y);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues)
  };
}
// ==============================
// BINARY MASK RENDER
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
