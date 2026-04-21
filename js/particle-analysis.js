// ==============================
// PARTICLE ANALYSIS MODULE
// Aqua Insight Version 0.1
// ==============================

function extractParticlesWithFeatures(
  detectedParticles,
  sourceCanvas
) {
  const ctx = sourceCanvas.getContext('2d');

  const imageData = ctx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  return detectedParticles.map((particle, index) => {
    const area = particle.area;

    const perimeter = calculateParticlePerimeter(
      particle.pixels
    );

    const circularity = calculateCircularity(
      area,
      perimeter
    );

    const feretDiameter = calculateFeretDiameter(
      particle
    );

    const aspectRatio = calculateAspectRatio(
      particle.width,
      particle.height
    );

    const centroid = calculateCentroid(
      particle.pixels
    );

    const rgbStatistics = calculateRGBStatistics(
      particle.pixels,
      imageData,
      sourceCanvas.width
    );

    return {
      id: index + 1,
      area,
      perimeter,
      circularity,
      feretDiameter,
      aspectRatio,
      centroidX: centroid.x,
      centroidY: centroid.y,
      meanRGB: rgbStatistics.meanRGB,
      minRGB: rgbStatistics.minRGB,
      maxRGB: rgbStatistics.maxRGB,
      touchesEdge: particle.touchesEdge,
      minX: particle.minX,
      minY: particle.minY,
      maxX: particle.maxX,
      maxY: particle.maxY,
      width: particle.width,
      height: particle.height,
      pixels: particle.pixels
    };
  });
}

// ==============================
// PARTICLE PERIMETER
// Faster perimeter approximation
// ==============================

function calculateParticlePerimeter(pixels) {
  if (!pixels || !pixels.length) {
    return 0;
  }

  const pointSet = new Set();

  pixels.forEach(pixel => {
    pointSet.add(`${pixel.x},${pixel.y}`);
  });

  let perimeter = 0;

  pixels.forEach(pixel => {
    const left = `${pixel.x - 1},${pixel.y}`;
    const right = `${pixel.x + 1},${pixel.y}`;
    const top = `${pixel.x},${pixel.y - 1}`;
    const bottom = `${pixel.x},${pixel.y + 1}`;

    if (!pointSet.has(left)) perimeter++;
    if (!pointSet.has(right)) perimeter++;
    if (!pointSet.has(top)) perimeter++;
    if (!pointSet.has(bottom)) perimeter++;
  });

  return perimeter;
}

// ==============================
// CIRCULARITY
// ==============================

function calculateCircularity(
  area,
  perimeter
) {
  if (perimeter === 0) {
    return 0;
  }

  return (
    (4 * Math.PI * area) /
    Math.pow(perimeter, 2)
  );
}

// ==============================
// FERET DIAMETER
// Fast approximation using bounding box
// ==============================

function calculateFeretDiameter(particle) {
  if (!particle) {
    return 0;
  }

  const width = particle.width || 0;
  const height = particle.height || 0;

  return Math.sqrt(
    width * width + height * height
  );
}

// ==============================
// ASPECT RATIO
// ==============================

function calculateAspectRatio(
  width,
  height
) {
  if (height === 0) {
    return 0;
  }

  return width / height;
}

// ==============================
// CENTROID
// ==============================

function calculateCentroid(pixels) {
  if (!pixels || !pixels.length) {
    return {
      x: 0,
      y: 0
    };
  }

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

// ==============================
// RGB STATISTICS
// ==============================

function calculateRGBStatistics(
  pixels,
  imageData,
  imageWidth
) {
  let totalRed = 0;
  let totalGreen = 0;
  let totalBlue = 0;

  let minRed = 255;
  let minGreen = 255;
  let minBlue = 255;

  let maxRed = 0;
  let maxGreen = 0;
  let maxBlue = 0;

  pixels.forEach(pixel => {
    const index =
      (pixel.y * imageWidth + pixel.x) * 4;

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];

    totalRed += red;
    totalGreen += green;
    totalBlue += blue;

    if (red < minRed) minRed = red;
    if (green < minGreen) minGreen = green;
    if (blue < minBlue) minBlue = blue;

    if (red > maxRed) maxRed = red;
    if (green > maxGreen) maxGreen = green;
    if (blue > maxBlue) maxBlue = blue;
  });
    const meanRed = Math.round(
    totalRed / pixels.length
  );

  const meanGreen = Math.round(
    totalGreen / pixels.length
  );

  const meanBlue = Math.round(
    totalBlue / pixels.length
  );

  return {
    meanRGB: `${meanRed}, ${meanGreen}, ${meanBlue}`,
    minRGB: `${minRed}, ${minGreen}, ${minBlue}`,
    maxRGB: `${maxRed}, ${maxGreen}, ${maxBlue}`
  };
}

// ==============================
// PARTICLE SORTING
// ==============================

function sortParticlesByArea(
  particles,
  descending = true
) {
  return [...particles].sort((a, b) => {
    return descending
      ? b.area - a.area
      : a.area - b.area;
  });
}

function sortParticlesByCircularity(
  particles,
  descending = true
) {
  return [...particles].sort((a, b) => {
    return descending
      ? b.circularity - a.circularity
      : a.circularity - b.circularity;
  });
}

