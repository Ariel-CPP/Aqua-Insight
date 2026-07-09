/* ==========================================================================
   AQUA INSIGHT - STATISTICAL REGRESSION & CORRELATION ENGINE
   Contains: Multi-model regression fits (Linear, Exponential, Log, Quadratic)
   via OLS / 3x3 matrix solvers, Pearson and Spearman correlation matrices.
   ========================================================================== */

window.AquaRegression = {
  // 1. Pearson Correlation Matrix
  // datasets: Array of Array of Numbers: [[col1], [col2], ...]
  // labels: Array of String column headers
  pearsonMatrix: function(datasets, labels) {
    const k = datasets.length;
    const matrix = [];
    
    for (let i = 0; i < k; i++) {
      matrix[i] = new Array(k);
      for (let j = 0; j < k; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.pearsonCorrelation(datasets[i], datasets[j]);
        }
      }
    }
    return { labels, matrix };
  },

  pearsonCorrelation: function(x, y) {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;
    
    const mx = window.AquaMath.mean(x);
    const my = window.AquaMath.mean(y);
    
    let num = 0;
    let denX = 0;
    let denY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx;
      const dy = y[i] - my;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    
    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  },

  // 2. Spearman Rank Correlation Matrix
  spearmanMatrix: function(datasets, labels) {
    const k = datasets.length;
    const matrix = [];
    
    // Rank columns
    const rankedDatasets = datasets.map(d => this.rankData(d));
    
    for (let i = 0; i < k; i++) {
      matrix[i] = new Array(k);
      for (let j = 0; j < k; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.pearsonCorrelation(rankedDatasets[i], rankedDatasets[j]);
        }
      }
    }
    return { labels, matrix };
  },

  rankData: function(arr) {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(arr.length);
    
    let i = 0;
    while (i < sorted.length) {
      let runEnd = i;
      while (runEnd + 1 < sorted.length && sorted[runEnd + 1].val === sorted[i].val) {
        runEnd++;
      }
      const rankSum = ((i + 1) + (runEnd + 1)) * (runEnd - i + 1) / 2;
      const avgRank = rankSum / (runEnd - i + 1);
      for (let j = i; j <= runEnd; j++) {
        ranks[sorted[j].idx] = avgRank;
      }
      i = runEnd + 1;
    }
    return ranks;
  },

  // 3. Multi-Model Regression Solver
  // fits x and y points to model
  fitModel: function(x, y, modelType = "linear") {
    const n = x.length;
    if (n !== y.length || n < 3) return null;
    
    switch (modelType.toLowerCase()) {
      case "linear":
        return this.fitLinear(x, y);
      case "exponential":
        return this.fitExponential(x, y);
      case "logarithmic":
        return this.fitLogarithmic(x, y);
      case "quadratic":
        return this.fitQuadratic(x, y);
      case "power":
        return this.fitPower(x, y);
      default:
        return this.fitLinear(x, y);
    }
  },

  // Linear Fit: y = mx + c
  fitLinear: function(x, y) {
    const n = x.length;
    const sumX = window.AquaMath.sum(x);
    const sumY = window.AquaMath.sum(y);
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    let num = 0;
    let den = 0;
    
    for (let i = 0; i < n; i++) {
      num += (x[i] - meanX) * (y[i] - meanY);
      den += Math.pow(x[i] - meanX, 2);
    }
    
    if (den === 0) return null;
    
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    
    // R-squared
    const r = this.pearsonCorrelation(x, y);
    const r2 = r * r;
    
    // ANOVA / Significance of Slope
    const df = n - 2;
    const tStat = r2 === 1.0 ? 999.9 : r * Math.sqrt(df / (1 - r2));
    const pValue = window.AquaMath.t2TailPValue(tStat, df);
    
    return {
      type: "Linear",
      formula: `y = ${slope.toFixed(4)}x + (${intercept.toFixed(4)})`,
      parameters: { slope, intercept },
      r2,
      tStat,
      df,
      pValue,
      isSignificant: pValue < 0.05,
      predict: (xVal) => slope * xVal + intercept
    };
  },

  // Exponential Fit: y = a * e^(bx)  -> ln(y) = ln(a) + bx
  fitExponential: function(x, y) {
    // Exclude zero or negative y values (cannot take log)
    const validPoints = [];
    for (let i = 0; i < x.length; i++) {
      if (y[i] > 0) {
        validPoints.push({ x: x[i], y: y[i], lnY: Math.log(y[i]) });
      }
    }
    
    if (validPoints.length < 3) return null;
    
    const xs = validPoints.map(p => p.x);
    const lnYs = validPoints.map(p => p.lnY);
    
    // Run linear regression on x and ln(y)
    const linFit = this.fitLinear(xs, lnYs);
    if (!linFit) return null;
    
    const b = linFit.parameters.slope;
    const a = Math.exp(linFit.parameters.intercept);
    
    // Calculate R2 based on original scale y values (essential for scientific comparison!)
    const yPreds = xs.map(xVal => a * Math.exp(b * xVal));
    const ys = validPoints.map(p => p.y);
    const r2 = this.calculateR2OriginalScale(ys, yPreds);
    
    return {
      type: "Eksponensial",
      formula: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
      parameters: { a, b },
      r2,
      tStat: linFit.tStat,
      df: linFit.df,
      pValue: linFit.pValue,
      isSignificant: linFit.pValue < 0.05,
      predict: (xVal) => a * Math.exp(b * xVal)
    };
  },

  // Logarithmic Fit: y = a * ln(x) + b  -> Transform x to ln(x)
  fitLogarithmic: function(x, y) {
    const validPoints = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] > 0) {
        validPoints.push({ x: x[i], lnX: Math.log(x[i]), y: y[i] });
      }
    }
    
    if (validPoints.length < 3) return null;
    
    const lnXs = validPoints.map(p => p.lnX);
    const ys = validPoints.map(p => p.y);
    
    const linFit = this.fitLinear(lnXs, ys);
    if (!linFit) return null;
    
    const a = linFit.parameters.slope;
    const b = linFit.parameters.intercept;
    
    return {
      type: "Logaritmik",
      formula: `y = ${a.toFixed(4)} * ln(x) + (${b.toFixed(4)})`,
      parameters: { a, b },
      r2: linFit.r2,
      tStat: linFit.tStat,
      df: linFit.df,
      pValue: linFit.pValue,
      isSignificant: linFit.pValue < 0.05,
      predict: (xVal) => xVal > 0 ? a * Math.log(xVal) + b : 0
    };
  },

  // Power Fit: y = a * x^b  -> ln(y) = ln(a) + b * ln(x)
  fitPower: function(x, y) {
    const validPoints = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] > 0 && y[i] > 0) {
        validPoints.push({ x: x[i], lnX: Math.log(x[i]), y: y[i], lnY: Math.log(y[i]) });
      }
    }
    
    if (validPoints.length < 3) return null;
    
    const lnXs = validPoints.map(p => p.lnX);
    const lnYs = validPoints.map(p => p.lnY);
    
    const linFit = this.fitLinear(lnXs, lnYs);
    if (!linFit) return null;
    
    const b = linFit.parameters.slope;
    const a = Math.exp(linFit.parameters.intercept);
    
    const ys = validPoints.map(p => p.y);
    const xs = validPoints.map(p => p.x);
    const yPreds = xs.map(xVal => a * Math.pow(xVal, b));
    const r2 = this.calculateR2OriginalScale(ys, yPreds);
    
    return {
      type: "Power",
      formula: `y = ${a.toFixed(4)} * x^(${b.toFixed(4)})`,
      parameters: { a, b },
      r2,
      tStat: linFit.tStat,
      df: linFit.df,
      pValue: linFit.pValue,
      isSignificant: linFit.pValue < 0.05,
      predict: (xVal) => xVal > 0 ? a * Math.pow(xVal, b) : 0
    };
  },

  // Quadratic/Polynomial Fit: y = ax^2 + bx + c
  // Solved using 3x3 matrix Cramer's Rule for OLS
  fitQuadratic: function(x, y) {
    const n = x.length;
    
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      const xi2 = xi * xi;
      
      sumX += xi;
      sumX2 += xi2;
      sumX3 += xi2 * xi;
      sumX4 += xi2 * xi2;
      
      sumY += yi;
      sumXY += xi * yi;
      sumX2Y += xi2 * yi;
    }
    
    // Systems of equations matrix: M * [a, b, c]^T = Y
    // Row 1: a*sumX4 + b*sumX3 + c*sumX2 = sumX2Y
    // Row 2: a*sumX3 + b*sumX2 + c*sumX  = sumXY
    // Row 3: a*sumX2 + b*sumX  + c*n     = sumY
    
    const d = this.det3x3([
      [sumX4, sumX3, sumX2],
      [sumX3, sumX2, sumX],
      [sumX2, sumX,  n]
    ]);
    
    if (d === 0) return null; // Singular matrix
    
    const da = this.det3x3([
      [sumX2Y, sumX3, sumX2],
      [sumXY,  sumX2, sumX],
      [sumY,   sumX,  n]
    ]);
    
    const db = this.det3x3([
      [sumX4, sumX2Y, sumX2],
      [sumX3, sumXY,  sumX],
      [sumX2, sumY,   n]
    ]);
    
    const dc = this.det3x3([
      [sumX4, sumX3, sumX2Y],
      [sumX3, sumX2, sumXY],
      [sumX2, sumX,  sumY]
    ]);
    
    const a = da / d;
    const b = db / d;
    const c = dc / d;
    
    // Calculate R2
    const yPreds = x.map(xVal => a * xVal * xVal + b * xVal + c);
    const r2 = this.calculateR2OriginalScale(y, yPreds);
    
    // Quadratic fits degrees of freedom is n - 3 (3 parameters: a, b, c)
    const df = n - 3;
    const fStat = df <= 0 ? 0 : (r2 / 2) / ((1 - r2) / df);
    const pValue = df <= 0 ? 1 : window.AquaMath.fPValue(fStat, 2, df);
    
    return {
      type: "Kuadratik",
      formula: `y = ${a.toFixed(4)}x² + (${b.toFixed(4)})x + (${c.toFixed(4)})`,
      parameters: { a, b, c },
      r2,
      tStat: fStat, // use F-stat for multi-parameters
      df,
      pValue,
      isSignificant: pValue < 0.05,
      predict: (xVal) => a * xVal * xVal + b * xVal + c
    };
  },

  // 3x3 Determinant calculation via Sarrus Rule
  det3x3: function(m) {
    return m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) -
           m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) +
           m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
  },

  calculateR2OriginalScale: function(yObs, yPred) {
    const meanY = window.AquaMath.mean(yObs);
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < yObs.length; i++) {
      ssRes += Math.pow(yObs[i] - yPred[i], 2);
      ssTot += Math.pow(yObs[i] - meanY, 2);
    }
    
    if (ssTot === 0) return 0;
    return 1 - (ssRes / ssTot);
  }
};
