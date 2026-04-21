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
        grayscale[j] = Math.round(
          (red + green + blue) / 3
        );
        break;
    }
  }

  return grayscale;
}

// ==============================
// THRESHOLD METHODS
// ==============================

function calculateOtsuThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < grayscale.length; i++) {
    histogram[grayscale[i]]++;
  }

  const total = grayscale.length;

  let sum = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let weightForeground = 0;

  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];

    if (weightBackground === 0) continue;

    weightForeground = total - weightBackground;

    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground =
      (sum - sumBackground) / weightForeground;

    const betweenClassVariance =
      weightBackground *
      weightForeground *
      Math.pow(meanBackground - meanForeground, 2);

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance;
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

    if (backgroundCount === 0 || foregroundCount === 0) {
      continue;
    }

    const backgroundMean = backgroundSum / backgroundCount;
    const foregroundMean = foregroundSum / foregroundCount;

    const error = Math.abs(
      backgroundMean - foregroundMean
    );

    if (error < minimumError) {
      minimumError = error;
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
  invert
) {
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
// ==============================

function morphologicalOpening(binaryMask, width, height) {
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
  const output = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keepPixel = 1;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index =
            (y + ky) * width + (x + kx);

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
          const index =
            (y + ky) * width + (x + kx);

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

function floodFillParticle(
  binaryMask,
  visited,
  width,
  height,
  startX,
  startY,
  particleId
) {
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
          const neighborIndex =
            ny * width + nx;

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
// FEATURE EXTRACTION
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

  const circularity = perimeter === 0
    ? 0
    : Number(
        (
          (4 * Math.PI * area) /
          (perimeter * perimeter)
        ).toFixed(4)
      );

  const feretDiameter = calculateFeretDiameter(
    bounds
  );

  const aspectRatio = calculateAspectRatio(
    bounds
  );

  const centroid = calculateParticleCentroidFromPixels(
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
    touchesEdge,
    bounds,
    pixels: particle.pixels
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
      const outsideImage =
        nx < 0 ||
        ny < 0 ||
        nx >= imageWidth ||
        ny >= imageHeight;

      const neighborMissing =
        !pixelSet.has(`${nx},${ny}`);

      if (outsideImage || neighborMissing) {
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

function calculateParticleCentroidFromPixels(pixels) {
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
// SIMPLE HELPER FUNCTIONS
// ==============================

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
  return getParticleBounds(pixels);
}

function calculateParticlePerimeterSimple(pixels) {
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
      if (!pixelSet.has(`${nx},${ny}`)) {
        perimeter++;
      }
    });
  });

  return perimeter;
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
    const value = binaryMask[i] === 1 ? 255 : 0;

    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