function sortParticlesByPerimeter(
  particles,
  descending = true
) {
  return [...particles].sort((a, b) => {
    return descending
      ? b.perimeter - a.perimeter
      : a.perimeter - b.perimeter;
  });
}

// ==============================
// PARTICLE SUMMARY
// ==============================

function calculateParticleSummary(particles) {
  if (!particles || !particles.length) {
    return {
      totalParticles: 0,
      totalArea: 0,
      meanArea: 0,
      meanPerimeter: 0,
      meanCircularity: 0,
      meanFeretDiameter: 0
    };
  }

  const totalParticles = particles.length;

  const totalArea = particles.reduce(
    (sum, particle) => {
      return sum + particle.area;
    },
    0
  );

  const totalPerimeter = particles.reduce(
    (sum, particle) => {
      return sum + particle.perimeter;
    },
    0
  );

  const totalCircularity = particles.reduce(
    (sum, particle) => {
      return sum + particle.circularity;
    },
    0
  );

  const totalFeretDiameter = particles.reduce(
    (sum, particle) => {
      return sum + particle.feretDiameter;
    },
    0
  );

  return {
    totalParticles,
    totalArea,
    meanArea: totalArea / totalParticles,
    meanPerimeter:
      totalPerimeter / totalParticles,
    meanCircularity:
      totalCircularity / totalParticles,
    meanFeretDiameter:
      totalFeretDiameter / totalParticles
  };
}

// ==============================
// PARTICLE EXPORT FORMATTER
// ==============================

function formatParticleForExport(
  particle,
  particleIndex
) {
  return {
    particleId: particle.id || particleIndex + 1,
    area: particle.area,
    perimeter: Number(
      particle.perimeter.toFixed(2)
    ),
    circularity: Number(
      particle.circularity.toFixed(4)
    ),
    feretDiameter: Number(
      particle.feretDiameter.toFixed(2)
    ),
    aspectRatio: Number(
      particle.aspectRatio.toFixed(2)
    ),
    meanRGB: particle.meanRGB,
    minRGB: particle.minRGB,
    maxRGB: particle.maxRGB,
    centroidX: Number(
      particle.centroidX.toFixed(2)
    ),
    centroidY: Number(
      particle.centroidY.toFixed(2)
    ),
    touchesEdge: particle.touchesEdge
      ? 'Yes'
      : 'No'
  };
}
// ==============================
// PARTICLE REINDEXING
// ==============================

function reindexParticles(particles) {
  return particles.map((particle, index) => {
    return {
      ...particle,
      id: index + 1
    };
  });
}

// ==============================
// PARTICLE BOUNDING BOX
// ==============================

function calculateBoundingBox(pixels) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  pixels.forEach(pixel => {
    if (pixel.x < minX) minX = pixel.x;
    if (pixel.y < minY) minY = pixel.y;
    if (pixel.x > maxX) maxX = pixel.x;
    if (pixel.y > maxY) maxY = pixel.y;
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// ==============================
// PARTICLE SHAPE CLASSIFICATION
// ==============================

function classifyParticleShape(particle) {
  const circularity = particle.circularity;
  const aspectRatio = particle.aspectRatio;

  if (circularity >= 0.85) {
    return 'Round';
  }

  if (
    circularity >= 0.6 &&
    aspectRatio >= 0.75 &&
    aspectRatio <= 1.25
  ) {
    return 'Oval';
  }

  if (aspectRatio > 1.5) {
    return 'Elongated';
  }

  if (circularity < 0.4) {
    return 'Irregular';
  }

  return 'Intermediate';
}

// ==============================
// PARTICLE DENSITY
// ==============================

function calculateParticleDensity(
  particles,
  imageWidth,
  imageHeight
) {
  const imageArea = imageWidth * imageHeight;

  if (imageArea === 0) {
    return 0;
  }

  return particles.length / imageArea;
}

// ==============================
// COVERAGE CALCULATION
// ==============================

function calculateCoverageMetrics(
  particles,
  imageWidth,
  imageHeight
) {
  const totalParticleArea = particles.reduce(
    (sum, particle) => {
      return sum + particle.area;
    },
    0
  );

  const imageArea = imageWidth * imageHeight;

  const coveragePercent =
    imageArea > 0
      ? (totalParticleArea / imageArea) * 100
      : 0;

  return {
    coveragePixels: totalParticleArea,
    coveragePercent: Number(
      coveragePercent.toFixed(2)
    )
  };
}

// ==============================
// PARTICLE NEAREST NEIGHBOR
// ==============================

function calculateNearestNeighborDistances(
  particles
) {
  return particles.map((particle, index) => {
    let nearestDistance = Infinity;

    particles.forEach((otherParticle, otherIndex) => {
      if (index === otherIndex) {
        return;
      }

      const dx =
        particle.centroidX -
        otherParticle.centroidX;

      const dy =
        particle.centroidY -
        otherParticle.centroidY;

      const distance = Math.sqrt(
        dx * dx + dy * dy
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    });

    return {
      particleId: particle.id,
      nearestNeighborDistance:
        nearestDistance === Infinity
          ? 0
          : Number(nearestDistance.toFixed(2))
    };
  });
}
