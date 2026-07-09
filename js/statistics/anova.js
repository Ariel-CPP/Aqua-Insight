/* ==========================================================================
   AQUA INSIGHT - STATISTICAL ANOVA & TUKEY HSD ENGINE
   Contains: One-Way ANOVA, Two-Way ANOVA, and Tukey HSD Post-Hoc calculations
   using a Studentized Range Q-Table with linear interpolation.
   ========================================================================== */

window.AquaANOVA = {
  // Studentized Range Q-Table for Alpha = 0.05
  // Index maps: keys are df_Error (degrees of freedom).
  // Array values correspond to k (number of treatments) from 2 to 10.
  // [ k=2, k=3, k=4, k=5, k=6, k=7, k=8, k=9, k=10 ]
  Q_TABLE_05: {
    5:   [3.64, 4.60, 5.22, 5.67, 6.03, 6.33, 6.58, 6.80, 6.99],
    6:   [3.46, 4.34, 4.90, 5.31, 5.63, 5.90, 6.12, 6.32, 6.49],
    7:   [3.34, 4.16, 4.68, 5.06, 5.36, 5.61, 5.82, 6.00, 6.16],
    8:   [3.26, 4.04, 4.53, 4.89, 5.17, 5.40, 5.60, 5.77, 5.92],
    9:   [3.20, 3.95, 4.41, 4.76, 5.02, 5.24, 5.43, 5.59, 5.74],
    10:  [3.15, 3.88, 4.33, 4.65, 4.91, 5.12, 5.30, 5.46, 5.60],
    11:  [3.11, 3.82, 4.26, 4.57, 4.82, 5.03, 5.20, 5.35, 5.49],
    12:  [3.08, 3.77, 4.20, 4.51, 4.75, 4.95, 5.12, 5.27, 5.39],
    13:  [3.06, 3.73, 4.15, 4.45, 4.69, 4.88, 5.05, 5.19, 5.32],
    14:  [3.03, 3.70, 4.11, 4.41, 4.64, 4.83, 4.99, 5.13, 5.25],
    15:  [3.01, 3.67, 4.08, 4.37, 4.59, 4.78, 4.94, 5.08, 5.20],
    16:  [3.00, 3.65, 4.05, 4.33, 4.56, 4.74, 4.90, 5.03, 5.15],
    17:  [2.98, 3.63, 4.02, 4.30, 4.52, 4.70, 4.86, 4.99, 5.11],
    18:  [2.97, 3.61, 4.00, 4.28, 4.49, 4.67, 4.82, 4.96, 5.07],
    19:  [2.96, 3.59, 3.98, 4.25, 4.47, 4.65, 4.79, 4.92, 5.04],
    20:  [2.95, 3.58, 3.96, 4.23, 4.45, 4.62, 4.77, 4.90, 5.01],
    24:  [2.92, 3.53, 3.90, 4.17, 4.37, 4.54, 4.68, 4.81, 4.92],
    30:  [2.89, 3.49, 3.85, 4.10, 4.30, 4.46, 4.60, 4.72, 4.82],
    40:  [2.86, 3.44, 3.79, 4.04, 4.23, 4.39, 4.52, 4.63, 4.73],
    60:  [2.83, 3.40, 3.74, 3.98, 4.16, 4.31, 4.44, 4.55, 4.65],
    120: [2.80, 3.36, 3.68, 3.92, 4.10, 4.24, 4.36, 4.47, 4.56],
    10000: [2.77, 3.31, 3.63, 3.86, 4.03, 4.17, 4.29, 4.39, 4.47] // Represents Infinity
  },

  getStudentizedRangeQ: function(k, df) {
    // k is groups, df is degrees of freedom for error
    const kIdx = Math.min(Math.max(k - 2, 0), 8); // clamp k to 2..10 (indexes 0..8)
    
    // Exact match in table
    if (this.Q_TABLE_05[df]) {
      return this.Q_TABLE_05[df][kIdx];
    }
    
    // Cutoff for infinity
    if (df > 120) {
      return this.Q_TABLE_05[10000][kIdx];
    }
    if (df < 5) {
      // Fallback for extremely small df
      return this.Q_TABLE_05[5][kIdx] + (5 - df) * 0.5;
    }
    
    // Linear interpolation
    const keys = Object.keys(this.Q_TABLE_05).map(Number).sort((a,b)=>a-b);
    let lowerKey = 5;
    let upperKey = 120;
    
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] > df) {
        upperKey = keys[i];
        lowerKey = keys[i-1];
        break;
      }
    }
    
    const valLower = this.Q_TABLE_05[lowerKey][kIdx];
    const valUpper = this.Q_TABLE_05[upperKey][kIdx];
    
    return valLower + ((df - lowerKey) / (upperKey - lowerKey)) * (valUpper - valLower);
  },

  // 1. One-Way ANOVA Calculation
  // groups: Array of Array of Numbers: [[group1], [group2], ...]
  // labels: Array of String representing group names
  oneWayANOVA: function(groups, labels) {
    const k = groups.length;
    if (k < 2) return null;
    
    const N = groups.reduce((acc, g) => acc + g.length, 0);
    const overallMean = window.AquaMath.mean(groups.flat());
    
    // Calculate SS Between
    let ssBetween = 0;
    groups.forEach((g, gIdx) => {
      const gMean = window.AquaMath.mean(g);
      ssBetween += g.length * Math.pow(gMean - overallMean, 2);
    });
    
    // Calculate SS Within (Error)
    let ssWithin = 0;
    groups.forEach((g, gIdx) => {
      const gMean = window.AquaMath.mean(g);
      g.forEach(val => {
        ssWithin += Math.pow(val - gMean, 2);
      });
    });
    
    const df1 = k - 1;
    const df2 = N - k;
    const msBetween = ssBetween / df1;
    const msWithin = ssWithin / df2;
    
    const fStat = msWithin === 0 ? 0 : msBetween / msWithin;
    const pValue = window.AquaMath.fPValue(fStat, df1, df2);
    const ssTotal = ssBetween + ssWithin;
    const dfTotal = N - 1;
    
    const result = {
      ssBetween,
      ssWithin,
      ssTotal,
      dfBetween: df1,
      dfWithin: df2,
      dfTotal,
      msBetween,
      msWithin,
      fStat,
      pValue,
      isSignificant: pValue < 0.05,
      groups: groups.map((g, idx) => ({
        label: labels[idx] || `Kelompok ${idx+1}`,
        mean: window.AquaMath.mean(g),
        sd: window.AquaMath.stdDev(g),
        n: g.length
      }))
    };
    
    // 2. Perform Tukey HSD if ANOVA is significant
    result.tukey = this.calculateTukeyHSD(result, groups, labels);
    
    return result;
  },

  calculateTukeyHSD: function(anovaResult, groups, labels) {
    const k = groups.length;
    const df = anovaResult.dfWithin;
    const msWithin = anovaResult.msWithin;
    
    // Critical q value from table
    const qCrit = this.getStudentizedRangeQ(k, df);
    const comparisons = [];
    
    // Pairwise comparisons
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const mean1 = anovaResult.groups[i].mean;
        const mean2 = anovaResult.groups[j].mean;
        const n1 = anovaResult.groups[i].n;
        const n2 = anovaResult.groups[j].n;
        
        // standard error for unequal sizes (harmonic mean like standard)
        const se = Math.sqrt((msWithin / 2) * (1/n1 + 1/n2));
        const diff = Math.abs(mean1 - mean2);
        
        // Tukey q stat
        const qStat = se === 0 ? 0 : diff / se;
        const criticalDifference = qCrit * se;
        
        comparisons.push({
          group1: labels[i] || `Kelompok ${i+1}`,
          group2: labels[j] || `Kelompok ${j+1}`,
          difference: mean1 - mean2,
          absDifference: diff,
          criticalDifference,
          qStat,
          se,
          isSignificant: diff >= criticalDifference
        });
      }
    }
    
    return {
      qCritical: qCrit,
      comparisons
    };
  },

  // 3. Two-Way ANOVA (With and Without Interaction)
  // rowFactorData: Array of factor A levels for each row in the dataset
  // colFactorData: Array of factor B levels for each row in the dataset
  // values: Array of numeric outcomes
  twoWayANOVA: function(factorALevels, factorBLevels, values, includeInteraction = true) {
    const N = values.length;
    if (N < 4) return null;
    
    // Get unique levels
    const levelsA = [...new Set(factorALevels)].sort();
    const levelsB = [...new Set(factorBLevels)].sort();
    
    const a = levelsA.length;
    const b = levelsB.length;
    
    if (a < 2 || b < 2) return null;
    
    const overallMean = window.AquaMath.mean(values);
    
    // Sum of Squares Total
    let ssTotal = 0;
    values.forEach(v => {
      ssTotal += Math.pow(v - overallMean, 2);
    });
    
    // Group values by Factor A, Factor B, and Cell(A, B)
    const dataByA = {};
    const dataByB = {};
    const dataByCell = {};
    
    levelsA.forEach(la => dataByA[la] = []);
    levelsB.forEach(lb => dataByB[lb] = []);
    levelsA.forEach(la => {
      levelsB.forEach(lb => {
        dataByCell[`${la}_${lb}`] = [];
      });
    });
    
    for (let i = 0; i < N; i++) {
      const la = factorALevels[i];
      const lb = factorBLevels[i];
      const val = values[i];
      
      if (dataByA[la]) dataByA[la].push(val);
      if (dataByB[lb]) dataByB[lb].push(val);
      if (dataByCell[`${la}_${lb}`]) dataByCell[`${la}_${lb}`].push(val);
    }
    
    // SS Factor A (Row Factor)
    let ssA = 0;
    levelsA.forEach(la => {
      const avgA = window.AquaMath.mean(dataByA[la]);
      ssA += dataByA[la].length * Math.pow(avgA - overallMean, 2);
    });
    
    // SS Factor B (Column Factor)
    let ssB = 0;
    levelsB.forEach(lb => {
      const avgB = window.AquaMath.mean(dataByB[lb]);
      ssB += dataByB[lb].length * Math.pow(avgB - overallMean, 2);
    });
    
    let ssCells = 0;
    levelsA.forEach(la => {
      levelsB.forEach(lb => {
        const cellData = dataByCell[`${la}_${lb}`];
        if (cellData.length > 0) {
          const avgCell = window.AquaMath.mean(cellData);
          ssCells += cellData.length * Math.pow(avgCell - overallMean, 2);
        }
      });
    });
    
    let ssAB = ssCells - ssA - ssB; // Interaction Sum of Squares
    let ssError = 0;
    
    // SS Within/Error calculation
    levelsA.forEach(la => {
      levelsB.forEach(lb => {
        const cellData = dataByCell[`${la}_${lb}`];
        if (cellData.length > 0) {
          const avgCell = window.AquaMath.mean(cellData);
          cellData.forEach(v => {
            ssError += Math.pow(v - avgCell, 2);
          });
        }
      });
    });
    
    // Adjust logic if no cell replicates (no interaction can be calculated)
    const dfA = a - 1;
    const dfB = b - 1;
    let dfAB, dfError;
    let msA, msB, msAB, msError;
    let fA, fB, fAB;
    let pA, pB, pAB;
    
    const cellCounts = Object.values(dataByCell).map(c => c.length);
    const minCellCount = Math.min(...cellCounts);
    
    if (minCellCount <= 1 || !includeInteraction) {
      // Add interaction back to error since we assume no interaction or can't compute it
      ssError = ssTotal - ssA - ssB;
      dfAB = 0;
      dfError = N - a - b + 1;
      
      msA = ssA / dfA;
      msB = ssB / dfB;
      msError = ssError / dfError;
      
      fA = msError === 0 ? 0 : msA / msError;
      fB = msError === 0 ? 0 : msB / msError;
      
      pA = window.AquaMath.fPValue(fA, dfA, dfError);
      pB = window.AquaMath.fPValue(fB, dfB, dfError);
      
      return {
        hasInteraction: false,
        factorA: { ss: ssA, df: dfA, ms: msA, fStat: fA, pValue: pA, isSignificant: pA < 0.05 },
        factorB: { ss: ssB, df: dfB, ms: msB, fStat: fB, pValue: pB, isSignificant: pB < 0.05 },
        interaction: null,
        error: { ss: ssError, df: dfError, ms: msError },
        total: { ss: ssTotal, df: N - 1 }
      };
    } else {
      dfAB = dfA * dfB;
      dfError = N - (a * b);
      
      msA = ssA / dfA;
      msB = ssB / dfB;
      msAB = ssAB / dfAB;
      msError = ssError / dfError;
      
      fA = msError === 0 ? 0 : msA / msError;
      fB = msError === 0 ? 0 : msB / msError;
      fAB = msError === 0 ? 0 : msAB / msError;
      
      pA = window.AquaMath.fPValue(fA, dfA, dfError);
      pB = window.AquaMath.fPValue(fB, dfB, dfError);
      pAB = window.AquaMath.fPValue(fAB, dfAB, dfError);
      
      return {
        hasInteraction: true,
        factorA: { ss: ssA, df: dfA, ms: msA, fStat: fA, pValue: pA, isSignificant: pA < 0.05 },
        factorB: { ss: ssB, df: dfB, ms: msB, fStat: fB, pValue: pB, isSignificant: pB < 0.05 },
        interaction: { ss: ssAB, df: dfAB, ms: msAB, fStat: fAB, pValue: pAB, isSignificant: pAB < 0.05 },
        error: { ss: ssError, df: dfError, ms: msError },
        total: { ss: ssTotal, df: N - 1 }
      };
    }
  }
};
