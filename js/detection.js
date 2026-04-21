const Detection = (() => {
  function extractChannel(imageData, mode = 'grayscale') {
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(width * height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixelIndex = i / 4;

      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      let value = 0;

      switch (mode) {
        case 'red':
          value = r;
          break;

        case 'green':
          value = g;
          break;

        case 'blue':
          value = b;
          break;

        case 'grayscale':
        default:
          value = Math.round((r + g + b) / 3);
          break;
      }

      output[pixelIndex] = value;
    }

    return {
      width,
      height,
      data: output
    };
  }

  function createChannelImageData(channelData) {
    const imageData = new ImageData(channelData.width, channelData.height);

    for (let i = 0; i < channelData.data.length; i++) {
      const value = channelData.data[i];
      const pixelIndex = i * 4;

      imageData.data[pixelIndex] = value;
      imageData.data[pixelIndex + 1] = value;
      imageData.data[pixelIndex + 2] = value;
      imageData.data[pixelIndex + 3] = 255;
    }

    return imageData;
  }

  function calculateMeanThreshold(channelData) {
    let total = 0;

    for (let i = 0; i < channelData.data.length; i++) {
      total += channelData.data[i];
    }

    return Math.round(total / channelData.data.length);
  }

  function calculateHistogram(channelData) {
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < channelData.data.length; i++) {
      histogram[channelData.data[i]]++;
    }

    return histogram;
  }

  function calculateOtsuThreshold(channelData) {
    const histogram = calculateHistogram(channelData);
    const totalPixels = channelData.data.length;

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

      weightForeground = totalPixels - weightBackground;

      if (weightForeground === 0) break;

      sumBackground += i * histogram[i];

      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sum - sumBackground) / weightForeground;

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

  function calculateTriangleThreshold(channelData) {
    const histogram = calculateHistogram(channelData);

    let first = 0;
    let last = 255;

    while (first < 255 && histogram[first] === 0) {
      first++;
    }

    while (last > 0 && histogram[last] === 0) {
      last--;
    }

    let maxDistance = -1;
    let threshold = first;

    const x1 = first;
    const y1 = histogram[first];
    const x2 = last;
    const y2 = histogram[last];

    for (let i = first; i <= last; i++) {
      const distance = Math.abs(
        (y2 - y1) * i -
        (x2 - x1) * histogram[i] +
        x2 * y1 -
        y2 * x1
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        threshold = i;
      }
    }

    return threshold;
  }

       function calculateMinimumErrorThreshold(channelData) {
    const histogram = calculateHistogram(channelData);
    const total = channelData.data.length;

    let bestThreshold = 128;
    let minimumError = Infinity;

    for (let threshold = 1; threshold < 255; threshold++) {
      let backgroundWeight = 0;
      let foregroundWeight = 0;

      let backgroundMean = 0;
      let foregroundMean = 0;

      for (let i = 0; i < threshold; i++) {
        backgroundWeight += histogram[i];
        backgroundMean += i * histogram[i];
      }

      for (let i = threshold; i < 256; i++) {
        foregroundWeight += histogram[i];
        foregroundMean += i * histogram[i];
      }

      if (backgroundWeight === 0 || foregroundWeight === 0) {
        continue;
      }

      backgroundMean /= backgroundWeight;
      foregroundMean /= foregroundWeight;

      let backgroundVariance = 0;
      let foregroundVariance = 0;

      for (let i = 0; i < threshold; i++) {
        backgroundVariance +=
          histogram[i] * Math.pow(i - backgroundMean, 2);
      }

      for (let i = threshold; i < 256; i++) {
        foregroundVariance +=
          histogram[i] * Math.pow(i - foregroundMean, 2);
      }

      backgroundVariance /= backgroundWeight;
      foregroundVariance /= foregroundWeight;

      if (backgroundVariance <= 0 || foregroundVariance <= 0) {
        continue;
      }

      const error =
        1 +
        2 * (
          backgroundWeight * Math.log(Math.sqrt(backgroundVariance)) +
          foregroundWeight * Math.log(Math.sqrt(foregroundVariance))
        ) -
        2 * (
          backgroundWeight * Math.log(backgroundWeight / total) +
          foregroundWeight * Math.log(foregroundWeight / total)
        );

      if (error < minimumError) {
        minimumError = error;
        bestThreshold = threshold;
      }
    }

    return bestThreshold;
  }

  function getThresholdValue(channelData, method, manualMin = 0, manualMax = 255) {
    switch (method) {
      case 'mean':
        return calculateMeanThreshold(channelData);

      case 'triangle':
        return calculateTriangleThreshold(channelData);

      case 'minimum-error':
        return calculateMinimumErrorThreshold(channelData);

      case 'manual':
        return {
          min: manualMin,
          max: manualMax
        };

      case 'otsu':
      default:
        return calculateOtsuThreshold(channelData);
    }
  }

  function createBinaryMask(
    channelData,
    thresholdMethod = 'otsu',
    manualMin = 0,
    manualMax = 255,
    invert = false
  ) {
    const width = channelData.width;
    const height = channelData.height;
    const mask = new Uint8Array(width * height);

    const thresholdValue = getThresholdValue(
      channelData,
      thresholdMethod,
      manualMin,
      manualMax
    );

    for (let i = 0; i < channelData.data.length; i++) {
      const value = channelData.data[i];

      let isForeground = false;

      if (thresholdMethod === 'manual') {
        isForeground = value >= manualMin && value <= manualMax;
      } else {
        isForeground = value >= thresholdValue;
      }

      if (invert) {
        isForeground = !isForeground;
      }

      mask[i] = isForeground ? 1 : 0;
    }

    return {
      width,
      height,
      data: mask,
      thresholdValue
    };
  }

  function createBinaryImageData(binaryMask) {
    const imageData = new ImageData(binaryMask.width, binaryMask.height);

    for (let i = 0; i < binaryMask.data.length; i++) {
      const pixelIndex = i * 4;
      const value = binaryMask.data[i] ? 255 : 0;

      imageData.data[pixelIndex] = value;
      imageData.data[pixelIndex + 1] = value;
      imageData.data[pixelIndex + 2] = value;
      imageData.data[pixelIndex + 3] = 255;
    }

    return imageData;
  }

    function removeBackgroundFromMask(binaryMask, originalImageData, rgbRange) {
    if (!rgbRange) {
      return binaryMask;
    }

    const output = new Uint8Array(binaryMask.data);

    for (let y = 0; y < binaryMask.height; y++) {
      for (let x = 0; x < binaryMask.width; x++) {
        const pixelIndex = y * binaryMask.width + x;
        const rgbaIndex = pixelIndex * 4;

        const pixel = {
          r: originalImageData.data[rgbaIndex],
          g: originalImageData.data[rgbaIndex + 1],
          b: originalImageData.data[rgbaIndex + 2]
        };

        const isBackgroundPixel = Utils.isPixelInsideRgbRange(pixel, rgbRange);

        if (isBackgroundPixel) {
          output[pixelIndex] = 0;
        }
      }
    }

    return {
      width: binaryMask.width,
      height: binaryMask.height,
      data: output
    };
  }

  function createNonBackgroundMask(originalImageData, rgbRange) {
    const width = originalImageData.width;
    const height = originalImageData.height;
    const output = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const rgbaIndex = pixelIndex * 4;

        const pixel = {
          r: originalImageData.data[rgbaIndex],
          g: originalImageData.data[rgbaIndex + 1],
          b: originalImageData.data[rgbaIndex + 2]
        };

        const isBackground = Utils.isPixelInsideRgbRange(pixel, rgbRange);

        output[pixelIndex] = isBackground ? 0 : 1;
      }
    }

    return {
      width,
      height,
      data: output
    };
  }

  function applyMorphologicalOpening(binaryMask, iterations = 1) {
    let currentMask = binaryMask.data.slice();

    for (let i = 0; i < iterations; i++) {
      currentMask = erodeMask(currentMask, binaryMask.width, binaryMask.height);
    }

    for (let i = 0; i < iterations; i++) {
      currentMask = dilateMask(currentMask, binaryMask.width, binaryMask.height);
    }

    return {
      width: binaryMask.width,
      height: binaryMask.height,
      data: currentMask
    };
  }

  function erodeMask(mask, width, height) {
    const output = new Uint8Array(mask.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;

        let keep = 1;

        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            const neighborIndex = (y + offsetY) * width + (x + offsetX);

            if (mask[neighborIndex] === 0) {
              keep = 0;
            }
          }
        }

        output[index] = keep;
      }
    }

    return output;
  }

  function dilateMask(mask, width, height) {
    const output = new Uint8Array(mask.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;

        let fill = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            const neighborIndex = (y + offsetY) * width + (x + offsetX);

            if (mask[neighborIndex] === 1) {
              fill = 1;
            }
          }
        }

        output[index] = fill;
      }
    }

    return output;
  }

  function connectedComponentLabeling(binaryMask, minimumParticleSize = 50) {
    const width = binaryMask.width;
    const height = binaryMask.height;

    const visited = new Uint8Array(width * height);
    const labels = new Uint32Array(width * height);

    const particles = [];
    let currentLabel = 1;

    const neighborOffsets = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],            [1, 0],
      [-1, 1],  [0, 1],   [1, 1]
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const startIndex = y * width + x;

        if (visited[startIndex] || binaryMask.data[startIndex] === 0) {
          continue;
        }

        const queue = [{ x, y }];
        const pixels = [];

        visited[startIndex] = 1;
        labels[startIndex] = currentLabel;

        while (queue.length > 0) {
          const current = queue.shift();
          const currentIndex = current.y * width + current.x;

          pixels.push({
            x: current.x,
            y: current.y,
            index: currentIndex
          });

          for (const [offsetX, offsetY] of neighborOffsets) {
            const nextX = current.x + offsetX;
            const nextY = current.y + offsetY;

            if (
              !Utils.isInsideBounds(nextX, nextY, width, height)
            ) {
              continue;
            }

            const nextIndex = nextY * width + nextX;

            if (
              visited[nextIndex] ||
              binaryMask.data[nextIndex] === 0
            ) {
              continue;
            }

            visited[nextIndex] = 1;
            labels[nextIndex] = currentLabel;

            queue.push({
              x: nextX,
              y: nextY
            });
          }
        }

        if (pixels.length >= minimumParticleSize) {
          particles.push({
            label: currentLabel,
            pixels
          });

          currentLabel++;
        }
      }
    }

    return {
      width,
      height,
      labels,
      particles
    };
  }

  return {
    extractChannel,
    createChannelImageData,
    calculateMeanThreshold,
    calculateHistogram,
    calculateOtsuThreshold,
    calculateTriangleThreshold,
    calculateMinimumErrorThreshold,
    getThresholdValue,
    createBinaryMask,
    createBinaryImageData,
    removeBackgroundFromMask,
    createNonBackgroundMask,
    applyMorphologicalOpening,
    connectedComponentLabeling
  };
})();   

